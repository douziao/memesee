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
@Table(name = "media_asset_variants")
public class MediaAssetVariant {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long mediaAssetId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private MediaAssetVariantKind kind;

    @Column(nullable = false, length = 80)
    private String bucketName;

    @Column(nullable = false, length = 255)
    private String objectKey;

    @Column(nullable = false, length = 100)
    private String contentType;

    @Column(nullable = false)
    private long sizeBytes;

    @Column(nullable = false)
    private int width;

    @Column(nullable = false)
    private int height;

    @Column(nullable = false, updatable = false)
    private Instant createdAt;

    protected MediaAssetVariant() {
    }

    public MediaAssetVariant(
            Long mediaAssetId,
            MediaAssetVariantKind kind,
            String bucketName,
            String objectKey,
            String contentType,
            long sizeBytes,
            int width,
            int height
    ) {
        this.mediaAssetId = mediaAssetId;
        this.kind = kind;
        this.bucketName = bucketName;
        this.objectKey = objectKey;
        this.contentType = contentType;
        this.sizeBytes = sizeBytes;
        this.width = width;
        this.height = height;
    }

    @PrePersist
    void onCreate() {
        createdAt = Instant.now();
    }

    public Long getId() {
        return id;
    }

    public Long getMediaAssetId() {
        return mediaAssetId;
    }

    public MediaAssetVariantKind getKind() {
        return kind;
    }

    public String getBucketName() {
        return bucketName;
    }

    public String getObjectKey() {
        return objectKey;
    }

    public String getContentType() {
        return contentType;
    }

    public long getSizeBytes() {
        return sizeBytes;
    }

    public int getWidth() {
        return width;
    }

    public int getHeight() {
        return height;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}
