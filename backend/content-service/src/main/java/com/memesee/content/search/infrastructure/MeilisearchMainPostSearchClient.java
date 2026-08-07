package com.memesee.content.search.infrastructure;

import com.fasterxml.jackson.databind.JsonNode;
import com.memesee.content.search.application.MainPostSearchDocument;
import com.memesee.content.search.application.MainPostSearchIndexer;
import com.memesee.content.search.application.MainPostSearchQueryService;
import com.memesee.content.search.application.MainPostSearchRequest;
import com.memesee.content.search.application.MainPostSearchResult;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestClientResponseException;

@Component
public class MeilisearchMainPostSearchClient implements MainPostSearchIndexer, MainPostSearchQueryService {

    private static final String PRIMARY_KEY = "mainPostId";
    private static final long TASK_POLL_INTERVAL_MILLIS = 100L;
    private static final long TASK_TIMEOUT_MILLIS = 10_000L;
    private static final List<String> FILTERABLE_ATTRIBUTES = List.of("communitySlug", "authorUsername", "tags");
    private static final List<String> SORTABLE_ATTRIBUTES = List.of(
            "latestActivityAt",
            "heatScore",
            "viewCount",
            "createdAt",
            "mainPostId"
    );
    private static final List<String> SEARCHABLE_ATTRIBUTES = List.of(
            "title",
            "content",
            "tags",
            "authorUsername",
            "communityName"
    );

    private final RestClient restClient;
    private final String indexUid;
    private volatile boolean configured;

    public MeilisearchMainPostSearchClient(
            RestClient.Builder restClientBuilder,
            @Value("${app.search.meilisearch.url:http://localhost:7700}") String meilisearchUrl,
            @Value("${app.search.meilisearch.api-key:memesee_master_key}") String meilisearchApiKey,
            @Value("${app.search.meilisearch.index-uid:main-posts}") String indexUid
    ) {
        RestClient.Builder builder = restClientBuilder
                .baseUrl(meilisearchUrl)
                .defaultHeader("Accept", MediaType.APPLICATION_JSON_VALUE)
                .defaultHeader("Content-Type", MediaType.APPLICATION_JSON_VALUE);
        if (StringUtils.hasText(meilisearchApiKey)) {
            String normalizedApiKey = meilisearchApiKey.trim();
            builder.defaultHeader("Authorization", "Bearer " + normalizedApiKey);
            builder.defaultHeader("X-Meili-API-Key", normalizedApiKey);
        }
        this.restClient = builder.build();
        this.indexUid = indexUid;
    }

    @Override
    public void upsert(MainPostSearchDocument document) {
        upsertAll(List.of(document));
    }

    @Override
    public void upsertAll(List<MainPostSearchDocument> documents) {
        if (documents == null || documents.isEmpty()) {
            return;
        }
        ensureConfigured();
        try {
            JsonNode response = restClient.post()
                    .uri(uriBuilder -> uriBuilder
                            .path("/indexes/{indexUid}/documents")
                            .queryParam("primaryKey", PRIMARY_KEY)
                            .build(indexUid))
                    .body(documents)
                    .retrieve()
                    .body(JsonNode.class);
            waitForTask(response);
        } catch (RestClientException error) {
            throw new IllegalStateException("Failed to upsert main-post document to Meilisearch.", error);
        }
    }

    @Override
    public void delete(Long mainPostId) {
        ensureConfigured();
        try {
            JsonNode response = restClient.delete()
                    .uri("/indexes/{indexUid}/documents/{mainPostId}", indexUid, mainPostId)
                    .retrieve()
                    .body(JsonNode.class);
            waitForTask(response);
        } catch (RestClientException error) {
            throw new IllegalStateException("Failed to delete main-post document from Meilisearch.", error);
        }
    }

    @Override
    public MainPostSearchResult search(MainPostSearchRequest request) {
        if (request == null || !StringUtils.hasText(request.keyword())) {
            return new MainPostSearchResult(List.of(), 0L);
        }
        ensureConfigured();
        try {
            JsonNode response = restClient.post()
                    .uri("/indexes/{indexUid}/search", indexUid)
                    .body(buildSearchBody(request))
                    .retrieve()
                    .body(JsonNode.class);
            return toSearchResult(response);
        } catch (RestClientException error) {
            throw new IllegalStateException("Failed to query main-post documents from Meilisearch.", error);
        }
    }

    @Override
    public void clearAll() {
        ensureConfigured();
        try {
            JsonNode response = restClient.delete()
                    .uri("/indexes/{indexUid}/documents", indexUid)
                    .retrieve()
                    .body(JsonNode.class);
            waitForTask(response);
        } catch (RestClientException error) {
            throw new IllegalStateException("Failed to clear main-post documents from Meilisearch.", error);
        }
    }

    private Map<String, Object> buildSearchBody(MainPostSearchRequest request) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("q", request.keyword().trim());
        body.put("offset", Math.max(0, request.offset()));
        body.put("limit", Math.max(1, request.limit()));
        body.put("attributesToRetrieve", List.of("mainPostId"));
        body.put("sort", toSort(request.sortMode()));

