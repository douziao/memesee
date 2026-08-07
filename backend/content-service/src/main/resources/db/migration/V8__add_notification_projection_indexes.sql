create index idx_notifications_username_read_at_created_at
    on notifications (username, read_at, created_at desc, id desc);

create index idx_notifications_username_type_created_at
    on notifications (username, type, created_at desc, id desc);

create index idx_notifications_username_actor_created_at
    on notifications (username, actor_username, created_at desc, id desc);
