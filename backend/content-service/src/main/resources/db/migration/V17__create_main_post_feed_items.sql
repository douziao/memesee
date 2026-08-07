create table main_post_feed_items (
    main_post_id bigint not null,
    community_id bigint not null,
    community_slug varchar(50) not null,
    community_name varchar(60) not null,
    title varchar(120) not null,
    content_preview varchar(220) not null,
    author_username varchar(80) not null,
    tags_json varchar(255) not null,
    media_assets_json longtext not null,
    preview_image_urls_json longtext not null,
    heat_score decimal(18, 6) not null,
    view_count bigint not null,
    sub_post_count bigint not null,
    like_count bigint not null,
    favorite_count bigint not null,
    created_at timestamp(6) not null,
    updated_at timestamp(6) not null,
    latest_activity_at timestamp(6) not null,
    deleted_at timestamp(6) null,
    projection_updated_at timestamp(6) not null default current_timestamp(6) on update current_timestamp(6),
    primary key (main_post_id)
);

create index idx_feed_items_latest_lobby
    on main_post_feed_items (deleted_at, latest_activity_at desc, main_post_id desc);

create index idx_feed_items_latest_community
    on main_post_feed_items (community_slug, deleted_at, latest_activity_at desc, main_post_id desc);

create index idx_feed_items_heat_lobby
    on main_post_feed_items (deleted_at, heat_score desc, created_at desc, main_post_id desc);

create index idx_feed_items_views_lobby
    on main_post_feed_items (deleted_at, view_count desc, created_at desc, main_post_id desc);

insert into main_post_feed_items (
    main_post_id,
    community_id,
    community_slug,
    community_name,
    title,
    content_preview,
    author_username,
    tags_json,
    media_assets_json,
    preview_image_urls_json,
    heat_score,
    view_count,
    sub_post_count,
    like_count,
    favorite_count,
    created_at,
    updated_at,
    latest_activity_at,
    deleted_at
)
select
    p.id,
    c.id,
    c.slug,
    c.name,
    p.title,
    left(regexp_replace(regexp_replace(p.content, '!\\[[^]]*]\\([^)]+\\)', ' '), '\\s+', ' '), 220),
    p.author_username,
    coalesce(p.tags, '[]'),
    '[]',
    '[]',
    p.heat_score,
    p.view_count,
    p.sub_post_count,
    p.like_count,
    p.favorite_count,
    p.created_at,
    p.updated_at,
    p.latest_activity_at,
    p.deleted_at
from main_posts p
join communities c on c.id = p.community_id;
