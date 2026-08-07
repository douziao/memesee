create index idx_main_posts_deleted_view_count_created_at
    on main_posts (deleted_at, view_count desc, created_at desc, id desc);

create index idx_main_posts_community_deleted_latest_activity_at
    on main_posts (community_id, deleted_at, latest_activity_at desc, id desc);

create index idx_main_posts_author_deleted_latest_activity_at
    on main_posts (author_username, deleted_at, latest_activity_at desc, id desc);

create index idx_main_post_likes_username_created_at
    on main_post_likes (username, created_at desc, main_post_id desc);

create index idx_main_post_favorites_username_created_at
    on main_post_favorites (username, created_at desc, main_post_id desc);

create index idx_sub_post_likes_username_created_at
    on sub_post_likes (username, created_at desc, sub_post_id desc);

create index idx_sub_post_favorites_username_created_at
    on sub_post_favorites (username, created_at desc, sub_post_id desc);
