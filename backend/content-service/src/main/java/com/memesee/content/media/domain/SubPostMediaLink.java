package com.memesee.content.media.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import java.time.Instant;

@Entity
@Table(name = "sub_post_media_links")
public class SubPostMediaLink {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long subPostId;

    @Column(nullable = false)
    private Long mediaAssetId;

    @Column(nullable = false)
    private int sortOrder;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private MediaLinkRole role;

    @Column(nullable = false, updatable = false)
    private Instant createdAt;

    protected SubPostMediaLink() {
    }

    public SubPostMediaLink(Long subPostId, Long mediaAssetId, int sortOrder, MediaLinkRole role) {
        this.subPostId = subPostId;
        this.mediaAssetId = mediaAssetId;
        this.sortOrder = sortOrder;
        this.role = role;
    }

    @PrePersist
    void onCreate() {
        createdAt = Instant.now();
    }

    public Long getSubPostId() {
        return subPostId;
    }

    public Long getMediaAssetId() {
        return mediaAssetId;
    }

    public int getSortOrder() {
        return sortOrder;
    }
}
