create table media_asset_variants (
    id bigint not null auto_increment,
    media_asset_id bigint not null,
    kind varchar(20) not null,
    storage_provider varchar(30) not null,
    bucket_name varchar(80) not null,
    object_key varchar(255) not null,
    content_type varchar(100) not null,
    size_bytes bigint not null,
    width int not null,
    height int not null,
    created_at timestamp(6) not null default current_timestamp(6),
    primary key (id),
    constraint uk_media_asset_variants_asset_kind unique (media_asset_id, kind),
    constraint uk_media_asset_variants_bucket_object_key unique (bucket_name, object_key),
    constraint fk_media_asset_variants_media_asset_id foreign key (media_asset_id) references media_assets (id)
);

create index idx_media_asset_variants_media_asset_id
    on media_asset_variants (media_asset_id);

set foreign_key_checks = 0;

delete from content_outbox_events;
delete from notifications;
delete from sub_post_favorites;
delete from main_post_favorites;
delete from sub_post_likes;
delete from main_post_likes;
delete from sub_post_media_links;
delete from main_post_media_links;
delete from sub_posts;
delete from main_posts;
delete from media_asset_variants;
delete from media_assets;

alter table content_outbox_events auto_increment = 1;
alter table notifications auto_increment = 1;
alter table sub_post_favorites auto_increment = 1;
alter table main_post_favorites auto_increment = 1;
alter table sub_post_likes auto_increment = 1;
alter table main_post_likes auto_increment = 1;
alter table sub_post_media_links auto_increment = 1;
alter table main_post_media_links auto_increment = 1;
alter table sub_posts auto_increment = 1;
alter table main_posts auto_increment = 1;
alter table media_asset_variants auto_increment = 1;
alter table media_assets auto_increment = 1;

set foreign_key_checks = 1;
