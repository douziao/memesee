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
        name = "user_community_main_post_activities",
        uniqueConstraints = {
                @UniqueConstraint(name = "uk_user_community_main_post_activity_user_community", columnNames = {"username", "community_slug"})
        },
        indexes = {
                @Index(name = "idx_user_community_main_post_activity_user", columnList = "username"),
                @Index(name = "idx_user_community_main_post_activity_user_last", columnList = "username,last_main_post_at")
        }
)
public class UserCommunityMainPostActivity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 50)
    private String username;

    @Column(name = "community_slug", nullable = false, length = 64)
    private String communitySlug;

    @Column(name = "main_post_count", nullable = false)
    private long mainPostCount;

    @Column(name = "first_main_post_at", nullable = false)
    private Instant firstMainPostAt;

    @Column(name = "last_main_post_at", nullable = false)
    private Instant lastMainPostAt;

    public UserCommunityMainPostActivity() {
    }

    public UserCommunityMainPostActivity(String username, String communitySlug, Instant now) {
        this.username = username;
        this.communitySlug = communitySlug;
        this.mainPostCount = 1L;
        this.firstMainPostAt = now;
        this.lastMainPostAt = now;
    }

    public Long getId() {
        return id;
    }

    public String getUsername() {
        return username;
    }

    public String getCommunitySlug() {
        return communitySlug;
    }

    public long getMainPostCount() {
        return mainPostCount;
    }

    public Instant getFirstMainPostAt() {
        return firstMainPostAt;
    }

    public Instant getLastMainPostAt() {
        return lastMainPostAt;
    }

    public void markMainPostCreated(Instant now) {
        this.mainPostCount += 1L;
        this.lastMainPostAt = now;
    }

    public void markMainPostDeleted(Instant now) {
        this.mainPostCount = Math.max(0L, this.mainPostCount - 1L);
        this.lastMainPostAt = now;
    }
}
