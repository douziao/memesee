package com.memesee.content.notification.domain;

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
@Table(name = "notifications")
public class ContentNotification {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 80)
    private String username;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 40)
    private NotificationType type;

    @Column(nullable = false, length = 120)
    private String title;

    @Column(nullable = false, length = 500)
    private String body;

    @Column
    private Long mainPostId;

    @Column
    private Long subPostId;

    @Column(length = 80)
    private String actorUsername;

    @Column(length = 255, unique = true)
    private String dedupeKey;

    @Column
    private Instant readAt;

    @Column(nullable = false, updatable = false)
    private Instant createdAt;

    protected ContentNotification() {
    }

    public ContentNotification(
            String username,
            NotificationType type,
            String title,
            String body,
            Long mainPostId,
            Long subPostId,
            String actorUsername
    ) {
        this.username = username;
        this.type = type;
        this.title = title;
        this.body = body;
        this.mainPostId = mainPostId;
        this.subPostId = subPostId;
        this.actorUsername = actorUsername;
    }

    public void assignDedupeKey(String dedupeKey) {
        this.dedupeKey = dedupeKey;
    }

    @PrePersist
    void onCreate() {
        createdAt = Instant.now();
    }

    public void markRead() {
        if (readAt == null) {
            readAt = Instant.now();
        }
    }

    public Long getId() {
        return id;
    }

    public String getUsername() {
        return username;
    }

    public NotificationType getType() {
        return type;
    }

    public String getTitle() {
        return title;
    }

    public String getBody() {
        return body;
    }

    public Long getMainPostId() {
        return mainPostId;
    }

    public Long getSubPostId() {
        return subPostId;
    }

    public String getActorUsername() {
        return actorUsername;
    }

    public Instant getReadAt() {
        return readAt;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public boolean isRead() {
        return readAt != null;
    }
}
