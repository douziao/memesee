package com.memesee.content.media.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "media_assets")
public class MediaAsset {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 36, unique = true)
    private String publicId;

    @Column(nullable = false, length = 80)
    private String ownerUsername;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private MediaAssetKind kind;

    @Column(nullable = false, length = 80)
    private String bucketName;

    @Column(nullable = false, length = 255)
    private String objectKey;

    @Column(nullable = false, length = 255)
    private String originalFilename;

    @Column(nullable = false, length = 100)
    private String contentType;

    @Column(nullable = false)
    private long sizeBytes;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private MediaAssetStatus status;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private MediaAssetProcessingStatus processingStatus;

    @Column(columnDefinition = "text")
    private String blurDataUrl;

    @Column(nullable = false, updatable = false)
    private Instant createdAt;

    @Column(nullable = false)
    private Instant updatedAt;

    protected MediaAsset() {
    }

    public MediaAsset(
            String ownerUsername,
            MediaAssetKind kind,
            String bucketName,
            String objectKey,
            String originalFilename,
            String contentType,
            long sizeBytes,
            MediaAssetStatus status,
            MediaAssetProcessingStatus processingStatus
    ) {
        this.ownerUsername = ownerUsername;
        this.kind = kind;
        this.bucketName = bucketName;
        this.objectKey = objectKey;
        this.originalFilename = originalFilename;
        this.contentType = contentType;
        this.sizeBytes = sizeBytes;
        this.status = status;
        this.processingStatus = processingStatus;
    }

    @PrePersist
    void onCreate() {
        if (publicId == null || publicId.isBlank()) {
            publicId = UUID.randomUUID().toString();
        }
        Instant now = Instant.now();
        createdAt = now;
        updatedAt = now;
    }

    @PreUpdate
    void onUpdate() {
        updatedAt = Instant.now();
    }

    public Long getId() {
        return id;
    }

    public String getPublicId() {
        return publicId;
    }

    public String getOwnerUsername() {
        return ownerUsername;
    }

    public MediaAssetKind getKind() {
        return kind;
    }

    public String getBucketName() {
        return bucketName;
    }

    public String getObjectKey() {
        return objectKey;
    }

    public String getOriginalFilename() {
        return originalFilename;
    }

    public String getContentType() {
        return contentType;
    }

    public long getSizeBytes() {
        return sizeBytes;
    }

    public MediaAssetStatus getStatus() {
        return status;
    }

    public MediaAssetProcessingStatus getProcessingStatus() {
        return processingStatus;
    }

    public String getBlurDataUrl() {
        return blurDataUrl;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    public boolean isActive() {
        return status == MediaAssetStatus.ACTIVE;
    }

    public void markProcessing() {
        processingStatus = MediaAssetProcessingStatus.PROCESSING;
    }

    public void markReady() {
        processingStatus = MediaAssetProcessingStatus.READY;
    }

    public void markFailed() {
        processingStatus = MediaAssetProcessingStatus.FAILED;
    }
}
