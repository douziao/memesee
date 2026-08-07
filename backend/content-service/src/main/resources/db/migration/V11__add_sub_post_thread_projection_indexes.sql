create index idx_sub_posts_main_post_deleted_created_at_id
    on sub_posts (main_post_id, deleted_at, created_at asc, id asc);
