package com.memesee.content.mainpost.share;

import static org.assertj.core.api.Assertions.assertThat;

import com.memesee.content.mainpost.application.MainPostQueryApplicationService;
import com.memesee.content.mainpost.dto.MainPostDetailMediaAssetResponse;
import com.memesee.content.mainpost.dto.MainPostDetailResponse;
import com.memesee.content.media.application.SubPostMediaCollaborationApplicationService;
import com.memesee.content.media.dto.MediaAssetResponse;
import com.memesee.content.subpost.application.SubPostApplicationSupport;
import com.memesee.content.subpost.domain.SubPost;
import com.memesee.platform.error.ApiErrorCode;
import com.memesee.platform.error.ApiException;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import java.lang.reflect.Field;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.mock.web.MockHttpServletRequest;

class MainPostShareHtmlServiceTest {

    private final RecordingMainPostQueryApplicationService queryService = new RecordingMainPostQueryApplicationService();
    private final RecordingSubPostApplicationSupport subPostSupport = new RecordingSubPostApplicationSupport();
    private final RecordingSubPostMediaCollaborationApplicationService subPostMediaService =
            new RecordingSubPostMediaCollaborationApplicationService();
    private final SimpleMeterRegistry meterRegistry = new SimpleMeterRegistry();
    private final MainPostShareHtmlService service = new MainPostShareHtmlService(
            queryService,
            subPostSupport,
            subPostMediaService,
            new MainPostShareHtmlTelemetry(meterRegistry)
    );

    @Test
    void rendersCrawlerReadableHtmlWithoutRecordingView() {
        queryService.response = post(
                "  <梗图标题>  ",
                "第一行\n\n第二行 <script>alert(1)</script>",
                List.of(new MainPostDetailMediaAssetResponse(
                        7L,
                        "asset-7",
                        "IMAGE",
                        "/media/original.jpg",
                        "/media/thumb.jpg",
                        "/media/small.jpg",
                        "/media/medium.jpg",
                        "/media/display.jpg",
                        "/media/raw.jpg",
                        1280,
                        720,
                        "READY",
                        null,
                        List.of()
                ))
        );
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/share/posts/42");
        request.addHeader("X-Forwarded-Proto", "https");
        request.addHeader("X-Forwarded-Host", "memesee.world");

        String html = service.render(42L, null, request);

        assertThat(queryService.requestedMainPostId).isEqualTo(42L);
        assertThat(queryService.requestedAuthorizationHeader).isNull();
        assertThat(queryService.requestedTrackView).isFalse();
        assertThat(html).contains("<meta property=\"og:type\" content=\"article\">");
        assertThat(html).contains("<meta property=\"og:title\" content=\"&lt;梗图标题&gt;\">");
        assertThat(html).contains("<meta name=\"description\" content=\"第一行 第二行 &lt;script&gt;alert(1)&lt;/script&gt;\">");
        assertThat(html).contains("<meta property=\"og:url\" content=\"https://memesee.world/posts/42\">");
        assertThat(html).contains("<meta property=\"og:image\" content=\"https://memesee.world/media/display.jpg\">");
        assertThat(html).contains("<meta property=\"og:image:width\" content=\"1280\">");
        assertThat(html).contains("<script>location.replace('https://memesee.world/posts/42');</script>");
        assertThat(renderCounter("main_post", "success", "main_post")).isEqualTo(1.0);
    }

    @Test
    void fallsBackToDefaultImageAndSafeOriginWhenHeadersAreInvalid() {
        queryService.response = post(
                "",
                "",
                List.of(new MainPostDetailMediaAssetResponse(
                        7L,
                        "asset-7",
                        "IMAGE",
                        "/media/display.jpg",
                        null,
                        null,
                        null,
                        "/media/display.jpg",
                        null,
                        1280,
                        720,
                        "PROCESSING",
                        null,
                        List.of()
                ))
        );
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/share/posts/42");
        request.addHeader("X-Forwarded-Proto", "javascript");
        request.addHeader("X-Forwarded-Host", "bad host\"><script>");

        String html = service.render(42L, null, request);

        assertThat(html).contains("<meta property=\"og:title\" content=\"MemeSee 帖子 #42\">");
        assertThat(html).contains("<meta property=\"og:description\" content=\"来自 @alice 在 梗图 发布的 MemeSee 帖子。\">");
        assertThat(html).contains("<meta property=\"og:url\" content=\"https://memesee.world/posts/42\">");
        assertThat(html).contains("<meta property=\"og:image\" content=\"https://memesee.world/og-image.png\">");
        assertThat(html).contains("<meta property=\"og:image:width\" content=\"1200\">");
        assertThat(html).contains("<meta property=\"og:image:height\" content=\"630\">");
        assertThat(renderCounter("main_post", "success", "default")).isEqualTo(1.0);
    }

