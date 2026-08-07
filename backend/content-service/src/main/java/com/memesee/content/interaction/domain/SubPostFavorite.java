package com.memesee.content.interaction.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import java.time.Instant;

@Entity
@Table(name = "sub_post_favorites")
public class SubPostFavorite {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long subPostId;

    @Column(nullable = false, length = 80)
    private String username;

    @Column(nullable = false, updatable = false)
    private Instant createdAt;

    protected SubPostFavorite() {
    }

    public SubPostFavorite(Long subPostId, String username) {
        this.subPostId = subPostId;
        this.username = username;
    }

    @PrePersist
    void onCreate() {
        createdAt = Instant.now();
    }

    public Long getSubPostId() {
        return subPostId;
    }

    public String getUsername() {
        return username;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}
