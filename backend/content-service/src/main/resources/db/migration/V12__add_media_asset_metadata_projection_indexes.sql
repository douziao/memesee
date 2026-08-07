CREATE INDEX idx_media_assets_owner_status_id
    ON media_assets (owner_username, status, id);