    @Test
    void rendersTargetSubPostMetadataAndPrefersSubPostImage() {
        queryService.response = post(
                "主帖标题",
                "主帖正文",
                List.of(new MainPostDetailMediaAssetResponse(
                        7L,
                        "asset-7",
                        "IMAGE",
                        "/media/main.jpg",
                        null,
                        null,
                        null,
                        "/media/main.jpg",
                        null,
                        1200,
                        630,
                        "READY",
                        null,
                        List.of()
                ))
        );
        subPostSupport.response = subPost(99L, 42L, "@bob", " 子帖正文\n带换行 ");
        subPostMediaService.mediaBySubPostId = Map.of(99L, List.of(new MediaAssetResponse(
                17L,
                "asset-17",
                "IMAGE",
                "/media/sub-original.jpg",
                "/media/sub-thumb.jpg",
                "/media/sub-small.jpg",
                "/media/sub-medium.jpg",
                "/media/sub-display.jpg",
                "/media/sub-raw.jpg",
                "image/jpeg",
                "sub.jpg",
                100,
                640,
                360,
                "READY",
                null,
                List.of()
        )));
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/share/posts/42");
        request.addHeader("X-Forwarded-Proto", "https");
        request.addHeader("X-Forwarded-Host", "memesee.world");

        String html = service.render(42L, "99", request);

        assertThat(subPostSupport.requestedSubPostId).isEqualTo(99L);
        assertThat(subPostMediaService.requestedSubPostIds).containsExactly(99L);
        assertThat(html).contains("<meta property=\"og:title\" content=\"主帖标题 &middot; @bob 的子帖\">");
        assertThat(html).contains("<meta property=\"og:description\" content=\"定位到子帖 #99：子帖正文 带换行\">");
        assertThat(html).contains("<meta property=\"og:url\" content=\"https://memesee.world/posts/42?subPost=99\">");
        assertThat(html).contains("<meta property=\"og:image\" content=\"https://memesee.world/media/sub-display.jpg\">");
        assertThat(html).contains("<meta property=\"og:image:alt\" content=\"MemeSee 子帖图片\">");
        assertThat(html).contains("<script>location.replace('https://memesee.world/posts/42?subPost=99');</script>");
        assertThat(renderCounter("sub_post", "success", "sub_post")).isEqualTo(1.0);
        assertThat(renderTimerCount("sub_post", "success", "sub_post")).isEqualTo(1L);
    }

    @Test
    void rendersMediaOnlyTargetSubPostDescriptionForShareCards() {
        queryService.response = post(
                "主帖标题",
                "主帖正文",
                List.of()
        );
        subPostSupport.response = subPost(99L, 42L, "bob", "");
        subPostMediaService.mediaBySubPostId = Map.of(99L, List.of(new MediaAssetResponse(
                17L,
                "asset-17",
                "IMAGE",
                "/media/sub-original.jpg",
                "/media/sub-thumb.jpg",
                "/media/sub-small.jpg",
                "/media/sub-medium.jpg",
                "/media/sub-display.jpg",
                "/media/sub-raw.jpg",
                "image/jpeg",
                "sub.jpg",
                100,
                640,
                360,
                "READY",
                null,
                List.of()
        )));
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/share/posts/42");
        request.addHeader("X-Forwarded-Proto", "https");
        request.addHeader("X-Forwarded-Host", "memesee.world");

        String html = service.render(42L, "99", request);

        assertThat(html).contains("<meta property=\"og:title\" content=\"主帖标题 &middot; @bob 的子帖\">");
        assertThat(html).contains("<meta name=\"description\" content=\"定位到子帖 #99：1 张图片\">");
        assertThat(html).contains("<meta property=\"og:description\" content=\"定位到子帖 #99：1 张图片\">");
        assertThat(html).contains("<meta name=\"twitter:description\" content=\"定位到子帖 #99：1 张图片\">");
        assertThat(html).contains("<meta property=\"og:image\" content=\"https://memesee.world/media/sub-display.jpg\">");
        assertThat(renderCounter("sub_post", "success", "sub_post")).isEqualTo(1.0);
    }

    @Test
    void rendersMediaOnlyMainPostDescriptionForShareCards() {
        queryService.response = post(
                "主帖标题",
                "",
                List.of(new MainPostDetailMediaAssetResponse(
                        7L,
                        "asset-7",
                        "IMAGE",
                        "/media/main-original.jpg",
                        "/media/main-thumb.jpg",
                        "/media/main-small.jpg",
                        "/media/main-medium.jpg",
                        "/media/main-display.jpg",
                        "/media/main-raw.jpg",
                        1280,
                        720,
                        "READY",
                        null,
                        List.of()
                ))
        );
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/share/posts/42");
        request.addHeader("X-Forwarded-Proto", "https");
        request.addHeader("X-Forwarded-Host", "memesee.world");

        String html = service.render(42L, null, request);

        assertThat(html).contains("<meta name=\"description\" content=\"1 张图片 &middot; MemeSee 帖子\">");
        assertThat(html).contains("<meta property=\"og:description\" content=\"1 张图片 &middot; MemeSee 帖子\">");
        assertThat(html).contains("<meta property=\"og:image\" content=\"https://memesee.world/media/main-display.jpg\">");
    }

