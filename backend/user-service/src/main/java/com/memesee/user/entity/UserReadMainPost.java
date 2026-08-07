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
        name = "user_read_main_posts",
        uniqueConstraints = {
                @UniqueConstraint(name = "uk_user_read_main_post_user_post", columnNames = {"username", "main_post_id"})
        },
        indexes = {
                @Index(name = "idx_user_read_main_post_user", columnList = "username"),
                @Index(name = "idx_user_read_main_post_user_last", columnList = "username,last_read_at")
        }
)
public class UserReadMainPost {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 50)
    private String username;

    @Column(name = "main_post_id", nullable = false)
    private Long mainPostId;

    @Column(name = "community_slug", length = 64)
    private String communitySlug;

    @Column(nullable = false)
    private Instant firstReadAt;

    @Column(name = "last_read_at", nullable = false)
    private Instant lastReadAt;

    public UserReadMainPost() {
    }

    public UserReadMainPost(String username, Long mainPostId, String communitySlug, Instant now) {
        this.username = username;
        this.mainPostId = mainPostId;
        this.communitySlug = communitySlug;
        this.firstReadAt = now;
        this.lastReadAt = now;
    }

    public Long getId() {
        return id;
    }

    public String getUsername() {
        return username;
    }

    public Long getMainPostId() {
        return mainPostId;
    }

    public String getCommunitySlug() {
        return communitySlug;
    }

    public Instant getFirstReadAt() {
        return firstReadAt;
    }

    public Instant getLastReadAt() {
        return lastReadAt;
    }

    public void touch(String communitySlug, Instant now) {
        if (communitySlug != null && !communitySlug.isBlank()) {
            this.communitySlug = communitySlug;
        }
        this.lastReadAt = now;
    }
}

