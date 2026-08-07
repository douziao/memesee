create index idx_feed_items_author_latest
    on main_post_feed_items (author_username, deleted_at, latest_activity_at desc, main_post_id desc);
