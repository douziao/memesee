package com.memesee.content.feed.application;

import com.memesee.content.community.domain.Community;
import com.memesee.content.mainpost.dto.MainPostDetailMediaAssetResponse;
import com.memesee.content.mainpost.dto.MainPostDetailResponse;
import com.memesee.content.mainpost.dto.MainPostSummaryResponse;
import com.memesee.content.mainpost.domain.MainPost;
import com.memesee.content.media.dto.MediaAssetResponse;
import java.util.ArrayList;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public class MainPostReadModelAssembler {

    private static final int CONTENT_PREVIEW_LIMIT = 160;
    private static final int PREVIEW_IMAGE_LIMIT = 3;
    private static final Pattern MARKDOWN_IMAGE_PATTERN =
            Pattern.compile("!\\[[^\\]]*]\\(([^)\\s]+)(?:\\s+\"[^\"]*\")?\\)");
    private static final Pattern HTML_IMAGE_PATTERN =
            Pattern.compile("<img[^>]+src=[\"']([^\"']+)[\"'][^>]*>", Pattern.CASE_INSENSITIVE);
    private static final Pattern PREVIEW_IMAGE_PATTERN =
            Pattern.compile(
                    "!\\[[^\\]]*]\\(([^)\\s]+)(?:\\s+\"[^\"]*\")?\\)|<img[^>]+src=[\"']([^\"']+)[\"'][^>]*>",
                    Pattern.CASE_INSENSITIVE
            );

    public MainPostReadModel assemble(
            MainPost mainPost,
            Community community,
            boolean likedByMe,
            boolean favoritedByMe,
            List<MediaAssetResponse> mediaAssets
    ) {
        return new MainPostReadModel(
                mainPost.getId(),
                community.getSlug(),
                community.getName(),
                mainPost.getTitle(),
                mainPost.getContent(),
                buildContentPreview(mainPost.getContent()),
                mainPost.getPostMode(),
                mainPost.getAuthorUsername(),
                mainPost.getCreatedAt(),
                mainPost.getUpdatedAt(),
                mainPost.getLatestActivityAt(),
                mainPost.getHeatScore(),
                mainPost.getViewCount(),
                mainPost.getSubPostCount(),
                mainPost.getLikeCount(),
                mainPost.getFavoriteCount(),
                likedByMe,
                favoritedByMe,
                mediaAssets,
                extractPreviewImageUrls(mainPost.getContent()),
                mainPost.getTags()
        );
    }

    public MainPostSummaryResponse toSummary(MainPostReadModel readModel) {
        return new MainPostSummaryResponse(
                readModel.id(),
                readModel.communitySlug(),
                readModel.communityName(),
                readModel.title(),
                readModel.contentPreview(),
                readModel.postMode(),
                readModel.authorUsername(),
                readModel.createdAt(),
                readModel.updatedAt(),
                readModel.latestActivityAt(),
                readModel.heatScore(),
                readModel.viewCount(),
                readModel.subPostCount(),
                readModel.likeCount(),
                readModel.favoriteCount(),
                readModel.likedByMe(),
                readModel.favoritedByMe(),
                readModel.mediaAssets(),
                readModel.previewImageUrls(),
                readModel.tags()
        );
    }

    public MainPostDetailResponse toDetail(MainPostReadModel readModel) {
        return new MainPostDetailResponse(
                readModel.id(),
                readModel.communitySlug(),
                readModel.communityName(),
                readModel.title(),
                readModel.content(),
                readModel.postMode(),
                readModel.authorUsername(),
                readModel.createdAt(),
                readModel.updatedAt(),
                readModel.latestActivityAt(),
                readModel.heatScore(),
                readModel.viewCount(),
                readModel.subPostCount(),
                readModel.likeCount(),
                readModel.favoriteCount(),
                readModel.likedByMe(),
                readModel.favoritedByMe(),
                toDetailMediaAssets(readModel.mediaAssets()),
                readModel.tags()
        );
    }

    private List<MainPostDetailMediaAssetResponse> toDetailMediaAssets(List<MediaAssetResponse> mediaAssets) {
        if (mediaAssets == null || mediaAssets.isEmpty()) {
            return List.of();
        }
        return mediaAssets.stream()
                .map(MainPostDetailMediaAssetResponse::from)
                .toList();
    }

    public String buildContentPreview(String content) {
        if (content == null || content.isBlank()) {
            return "";
        }
        String plainContent = stripPreviewMarkup(content);
        if (plainContent.length() <= CONTENT_PREVIEW_LIMIT) {
            return plainContent;
        }
        return plainContent.substring(0, CONTENT_PREVIEW_LIMIT) + "...";
    }

    public List<String> extractPreviewImageUrls(String content) {
        if (content == null || content.isBlank()) {
            return List.of();
        }
        Matcher matcher = PREVIEW_IMAGE_PATTERN.matcher(content);
        List<String> imageUrls = new ArrayList<>();
        while (matcher.find() && imageUrls.size() < PREVIEW_IMAGE_LIMIT) {
            String imageUrl = matcher.group(1) != null ? matcher.group(1) : matcher.group(2);
            if (imageUrl != null && !imageUrl.isBlank() && !imageUrls.contains(imageUrl)) {
                imageUrls.add(imageUrl.trim());
            }
        }
        return List.copyOf(imageUrls);
    }

    private String stripPreviewMarkup(String content) {
        String withoutImages = HTML_IMAGE_PATTERN
                .matcher(MARKDOWN_IMAGE_PATTERN.matcher(content).replaceAll(" "))
                .replaceAll(" ");
        return withoutImages
                .replaceAll("\\[([^\\]]+)]\\([^)]*\\)", "$1")
                .replaceAll("[`*_>#-]", " ")
                .replaceAll("\\s+", " ")
                .trim();
    }
}
