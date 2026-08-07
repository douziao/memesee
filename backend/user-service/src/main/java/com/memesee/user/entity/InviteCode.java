package com.memesee.user.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;

@Entity
@Table(name = "invite_codes")
public class InviteCode {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 64)
    private String code;

    @Column(nullable = false)
    private int maxUses = 1;

    @Column(nullable = false)
    private int usedCount = 0;

    @Column(nullable = false)
    private boolean disabled = false;

    private Instant expiresAt;

    @Column(nullable = false, updatable = false)
    private Instant createdAt;

    private Instant usedAt;

    @Column(length = 50)
    private String usedBy;

    public InviteCode() {
    }

    public boolean isDisabled() {
        return disabled;
    }

    public boolean isExpired(Instant now) {
        return expiresAt != null && !expiresAt.isAfter(now);
    }

    public boolean hasRemainingUses() {
        return usedCount < maxUses;
    }

    public void consume(String username, Instant now) {
        usedCount += 1;
        usedBy = username;
        usedAt = now;
    }
}
