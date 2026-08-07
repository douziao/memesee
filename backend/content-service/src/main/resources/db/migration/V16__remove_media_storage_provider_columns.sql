alter table media_asset_variants
    drop column storage_provider;

alter table media_assets
    drop column storage_provider;
