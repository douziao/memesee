alter table main_posts
    add column tags varchar(255) not null default '[]' after content;
