package com.memesee.content.feed.application;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.memesee.content.community.domain.Community;
import com.memesee.content.feed.infrastructure.MainPostFeedItem;
import com.memesee.content.mainpost.domain.MainPost;
import com.memesee.content.media.dto.MediaAssetResponse;
import java.util.List;
import org.springframework.stereotype.Component;

@Component
public class MainPostFeedItemAssembler {

    private final MainPostReadModelAssembler mainPostReadModelAssembler;
    private final MainPostFeedProjectionSupport projectionSupport;
    private final ObjectMapper objectMapper;

    public MainPostFeedItemAssembler(
            MainPostReadModelAssembler mainPostReadModelAssembler,
            MainPostFeedProjectionSupport projectionSupport,
            ObjectMapper objectMapper
    ) {
        this.mainPostReadModelAssembler = mainPostReadModelAssembler;
        this.projectionSupport = projectionSupport;
        this.objectMapper = objectMapper;
    }

    public MainPostFeedItem assemble(MainPost mainPost, List<MediaAssetResponse> mediaAssets) {
        Community community = projectionSupport.requireCommunityById(mainPost.getCommunityId());
        List<MediaAssetResponse> visibleMediaAssets = mainPost.getDeletedAt() == null
                ? safeList(mediaAssets)
                : List.of();
        return new MainPostFeedItem(
                mainPost.getId(),
                community.getId(),
                community.getSlug(),
                community.getName(),
                mainPost.getTitle(),
                mainPostReadModelAssembler.buildContentPreview(mainPost.getContent()),
                mainPost.getPostMode(),
                mainPost.getAuthorUsername(),
                writeJson(mainPost.getTags()),
                writeJson(visibleMediaAssets),
                writeJson(mainPostReadModelAssembler.extractPreviewImageUrls(mainPost.getContent())),
                mainPost.getHeatScore(),
                mainPost.getViewCount(),
                mainPost.getSubPostCount(),
                mainPost.getLikeCount(),
                mainPost.getFavoriteCount(),
                mainPost.getCreatedAt(),
                mainPost.getUpdatedAt(),
                mainPost.getLatestActivityAt(),
                mainPost.getDeletedAt()
        );
    }

    private List<MediaAssetResponse> safeList(List<MediaAssetResponse> mediaAssets) {
        return mediaAssets == null ? List.of() : List.copyOf(mediaAssets);
    }

    private String writeJson(Object value) {
        try {
            return objectMapper.writeValueAsString(value == null ? List.of() : value);
        } catch (JsonProcessingException ex) {
            throw new IllegalStateException("Failed to serialize feed projection value.", ex);
        }
    }
}
