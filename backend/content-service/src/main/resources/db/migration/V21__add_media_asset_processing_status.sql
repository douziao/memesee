alter table media_assets
    add column processing_status varchar(20) not null default 'READY' after status;

create index idx_media_assets_processing_status
    on media_assets (processing_status, id);
