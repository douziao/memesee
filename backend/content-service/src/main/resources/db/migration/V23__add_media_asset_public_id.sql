alter table media_assets
    add column public_id varchar(36) null after id;

update media_assets
set public_id = uuid()
where public_id is null;

alter table media_assets
    modify column public_id varchar(36) not null;

create unique index uk_media_assets_public_id
    on media_assets (public_id);
