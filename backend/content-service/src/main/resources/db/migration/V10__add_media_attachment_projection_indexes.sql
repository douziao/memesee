CREATE INDEX idx_main_post_media_links_owner_sort_asset
    ON main_post_media_links (main_post_id, sort_order, id, media_asset_id);

CREATE INDEX idx_sub_post_media_links_owner_sort_asset
    ON sub_post_media_links (sub_post_id, sort_order, id, media_asset_id);
