set foreign_key_checks = 0;

delete from sub_post_media_links
where media_asset_id in (
    select id from media_assets where storage_provider = 'LOCAL'
);

delete from main_post_media_links
where media_asset_id in (
    select id from media_assets where storage_provider = 'LOCAL'
);

delete from media_asset_variants
where storage_provider = 'LOCAL'
   or media_asset_id in (
       select id from media_assets where storage_provider = 'LOCAL'
   );

delete from media_assets
where storage_provider = 'LOCAL';

set foreign_key_checks = 1;
