CREATE TABLE user_community_main_post_activities (
    id BIGINT NOT NULL AUTO_INCREMENT,
    username VARCHAR(50) NOT NULL,
    community_slug VARCHAR(64) NOT NULL,
    main_post_count BIGINT NOT NULL,
    first_main_post_at DATETIME(6) NOT NULL,
    last_main_post_at DATETIME(6) NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT uk_user_community_main_post_activity_user_community UNIQUE (username, community_slug)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_user_community_main_post_activity_user ON user_community_main_post_activities (username);
CREATE INDEX idx_user_community_main_post_activity_user_last ON user_community_main_post_activities (username, last_main_post_at);
