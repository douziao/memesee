package com.memesee.user.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import java.time.Instant;

@Entity
@Table(
        name = "post_creation_records",
        uniqueConstraints = {
                @UniqueConstraint(name = "uk_post_creation_record_main_post_id", columnNames = {"main_post_id"})
        },
        indexes = {
                @Index(name = "idx_post_creation_record_main_post_id", columnList = "main_post_id")
        }
)
public class PostCreationRecord {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "main_post_id", nullable = false)
    private Long mainPostId;

    @Column(name = "occurred_at", nullable = false)
    private Instant occurredAt;

    protected PostCreationRecord() {
    }

    public PostCreationRecord(Long mainPostId, Instant occurredAt) {
        this.mainPostId = mainPostId;
        this.occurredAt = occurredAt;
    }

    public Long getId() {
        return id;
    }

    public Long getMainPostId() {
        return mainPostId;
    }

    public Instant getOccurredAt() {
        return occurredAt;
    }
}