        if (StringUtils.hasText(request.communitySlug())) {
            body.put("filter", "communitySlug = \"" + escapeFilterValue(request.communitySlug().trim()) + "\"");
        }
        return body;
    }

    private List<String> toSort(String sortMode) {
        if ("MOST_VIEWS".equalsIgnoreCase(sortMode) || "most_views".equalsIgnoreCase(sortMode)) {
            return List.of("viewCount:desc", "createdAt:desc", "mainPostId:desc");
        }
        if ("MOST_HEAT".equalsIgnoreCase(sortMode) || "most_heat".equalsIgnoreCase(sortMode)) {
            return List.of("heatScore:desc", "createdAt:desc", "mainPostId:desc");
        }
        return List.of("latestActivityAt:desc", "mainPostId:desc");
    }

    private MainPostSearchResult toSearchResult(JsonNode response) {
        List<Long> mainPostIds = new ArrayList<>();
        JsonNode hits = response == null ? null : response.path("hits");
        if (hits != null && hits.isArray()) {
            for (JsonNode hit : hits) {
                JsonNode mainPostIdNode = hit.get("mainPostId");
                if (mainPostIdNode != null && mainPostIdNode.canConvertToLong()) {
                    mainPostIds.add(mainPostIdNode.asLong());
                }
            }
        }

        long totalHits = 0L;
        if (response != null) {
            JsonNode totalHitsNode = response.get("totalHits");
            if (totalHitsNode != null && totalHitsNode.canConvertToLong()) {
                totalHits = totalHitsNode.asLong();
            } else {
                JsonNode estimatedTotalHitsNode = response.get("estimatedTotalHits");
                if (estimatedTotalHitsNode != null && estimatedTotalHitsNode.canConvertToLong()) {
                    totalHits = estimatedTotalHitsNode.asLong();
                }
            }
        }
        return new MainPostSearchResult(mainPostIds, totalHits);
    }

    private void ensureConfigured() {
        if (configured) {
            return;
        }
        synchronized (this) {
            if (configured) {
                return;
            }
            try {
                ensureIndexExists();
                JsonNode searchableTask = restClient.put()
                        .uri("/indexes/{indexUid}/settings/searchable-attributes", indexUid)
                        .body(SEARCHABLE_ATTRIBUTES)
                        .retrieve()
                        .body(JsonNode.class);
                waitForTask(searchableTask);
                JsonNode filterableTask = restClient.put()
                        .uri("/indexes/{indexUid}/settings/filterable-attributes", indexUid)
                        .body(FILTERABLE_ATTRIBUTES)
                        .retrieve()
                        .body(JsonNode.class);
                waitForTask(filterableTask);
                JsonNode sortableTask = restClient.put()
                        .uri("/indexes/{indexUid}/settings/sortable-attributes", indexUid)
                        .body(SORTABLE_ATTRIBUTES)
                        .retrieve()
                        .body(JsonNode.class);
                waitForTask(sortableTask);
                configured = true;
            } catch (RestClientException error) {
                throw new IllegalStateException("Failed to configure Meilisearch main-post index.", error);
            }
        }
    }

    private String escapeFilterValue(String value) {
        return value.replace("\\", "\\\\").replace("\"", "\\\"");
    }

    private void ensureIndexExists() {
        try {
            restClient.get()
                    .uri("/indexes/{indexUid}", indexUid)
                    .retrieve()
                    .toBodilessEntity();
            return;
        } catch (RestClientResponseException error) {
            if (error.getStatusCode() != HttpStatus.NOT_FOUND) {
                throw error;
            }
        }
        JsonNode response = restClient.post()
                .uri("/indexes")
                .body(Map.of("uid", indexUid, "primaryKey", PRIMARY_KEY))
                .retrieve()
                .body(JsonNode.class);
        waitForTask(response);
    }

    private void waitForTask(JsonNode response) {
        Long taskUid = taskUid(response);
        if (taskUid == null) {
            return;
        }
        long deadline = System.currentTimeMillis() + TASK_TIMEOUT_MILLIS;
        while (System.currentTimeMillis() <= deadline) {
            JsonNode task = restClient.get()
                    .uri("/tasks/{taskUid}", taskUid)
                    .retrieve()
                    .body(JsonNode.class);
            String status = task == null ? "" : task.path("status").asText("");
            if ("succeeded".equals(status)) {
                return;
            }
            if ("failed".equals(status) || "canceled".equals(status)) {
                String message = task == null ? "unknown task failure" : task.toString();
                throw new IllegalStateException("Meilisearch task did not succeed: " + message);
            }
            sleepBeforeNextPoll();
        }
        throw new IllegalStateException("Timed out waiting for Meilisearch task " + taskUid + ".");
    }

    private Long taskUid(JsonNode response) {
        if (response == null) {
            return null;
        }
        JsonNode taskUid = response.get("taskUid");
        if (taskUid != null && taskUid.canConvertToLong()) {
            return taskUid.asLong();
        }
        JsonNode uid = response.get("uid");
        if (uid != null && uid.canConvertToLong()) {
            return uid.asLong();
        }
        return null;
    }

    private void sleepBeforeNextPoll() {
        try {
            Thread.sleep(TASK_POLL_INTERVAL_MILLIS);
        } catch (InterruptedException error) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("Interrupted while waiting for Meilisearch task.", error);
        }
    }
}