    @Test
    void usesMediaSummaryWhenTargetSubPostOnlyHasMarkdownImageText() {
        queryService.response = post(
                "主帖标题",
                "主帖正文",
                List.of()
        );
        subPostSupport.response = subPost(99L, 42L, "bob", "![图片](media:17)");
        subPostMediaService.mediaBySubPostId = Map.of(99L, List.of(new MediaAssetResponse(
                17L,
                "asset-17",
                "IMAGE",
                "/media/sub-original.jpg",
                "/media/sub-thumb.jpg",
                "/media/sub-small.jpg",
                "/media/sub-medium.jpg",
                "/media/sub-display.jpg",
                "/media/sub-raw.jpg",
                "image/jpeg",
                "sub.jpg",
                100,
                640,
                360,
                "READY",
                null,
                List.of()
        )));
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/share/posts/42");
        request.addHeader("X-Forwarded-Proto", "https");
        request.addHeader("X-Forwarded-Host", "memesee.world");

        String html = service.render(42L, "99", request);

        assertThat(html).contains("<meta property=\"og:description\" content=\"定位到子帖 #99：1 张图片\">");
        assertThat(html).doesNotContain("![图片]");
    }

    @Test
    void fallsBackToMainPostMetadataWhenTargetSubPostDoesNotBelongToMainPost() {
        queryService.response = post("主帖标题", "主帖正文", List.of());
        subPostSupport.response = subPost(99L, 777L, "bob", "其它主帖里的子帖");
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/share/posts/42");
        request.addHeader("X-Forwarded-Proto", "https");
        request.addHeader("X-Forwarded-Host", "memesee.world");

        String html = service.render(42L, "99", request);

        assertThat(html).contains("<meta property=\"og:title\" content=\"主帖标题\">");
        assertThat(html).contains("<meta property=\"og:url\" content=\"https://memesee.world/posts/42\">");
        assertThat(html).doesNotContain("subPost=99");
        assertThat(subPostMediaService.requestedSubPostIds).isEmpty();
        assertThat(renderCounter("main_post", "sub_post_cross_post", "default")).isEqualTo(1.0);
    }

    @Test
    void ignoresInvalidTargetSubPostQueryValue() {
        queryService.response = post("主帖标题", "主帖正文", List.of());
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/share/posts/42");
        request.addHeader("X-Forwarded-Proto", "https");
        request.addHeader("X-Forwarded-Host", "memesee.world");

        String html = service.render(42L, "abc", request);

        assertThat(subPostSupport.requestedSubPostId).isNull();
        assertThat(html).contains("<meta property=\"og:url\" content=\"https://memesee.world/posts/42\">");
        assertThat(html).doesNotContain("subPost=");
        assertThat(renderCounter("main_post", "invalid_sub_post_query", "default")).isEqualTo(1.0);
    }

    @Test
    void recordsSubPostNotFoundFallbackWithoutLoadingMedia() {
        queryService.response = post("主帖标题", "主帖正文", List.of());
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/share/posts/42");
        request.addHeader("X-Forwarded-Proto", "https");
        request.addHeader("X-Forwarded-Host", "memesee.world");

        String html = service.render(42L, "99", request);

        assertThat(subPostSupport.requestedSubPostId).isEqualTo(99L);
        assertThat(subPostMediaService.requestedSubPostIds).isEmpty();
        assertThat(html).contains("<meta property=\"og:url\" content=\"https://memesee.world/posts/42\">");
        assertThat(renderCounter("main_post", "sub_post_not_found", "default")).isEqualTo(1.0);
    }

