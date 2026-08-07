param(
  [string]$FrontendUrl = "http://127.0.0.1:3000",
  [int]$TimeoutSec = 10,
  [switch]$VerifyAssetCompression
)

$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.Net.Http

function Join-Url {
  param(
    [string]$BaseUrl,
    [string]$Path
  )

  $normalizedBase = $BaseUrl.TrimEnd("/")
  $normalizedPath = if ($Path.StartsWith("/")) { $Path } else { "/$Path" }
  return "$normalizedBase$normalizedPath"
}

function Invoke-CheckedRequest {
  param(
    [string]$Url,
    [string]$Name
  )

  $response = Invoke-WebRequest -Uri $Url -Method GET -UseBasicParsing -TimeoutSec $TimeoutSec
  if ([int]$response.StatusCode -lt 200 -or [int]$response.StatusCode -ge 400) {
    throw "$Name returned HTTP $($response.StatusCode): $Url"
  }
  return $response
}

function Header-Value {
  param(
    [object]$Headers,
    [string]$Name
  )

  return @($Headers[$Name]) -join ", "
}

function Assert-NoCacheResponse {
  param(
    [object]$Response,
    [string]$Name
  )

  $cacheControl = Header-Value -Headers $Response.Headers -Name "Cache-Control"
  if ($cacheControl -notmatch "no-cache") {
    throw "$Name Cache-Control must be no-cache, got '$cacheControl'"
  }
  return $cacheControl
}

function Assert-AppShellResponse {
  param(
    [object]$Response,
    [string]$Name
  )

  if ($Response.Content -notmatch '<div\s+id="root"\s*>') {
    throw "$Name did not return the frontend app shell"
  }
}

function Assert-PublicDiscoveryAssetResponse {
  param(
    [object]$Response,
    [string]$Name,
    [string]$ExpectedContentTypePattern,
    [string]$ExpectedBodyPattern
  )

  $cacheControl = Assert-NoCacheResponse -Response $Response -Name $Name
  $contentType = Header-Value -Headers $Response.Headers -Name "Content-Type"
  if ($contentType -notmatch $ExpectedContentTypePattern) {
    throw "$Name Content-Type mismatch, got '$contentType'"
  }
  if ($Response.Content -match '<div\s+id="root"\s*>') {
    throw "$Name unexpectedly returned the frontend app shell"
  }
  if ($Response.Content -notmatch $ExpectedBodyPattern) {
    throw "$Name did not include expected discovery content"
  }

  return [PSCustomObject]@{
    CacheControl = $cacheControl
    ContentType = $contentType
  }
}

function Invoke-CheckedRawRequest {
  param(
    [string]$Url,
    [string]$Name,
    [hashtable]$Headers = @{}
  )

  $handler = [System.Net.Http.HttpClientHandler]::new()
  $handler.AutomaticDecompression = [System.Net.DecompressionMethods]::None
  $client = [System.Net.Http.HttpClient]::new($handler)
  $client.Timeout = [TimeSpan]::FromSeconds($TimeoutSec)
  $request = [System.Net.Http.HttpRequestMessage]::new([System.Net.Http.HttpMethod]::Get, $Url)
  foreach ($headerName in $Headers.Keys) {
    [void]$request.Headers.TryAddWithoutValidation($headerName, [string]$Headers[$headerName])
  }

  try {
    $response = $client.SendAsync($request).GetAwaiter().GetResult()
    if ([int]$response.StatusCode -lt 200 -or [int]$response.StatusCode -ge 400) {
      throw "$Name returned HTTP $([int]$response.StatusCode): $Url"
    }

    $responseHeaders = @{}
    foreach ($header in $response.Headers.GetEnumerator()) {
      $responseHeaders[$header.Key] = @($header.Value) -join ", "
    }
    foreach ($header in $response.Content.Headers.GetEnumerator()) {
      $responseHeaders[$header.Key] = @($header.Value) -join ", "
    }

    return [PSCustomObject]@{
      StatusCode = [int]$response.StatusCode
      Headers = $responseHeaders
    }
  } finally {
    if ($response) {
      $response.Dispose()
    }
    $request.Dispose()
    $client.Dispose()
    $handler.Dispose()
  }
}

$healthUrl = Join-Url -BaseUrl $FrontendUrl -Path "/healthz"
$healthResponse = Invoke-CheckedRequest -Url $healthUrl -Name "frontend healthz"
$healthCacheControl = Header-Value -Headers $healthResponse.Headers -Name "Cache-Control"
if ($healthCacheControl -notmatch "no-store") {
  throw "frontend /healthz Cache-Control must be no-store, got '$healthCacheControl'"
}

$indexResponse = Invoke-CheckedRequest -Url $FrontendUrl -Name "frontend index"
$indexCacheControl = Assert-NoCacheResponse -Response $indexResponse -Name "frontend index"
Assert-AppShellResponse -Response $indexResponse -Name "frontend index"

