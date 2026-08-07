alter table main_posts
    modify column updated_at timestamp(6) not null default current_timestamp(6);

alter table sub_posts
    modify column updated_at timestamp(6) not null default current_timestamp(6);
