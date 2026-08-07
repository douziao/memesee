param(
  [string]$GatewayUrl = "http://127.0.0.1:8080",
  [string]$FrontendUrl = "http://127.0.0.1:3000",
  [string]$PrometheusUrl = "http://127.0.0.1:9090",
  [int]$TimeoutSec = 15,
  [switch]$MeasureApiLatency,
  [int]$LatencyIterations = 30,
  [int]$LatencyWarmup = 3,
  [int]$MaxP95Ms = 0,
  [double]$MaxErrorRatePercent = -1,
  [string[]]$LatencyPaths = @(
    "/api/communities",
    "/api/feed?size=10"
  ),
  [switch]$PrimeMetrics,
  [string[]]$MetricPrimePaths = @(
    "/api/communities",
    "/api/feed?size=10"
  ),
  [int]$MetricScrapeWaitSec = 0,
  [string[]]$ExpectedPrometheusJobs = @(
    "memesee-gateway-service",
    "memesee-user-service",
    "memesee-content-service",
    "memesee-media-worker",
    "memesee-otel-collector"
  ),
  [switch]$VerifyApiMetrics,
  [string[]]$ApiMetricQueries = @(
    'http_server_requests_seconds_count{job=~"memesee-.*",uri!~"/actuator.*"}',
    'http_server_requests_seconds_bucket{job=~"memesee-.*",uri!~"/actuator.*"}'
  ),
  [switch]$VerifyProjectionQueryMetrics,
  [string[]]$ProjectionQueryMetricQueries = @(
    "memesee_projection_query_duration_seconds_count"
  ),
  [switch]$VerifyContentCommandMetrics,
  [string[]]$ContentCommandMetricQueries = @(
    'memesee_content_command_total{operation!="startup"}',
    'memesee_content_command_duration_seconds_count{operation!="startup"}'
  ),
  [switch]$VerifyContentCommandMetricDefinitions,
  [string[]]$ContentCommandMetricDefinitionQueries = @(
    'memesee_content_command_total{aggregate="content-command",operation="startup",outcome="ready",postMode="unknown"}',
    'memesee_content_command_duration_seconds_count{aggregate="content-command",operation="startup",outcome="ready",postMode="unknown"}'
  ),
  [switch]$VerifyInternalAdminMetricDefinitions,
  [string[]]$InternalAdminMetricDefinitionQueries = @(
    'memesee_internal_admin_operation_total{operation="startup",outcome="ready"}',
    'memesee_internal_admin_operation_duration_seconds_count{operation="startup",outcome="ready"}'
  ),
  [switch]$VerifyInternalAdminMetrics,
  [string[]]$InternalAdminMetricQueries = @(
    'memesee_internal_admin_operation_total{operation!="startup"}',
    'memesee_internal_admin_operation_duration_seconds_count{operation!="startup"}'
  ),
  [switch]$VerifyMediaWorkerMetrics,
  [string[]]$MediaWorkerMetricQueries = @(
    "memesee_media_worker_ready",
    "memesee_media_worker_processed_total",
    "memesee_media_worker_failed_total"
  ),
  [switch]$VerifyOtelCollectorMetrics,
  [string[]]$OtelCollectorMetricQueries = @(
    'otelcol_receiver_accepted_spans_total{job="memesee-otel-collector"}',
    'otelcol_exporter_sent_spans_total{job="memesee-otel-collector"}'
  ),
  [switch]$VerifyFrontendAssetCache,
  [switch]$VerifyFrontendAssetCompression,
  [switch]$VerifyFrontendDiscoveryAssets,
  [string[]]$FrontendSpaRoutePaths = @(
    "/posts/42",
    "/compose"
  ),
  [string]$MediaUrl = "",
  [switch]$VerifyMediaRangeRequest,
  [switch]$VerifyCacheMetrics,
  [string[]]$CacheMetricQueries = @(
    "memesee_cache_operations_total"
  ),
  [double]$MinCacheHitRatePercent = -1,
  [string]$CacheHitRateQuery = @"
100 * sum(memesee_cache_operations_total{operation="hit"}) / clamp_min(sum(memesee_cache_operations_total{operation=~"hit|miss"}), 1)
"@,
  [switch]$VerifyShareHtmlMetrics,
  [string]$ShareHtmlBaseUrl = "",
  [string[]]$ShareHtmlPrimePaths = @(
    "/share/posts/1"
  ),
  [string]$ShareHtmlUserAgent = "Twitterbot/1.0",
  [string]$ShareHtmlHost = "",
  [string[]]$ShareHtmlMetricQueries = @(
    "memesee_share_html_render_total",
    "memesee_share_html_render_duration_seconds_count"
  ),
  [switch]$VerifyShareHtmlOuterRoute,
  [string]$ShareHtmlOuterBaseUrl = "",
  [string[]]$ShareHtmlOuterRoutePaths = @(
    "/posts/1"
  ),
  [switch]$VerifyHttpsRedirect,
  [string]$HttpsRedirectBaseUrl = "",
  [string[]]$HttpsRedirectPaths = @(
    "/posts/1"
  ),
  [string]$HttpsRedirectHost = "",
  [switch]$VerifyHsts,
  [string]$HstsBaseUrl = "",
  [string[]]$HstsPaths = @(
    "/"
  ),
  [string]$HstsHost = "",
  [string]$HstsExpectedPattern = "max-age=31536000.*includeSubDomains",
  [switch]$HstsSkipCertificateCheck
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

function Split-ConfiguredList {
  param([string[]]$Values)

  return @($Values |
    ForEach-Object { [string]$_ } |
    ForEach-Object { $_ -split "," } |
    ForEach-Object { $_.Trim() } |
    Where-Object { $_ })
}

function Invoke-HealthRequest {
  param(
    [string]$Url,
    [string]$Name
  )

  $response = Invoke-WebRequest -Uri $Url -Method GET -UseBasicParsing -TimeoutSec $TimeoutSec
  if ([int]$response.StatusCode -lt 200 -or [int]$response.StatusCode -ge 400) {
    throw "$Name returned HTTP $($response.StatusCode): $Url"
  }
  [PSCustomObject]@{
    Name = $Name
    Url = $Url
    StatusCode = [int]$response.StatusCode
  }
}

function Invoke-CacheHeaderRequest {
  param(
    [string]$Url,
    [string]$Name,
    [string]$ExpectedPattern = "max-age=31536000.*immutable",
    [string]$ExpectedContentTypePattern = "",
    [switch]$RejectAppShell
  )

  $response = Invoke-WebRequest -Uri $Url -Method GET -UseBasicParsing -TimeoutSec $TimeoutSec
  if ([int]$response.StatusCode -lt 200 -or [int]$response.StatusCode -ge 400) {
    throw "$Name returned HTTP $($response.StatusCode): $Url"
  }

  $cacheControl = @($response.Headers["Cache-Control"]) -join ", "
  if ($cacheControl -notmatch $ExpectedPattern) {
    throw "$Name Cache-Control header '$cacheControl' does not match '$ExpectedPattern': $Url"
  }
  $contentType = @($response.Headers["Content-Type"]) -join ", "
  if ($ExpectedContentTypePattern -and $contentType -notmatch $ExpectedContentTypePattern) {
    throw "$Name Content-Type '$contentType' does not match '$ExpectedContentTypePattern': $Url"
  }
  if ($RejectAppShell -and $response.Content -match '<div\s+id="root"\s*>') {
    throw "$Name unexpectedly returned the frontend app shell: $Url"
  }

  $result = [ordered]@{
    Name = $Name
    Url = $Url
    StatusCode = [int]$response.StatusCode
    CacheControl = $cacheControl
  }
  if ($ExpectedContentTypePattern) {
    $result.ContentType = $contentType
  }
  [PSCustomObject]$result
}

function Invoke-FrontendAppShellRequest {
  param(
    [string]$Url,
    [string]$Name
  )

  $response = Invoke-WebRequest -Uri $Url -Method GET -UseBasicParsing -TimeoutSec $TimeoutSec
  if ([int]$response.StatusCode -lt 200 -or [int]$response.StatusCode -ge 400) {
    throw "$Name returned HTTP $($response.StatusCode): $Url"
  }

  $cacheControl = @($response.Headers["Cache-Control"]) -join ", "
  if ($cacheControl -notmatch "no-cache") {
    throw "$Name Cache-Control must be no-cache, got '$cacheControl': $Url"
  }
  if ($response.Content -notmatch '<div\s+id="root"\s*>') {
    throw "$Name did not return the frontend app shell: $Url"
  }

  [PSCustomObject]@{
    Name = $Name
    Url = $Url
    StatusCode = [int]$response.StatusCode
    CacheControl = $cacheControl
  }
}

function Invoke-FrontendDiscoveryAssetRequest {
  param(
    [string]$Url,
    [string]$Name,
    [string]$ExpectedContentTypePattern,
    [string]$ExpectedBodyPattern
  )

  $response = Invoke-WebRequest -Uri $Url -Method GET -UseBasicParsing -TimeoutSec $TimeoutSec
  if ([int]$response.StatusCode -lt 200 -or [int]$response.StatusCode -ge 400) {
    throw "$Name returned HTTP $($response.StatusCode): $Url"
  }

  $contentType = @($response.Headers["Content-Type"]) -join ", "
  if ($contentType -notmatch $ExpectedContentTypePattern) {
    throw "$Name Content-Type '$contentType' does not match '$ExpectedContentTypePattern': $Url"
  }
  $cacheControl = @($response.Headers["Cache-Control"]) -join ", "
  if ($cacheControl -notmatch "no-cache") {
    throw "$Name Cache-Control must be no-cache, got '$cacheControl': $Url"
  }
  if ($response.Content -match '<div\s+id="root"\s*>') {
    throw "$Name unexpectedly returned the frontend app shell: $Url"
  }
  if ($response.Content -notmatch $ExpectedBodyPattern) {
    throw "$Name did not include expected discovery content: $Url"
  }
  if ($response.Content -match "https?://(localhost|127\.0\.0\.1)(:\d+)?") {
    throw "$Name must not include local development origins: $Url"
  }

  [PSCustomObject]@{
    Name = $Name
    Url = $Url
    StatusCode = [int]$response.StatusCode
    ContentType = $contentType
    CacheControl = $cacheControl
  }
}

function Invoke-CompressedHeaderRequest {
  param(
    [string]$Url,
    [string]$Name
  )

  $handler = [System.Net.Http.HttpClientHandler]::new()
  $handler.AutomaticDecompression = [System.Net.DecompressionMethods]::None
  $client = [System.Net.Http.HttpClient]::new($handler)
  $client.Timeout = [TimeSpan]::FromSeconds($TimeoutSec)
  $request = [System.Net.Http.HttpRequestMessage]::new([System.Net.Http.HttpMethod]::Get, $Url)
  [void]$request.Headers.TryAddWithoutValidation("Accept-Encoding", "gzip")

  try {
    $response = $client.SendAsync($request).GetAwaiter().GetResult()
    if ([int]$response.StatusCode -lt 200 -or [int]$response.StatusCode -ge 400) {
      throw "$Name returned HTTP $([int]$response.StatusCode): $Url"
    }

    $contentEncoding = @($response.Content.Headers.ContentEncoding) -join ", "
    if ($contentEncoding -notmatch "(^|,\s*)gzip(\s*,|$)") {
      throw "$Name Content-Encoding must include gzip when requested, got '$contentEncoding': $Url"
    }

    [PSCustomObject]@{
      Name = $Name
      Url = $Url
      StatusCode = [int]$response.StatusCode
      ContentEncoding = $contentEncoding
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

function Invoke-RangeHeaderRequest {
  param(
    [string]$Url,
    [string]$Name
  )

  $handler = [System.Net.Http.HttpClientHandler]::new()
  $handler.AutomaticDecompression = [System.Net.DecompressionMethods]::None
  $client = [System.Net.Http.HttpClient]::new($handler)
  $client.Timeout = [TimeSpan]::FromSeconds($TimeoutSec)
  $request = [System.Net.Http.HttpRequestMessage]::new([System.Net.Http.HttpMethod]::Get, $Url)
  [void]$request.Headers.TryAddWithoutValidation("Range", "bytes=0-0")

  try {
    $response = $client.SendAsync($request, [System.Net.Http.HttpCompletionOption]::ResponseHeadersRead).GetAwaiter().GetResult()
    if ([int]$response.StatusCode -ne 206) {
      throw "$Name must support byte range requests with HTTP 206, got HTTP $([int]$response.StatusCode): $Url"
    }

    $contentRange = @($response.Content.Headers.ContentRange) -join ", "
    if ($contentRange -notmatch "^bytes\s+0-0/") {
      throw "$Name Content-Range must start with 'bytes 0-0/', got '$contentRange': $Url"
    }

    $acceptRanges = if ($response.Headers.Contains("Accept-Ranges")) {
      @($response.Headers.GetValues("Accept-Ranges")) -join ", "
    } else {
      ""
    }
    if ($acceptRanges -and $acceptRanges -notmatch "(^|,\s*)bytes(\s*,|$)") {
      throw "$Name Accept-Ranges must include bytes when present, got '$acceptRanges': $Url"
    }

    [PSCustomObject]@{
      Name = $Name
      Url = $Url
      StatusCode = [int]$response.StatusCode
      ContentRange = $contentRange
      AcceptRanges = $acceptRanges
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

function Get-ExpectedSharePublicPath {
  param([string]$Url)

  $uri = [Uri]$Url
  $pathAndQuery = $uri.PathAndQuery
  if ($pathAndQuery -match "^/share/posts/") {
    return $pathAndQuery -replace "^/share/posts/", "/posts/"
  }
  return $pathAndQuery
}

function Assert-ShareHtmlMeta {
  param(
    [string]$Content,
    [string]$Name,
    [string]$Pattern,
    [string]$Description,
    [string]$Url
  )

  if ($Content -notmatch $Pattern) {
    throw "$Name did not return share HTML with $Description`: $Url"
  }
}

function Invoke-ShareHtmlPrimeRequest {
  param(
    [string]$Url,
    [string]$Name
  )

  $headers = @{
    "User-Agent" = $ShareHtmlUserAgent
  }
  if ($ShareHtmlHost.Trim()) {
    $headers["Host"] = $ShareHtmlHost.Trim()
  }

  $response = Invoke-WebRequest -Uri $Url -Method GET -Headers $headers -UseBasicParsing -TimeoutSec $TimeoutSec
  if ([int]$response.StatusCode -lt 200 -or [int]$response.StatusCode -ge 400) {
    throw "$Name returned HTTP $($response.StatusCode): $Url"
  }

  $contentType = @($response.Headers["Content-Type"]) -join ", "
  if ($contentType -notmatch "text/html") {
    throw "$Name Content-Type must include text/html, got '$contentType': $Url"
  }
  if ($response.Content -notmatch '<meta\s+property="og:title"') {
    throw "$Name did not return share HTML with og:title: $Url"
  }
  if ($response.Content -match '<div\s+id="root"\s*>') {
    throw "$Name unexpectedly returned the frontend app shell: $Url"
  }

  Assert-ShareHtmlMeta `
    -Content $response.Content `
    -Name $Name `
    -Pattern '<meta\s+property="og:url"\s+content="https?://[^"]+"' `
    -Description "absolute og:url" `
    -Url $Url
  Assert-ShareHtmlMeta `
    -Content $response.Content `
    -Name $Name `
    -Pattern '<link\s+rel="canonical"\s+href="https?://[^"]+"' `
    -Description "absolute canonical link" `
    -Url $Url
  Assert-ShareHtmlMeta `
    -Content $response.Content `
    -Name $Name `
    -Pattern '<meta\s+property="og:image"\s+content="https?://[^"]+"' `
    -Description "absolute og:image" `
    -Url $Url
  Assert-ShareHtmlMeta `
    -Content $response.Content `
    -Name $Name `
    -Pattern '<meta\s+property="og:image:alt"\s+content="[^"]+"' `
    -Description "og:image:alt" `
    -Url $Url
  Assert-ShareHtmlMeta `
    -Content $response.Content `
    -Name $Name `
    -Pattern '<meta\s+property="og:image:width"\s+content="[1-9][0-9]*"' `
    -Description "positive og:image:width" `
    -Url $Url
  Assert-ShareHtmlMeta `
    -Content $response.Content `
    -Name $Name `
    -Pattern '<meta\s+property="og:image:height"\s+content="[1-9][0-9]*"' `
    -Description "positive og:image:height" `
    -Url $Url
  Assert-ShareHtmlMeta `
    -Content $response.Content `
    -Name $Name `
    -Pattern '<meta\s+name="twitter:card"\s+content="summary_large_image"' `
    -Description "twitter summary_large_image card" `
    -Url $Url
  Assert-ShareHtmlMeta `
    -Content $response.Content `
    -Name $Name `
    -Pattern '<meta\s+name="twitter:image"\s+content="https?://[^"]+"' `
    -Description "absolute twitter:image" `
    -Url $Url
  Assert-ShareHtmlMeta `
    -Content $response.Content `
    -Name $Name `
    -Pattern '<meta\s+name="twitter:image:alt"\s+content="[^"]+"' `
    -Description "twitter:image:alt" `
    -Url $Url

  if ($response.Content -match "og-image\.svg") {
    throw "$Name still references SVG default OG image instead of production PNG: $Url"
  }

  $expectedPublicPath = Get-ExpectedSharePublicPath -Url $Url
  if ($response.Content -notmatch [regex]::Escape($expectedPublicPath)) {
    throw "$Name share HTML did not preserve expected public path '$expectedPublicPath': $Url"
  }

  [PSCustomObject]@{
    Name = $Name
    Url = $Url
    StatusCode = [int]$response.StatusCode
    ContentType = $contentType
    ExpectedPublicPath = $expectedPublicPath
  }
}

function Invoke-HttpsRedirectRequest {
  param(
    [string]$Url,
    [string]$Path,
    [string]$HostName,
    [string]$Name
  )

  $requestUri = [Uri]$Url
  $expectedHost = if ($HostName.Trim()) { $HostName.Trim() } else { $requestUri.Host }
  $expectedLocation = "https://${expectedHost}${Path}"

  $handler = [System.Net.Http.HttpClientHandler]::new()
  $handler.AllowAutoRedirect = $false
  $client = [System.Net.Http.HttpClient]::new($handler)
  $client.Timeout = [TimeSpan]::FromSeconds($TimeoutSec)
  $request = [System.Net.Http.HttpRequestMessage]::new([System.Net.Http.HttpMethod]::Get, $Url)
  if ($HostName.Trim()) {
    $request.Headers.Host = $HostName.Trim()
  }

  try {
    $response = $client.SendAsync($request).GetAwaiter().GetResult()
    if ([int]$response.StatusCode -ne 301) {
      throw "$Name must return HTTP 301, got HTTP $([int]$response.StatusCode): $Url"
    }

    $actualLocation = [string]$response.Headers.Location
    if ($actualLocation -ne $expectedLocation) {
      throw "$Name expected Location '$expectedLocation', got '$actualLocation': $Url"
    }

    [PSCustomObject]@{
      Name = $Name
      Url = $Url
      StatusCode = [int]$response.StatusCode
      Host = $expectedHost
      Location = $actualLocation
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

function Invoke-HstsRequest {
  param(
    [string]$Url,
    [string]$HostName,
    [string]$Name
  )

  $handler = [System.Net.Http.HttpClientHandler]::new()
  $handler.AllowAutoRedirect = $false
  if ($HstsSkipCertificateCheck) {
    $handler.ServerCertificateCustomValidationCallback = { $true }
  }

  $client = [System.Net.Http.HttpClient]::new($handler)
  $client.Timeout = [TimeSpan]::FromSeconds($TimeoutSec)
  $request = [System.Net.Http.HttpRequestMessage]::new([System.Net.Http.HttpMethod]::Get, $Url)
  if ($HostName.Trim()) {
    $request.Headers.Host = $HostName.Trim()
  }

  try {
    $response = $client.SendAsync($request).GetAwaiter().GetResult()
    if ([int]$response.StatusCode -lt 200 -or [int]$response.StatusCode -ge 400) {
      throw "$Name returned HTTP $([int]$response.StatusCode): $Url"
    }

    $strictTransportSecurity = if ($response.Headers.Contains("Strict-Transport-Security")) {
      @($response.Headers.GetValues("Strict-Transport-Security")) -join ", "
    } else {
      ""
    }
    if ($strictTransportSecurity -notmatch $HstsExpectedPattern) {
      throw "$Name Strict-Transport-Security header '$strictTransportSecurity' does not match '$HstsExpectedPattern': $Url"
    }

    [PSCustomObject]@{
      Name = $Name
      Url = $Url
      StatusCode = [int]$response.StatusCode
      StrictTransportSecurity = $strictTransportSecurity
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

function Get-FirstFrontendAssetUrl {
  param([string]$BaseUrl)

  $response = Invoke-WebRequest -Uri $BaseUrl -Method GET -UseBasicParsing -TimeoutSec $TimeoutSec
  $matches = [regex]::Matches($response.Content, '(?:src|href)="(/assets/[^"]+\.(?:js|css))"')
  if ($matches.Count -eq 0) {
    throw "frontend index did not reference a built /assets/*.js or /assets/*.css file"
  }
  return Join-Url -BaseUrl $BaseUrl -Path $matches[0].Groups[1].Value
}

function Get-PrometheusTargets {
  param([string]$BaseUrl)

  $targetsUrl = Join-Url -BaseUrl $BaseUrl -Path "/api/v1/targets?state=active"
  $response = Invoke-WebRequest -Uri $targetsUrl -Method GET -UseBasicParsing -TimeoutSec $TimeoutSec
  $payload = $response.Content | ConvertFrom-Json
  if ($payload.status -ne "success") {
    throw "Prometheus targets API returned status $($payload.status)"
  }
  return @($payload.data.activeTargets)
}

function Invoke-PrometheusQuery {
  param(
    [string]$BaseUrl,
    [string]$Query
  )

  $encodedQuery = [System.Uri]::EscapeDataString($Query)
  $queryUrl = Join-Url -BaseUrl $BaseUrl -Path "/api/v1/query?query=$encodedQuery"
  $response = Invoke-WebRequest -Uri $queryUrl -Method GET -UseBasicParsing -TimeoutSec $TimeoutSec
  $payload = $response.Content | ConvertFrom-Json
  if ($payload.status -ne "success") {
    throw "Prometheus query returned status $($payload.status): $Query"
  }
  $items = @($payload.data.result)
  if ($items.Count -eq 0) {
    throw "Prometheus query returned no samples: $Query"
  }
  return [PSCustomObject]@{
    Query = $Query
    Samples = $items.Count
  }
}

function Invoke-PrometheusScalarQuery {
  param(
    [string]$BaseUrl,
    [string]$Query,
    [string]$Name
  )

  $encodedQuery = [System.Uri]::EscapeDataString($Query)
  $queryUrl = Join-Url -BaseUrl $BaseUrl -Path "/api/v1/query?query=$encodedQuery"
  $response = Invoke-WebRequest -Uri $queryUrl -Method GET -UseBasicParsing -TimeoutSec $TimeoutSec
  $payload = $response.Content | ConvertFrom-Json
  if ($payload.status -ne "success") {
    throw "Prometheus query returned status $($payload.status): $Query"
  }

  $items = @($payload.data.result)
  if ($items.Count -eq 0) {
    throw "Prometheus query returned no samples for ${Name}: $Query"
  }

  $rawValue = [string]$items[0].value[1]
  $value = 0.0
  if (-not [double]::TryParse($rawValue, [Globalization.NumberStyles]::Float, [Globalization.CultureInfo]::InvariantCulture, [ref]$value)) {
    throw "Prometheus query returned non-numeric value for ${Name}: $rawValue"
  }
  if ([double]::IsNaN($value) -or [double]::IsInfinity($value)) {
    throw "Prometheus query returned invalid value for ${Name}: $rawValue"
  }

  return [PSCustomObject]@{
    Name = $Name
    Query = $Query
    Value = [Math]::Round($value, 2)
  }
}

$checks = @()
$checks += Invoke-HealthRequest -Url (Join-Url -BaseUrl $GatewayUrl -Path "/api/communities") -Name "gateway communities API"
$checks += Invoke-FrontendAppShellRequest -Url $FrontendUrl -Name "frontend"
$checks += Invoke-HealthRequest -Url (Join-Url -BaseUrl $PrometheusUrl -Path "/-/ready") -Name "prometheus ready"

$metricPrimeRequests = @()
if ($PrimeMetrics) {
  $metricPrimeRequests = @($MetricPrimePaths | ForEach-Object {
    Invoke-HealthRequest -Url (Join-Url -BaseUrl $GatewayUrl -Path $_) -Name "metric prime $_"
  })
}

if ($MetricScrapeWaitSec -gt 0) {
  Start-Sleep -Seconds $MetricScrapeWaitSec
}

$targets = Get-PrometheusTargets -BaseUrl $PrometheusUrl
$memeseeTargets = @($targets | Where-Object { ([string]$_.labels.job).StartsWith("memesee-") })
if ($memeseeTargets.Count -eq 0) {
  throw "Prometheus has no active memesee-* scrape targets"
}

$actualJobs = @($memeseeTargets | ForEach-Object { [string]$_.labels.job } | Sort-Object -Unique)
$missingJobs = @($ExpectedPrometheusJobs | Where-Object { $actualJobs -notcontains $_ })
if ($missingJobs.Count -gt 0) {
  throw "Prometheus is missing expected memesee scrape jobs: $($missingJobs -join ', ')"
}

$downTargets = @($memeseeTargets | Where-Object { $_.health -ne "up" })
if ($downTargets.Count -gt 0) {
  $summary = $downTargets | ForEach-Object { "$($_.labels.job)@$($_.labels.instance)=$($_.health)" }
  throw "Prometheus scrape targets are not all up: $($summary -join ', ')"
}

$result = [ordered]@{
  Checks = $checks
  FrontendSpaRoutes = @($FrontendSpaRoutePaths | ForEach-Object {
    Invoke-FrontendAppShellRequest -Url (Join-Url -BaseUrl $FrontendUrl -Path $_) -Name "frontend SPA route $_"
  })
  PrometheusTargets = @($memeseeTargets | ForEach-Object {
    [PSCustomObject]@{
      Job = $_.labels.job
      Instance = $_.labels.instance
      Health = $_.health
      LastScrape = $_.lastScrape
    }
  })
}

if ($PrimeMetrics) {
  $result.MetricPrimeRequests = $metricPrimeRequests
}

if ($VerifyShareHtmlMetrics) {
  $shareBaseUrl = if ($ShareHtmlBaseUrl.Trim()) { $ShareHtmlBaseUrl.Trim() } else { $GatewayUrl }
  $shareHtmlPrimePathsToVerify = @(Split-ConfiguredList -Values $ShareHtmlPrimePaths)
  if ($shareHtmlPrimePathsToVerify.Count -eq 0) {
    throw "-VerifyShareHtmlMetrics requires at least one -ShareHtmlPrimePaths value"
  }
  $result.ShareHtmlPrimeRequests = @($shareHtmlPrimePathsToVerify | ForEach-Object {
    Invoke-ShareHtmlPrimeRequest -Url (Join-Url -BaseUrl $shareBaseUrl -Path $_) -Name "share HTML prime $_"
  })

  if ($MetricScrapeWaitSec -gt 0) {
    Start-Sleep -Seconds $MetricScrapeWaitSec
  }

  $result.ShareHtmlMetrics = @($ShareHtmlMetricQueries | ForEach-Object {
    Invoke-PrometheusQuery -BaseUrl $PrometheusUrl -Query $_
  })
}

if ($VerifyShareHtmlOuterRoute) {
  $outerBaseUrl = if ($ShareHtmlOuterBaseUrl.Trim()) { $ShareHtmlOuterBaseUrl.Trim() } else { $FrontendUrl }
  $shareHtmlOuterRoutePathsToVerify = @(Split-ConfiguredList -Values $ShareHtmlOuterRoutePaths)
  if ($shareHtmlOuterRoutePathsToVerify.Count -eq 0) {
    throw "-VerifyShareHtmlOuterRoute requires at least one -ShareHtmlOuterRoutePaths value"
  }
  $result.ShareHtmlOuterRoutes = @($shareHtmlOuterRoutePathsToVerify | ForEach-Object {
    Invoke-ShareHtmlPrimeRequest -Url (Join-Url -BaseUrl $outerBaseUrl -Path $_) -Name "share HTML outer route $_"
  })
}

if ($VerifyHttpsRedirect) {
  $httpsRedirectBaseUrl = if ($HttpsRedirectBaseUrl.Trim()) { $HttpsRedirectBaseUrl.Trim() } else { $FrontendUrl }
  $httpsRedirectPathsToVerify = @(Split-ConfiguredList -Values $HttpsRedirectPaths)
  if ($httpsRedirectPathsToVerify.Count -eq 0) {
    throw "-VerifyHttpsRedirect requires at least one -HttpsRedirectPaths value"
  }
  $result.HttpsRedirects = @($httpsRedirectPathsToVerify | ForEach-Object {
    Invoke-HttpsRedirectRequest `
      -Url (Join-Url -BaseUrl $httpsRedirectBaseUrl -Path $_) `
      -Path $_ `
      -HostName $HttpsRedirectHost `
      -Name "HTTPS redirect $_"
  })
}

if ($VerifyHsts) {
  $hstsBaseUrl = if ($HstsBaseUrl.Trim()) { $HstsBaseUrl.Trim() } else { $FrontendUrl }
  $hstsPathsToVerify = @(Split-ConfiguredList -Values $HstsPaths)
  if ($hstsPathsToVerify.Count -eq 0) {
    throw "-VerifyHsts requires at least one -HstsPaths value"
  }
  $result.HstsHeaders = @($hstsPathsToVerify | ForEach-Object {
    Invoke-HstsRequest `
      -Url (Join-Url -BaseUrl $hstsBaseUrl -Path $_) `
      -HostName $HstsHost `
      -Name "HSTS $_"
  })
}

if ($VerifyApiMetrics) {
  $result.ApiMetrics = @($ApiMetricQueries | ForEach-Object {
    Invoke-PrometheusQuery -BaseUrl $PrometheusUrl -Query $_
  })
}

if ($VerifyProjectionQueryMetrics) {
  $result.ProjectionQueryMetrics = @($ProjectionQueryMetricQueries | ForEach-Object {
    Invoke-PrometheusQuery -BaseUrl $PrometheusUrl -Query $_
  })
}

if ($VerifyContentCommandMetricDefinitions) {
  $result.ContentCommandMetricDefinitions = @($ContentCommandMetricDefinitionQueries | ForEach-Object {
    Invoke-PrometheusQuery -BaseUrl $PrometheusUrl -Query $_
  })
}

if ($VerifyContentCommandMetrics) {
  $result.ContentCommandMetrics = @($ContentCommandMetricQueries | ForEach-Object {
    Invoke-PrometheusQuery -BaseUrl $PrometheusUrl -Query $_
  })
}

if ($VerifyInternalAdminMetricDefinitions) {
  $result.InternalAdminMetricDefinitions = @($InternalAdminMetricDefinitionQueries | ForEach-Object {
    Invoke-PrometheusQuery -BaseUrl $PrometheusUrl -Query $_
  })
}

if ($VerifyInternalAdminMetrics) {
  $result.InternalAdminMetrics = @($InternalAdminMetricQueries | ForEach-Object {
    Invoke-PrometheusQuery -BaseUrl $PrometheusUrl -Query $_
  })
}

if ($VerifyMediaWorkerMetrics) {
  $result.MediaWorkerMetrics = @($MediaWorkerMetricQueries | ForEach-Object {
    Invoke-PrometheusQuery -BaseUrl $PrometheusUrl -Query $_
  })
}

if ($VerifyOtelCollectorMetrics) {
  $result.OtelCollectorMetrics = @($OtelCollectorMetricQueries | ForEach-Object {
    Invoke-PrometheusQuery -BaseUrl $PrometheusUrl -Query $_
  })
}

if ($VerifyFrontendAssetCache -or $VerifyFrontendAssetCompression) {
  $assetUrl = Get-FirstFrontendAssetUrl -BaseUrl $FrontendUrl
}

if ($VerifyFrontendAssetCache) {
  $result.FrontendAssetCache = Invoke-CacheHeaderRequest -Url $assetUrl -Name "frontend immutable asset"
}

if ($VerifyFrontendAssetCompression) {
  $result.FrontendAssetCompression = Invoke-CompressedHeaderRequest -Url $assetUrl -Name "frontend compressed immutable asset"
}

if ($VerifyFrontendDiscoveryAssets) {
  $result.FrontendDiscoveryAssets = @(
    Invoke-FrontendDiscoveryAssetRequest `
      -Url (Join-Url -BaseUrl $FrontendUrl -Path "/robots.txt") `
      -Name "frontend robots.txt" `
      -ExpectedContentTypePattern "text/plain" `
      -ExpectedBodyPattern "Sitemap:\s+https://memesee\.world/sitemap\.xml"
    Invoke-FrontendDiscoveryAssetRequest `
      -Url (Join-Url -BaseUrl $FrontendUrl -Path "/sitemap.xml") `
      -Name "frontend sitemap.xml" `
      -ExpectedContentTypePattern "xml|text/plain" `
      -ExpectedBodyPattern "<loc>https://memesee\.world/</loc>"
  )
}

if ($MediaUrl.Trim()) {
  $mediaAssetUrl = $MediaUrl.Trim()
  $result.MediaCache = Invoke-CacheHeaderRequest `
    -Url $mediaAssetUrl `
    -Name "media immutable asset" `
    -ExpectedContentTypePattern "^image/" `
    -RejectAppShell
  if ($VerifyMediaRangeRequest) {
    $result.MediaRange = Invoke-RangeHeaderRequest -Url $mediaAssetUrl -Name "media byte range"
  }
} elseif ($VerifyMediaRangeRequest) {
  throw "-VerifyMediaRangeRequest requires -MediaUrl"
}

if ($VerifyCacheMetrics) {
  $result.CacheMetrics = @($CacheMetricQueries | ForEach-Object {
    Invoke-PrometheusQuery -BaseUrl $PrometheusUrl -Query $_
  })
}

if ($MinCacheHitRatePercent -ge 0) {
  $cacheHitRate = Invoke-PrometheusScalarQuery `
    -BaseUrl $PrometheusUrl `
    -Query $CacheHitRateQuery `
    -Name "cache hit rate percent"
  if ($cacheHitRate.Value -lt $MinCacheHitRatePercent) {
    throw "Cache hit rate $($cacheHitRate.Value)% is below budget ${MinCacheHitRatePercent}%"
  }
  $result.CacheHitRate = $cacheHitRate
}

if ($MeasureApiLatency) {
  $latencyScript = Join-Path $PSScriptRoot "measure-api-latency.ps1"
  $latencyParams = @{
    GatewayUrl = $GatewayUrl
    Iterations = $LatencyIterations
    Warmup = $LatencyWarmup
    TimeoutSec = $TimeoutSec
    MaxP95Ms = $MaxP95Ms
    MaxErrorRatePercent = $MaxErrorRatePercent
    Paths = $LatencyPaths
  }

  $latencyJson = & $latencyScript @latencyParams
  $result.ApiLatency = ($latencyJson -join "`n") | ConvertFrom-Json
}

$result | ConvertTo-Json -Depth 8
