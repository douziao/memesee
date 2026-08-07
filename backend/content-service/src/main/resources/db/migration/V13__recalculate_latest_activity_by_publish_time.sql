update main_posts mp
set latest_activity_at = greatest(
    mp.created_at,
    coalesce(
        (
            select max(sp.created_at)
            from sub_posts sp
            where sp.main_post_id = mp.id
              and sp.deleted_at is null
        ),
        mp.created_at
    )
);
