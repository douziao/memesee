CREATE TABLE invite_codes (
    id BIGINT NOT NULL AUTO_INCREMENT,
    code VARCHAR(64) NOT NULL,
    max_uses INT NOT NULL DEFAULT 1,
    used_count INT NOT NULL DEFAULT 0,
    disabled BOOLEAN NOT NULL DEFAULT FALSE,
    expires_at DATETIME(6) NULL,
    created_at DATETIME(6) NOT NULL,
    used_at DATETIME(6) NULL,
    used_by VARCHAR(50) NULL,
    PRIMARY KEY (id),
    CONSTRAINT uk_invite_codes_code UNIQUE (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_invite_codes_code ON invite_codes (code);
CREATE INDEX idx_invite_codes_expires_at ON invite_codes (expires_at);
