package com.memesee.content.interaction.infrastructure;

import java.sql.Timestamp;

class MybatisPostInteractionProjectionRow {

    private Long postId;
    private String postTitle;
    private String communityName;
    private String contentPreview;
    private String authorUsername;
    private Timestamp createdAt;
    private Timestamp latestActivityAt;
    private long viewCount;
    private long subPostCount;
    private long likeCount;
    private long favoriteCount;
    private String action;
    private Timestamp interactedAt;

    public Long getPostId() {
        return postId;
    }

    public void setPostId(Long postId) {
        this.postId = postId;
    }

    public String getPostTitle() {
        return postTitle;
    }

    public void setPostTitle(String postTitle) {
        this.postTitle = postTitle;
    }

    public String getCommunityName() {
        return communityName;
    }

    public void setCommunityName(String communityName) {
        this.communityName = communityName;
    }

    public String getContentPreview() {
        return contentPreview;
    }

    public void setContentPreview(String contentPreview) {
        this.contentPreview = contentPreview;
    }

    public String getAuthorUsername() {
        return authorUsername;
    }

    public void setAuthorUsername(String authorUsername) {
        this.authorUsername = authorUsername;
    }

    public Timestamp getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Timestamp createdAt) {
        this.createdAt = createdAt;
    }

    public Timestamp getLatestActivityAt() {
        return latestActivityAt;
    }

    public void setLatestActivityAt(Timestamp latestActivityAt) {
        this.latestActivityAt = latestActivityAt;
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

    public String getAction() {
        return action;
    }

    public void setAction(String action) {
        this.action = action;
    }

    public Timestamp getInteractedAt() {
        return interactedAt;
    }

    public void setInteractedAt(Timestamp interactedAt) {
        this.interactedAt = interactedAt;
    }
}