$spaRouteChecks = @(
  [PSCustomObject]@{
    Name = "post route"
    Path = "/posts/42"
  },
  [PSCustomObject]@{
    Name = "compose route"
    Path = "/compose"
  }
)
$spaRouteResults = @()
foreach ($spaRouteCheck in $spaRouteChecks) {
  $spaRouteUrl = Join-Url -BaseUrl $FrontendUrl -Path $spaRouteCheck.Path
  $spaRouteResponse = Invoke-CheckedRequest -Url $spaRouteUrl -Name "frontend SPA $($spaRouteCheck.Name)"
  $spaRouteCacheControl = Assert-NoCacheResponse -Response $spaRouteResponse -Name "frontend SPA $($spaRouteCheck.Name)"
  Assert-AppShellResponse -Response $spaRouteResponse -Name "frontend SPA $($spaRouteCheck.Name)"
  $spaRouteResults += [PSCustomObject]@{
    Name = $spaRouteCheck.Name
    Url = $spaRouteUrl
    StatusCode = [int]$spaRouteResponse.StatusCode
    CacheControl = $spaRouteCacheControl
  }
}

$robotsUrl = Join-Url -BaseUrl $FrontendUrl -Path "/robots.txt"
$robotsResponse = Invoke-CheckedRequest -Url $robotsUrl -Name "frontend robots.txt"
$robotsDiscoveryCheck = Assert-PublicDiscoveryAssetResponse `
  -Response $robotsResponse `
  -Name "frontend robots.txt" `
  -ExpectedContentTypePattern "text/plain" `
  -ExpectedBodyPattern "Sitemap:\s+https://memesee\.world/sitemap\.xml"

$sitemapUrl = Join-Url -BaseUrl $FrontendUrl -Path "/sitemap.xml"
$sitemapResponse = Invoke-CheckedRequest -Url $sitemapUrl -Name "frontend sitemap.xml"
$sitemapDiscoveryCheck = Assert-PublicDiscoveryAssetResponse `
  -Response $sitemapResponse `
  -Name "frontend sitemap.xml" `
  -ExpectedContentTypePattern "xml" `
  -ExpectedBodyPattern "<loc>https://memesee\.world/</loc>"

$assetMatch = [regex]::Match($indexResponse.Content, '(?:src|href)="(/assets/[^"]+\.(?:js|css))"')
if (-not $assetMatch.Success) {
  throw "frontend index did not reference a built /assets/*.js or /assets/*.css file"
}

$assetPath = $assetMatch.Groups[1].Value
$assetUrl = Join-Url -BaseUrl $FrontendUrl -Path $assetPath
$assetResponse = Invoke-CheckedRequest -Url $assetUrl -Name "frontend immutable asset"
$assetCacheControl = Header-Value -Headers $assetResponse.Headers -Name "Cache-Control"
if ($assetCacheControl -notmatch "max-age=31536000.*immutable") {
  throw "frontend asset Cache-Control must be immutable, got '$assetCacheControl'"
}

$assetCompressionCheck = $null
if ($VerifyAssetCompression) {
  $compressedAssetResponse = Invoke-CheckedRawRequest `
    -Url $assetUrl `
    -Name "frontend compressed immutable asset" `
    -Headers @{ "Accept-Encoding" = "gzip" }
  $assetContentEncoding = Header-Value -Headers $compressedAssetResponse.Headers -Name "Content-Encoding"
  if ($assetContentEncoding -notmatch "(^|,\s*)gzip(\s*,|$)") {
    throw "frontend asset Content-Encoding must include gzip when requested, got '$assetContentEncoding'"
  }
  $assetCompressionCheck = [PSCustomObject]@{
    Name = "asset gzip"
    Url = $assetUrl
    StatusCode = [int]$compressedAssetResponse.StatusCode
    ContentEncoding = $assetContentEncoding
  }
}

$checks = @(
  [PSCustomObject]@{
    Name = "healthz"
    Url = $healthUrl
    StatusCode = [int]$healthResponse.StatusCode
    CacheControl = $healthCacheControl
  },
  [PSCustomObject]@{
    Name = "index"
    Url = $FrontendUrl
    StatusCode = [int]$indexResponse.StatusCode
    CacheControl = $indexCacheControl
  }
)
$checks += $spaRouteResults
$checks += [PSCustomObject]@{
  Name = "robots.txt"
  Url = $robotsUrl
  StatusCode = [int]$robotsResponse.StatusCode
  CacheControl = $robotsDiscoveryCheck.CacheControl
  ContentType = $robotsDiscoveryCheck.ContentType
}
$checks += [PSCustomObject]@{
  Name = "sitemap.xml"
  Url = $sitemapUrl
  StatusCode = [int]$sitemapResponse.StatusCode
  CacheControl = $sitemapDiscoveryCheck.CacheControl
  ContentType = $sitemapDiscoveryCheck.ContentType
}
$checks += [PSCustomObject]@{
  Name = "asset"
  Url = $assetUrl
  StatusCode = [int]$assetResponse.StatusCode
  CacheControl = $assetCacheControl
}

if ($assetCompressionCheck) {
  $checks += $assetCompressionCheck
}

[PSCustomObject]@{
  FrontendUrl = $FrontendUrl
  Checks = $checks
} | ConvertTo-Json -Depth 4