    @Test
    void rendersNoIndexFallbackWhenMainPostIsUnavailable() {
        queryService.error = new ApiException(
                HttpStatus.NOT_FOUND,
                ApiErrorCode.RESOURCE_NOT_FOUND,
                "主帖不存在。"
        );
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/share/posts/42");
        request.addHeader("X-Forwarded-Proto", "https");
        request.addHeader("X-Forwarded-Host", "memesee.world");

        String html = service.render(42L, "99", request);

        assertThat(html).contains("<title>主帖已不可用 | MemeSee</title>");
        assertThat(html).contains("<meta name=\"robots\" content=\"noindex,nofollow\">");
        assertThat(html).contains("<meta property=\"og:title\" content=\"主帖已不可用\">");
        assertThat(html).contains("<meta property=\"og:description\" content=\"这条 MemeSee 内容可能已经被删除，或链接里的帖子编号不存在。\">");
        assertThat(html).contains("<meta property=\"og:url\" content=\"https://memesee.world/posts/42\">");
        assertThat(html).contains("<meta property=\"og:image\" content=\"https://memesee.world/og-image.png\">");
        assertThat(html).contains("<script>location.replace('https://memesee.world/posts/42');</script>");
        assertThat(subPostSupport.requestedSubPostId).isNull();
        assertThat(renderCounter("main_post", "main_post_not_found", "default")).isEqualTo(1.0);
    }

    private MainPostDetailResponse post(
            String title,
            String content,
            List<MainPostDetailMediaAssetResponse> mediaAssets
    ) {
        return new MainPostDetailResponse(
                42L,
                "memes",
                "梗图",
                title,
                content,
                "rich",
                "alice",
                Instant.parse("2026-01-01T00:00:00Z"),
                Instant.parse("2026-01-01T00:00:00Z"),
                Instant.parse("2026-01-01T00:00:00Z"),
                BigDecimal.ZERO,
                10,
                2,
                3,
                4,
                false,
                false,
                mediaAssets,
                List.of("tag")
        );
    }

    private SubPost subPost(Long id, Long mainPostId, String authorUsername, String content) {
        SubPost subPost = new SubPost(mainPostId, null, authorUsername, content);
        writeField(subPost, "id", id);
        writeField(subPost, "createdAt", Instant.parse("2026-01-02T00:00:00Z"));
        writeField(subPost, "updatedAt", Instant.parse("2026-01-02T00:00:00Z"));
        return subPost;
    }

    private void writeField(Object target, String fieldName, Object value) {
        try {
            Field field = target.getClass().getDeclaredField(fieldName);
            field.setAccessible(true);
            field.set(target, value);
        } catch (ReflectiveOperationException error) {
            throw new IllegalStateException("Failed to set test field " + fieldName, error);
        }
    }

    private double renderCounter(String target, String outcome, String image) {
        return meterRegistry.find(MainPostShareHtmlTelemetry.RENDER_TOTAL_METRIC_NAME)
                .tag("target", target)
                .tag("outcome", outcome)
                .tag("image", image)
                .counter()
                .count();
    }

    private long renderTimerCount(String target, String outcome, String image) {
        return meterRegistry.find(MainPostShareHtmlTelemetry.RENDER_DURATION_METRIC_NAME)
                .tag("target", target)
                .tag("outcome", outcome)
                .tag("image", image)
                .timer()
                .count();
    }

    private static class RecordingMainPostQueryApplicationService extends MainPostQueryApplicationService {

        private MainPostDetailResponse response;
        private RuntimeException error;
        private Long requestedMainPostId;
        private String requestedAuthorizationHeader;
        private Boolean requestedTrackView;

        private RecordingMainPostQueryApplicationService() {
            super(null, null, null, null);
        }

        @Override
        public MainPostDetailResponse getMainPost(Long mainPostId, String authorizationHeader, boolean trackView) {
            this.requestedMainPostId = mainPostId;
            this.requestedAuthorizationHeader = authorizationHeader;
            this.requestedTrackView = trackView;
            if (error != null) {
                throw error;
            }
            return response;
        }
    }

    private static class RecordingSubPostApplicationSupport extends SubPostApplicationSupport {

        private SubPost response;
        private Long requestedSubPostId;

        private RecordingSubPostApplicationSupport() {
            super(null, null);
        }

        @Override
        public SubPost requireActiveSubPost(Long subPostId) {
            this.requestedSubPostId = subPostId;
            if (response == null) {
                throw new ApiException(
                        HttpStatus.NOT_FOUND,
                        ApiErrorCode.RESOURCE_NOT_FOUND,
                        "子帖不存在。"
                );
            }
            return response;
        }
    }

    private static class RecordingSubPostMediaCollaborationApplicationService
            implements SubPostMediaCollaborationApplicationService {

        private Map<Long, List<MediaAssetResponse>> mediaBySubPostId = Map.of();
        private List<Long> requestedSubPostIds = List.of();

        @Override
        public Map<Long, List<MediaAssetResponse>> resolveSubPostMedia(Collection<SubPost> subPosts) {
            return mediaBySubPostId;
        }

        @Override
        public Map<Long, List<MediaAssetResponse>> resolveSubPostMediaByIds(Collection<Long> subPostIds) {
            this.requestedSubPostIds = subPostIds == null ? List.of() : List.copyOf(subPostIds);
            return mediaBySubPostId;
        }
    }
}
