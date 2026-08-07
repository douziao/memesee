$ErrorActionPreference = "Stop"

$migrationDir = Join-Path "backend" "content-service/src/main/resources/db/migration"
if (-not (Test-Path $migrationDir)) {
  throw "missing $migrationDir"
}

$migrationFiles = Get-ChildItem -Path $migrationDir -Filter "*.sql" | Sort-Object Name
if ($migrationFiles.Count -eq 0) {
  throw "no content-service migrations found in $migrationDir"
}

$sql = ($migrationFiles | ForEach-Object { Get-Content -Raw $_.FullName }) -join "`n"
$normalizedSql = ($sql -replace "\s+", " ").ToLowerInvariant()

function Assert-SqlContains {
  param(
    [Parameter(Mandatory = $true)]
    [string] $Expected,
    [Parameter(Mandatory = $true)]
    [string] $Description
  )

  $normalizedExpected = ($Expected -replace "\s+", " ").ToLowerInvariant()
  if (-not $normalizedSql.Contains($normalizedExpected)) {
    throw "missing critical content DB index: $Description"
  }
}

Assert-SqlContains `
  "create index idx_feed_items_author_latest on main_post_feed_items (author_username, deleted_at, latest_activity_at desc, main_post_id desc)" `
  "author profile feed sorted by latest activity"

Assert-SqlContains `
  "create index idx_main_post_media_links_owner_sort_asset on main_post_media_links (main_post_id, sort_order, id, media_asset_id)" `
  "main post media attachment ordered projection"

Assert-SqlContains `
  "create index idx_sub_post_media_links_owner_sort_asset on sub_post_media_links (sub_post_id, sort_order, id, media_asset_id)" `
  "sub post media attachment ordered projection"

Assert-SqlContains `
  "create index idx_media_asset_variants_media_asset_id on media_asset_variants (media_asset_id)" `
  "media asset variant batch loading"

Assert-SqlContains `
  "create index idx_main_post_media_links_asset_owner on main_post_media_links (media_asset_id, main_post_id)" `
  "main post media reverse lookup by asset"

Assert-SqlContains `
  "create index idx_sub_post_media_links_asset_owner on sub_post_media_links (media_asset_id, sub_post_id)" `
  "sub post media reverse lookup by asset"

$indexNames = [regex]::Matches($normalizedSql, "create\s+(?:unique\s+)?index\s+([a-z0-9_]+)") |
  ForEach-Object { $_.Groups[1].Value }

$duplicateIndexNames = $indexNames |
  Group-Object |
  Where-Object { $_.Count -gt 1 } |
  ForEach-Object { $_.Name }

if ($duplicateIndexNames.Count -gt 0) {
  throw "duplicate migration index names found: $($duplicateIndexNames -join ', ')"
}

Write-Output "content DB index coverage ok"
