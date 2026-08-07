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
@Table(name = "main_post_favorites")
public class MainPostFavorite {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long mainPostId;

    @Column(nullable = false, length = 80)
    private String username;

    @Column(nullable = false, updatable = false)
    private Instant createdAt;

    protected MainPostFavorite() {
    }

    public MainPostFavorite(Long mainPostId, String username) {
        this.mainPostId = mainPostId;
        this.username = username;
    }

    @PrePersist
    void onCreate() {
        createdAt = Instant.now();
    }

    public Long getMainPostId() {
        return mainPostId;
    }

    public String getUsername() {
        return username;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}
