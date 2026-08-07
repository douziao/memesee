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
        name = "user_community_visits",
        uniqueConstraints = {
                @UniqueConstraint(name = "uk_user_community_visit_user_community", columnNames = {"username", "community_slug"})
        },
        indexes = {
                @Index(name = "idx_user_community_visit_user", columnList = "username"),
                @Index(name = "idx_user_community_visit_community", columnList = "community_slug")
        }
)
public class UserCommunityVisit {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 50)
    private String username;

    @Column(name = "community_slug", nullable = false, length = 64)
    private String communitySlug;

    @Column(nullable = false)
    private Instant firstVisitedAt;

    @Column(nullable = false)
    private Instant lastVisitedAt;

    public UserCommunityVisit() {
    }

    public UserCommunityVisit(String username, String communitySlug, Instant now) {
        this.username = username;
        this.communitySlug = communitySlug;
        this.firstVisitedAt = now;
        this.lastVisitedAt = now;
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

    public Instant getFirstVisitedAt() {
        return firstVisitedAt;
    }

    public Instant getLastVisitedAt() {
        return lastVisitedAt;
    }

    public void touch(Instant now) {
        this.lastVisitedAt = now;
    }
}

