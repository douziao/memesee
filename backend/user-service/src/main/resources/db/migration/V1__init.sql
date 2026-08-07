CREATE TABLE users (
    id BIGINT NOT NULL AUTO_INCREMENT,
    username VARCHAR(50) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at DATETIME(6) NOT NULL,
    level INT NOT NULL DEFAULT 0,
    PRIMARY KEY (id),
    CONSTRAINT uk_users_username UNIQUE (username)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE user_daily_metrics (
    id BIGINT NOT NULL AUTO_INCREMENT,
    username VARCHAR(50) NOT NULL,
    activity_date DATE NOT NULL,
    read_seconds BIGINT NOT NULL,
    likes_given BIGINT NOT NULL,
    likes_received BIGINT NOT NULL,
    visited BOOLEAN NOT NULL,
    updated_at DATETIME(6) NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT uk_user_daily_metric_user_date UNIQUE (username, activity_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_user_daily_metric_user ON user_daily_metrics (username);
CREATE INDEX idx_user_daily_metric_user_date ON user_daily_metrics (username, activity_date);

CREATE TABLE user_community_visits (
    id BIGINT NOT NULL AUTO_INCREMENT,
    username VARCHAR(50) NOT NULL,
    community_slug VARCHAR(64) NOT NULL,
    first_visited_at DATETIME(6) NOT NULL,
    last_visited_at DATETIME(6) NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT uk_user_community_visit_user_community UNIQUE (username, community_slug)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_user_community_visit_user ON user_community_visits (username);
CREATE INDEX idx_user_community_visit_community ON user_community_visits (community_slug);

CREATE TABLE user_community_sub_post_activities (
    id BIGINT NOT NULL AUTO_INCREMENT,
    username VARCHAR(50) NOT NULL,
    community_slug VARCHAR(64) NOT NULL,
    sub_post_count BIGINT NOT NULL,
    first_sub_post_at DATETIME(6) NOT NULL,
    last_sub_post_at DATETIME(6) NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT uk_user_community_sub_post_activity_user_community UNIQUE (username, community_slug)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_user_community_sub_post_activity_user ON user_community_sub_post_activities (username);
CREATE INDEX idx_user_community_sub_post_activity_user_last ON user_community_sub_post_activities (username, last_sub_post_at);

CREATE TABLE user_read_main_posts (
    id BIGINT NOT NULL AUTO_INCREMENT,
    username VARCHAR(50) NOT NULL,
    main_post_id BIGINT NOT NULL,
    community_slug VARCHAR(64) NULL,
    first_read_at DATETIME(6) NOT NULL,
    last_read_at DATETIME(6) NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT uk_user_read_main_post_user_post UNIQUE (username, main_post_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_user_read_main_post_user ON user_read_main_posts (username);
CREATE INDEX idx_user_read_main_post_user_last ON user_read_main_posts (username, last_read_at);

CREATE TABLE post_daily_stats (
    id BIGINT NOT NULL AUTO_INCREMENT,
    activity_date DATE NOT NULL,
    created_count BIGINT NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT uk_post_daily_stats_date UNIQUE (activity_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_post_daily_stats_date ON post_daily_stats (activity_date);

CREATE TABLE post_creation_records (
    id BIGINT NOT NULL AUTO_INCREMENT,
    main_post_id BIGINT NOT NULL,
    occurred_at DATETIME(6) NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT uk_post_creation_record_main_post_id UNIQUE (main_post_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_post_creation_record_main_post_id ON post_creation_records (main_post_id);

