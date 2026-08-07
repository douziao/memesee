create index idx_feed_items_heat_community
    on main_post_feed_items (community_slug, deleted_at, heat_score desc, created_at desc, main_post_id desc);

create index idx_feed_items_views_community
    on main_post_feed_items (community_slug, deleted_at, view_count desc, created_at desc, main_post_id desc);
