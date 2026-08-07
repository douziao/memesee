package com.memesee.content.subpost.infrastructure;

import java.sql.Timestamp;

class MybatisSubPostThreadProjectionRow {

    private Long id;
    private Long mainPostId;
    private Long parentSubPostId;
    private String parentSubPostAuthorUsername;
    private String authorUsername;
    private String content;
    private long likeCount;
    private long childSubPostCount;
    private Timestamp createdAt;
    private Timestamp updatedAt;

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public Long getMainPostId() {
        return mainPostId;
    }

    public void setMainPostId(Long mainPostId) {
        this.mainPostId = mainPostId;
    }

    public Long getParentSubPostId() {
        return parentSubPostId;
    }

    public void setParentSubPostId(Long parentSubPostId) {
        this.parentSubPostId = parentSubPostId;
    }

    public String getParentSubPostAuthorUsername() {
        return parentSubPostAuthorUsername;
    }

    public void setParentSubPostAuthorUsername(String parentSubPostAuthorUsername) {
        this.parentSubPostAuthorUsername = parentSubPostAuthorUsername;
    }

    public String getAuthorUsername() {
        return authorUsername;
    }

    public void setAuthorUsername(String authorUsername) {
        this.authorUsername = authorUsername;
    }

    public String getContent() {
        return content;
    }

    public void setContent(String content) {
        this.content = content;
    }

    public long getLikeCount() {
        return likeCount;
    }

    public void setLikeCount(long likeCount) {
        this.likeCount = likeCount;
    }

    public long getChildSubPostCount() {
        return childSubPostCount;
    }

    public void setChildSubPostCount(long childSubPostCount) {
        this.childSubPostCount = childSubPostCount;
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
}
