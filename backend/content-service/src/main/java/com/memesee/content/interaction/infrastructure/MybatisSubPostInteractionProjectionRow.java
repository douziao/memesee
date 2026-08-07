package com.memesee.content.interaction.infrastructure;

import java.sql.Timestamp;

class MybatisSubPostInteractionProjectionRow {

    private Long subPostId;
    private Long mainPostId;
    private String postTitle;
    private String mainPostCommunitySlug;
    private String mainPostCommunityName;
    private String mainPostContentPreview;
    private String mainPostAuthorUsername;
    private Timestamp mainPostCreatedAt;
    private Timestamp mainPostLatestActivityAt;
    private long mainPostViewCount;
    private long mainPostSubPostCount;
    private long mainPostLikeCount;
    private long mainPostFavoriteCount;
    private String subPostAuthorUsername;
    private String subPostContent;
    private String action;
    private Timestamp interactedAt;

    public Long getSubPostId() {
        return subPostId;
    }

    public void setSubPostId(Long subPostId) {
        this.subPostId = subPostId;
    }

    public Long getMainPostId() {
        return mainPostId;
    }

    public void setMainPostId(Long mainPostId) {
        this.mainPostId = mainPostId;
    }

    public String getPostTitle() {
        return postTitle;
    }

    public void setPostTitle(String postTitle) {
        this.postTitle = postTitle;
    }

    public String getMainPostCommunitySlug() {
        return mainPostCommunitySlug;
    }

    public void setMainPostCommunitySlug(String mainPostCommunitySlug) {
        this.mainPostCommunitySlug = mainPostCommunitySlug;
    }

    public String getMainPostCommunityName() {
        return mainPostCommunityName;
    }

    public void setMainPostCommunityName(String mainPostCommunityName) {
        this.mainPostCommunityName = mainPostCommunityName;
    }

    public String getMainPostContentPreview() {
        return mainPostContentPreview;
    }

    public void setMainPostContentPreview(String mainPostContentPreview) {
        this.mainPostContentPreview = mainPostContentPreview;
    }

    public String getMainPostAuthorUsername() {
        return mainPostAuthorUsername;
    }

    public void setMainPostAuthorUsername(String mainPostAuthorUsername) {
        this.mainPostAuthorUsername = mainPostAuthorUsername;
    }

    public Timestamp getMainPostCreatedAt() {
        return mainPostCreatedAt;
    }

    public void setMainPostCreatedAt(Timestamp mainPostCreatedAt) {
        this.mainPostCreatedAt = mainPostCreatedAt;
    }

    public Timestamp getMainPostLatestActivityAt() {
        return mainPostLatestActivityAt;
    }

    public void setMainPostLatestActivityAt(Timestamp mainPostLatestActivityAt) {
        this.mainPostLatestActivityAt = mainPostLatestActivityAt;
    }

    public long getMainPostViewCount() {
        return mainPostViewCount;
    }

    public void setMainPostViewCount(long mainPostViewCount) {
        this.mainPostViewCount = mainPostViewCount;
    }

    public long getMainPostSubPostCount() {
        return mainPostSubPostCount;
    }

    public void setMainPostSubPostCount(long mainPostSubPostCount) {
        this.mainPostSubPostCount = mainPostSubPostCount;
    }

    public long getMainPostLikeCount() {
        return mainPostLikeCount;
    }

    public void setMainPostLikeCount(long mainPostLikeCount) {
        this.mainPostLikeCount = mainPostLikeCount;
    }

    public long getMainPostFavoriteCount() {
        return mainPostFavoriteCount;
    }

    public void setMainPostFavoriteCount(long mainPostFavoriteCount) {
        this.mainPostFavoriteCount = mainPostFavoriteCount;
    }

    public String getSubPostAuthorUsername() {
        return subPostAuthorUsername;
    }

    public void setSubPostAuthorUsername(String subPostAuthorUsername) {
        this.subPostAuthorUsername = subPostAuthorUsername;
    }

    public String getSubPostContent() {
        return subPostContent;
    }

    public void setSubPostContent(String subPostContent) {
        this.subPostContent = subPostContent;
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
