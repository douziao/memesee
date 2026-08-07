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
        name = "user_community_sub_post_activities",
        uniqueConstraints = {
                @UniqueConstraint(name = "uk_user_community_sub_post_activity_user_community", columnNames = {"username", "community_slug"})
        },
        indexes = {
                @Index(name = "idx_user_community_sub_post_activity_user", columnList = "username"),
                @Index(name = "idx_user_community_sub_post_activity_user_last", columnList = "username,last_sub_post_at")
        }
)
public class UserCommunitySubPostActivity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 50)
    private String username;

    @Column(name = "community_slug", nullable = false, length = 64)
    private String communitySlug;

    @Column(name = "sub_post_count", nullable = false)
    private long subPostCount;

    @Column(name = "first_sub_post_at", nullable = false)
    private Instant firstSubPostAt;

    @Column(name = "last_sub_post_at", nullable = false)
    private Instant lastSubPostAt;

    public UserCommunitySubPostActivity() {
    }

    public UserCommunitySubPostActivity(String username, String communitySlug, Instant now) {
        this.username = username;
        this.communitySlug = communitySlug;
        this.subPostCount = 1L;
        this.firstSubPostAt = now;
        this.lastSubPostAt = now;
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

    public long getSubPostCount() {
        return subPostCount;
    }

    public Instant getFirstSubPostAt() {
        return firstSubPostAt;
    }

    public Instant getLastSubPostAt() {
        return lastSubPostAt;
    }

    public void markSubPostCreated(Instant now) {
        this.subPostCount += 1L;
        this.lastSubPostAt = now;
    }
}

