create table sub_post_favorites (
    id bigint not null auto_increment,
    sub_post_id bigint not null,
    username varchar(80) not null,
    created_at timestamp(6) not null default current_timestamp(6),
    primary key (id),
    constraint uk_sub_post_favorites unique (sub_post_id, username),
    constraint fk_sub_post_favorites_sub_post_id foreign key (sub_post_id) references sub_posts (id)
);

create index idx_sub_post_favorites_sub_post_id on sub_post_favorites (sub_post_id);
