alter table main_posts
    add column post_mode varchar(16) not null default 'long' after content;

alter table main_post_feed_items
    add column post_mode varchar(16) not null default 'long' after content_preview;
