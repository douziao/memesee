create index idx_main_post_media_links_asset_owner
    on main_post_media_links (media_asset_id, main_post_id);

create index idx_sub_post_media_links_asset_owner
    on sub_post_media_links (media_asset_id, sub_post_id);
