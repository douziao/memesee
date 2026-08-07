package com.memesee.content.interaction.infrastructure;

import com.memesee.content.community.dto.CommunityResponse;
import com.memesee.content.community.domain.Community;
import com.memesee.content.community.infrastructure.CommunityCatalogCache;
import com.memesee.content.community.infrastructure.CommunityRepository;
import com.memesee.content.interaction.application.InteractionListProjectionPort;
import com.memesee.content.mainpost.domain.MainPost;
import com.memesee.content.mainpost.infrastructure.MainPostRepository;
import com.memesee.content.subpost.domain.SubPost;
import com.memesee.content.subpost.infrastructure.SubPostRepository;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;

@Service
@ConditionalOnProperty(prefix = "app.projection.interaction-list", name = "mode", havingValue = "jpa")
public class JpaInteractionListProjectionPort implements InteractionListProjectionPort {

    private static final int SUB_POST_PREVIEW_LIMIT = 120;

    private final MainPostLikeRepository mainPostLikeRepository;
    private final MainPostFavoriteRepository mainPostFavoriteRepository;
    private final SubPostLikeRepository subPostLikeRepository;
    private final SubPostFavoriteRepository subPostFavoriteRepository;
    private final MainPostRepository mainPostRepository;
    private final SubPostRepository subPostRepository;
    private final CommunityRepository communityRepository;
    private final CommunityCatalogCache communityCatalogCache;

    public JpaInteractionListProjectionPort(
            MainPostLikeRepository mainPostLikeRepository,
            MainPostFavoriteRepository mainPostFavoriteRepository,
            SubPostLikeRepository subPostLikeRepository,
            SubPostFavoriteRepository subPostFavoriteRepository,
            MainPostRepository mainPostRepository,
            SubPostRepository subPostRepository,
            CommunityRepository communityRepository,
            CommunityCatalogCache communityCatalogCache
    ) {
        this.mainPostLikeRepository = mainPostLikeRepository;
        this.mainPostFavoriteRepository = mainPostFavoriteRepository;
        this.subPostLikeRepository = subPostLikeRepository;
        this.subPostFavoriteRepository = subPostFavoriteRepository;
        this.mainPostRepository = mainPostRepository;
        this.subPostRepository = subPostRepository;
        this.communityRepository = communityRepository;
        this.communityCatalogCache = communityCatalogCache;
    }

    @Override
    public InteractionListProjection loadInteractionList(String username, int limit) {
        PageRequest limitPage = PageRequest.of(0, limit);

        List<PostInteractionRow> postRows = new ArrayList<>();
        mainPostLikeRepository.findAllByUsernameOrderByCreatedAtDesc(username, limitPage)
                .forEach(like -> postRows.add(new PostInteractionRow(like.getMainPostId(), like.getCreatedAt(), "like")));
        mainPostFavoriteRepository.findAllByUsernameOrderByCreatedAtDesc(username, limitPage)
                .forEach(favorite -> postRows.add(new PostInteractionRow(
                        favorite.getMainPostId(),
                        favorite.getCreatedAt(),
                        "favorite"
                )));
        postRows.sort(Comparator.comparing(PostInteractionRow::interactedAt, Comparator.nullsLast(Comparator.reverseOrder())));
        List<PostInteractionRow> limitedPostRows = limitRows(postRows, limit);

        Map<Long, MainPost> mainPostsById = loadMainPosts(limitedPostRows.stream().map(PostInteractionRow::mainPostId).toList());
        Map<Long, Community> communitiesById = loadCommunities(mainPostsById.values().stream().map(MainPost::getCommunityId).toList());

        List<PostInteractionProjection> postInteractions = limitedPostRows.stream()
                .map(row -> {
                    MainPost mainPost = mainPostsById.get(row.mainPostId());
                    if (mainPost == null) {
                        return null;
                    }
                    Community community = communitiesById.get(mainPost.getCommunityId());
                    return new PostInteractionProjection(
                            mainPost.getId(),
                            mainPost.getTitle(),
                            community == null ? "" : community.getName(),
                            summarizeMainPost(mainPost.getContent()),
                            mainPost.getAuthorUsername(),
                            mainPost.getCreatedAt(),
                            mainPost.getLatestActivityAt(),
                            mainPost.getViewCount(),
                            mainPost.getSubPostCount(),
                            mainPost.getLikeCount(),
                            mainPost.getFavoriteCount(),
                            row.action(),
                            row.interactedAt()
                    );
                })
                .filter(Objects::nonNull)
                .toList();

        List<SubPostInteractionRow> subPostRows = new ArrayList<>();
        subPostLikeRepository.findAllByUsernameOrderByCreatedAtDesc(username, limitPage)
                .forEach(like -> subPostRows.add(new SubPostInteractionRow(like.getSubPostId(), like.getCreatedAt(), "like")));
        subPostFavoriteRepository.findAllByUsernameOrderByCreatedAtDesc(username, limitPage)
                .forEach(favorite -> subPostRows.add(new SubPostInteractionRow(
                        favorite.getSubPostId(),
                        favorite.getCreatedAt(),
                        "favorite"
                )));
        subPostRows.sort(Comparator.comparing(SubPostInteractionRow::interactedAt, Comparator.nullsLast(Comparator.reverseOrder())));
        List<SubPostInteractionRow> limitedSubPostRows = limitRows(subPostRows, limit);

        Map<Long, SubPost> subPostsById = loadSubPosts(limitedSubPostRows.stream().map(SubPostInteractionRow::subPostId).toList());
        Map<Long, MainPost> subPostMainPostsById = loadMainPosts(subPostsById.values().stream().map(SubPost::getMainPostId).toList());
        Map<Long, Community> subPostMainPostCommunitiesById =
                loadCommunities(subPostMainPostsById.values().stream().map(MainPost::getCommunityId).toList());

        List<SubPostInteractionProjection> subPostInteractions = limitedSubPostRows.stream()
                .map(row -> {
                    SubPost subPost = subPostsById.get(row.subPostId());
                    if (subPost == null) {
                        return null;
                    }
                    MainPost mainPost = subPostMainPostsById.get(subPost.getMainPostId());
                    if (mainPost == null) {
                        return null;
                    }
                    Community community = subPostMainPostCommunitiesById.get(mainPost.getCommunityId());
                    return new SubPostInteractionProjection(
                            subPost.getId(),
                            subPost.getMainPostId(),
                            mainPost.getTitle(),
                            community == null ? "" : community.getSlug(),
                            community == null ? "" : community.getName(),
                            summarizeMainPost(mainPost.getContent()),
                            mainPost.getAuthorUsername(),
                            mainPost.getCreatedAt(),
                            mainPost.getLatestActivityAt(),
                            mainPost.getViewCount(),
                            mainPost.getSubPostCount(),
                            mainPost.getLikeCount(),
                            mainPost.getFavoriteCount(),
                            subPost.getAuthorUsername(),
                            summarizeSubPost(subPost.getContent()),
                            row.action(),
                            row.interactedAt()
                    );
                })
                .filter(Objects::nonNull)
                .toList();

        return new InteractionListProjection(postInteractions, subPostInteractions);
    }

