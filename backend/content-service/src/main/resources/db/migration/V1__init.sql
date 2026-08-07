create table communities (
    id bigint not null auto_increment,
    slug varchar(50) not null,
    name varchar(60) not null,
    description varchar(255) not null,
    sort_order int not null,
    created_at timestamp(6) not null default current_timestamp(6),
    updated_at timestamp(6) not null default current_timestamp(6) on update current_timestamp(6),
    primary key (id),
    constraint uk_communities_slug unique (slug)
);

create table main_posts (
    id bigint not null auto_increment,
    community_id bigint not null,
    author_username varchar(80) not null,
    title varchar(120) not null,
    content text not null,
    heat_score decimal(18, 6) not null default 0,
    view_count bigint not null default 0,
    sub_post_count bigint not null default 0,
    like_count bigint not null default 0,
    favorite_count bigint not null default 0,
    created_at timestamp(6) not null default current_timestamp(6),
    updated_at timestamp(6) not null default current_timestamp(6) on update current_timestamp(6),
    deleted_at timestamp(6) null,
    primary key (id),
    constraint fk_main_posts_community_id foreign key (community_id) references communities (id)
);

create index idx_main_posts_community_created_at on main_posts (community_id, created_at desc);
create index idx_main_posts_created_at on main_posts (created_at desc);
create index idx_main_posts_heat_score on main_posts (heat_score desc, created_at desc);

create table sub_posts (
    id bigint not null auto_increment,
    main_post_id bigint not null,
    parent_sub_post_id bigint null,
    author_username varchar(80) not null,
    content text not null,
    like_count bigint not null default 0,
    child_sub_post_count bigint not null default 0,
    created_at timestamp(6) not null default current_timestamp(6),
    updated_at timestamp(6) not null default current_timestamp(6) on update current_timestamp(6),
    deleted_at timestamp(6) null,
    primary key (id),
    constraint fk_sub_posts_main_post_id foreign key (main_post_id) references main_posts (id),
    constraint fk_sub_posts_parent_sub_post_id foreign key (parent_sub_post_id) references sub_posts (id)
);

create index idx_sub_posts_main_post_created_at on sub_posts (main_post_id, created_at asc);
create index idx_sub_posts_parent_sub_post_created_at on sub_posts (parent_sub_post_id, created_at asc);

create table media_assets (
    id bigint not null auto_increment,
    owner_username varchar(80) not null,
    kind varchar(20) not null,
    storage_provider varchar(30) not null,
    bucket_name varchar(80) not null,
    object_key varchar(255) not null,
    original_filename varchar(255) not null,
    content_type varchar(100) not null,
    size_bytes bigint not null,
    status varchar(20) not null,
    created_at timestamp(6) not null default current_timestamp(6),
    updated_at timestamp(6) not null default current_timestamp(6) on update current_timestamp(6),
    primary key (id),
    constraint uk_media_assets_bucket_object_key unique (bucket_name, object_key)
);

create table main_post_media_links (
    id bigint not null auto_increment,
    main_post_id bigint not null,
    media_asset_id bigint not null,
    sort_order int not null default 0,
    role varchar(30) not null default 'attachment',
    created_at timestamp(6) not null default current_timestamp(6),
    primary key (id),
    constraint uk_main_post_media_links unique (main_post_id, media_asset_id),
    constraint fk_main_post_media_links_main_post_id foreign key (main_post_id) references main_posts (id),
    constraint fk_main_post_media_links_media_asset_id foreign key (media_asset_id) references media_assets (id)
);

create table sub_post_media_links (
    id bigint not null auto_increment,
    sub_post_id bigint not null,
    media_asset_id bigint not null,
    sort_order int not null default 0,
    role varchar(30) not null default 'attachment',
    created_at timestamp(6) not null default current_timestamp(6),
    primary key (id),
    constraint uk_sub_post_media_links unique (sub_post_id, media_asset_id),
    constraint fk_sub_post_media_links_sub_post_id foreign key (sub_post_id) references sub_posts (id),
    constraint fk_sub_post_media_links_media_asset_id foreign key (media_asset_id) references media_assets (id)
);

create table main_post_likes (
    id bigint not null auto_increment,
    main_post_id bigint not null,
    username varchar(80) not null,
    created_at timestamp(6) not null default current_timestamp(6),
    primary key (id),
    constraint uk_main_post_likes unique (main_post_id, username),
    constraint fk_main_post_likes_main_post_id foreign key (main_post_id) references main_posts (id)
);

create table sub_post_likes (
    id bigint not null auto_increment,
    sub_post_id bigint not null,
    username varchar(80) not null,
    created_at timestamp(6) not null default current_timestamp(6),
    primary key (id),
    constraint uk_sub_post_likes unique (sub_post_id, username),
    constraint fk_sub_post_likes_sub_post_id foreign key (sub_post_id) references sub_posts (id)
);

create table main_post_favorites (
    id bigint not null auto_increment,
    main_post_id bigint not null,
    username varchar(80) not null,
    created_at timestamp(6) not null default current_timestamp(6),
    primary key (id),
    constraint uk_main_post_favorites unique (main_post_id, username),
    constraint fk_main_post_favorites_main_post_id foreign key (main_post_id) references main_posts (id)
);

create table notifications (
    id bigint not null auto_increment,
    username varchar(80) not null,
    type varchar(40) not null,
    title varchar(120) not null,
    body varchar(500) not null,
    main_post_id bigint null,
    sub_post_id bigint null,
    actor_username varchar(80) null,
    read_at timestamp(6) null,
    created_at timestamp(6) not null default current_timestamp(6),
    primary key (id),
    constraint fk_notifications_main_post_id foreign key (main_post_id) references main_posts (id),
    constraint fk_notifications_sub_post_id foreign key (sub_post_id) references sub_posts (id)
);

create index idx_notifications_username_created_at on notifications (username, created_at desc);
