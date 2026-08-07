package com.memesee.content.feed.infrastructure;

import java.math.BigDecimal;
import java.sql.Timestamp;

public class MybatisMainPostFeedItemRow {

    private Long mainPostId;
    private String communitySlug;
    private String communityName;
    private String title;
    private String contentPreview;
    private String postMode;
    private String authorUsername;
    private String tagsJson;
    private String mediaAssetsJson;
    private String previewImageUrlsJson;
    private BigDecimal heatScore;
    private long viewCount;
    private long subPostCount;
    private long likeCount;
    private long favoriteCount;
    private Timestamp createdAt;
    private Timestamp updatedAt;
    private Timestamp latestActivityAt;

    public Long getMainPostId() {
        return mainPostId;
    }

    public void setMainPostId(Long mainPostId) {
        this.mainPostId = mainPostId;
    }

    public String getCommunitySlug() {
        return communitySlug;
    }

    public void setCommunitySlug(String communitySlug) {
        this.communitySlug = communitySlug;
    }

    public String getCommunityName() {
        return communityName;
    }

    public void setCommunityName(String communityName) {
        this.communityName = communityName;
    }

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public String getContentPreview() {
        return contentPreview;
    }

    public void setContentPreview(String contentPreview) {
        this.contentPreview = contentPreview;
    }

    public String getPostMode() {
        return postMode;
    }

    public void setPostMode(String postMode) {
        this.postMode = postMode;
    }

    public String getAuthorUsername() {
        return authorUsername;
    }

    public void setAuthorUsername(String authorUsername) {
        this.authorUsername = authorUsername;
    }

    public String getTagsJson() {
        return tagsJson;
    }

    public void setTagsJson(String tagsJson) {
        this.tagsJson = tagsJson;
    }

    public String getMediaAssetsJson() {
        return mediaAssetsJson;
    }

    public void setMediaAssetsJson(String mediaAssetsJson) {
        this.mediaAssetsJson = mediaAssetsJson;
    }

    public String getPreviewImageUrlsJson() {
        return previewImageUrlsJson;
    }

    public void setPreviewImageUrlsJson(String previewImageUrlsJson) {
        this.previewImageUrlsJson = previewImageUrlsJson;
    }

    public BigDecimal getHeatScore() {
        return heatScore;
    }

    public void setHeatScore(BigDecimal heatScore) {
        this.heatScore = heatScore;
    }

    public long getViewCount() {
        return viewCount;
    }

    public void setViewCount(long viewCount) {
        this.viewCount = viewCount;
    }

    public long getSubPostCount() {
        return subPostCount;
    }

    public void setSubPostCount(long subPostCount) {
        this.subPostCount = subPostCount;
    }

    public long getLikeCount() {
        return likeCount;
    }

    public void setLikeCount(long likeCount) {
        this.likeCount = likeCount;
    }

    public long getFavoriteCount() {
        return favoriteCount;
    }

    public void setFavoriteCount(long favoriteCount) {
        this.favoriteCount = favoriteCount;
    }

    public Timestamp getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Timestamp createdAt) {
        this.createdAt = createdAt;
    }

    public Timestamp getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(Timestamp updatedAt) {
        this.updatedAt = updatedAt;
    }

    public Timestamp getLatestActivityAt() {
        return latestActivityAt;
    }

    public void setLatestActivityAt(Timestamp latestActivityAt) {
        this.latestActivityAt = latestActivityAt;
    }
}
