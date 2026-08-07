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
import java.time.LocalDate;

@Entity
@Table(
        name = "user_daily_metrics",
        uniqueConstraints = {
                @UniqueConstraint(name = "uk_user_daily_metric_user_date", columnNames = {"username", "activity_date"})
        },
        indexes = {
                @Index(name = "idx_user_daily_metric_user", columnList = "username"),
                @Index(name = "idx_user_daily_metric_user_date", columnList = "username,activity_date")
        }
)
public class UserDailyMetric {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 50)
    private String username;

    @Column(name = "activity_date", nullable = false)
    private LocalDate activityDate;

    @Column(nullable = false)
    private long readSeconds;

    @Column(nullable = false)
    private long likesGiven;

    @Column(nullable = false)
    private long likesReceived;

    @Column(nullable = false)
    private boolean visited;

    @Column(nullable = false)
    private Instant updatedAt;

    public UserDailyMetric() {
    }

    public UserDailyMetric(String username, LocalDate activityDate, Instant updatedAt) {
        this.username = username;
        this.activityDate = activityDate;
        this.updatedAt = updatedAt;
        this.readSeconds = 0L;
        this.likesGiven = 0L;
        this.likesReceived = 0L;
        this.visited = false;
    }

    public Long getId() {
        return id;
    }

    public String getUsername() {
        return username;
    }

    public LocalDate getActivityDate() {
        return activityDate;
    }

    public long getReadSeconds() {
        return readSeconds;
    }

    public long getLikesGiven() {
        return likesGiven;
    }

    public long getLikesReceived() {
        return likesReceived;
    }

    public boolean isVisited() {
        return visited;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    public void addReadSeconds(long seconds, Instant now) {
        if (seconds > 0) {
            this.readSeconds += seconds;
        }
        this.updatedAt = now;
    }

    public void incrementLikesGiven(Instant now) {
        this.likesGiven += 1L;
        this.updatedAt = now;
    }

    public void incrementLikesReceived(Instant now) {
        this.likesReceived += 1L;
        this.updatedAt = now;
    }

    public void markVisited(Instant now) {
        this.visited = true;
        this.updatedAt = now;
    }

    public void touch(Instant now) {
        this.updatedAt = now;
    }
}

