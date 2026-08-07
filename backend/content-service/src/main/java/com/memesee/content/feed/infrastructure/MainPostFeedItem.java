package com.memesee.content.feed.infrastructure;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.Instant;

@Entity
@Table(name = "main_post_feed_items")
public class MainPostFeedItem {

    @Id
    private Long mainPostId;

    @Column(nullable = false)
    private Long communityId;

    @Column(nullable = false, length = 50)
    private String communitySlug;

    @Column(nullable = false, length = 60)
    private String communityName;

    @Column(nullable = false, length = 120)
    private String title;

    @Column(nullable = false, length = 220)
    private String contentPreview;

    @Column(nullable = false, length = 16)
    private String postMode;

    @Column(nullable = false, length = 80)
    private String authorUsername;

    @Column(nullable = false, length = 255)
    private String tagsJson;

    @Column(nullable = false, columnDefinition = "longtext")
    private String mediaAssetsJson;

    @Column(nullable = false, columnDefinition = "longtext")
    private String previewImageUrlsJson;

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

    @Column(nullable = false)
    private Instant createdAt;

    @Column(nullable = false)
    private Instant updatedAt;

    @Column(nullable = false)
    private Instant latestActivityAt;

    @Column
    private Instant deletedAt;

    protected MainPostFeedItem() {
    }

    public MainPostFeedItem(
            Long mainPostId,
            Long communityId,
            String communitySlug,
            String communityName,
            String title,
            String contentPreview,
            String postMode,
            String authorUsername,
            String tagsJson,
            String mediaAssetsJson,
            String previewImageUrlsJson,
            BigDecimal heatScore,
            long viewCount,
            long subPostCount,
            long likeCount,
            long favoriteCount,
            Instant createdAt,
            Instant updatedAt,
            Instant latestActivityAt,
            Instant deletedAt
    ) {
        this.mainPostId = mainPostId;
        this.communityId = communityId;
        this.communitySlug = communitySlug;
        this.communityName = communityName;
        this.title = title;
        this.contentPreview = contentPreview;
        this.postMode = postMode;
        this.authorUsername = authorUsername;
        this.tagsJson = tagsJson;
        this.mediaAssetsJson = mediaAssetsJson;
        this.previewImageUrlsJson = previewImageUrlsJson;
        this.heatScore = heatScore;
        this.viewCount = viewCount;
        this.subPostCount = subPostCount;
        this.likeCount = likeCount;
        this.favoriteCount = favoriteCount;
        this.createdAt = createdAt;
        this.updatedAt = updatedAt;
        this.latestActivityAt = latestActivityAt;
        this.deletedAt = deletedAt;
    }

    public Long getMainPostId() {
        return mainPostId;
    }

    public String getCommunitySlug() {
        return communitySlug;
    }

    public String getCommunityName() {
        return communityName;
    }

    public String getTitle() {
        return title;
    }

    public String getContentPreview() {
        return contentPreview;
    }

    public String getPostMode() {
        return postMode;
    }

    public String getAuthorUsername() {
        return authorUsername;
    }

    public String getTagsJson() {
        return tagsJson;
    }

    public String getMediaAssetsJson() {
        return mediaAssetsJson;
    }

    public String getPreviewImageUrlsJson() {
        return previewImageUrlsJson;
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
}
