$ErrorActionPreference = "Stop"

function Assert-ConfigContains {
  param(
    [string]$Content,
    [string]$Pattern,
    [string]$Description,
    [string]$Path
  )

  if ($Content -notmatch $Pattern) {
    throw "$Path is missing $Description"
  }
}

function Get-LocationBlock {
  param(
    [string]$Content,
    [string]$LocationPattern,
    [string]$Description,
    [string]$Path
  )

  $match = [regex]::Match($Content, "(?s)$LocationPattern\s*\{(?<body>.*?)\n\s*\}")
  if (-not $match.Success) {
    throw "$Path is missing $Description location block"
  }
  return $match.Groups["body"].Value
}

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$nginxConfigPath = Join-Path $repoRoot "frontend/nginx.conf"

if (-not (Test-Path $nginxConfigPath)) {
  throw "Missing frontend nginx config: $nginxConfigPath"
}

$content = Get-Content -Raw $nginxConfigPath

Assert-ConfigContains -Content $content -Path $nginxConfigPath -Description "gzip enablement" -Pattern "(?m)^\s*gzip\s+on;"
Assert-ConfigContains -Content $content -Path $nginxConfigPath -Description "gzip compression level" -Pattern "(?m)^\s*gzip_comp_level\s+[4-9];"
Assert-ConfigContains -Content $content -Path $nginxConfigPath -Description "javascript gzip type" -Pattern "(?m)^\s*gzip_types\s+.*application/javascript"
Assert-ConfigContains -Content $content -Path $nginxConfigPath -Description "css gzip type" -Pattern "(?m)^\s*gzip_types\s+.*text/css"
Assert-ConfigContains -Content $content -Path $nginxConfigPath -Description "json gzip type" -Pattern "(?m)^\s*gzip_types\s+.*application/json"

$healthzBlock = Get-LocationBlock -Content $content -LocationPattern "location\s+=\s+/healthz" -Description "/healthz" -Path $nginxConfigPath
Assert-ConfigContains -Content $healthzBlock -Path $nginxConfigPath -Description "/healthz no-store cache policy" -Pattern "add_header\s+Cache-Control\s+`"no-store`"\s+always;"
Assert-ConfigContains -Content $healthzBlock -Path $nginxConfigPath -Description "/healthz response" -Pattern "return\s+200"

$robotsBlock = Get-LocationBlock -Content $content -LocationPattern "location\s+=\s+/robots\.txt" -Description "/robots.txt" -Path $nginxConfigPath
Assert-ConfigContains -Content $robotsBlock -Path $nginxConfigPath -Description "/robots.txt exact static file guard" -Pattern "try_files\s+[$]uri\s+=404;"
Assert-ConfigContains -Content $robotsBlock -Path $nginxConfigPath -Description "/robots.txt no-cache policy" -Pattern "add_header\s+Cache-Control\s+`"no-cache`"\s+always;"

$sitemapBlock = Get-LocationBlock -Content $content -LocationPattern "location\s+=\s+/sitemap\.xml" -Description "/sitemap.xml" -Path $nginxConfigPath
Assert-ConfigContains -Content $sitemapBlock -Path $nginxConfigPath -Description "/sitemap.xml exact static file guard" -Pattern "try_files\s+[$]uri\s+=404;"
Assert-ConfigContains -Content $sitemapBlock -Path $nginxConfigPath -Description "/sitemap.xml no-cache policy" -Pattern "add_header\s+Cache-Control\s+`"no-cache`"\s+always;"

$assetsBlock = Get-LocationBlock -Content $content -LocationPattern "location\s+/assets/" -Description "/assets/" -Path $nginxConfigPath
Assert-ConfigContains -Content $assetsBlock -Path $nginxConfigPath -Description "/assets try_files guard" -Pattern "try_files\s+[$]uri\s+=404;"
Assert-ConfigContains -Content $assetsBlock -Path $nginxConfigPath -Description "immutable built asset cache policy" -Pattern "add_header\s+Cache-Control\s+`"public,\s*max-age=31536000,\s*immutable`"\s+always;"

$spaBlock = Get-LocationBlock -Content $content -LocationPattern "location\s+/" -Description "SPA fallback" -Path $nginxConfigPath
Assert-ConfigContains -Content $spaBlock -Path $nginxConfigPath -Description "SPA fallback" -Pattern "try_files\s+[$]uri\s+[$]uri/\s+/index\.html;"
Assert-ConfigContains -Content $spaBlock -Path $nginxConfigPath -Description "SPA no-cache policy" -Pattern "add_header\s+Cache-Control\s+`"no-cache`"\s+always;"

Write-Output "frontend nginx configuration ok"
