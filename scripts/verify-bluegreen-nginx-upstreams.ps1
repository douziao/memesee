$ErrorActionPreference = "Stop"

. (Join-Path $PSScriptRoot "nginx-upstream-utils.ps1")

function Assert-Contains {
  param(
    [string]$Content,
    [string]$Pattern,
    [string]$Description
  )

  if ($Content -notmatch $Pattern) {
    throw "missing $Description"
  }
}

function Assert-Count {
  param(
    [string]$Content,
    [string]$Pattern,
    [int]$Expected,
    [string]$Description
  )

  $count = ([regex]::Matches($Content, $Pattern)).Count
  if ($count -ne $Expected) {
    throw "expected $Expected matches for $Description, got $count"
  }
}

function Invoke-UpstreamRewriteCase {
  param([string]$SourcePath)

  $tempPath = Join-Path ([System.IO.Path]::GetTempPath()) "memesee-nginx-upstreams-$([guid]::NewGuid().ToString('N')).conf"
  try {
    Copy-Item -LiteralPath $SourcePath -Destination $tempPath -Force
    Set-NginxUpstreams -Path $tempPath -Gateway 18081 -Frontend 13001 -Minio 19002
    $content = Get-Content -Raw $tempPath

    Assert-Count -Content $content -Pattern "proxy_pass\s+http://127\.0\.0\.1:18081;" -Expected 3 -Description "$SourcePath gateway upstreams"
    Assert-Count -Content $content -Pattern "proxy_pass\s+http://127\.0\.0\.1:13001;" -Expected 2 -Description "$SourcePath frontend upstreams"
    Assert-Count -Content $content -Pattern "proxy_pass\s+http://127\.0\.0\.1:19002/memesee-post-images/;" -Expected 1 -Description "$SourcePath media upstream"

    Assert-Contains -Content $content -Pattern "(?s)location\s+/api/\s*\{.*?proxy_pass\s+http://127\.0\.0\.1:18081;" -Description "$SourcePath API location rewrite"
    Assert-Contains -Content $content -Pattern "(?s)location\s+/share/\s*\{.*?proxy_pass\s+http://127\.0\.0\.1:18081;" -Description "$SourcePath share location rewrite"
    Assert-Contains -Content $content -Pattern "(?s)location\s+@memesee_share_post\s*\{.*?proxy_pass\s+http://127\.0\.0\.1:18081;" -Description "$SourcePath share fallback rewrite"
    Assert-Contains -Content $content -Pattern "(?s)location\s+/media/\s*\{.*?proxy_pass\s+http://127\.0\.0\.1:19002/memesee-post-images/;" -Description "$SourcePath media rewrite"
    Assert-Contains -Content $content -Pattern "(?s)location\s+~\s+\^/posts/\[0-9\]\+/\?\$\s*\{.*?proxy_pass\s+http://127\.0\.0\.1:13001;" -Description "$SourcePath post SPA rewrite"
    Assert-Contains -Content $content -Pattern "(?s)location\s+/\s*\{.*?proxy_pass\s+http://127\.0\.0\.1:13001;" -Description "$SourcePath root frontend rewrite"
  } finally {
    if (Test-Path $tempPath) {
      Remove-Item -LiteralPath $tempPath -Force
    }
  }
}

foreach ($configPath in @(
  "deploy/nginx/memesee.world.http.conf",
  "deploy/nginx/memesee.world.ssl.conf"
)) {
  Invoke-UpstreamRewriteCase -SourcePath $configPath
}

foreach ($scriptPath in @(
  "scripts/deploy-bluegreen.ps1",
  "scripts/rollback-bluegreen.ps1"
)) {
  Assert-Contains -Content (Get-Content -Raw $scriptPath) -Pattern "nginx-upstream-utils\.ps1" -Description "$scriptPath shared upstream helper"
}

Write-Output "blue/green nginx upstream rewrites ok"
