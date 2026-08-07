alter table main_posts
    add column latest_activity_at timestamp(6) not null default current_timestamp(6) after updated_at;

update main_posts mp
set latest_activity_at = greatest(
    mp.created_at,
    mp.updated_at,
    coalesce(
        (
            select max(greatest(sp.created_at, sp.updated_at))
            from sub_posts sp
            where sp.main_post_id = mp.id
              and sp.deleted_at is null
        ),
        mp.created_at
    )
);

create index idx_main_posts_latest_activity_at on main_posts (latest_activity_at desc, id desc);
