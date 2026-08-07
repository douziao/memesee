package com.memesee.content.subpost.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import java.time.Instant;

@Entity
@Table(name = "sub_posts")
public class SubPost {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long mainPostId;

    @Column
    private Long parentSubPostId;

    @Column(nullable = false, length = 80)
    private String authorUsername;

    @Column(nullable = false, columnDefinition = "text")
    private String content;

    @Column(nullable = false)
    private long likeCount;

    @Column(nullable = false)
    private long childSubPostCount;

    @Column(nullable = false, updatable = false)
    private Instant createdAt;

    @Column(nullable = false)
    private Instant updatedAt;

    @Column
    private Instant deletedAt;

    protected SubPost() {
    }

    public SubPost(Long mainPostId, Long parentSubPostId, String authorUsername, String content) {
        this.mainPostId = mainPostId;
        this.parentSubPostId = parentSubPostId;
        this.authorUsername = authorUsername;
        this.content = content;
        this.likeCount = 0L;
        this.childSubPostCount = 0L;
    }

    @PrePersist
    void onCreate() {
        Instant now = Instant.now();
        createdAt = now;
        updatedAt = now;
    }

    public void updateContent(String content) {
        this.content = content;
        this.updatedAt = Instant.now();
    }

    public void increaseChildSubPostCount() {
        this.childSubPostCount = this.childSubPostCount + 1L;
    }

    public void decreaseChildSubPostCount() {
        this.childSubPostCount = Math.max(0L, this.childSubPostCount - 1L);
    }

    public void increaseLikeCount() {
        this.likeCount = this.likeCount + 1L;
    }

    public void decreaseLikeCount() {
        this.likeCount = Math.max(0L, this.likeCount - 1L);
    }

    public void markDeleted() {
        this.deletedAt = Instant.now();
    }

    public Long getId() {
        return id;
    }

    public Long getMainPostId() {
        return mainPostId;
    }

    public Long getParentSubPostId() {
        return parentSubPostId;
    }

    public String getAuthorUsername() {
        return authorUsername;
    }

    public String getContent() {
        return content;
    }

    public long getLikeCount() {
        return likeCount;
    }

    public long getChildSubPostCount() {
        return childSubPostCount;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    public Instant getDeletedAt() {
        return deletedAt;
    }
}