    private <T> List<T> limitRows(List<T> rows, int limit) {
        if (rows.size() <= limit) {
            return rows;
        }
        return rows.subList(0, limit);
    }

    private Map<Long, MainPost> loadMainPosts(Collection<Long> mainPostIds) {
        Map<Long, MainPost> mainPostsById = new HashMap<>();
        if (mainPostIds == null || mainPostIds.isEmpty()) {
            return mainPostsById;
        }
        mainPostRepository.findAllById(mainPostIds).forEach(mainPost -> {
            if (mainPost.getDeletedAt() == null) {
                mainPostsById.put(mainPost.getId(), mainPost);
            }
        });
        return mainPostsById;
    }

    private Map<Long, SubPost> loadSubPosts(Collection<Long> subPostIds) {
        Map<Long, SubPost> subPostsById = new HashMap<>();
        if (subPostIds == null || subPostIds.isEmpty()) {
            return subPostsById;
        }
        subPostRepository.findAllById(subPostIds).forEach(subPost -> {
            if (subPost.getDeletedAt() == null) {
                subPostsById.put(subPost.getId(), subPost);
            }
        });
        return subPostsById;
    }

    private Map<Long, Community> loadCommunities(Collection<Long> communityIds) {
        Map<Long, Community> communitiesById = new HashMap<>();
        if (communityIds == null || communityIds.isEmpty()) {
            return communitiesById;
        }
        LinkedHashSet<Long> requestedIds = new LinkedHashSet<>(communityIds);
        requestedIds.forEach(communityId -> communityCatalogCache.getCommunityById(communityId)
                .ifPresent(community -> communitiesById.put(communityId, toCommunity(community))));
        if (communitiesById.size() == requestedIds.size()) {
            return communitiesById;
        }
        communityRepository.findAllById(
                        requestedIds.stream()
                                .filter(communityId -> !communitiesById.containsKey(communityId))
                                .toList()
                )
                .forEach(community -> {
                    communitiesById.put(community.getId(), community);
                    communityCatalogCache.putCommunity(toCommunityResponse(community));
                });
        return communitiesById;
    }

    private String summarizeSubPost(String content) {
        return summarizeText(content);
    }

    private String summarizeMainPost(String content) {
        return summarizeText(content);
    }

    private String summarizeText(String content) {
        String normalizedContent = String.valueOf(content == null ? "" : content)
                .replaceAll("\\s+", " ")
                .trim();
        if (normalizedContent.isEmpty()) {
            return "";
        }
        if (normalizedContent.length() <= SUB_POST_PREVIEW_LIMIT) {
            return normalizedContent;
        }
        return normalizedContent.substring(0, SUB_POST_PREVIEW_LIMIT - 3) + "...";
    }

    private CommunityResponse toCommunityResponse(Community community) {
        return new CommunityResponse(
                community.getId(),
                community.getSlug(),
                community.getName(),
                community.getDescription(),
                community.getSortOrder()
        );
    }

    private Community toCommunity(CommunityResponse community) {
        return new Community(
                community.slug(),
                community.name(),
                community.description(),
                community.sortOrder()
        );
    }

    private record PostInteractionRow(Long mainPostId, Instant interactedAt, String action) {
    }

    private record SubPostInteractionRow(Long subPostId, Instant interactedAt, String action) {
    }
}
