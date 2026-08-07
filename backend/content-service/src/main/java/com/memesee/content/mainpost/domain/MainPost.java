package com.memesee.content.mainpost.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Convert;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.util.List;

@Entity
@Table(name = "main_posts")
public class MainPost {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long communityId;

    @Column(nullable = false, length = 80)
    private String authorUsername;

    @Column(nullable = false, length = 120)
    private String title;

    @Column(nullable = false, columnDefinition = "text")
    private String content;

    @Column(nullable = false, length = 16)
    private String postMode = "long";

    @Convert(converter = MainPostTagsJsonConverter.class)
    @Column(nullable = false, length = 255)
    private List<String> tags = List.of();

    @Column(nullable = false, precision = 18, scale = 6)
    private BigDecimal heatScore;

    @Column(nullable = false)
    private long viewCount;

    @Column(nullable = false)
    private long subPostCount;

    @Column(nullable = false)
    private long likeCount;

    @Column(nullable = false)
    private long favoriteCount;

    @Column(nullable = false, updatable = false)
    private Instant createdAt;

    @Column(nullable = false)
    private Instant updatedAt;

    @Column(nullable = false)
    private Instant latestActivityAt;

    @Column
    private Instant deletedAt;

    protected MainPost() {
    }

    public MainPost(Long communityId, String authorUsername, String title, String content) {
        this(communityId, authorUsername, title, content, List.of(), "long");
    }

    public MainPost(Long communityId, String authorUsername, String title, String content, List<String> tags) {
        this(communityId, authorUsername, title, content, tags, "long");
    }

    public MainPost(Long communityId, String authorUsername, String title, String content, List<String> tags, String postMode) {
        this.communityId = communityId;
        this.authorUsername = authorUsername;
        this.title = title;
        this.content = content;
        this.postMode = normalizePostMode(postMode);
        this.tags = copyTags(tags);
        this.heatScore = BigDecimal.ZERO.setScale(6);
        this.viewCount = 0L;
        this.subPostCount = 0L;
        this.likeCount = 0L;
        this.favoriteCount = 0L;
    }

    @PrePersist
    void onCreate() {
        Instant now = Instant.now();
        createdAt = now;
        updatedAt = now;
        latestActivityAt = now;
    }

    public void updateContent(String title, String content, List<String> tags) {
        updateContent(title, content, tags, this.postMode);
    }

    public void updateContent(String title, String content, List<String> tags, String postMode) {
        this.title = title;
        this.content = content;
        this.postMode = normalizePostMode(postMode);
        this.tags = copyTags(tags);
        this.updatedAt = Instant.now();
    }

    public void increaseSubPostCount() {
        this.subPostCount = this.subPostCount + 1L;
        recalculateHeatScore();
    }

    public void decreaseSubPostCount() {
        this.subPostCount = Math.max(0L, this.subPostCount - 1L);
        recalculateHeatScore();
    }

    public void increaseLikeCount() {
        this.likeCount = this.likeCount + 1L;
        recalculateHeatScore();
    }

    public void decreaseLikeCount() {
        this.likeCount = Math.max(0L, this.likeCount - 1L);
        recalculateHeatScore();
    }

    public void increaseFavoriteCount() {
        this.favoriteCount = this.favoriteCount + 1L;
        recalculateHeatScore();
    }

    public void decreaseFavoriteCount() {
        this.favoriteCount = Math.max(0L, this.favoriteCount - 1L);
        recalculateHeatScore();
    }

    public void increaseViewCount() {
        this.viewCount = this.viewCount + 1L;
        recalculateHeatScore();
    }

    public void touchActivityAt(Instant activityAt) {
        if (activityAt == null) {
            return;
        }
        if (latestActivityAt == null || activityAt.isAfter(latestActivityAt)) {
            latestActivityAt = activityAt;
        }
    }

    public void recalculateLatestActivityAt(Instant latestSubPostActivityAt) {
        Instant nextLatestActivityAt = createdAt;
        if (latestSubPostActivityAt != null && (nextLatestActivityAt == null || latestSubPostActivityAt.isAfter(nextLatestActivityAt))) {
            nextLatestActivityAt = latestSubPostActivityAt;
        }
        latestActivityAt = nextLatestActivityAt;
    }

    public void markDeleted() {
        this.deletedAt = Instant.now();
    }

    public Long getId() {
        return id;
    }

    public Long getCommunityId() {
        return communityId;
    }

    public String getAuthorUsername() {
        return authorUsername;
    }

    public String getTitle() {
        return title;
    }

    public String getContent() {
        return content;
    }

    public String getPostMode() {
        return postMode;
    }

    public List<String> getTags() {
        return copyTags(tags);
    }

    public BigDecimal getHeatScore() {
        return heatScore;
    }

    public long getViewCount() {
        return viewCount;
    }

    public long getSubPostCount() {
        return subPostCount;
    }

    public long getLikeCount() {
        return likeCount;
    }

    public long getFavoriteCount() {
        return favoriteCount;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    public Instant getLatestActivityAt() {
        return latestActivityAt;
    }

    public Instant getDeletedAt() {
        return deletedAt;
    }

    private String normalizePostMode(String postMode) {
        return "rich".equals(postMode) ? "rich" : "long";
    }

    private List<String> copyTags(List<String> tags) {
        return tags == null ? List.of() : List.copyOf(tags);
    }

    private void recalculateHeatScore() {
        double nextHeatScore = (viewCount * 0.1d)
                + likeCount
                + (favoriteCount * 2d)
                + (subPostCount * 3d);
        this.heatScore = BigDecimal.valueOf(nextHeatScore).setScale(6, RoundingMode.HALF_UP);
    }
}
