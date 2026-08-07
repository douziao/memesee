package com.memesee.user.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import java.time.LocalDate;

@Entity
@Table(
        name = "post_daily_stats",
        uniqueConstraints = {
                @UniqueConstraint(name = "uk_post_daily_stats_date", columnNames = {"activity_date"})
        },
        indexes = {
                @Index(name = "idx_post_daily_stats_date", columnList = "activity_date")
        }
)
public class PostDailyStat {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "activity_date", nullable = false)
    private LocalDate activityDate;

    @Column(name = "created_count", nullable = false)
    private long createdCount;

    public PostDailyStat() {
    }

    public PostDailyStat(LocalDate activityDate, long createdCount) {
        this.activityDate = activityDate;
        this.createdCount = Math.max(0L, createdCount);
    }

    public Long getId() {
        return id;
    }

    public LocalDate getActivityDate() {
        return activityDate;
    }

    public long getCreatedCount() {
        return createdCount;
    }

    public void increment() {
        this.createdCount = this.createdCount + 1L;
    }
}

