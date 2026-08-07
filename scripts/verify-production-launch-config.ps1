$ErrorActionPreference = "Stop"

function Assert-Contains {
  param(
    [string]$Content,
    [string]$Pattern,
    [string]$Description
  )

  if ($Content -notmatch [regex]::Escape($Pattern)) {
    throw "launch verification command is missing $Description`: $Pattern`nCommand: $Content"
  }
}

function Assert-NotContains {
  param(
    [string]$Content,
    [string]$Pattern,
    [string]$Description
  )

  if ($Content -match [regex]::Escape($Pattern)) {
    throw "launch verification command unexpectedly includes $Description`: $Pattern`nCommand: $Content"
  }
}

$tempDirectory = [System.IO.Path]::GetTempPath()
$envFile = Join-Path $tempDirectory "memesee-launch-config-$([guid]::NewGuid().ToString('N')).env"
$auditFile = Join-Path $tempDirectory "memesee-launch-config-audit-$([guid]::NewGuid().ToString('N')).json"

try {
  @'
FRONTEND_ORIGIN=https://memesee.example
GATEWAY_HOST_PORT=18080
FRONTEND_HOST_PORT=13000
PROMETHEUS_HOST_PORT=19090
DEPLOY_VERIFY_METRIC_SCRAPE_WAIT_SECONDS=3
DEPLOY_VERIFY_API_LATENCY_ITERATIONS=4
DEPLOY_VERIFY_API_MAX_P95_MS=123
DEPLOY_VERIFY_API_MAX_ERROR_RATE_PERCENT=1.5
DEPLOY_VERIFY_MIN_CACHE_HIT_RATE_PERCENT=77
DEPLOY_VERIFY_CACHE_METRICS=true
DEPLOY_VERIFY_CONTENT_COMMAND_METRIC_DEFINITIONS=true
DEPLOY_VERIFY_CONTENT_COMMAND_METRICS=true
DEPLOY_VERIFY_OTEL_COLLECTOR_METRICS=false
DEPLOY_VERIFY_SHARE_HTML_BASE_URL=http://127.0.0.1:18111
DEPLOY_VERIFY_SHARE_HTML_PATH=/share/posts/9,/share/posts/9?subPost=8
DEPLOY_VERIFY_SHARE_HTML_OUTER_BASE_URL=https://outer.memesee.example
DEPLOY_VERIFY_SHARE_HTML_OUTER_PATH=/posts/9,/posts/9?subPost=8
DEPLOY_VERIFY_SHARE_HTML_HOST=share.memesee.example
DEPLOY_VERIFY_HTTPS_REDIRECT_BASE_URL=http://127.0.0.1:180
DEPLOY_VERIFY_HTTPS_REDIRECT_PATH=/posts/9,/posts/9?subPost=8
DEPLOY_VERIFY_HTTPS_REDIRECT_HOST=redirect.memesee.example
DEPLOY_VERIFY_HSTS_BASE_URL=https://memesee.example
DEPLOY_VERIFY_HSTS_PATH=/,/posts/9
DEPLOY_VERIFY_HSTS_HOST=hsts.memesee.example
DEPLOY_VERIFY_HSTS_SKIP_CERTIFICATE_CHECK=true
DEPLOY_VERIFY_MEDIA_URL=https://memesee.example/media/test.webp
'@ | Set-Content -Path $envFile -NoNewline

  $command = powershell -NoProfile -ExecutionPolicy Bypass -File scripts/verify-production-launch.ps1 -FromEnvFile $envFile -GatewayUrl http://127.0.0.1:28888 -PrintCommand
  $commandText = ($command -join "`n")

  foreach ($expectation in @(
    @{ Pattern = "-GatewayUrl http://127.0.0.1:28888"; Description = "explicit GatewayUrl override" },
    @{ Pattern = "-FrontendUrl http://127.0.0.1:13000"; Description = "frontend port from env" },
    @{ Pattern = "-PrometheusUrl http://127.0.0.1:19090"; Description = "prometheus port from env" },
    @{ Pattern = "-MetricScrapeWaitSec 3"; Description = "metric scrape wait from env" },
    @{ Pattern = "-ShareHtmlBaseUrl http://127.0.0.1:18111"; Description = "share HTML base URL from env" },
    @{ Pattern = "-ShareHtmlPrimePaths /share/posts/9,/share/posts/9?subPost=8"; Description = "share HTML prime paths from env" },
    @{ Pattern = "-ShareHtmlOuterBaseUrl https://outer.memesee.example"; Description = "outer share route base URL from env" },
    @{ Pattern = "-ShareHtmlOuterRoutePaths /posts/9,/posts/9?subPost=8"; Description = "outer share route paths from env" },
    @{ Pattern = "-ShareHtmlHost share.memesee.example"; Description = "share HTML host from env" },
    @{ Pattern = "-HttpsRedirectBaseUrl http://127.0.0.1:180"; Description = "HTTPS redirect base URL from env" },
    @{ Pattern = "-HttpsRedirectPaths /posts/9,/posts/9?subPost=8"; Description = "HTTPS redirect paths from env" },
    @{ Pattern = "-HttpsRedirectHost redirect.memesee.example"; Description = "HTTPS redirect host from env" },
    @{ Pattern = "-HstsBaseUrl https://memesee.example"; Description = "HSTS base URL from env" },
    @{ Pattern = "-HstsPaths /,/posts/9"; Description = "HSTS paths from env" },
    @{ Pattern = "-HstsHost hsts.memesee.example"; Description = "HSTS host from env" },
    @{ Pattern = "-HstsSkipCertificateCheck"; Description = "HSTS certificate bypass flag from env" },
    @{ Pattern = "-MediaUrl https://memesee.example/media/test.webp"; Description = "media URL from env" },
    @{ Pattern = "-VerifyCacheMetrics"; Description = "cache metric verification from env" },
    @{ Pattern = "-VerifyContentCommandMetricDefinitions"; Description = "content command metric definition verification from env" },
    @{ Pattern = "-VerifyContentCommandMetrics"; Description = "content command metric verification from env" },
    @{ Pattern = "-MinCacheHitRatePercent 77"; Description = "cache hit budget from env" },
    @{ Pattern = "-VerifyFrontendDiscoveryAssets"; Description = "frontend discovery asset verification" },
    @{ Pattern = "-LatencyIterations 4"; Description = "latency iterations from env" },
    @{ Pattern = "-MaxP95Ms 123"; Description = "latency p95 budget from env" },
    @{ Pattern = "-MaxErrorRatePercent 1.5"; Description = "latency error budget from env" }
  )) {
    Assert-Contains -Content $commandText -Pattern $expectation.Pattern -Description $expectation.Description
  }

  Assert-NotContains -Content $commandText -Pattern "-VerifyOtelCollectorMetrics" -Description "disabled OTEL collector metric verification"

  $internalCommand = powershell -NoProfile -ExecutionPolicy Bypass -File scripts/verify-production-launch.ps1 -FromEnvFile $envFile -InternalOnly -PrintCommand
  $internalCommandText = ($internalCommand -join "`n")
  foreach ($expectation in @(
    @{ Pattern = "-GatewayUrl http://127.0.0.1:18080"; Description = "internal gateway URL from env" },
    @{ Pattern = "-FrontendUrl http://127.0.0.1:13000"; Description = "internal frontend URL from env" },
    @{ Pattern = "-PrometheusUrl http://127.0.0.1:19090"; Description = "internal prometheus URL from env" },
    @{ Pattern = "-VerifyApiMetrics"; Description = "internal API metric verification" },
    @{ Pattern = "-VerifyProjectionQueryMetrics"; Description = "internal projection metric verification" },
    @{ Pattern = "-VerifyMediaWorkerMetrics"; Description = "internal media worker metric verification" },
    @{ Pattern = "-VerifyFrontendAssetCache"; Description = "internal frontend asset cache verification" },
    @{ Pattern = "-VerifyFrontendAssetCompression"; Description = "internal frontend asset compression verification" },
    @{ Pattern = "-VerifyFrontendDiscoveryAssets"; Description = "internal frontend discovery asset verification" },
    @{ Pattern = "-MeasureApiLatency"; Description = "internal API latency verification" }
  )) {
    Assert-Contains -Content $internalCommandText -Pattern $expectation.Pattern -Description $expectation.Description
  }
  foreach ($unexpected in @(
    @{ Pattern = "-VerifyShareHtmlMetrics"; Description = "public share HTML metric verification" },
    @{ Pattern = "-VerifyShareHtmlOuterRoute"; Description = "public share outer route verification" },
    @{ Pattern = "-VerifyHttpsRedirect"; Description = "public HTTPS redirect verification" },
    @{ Pattern = "-VerifyHsts"; Description = "public HSTS verification" }
  )) {
    Assert-NotContains -Content $internalCommandText -Pattern $unexpected.Pattern -Description $unexpected.Description
  }

  powershell -NoProfile -ExecutionPolicy Bypass -File scripts/verify-production-launch.ps1 -FromEnvFile $envFile -InternalOnly -PrintCommand -OutputFile $auditFile | Out-Null
  if (-not (Test-Path $auditFile)) {
    throw "launch verification command did not write OutputFile"
  }
  $audit = Get-Content -Raw $auditFile | ConvertFrom-Json
  if ($audit.Action -ne "ProductionLaunchVerification") {
    throw "launch verification OutputFile has unexpected Action: $($audit.Action)"
  }
  if ($audit.AuditSchemaVersion -ne 1) {
    throw "launch verification OutputFile must include AuditSchemaVersion=1"
  }
  if ($audit.Status -ne "PLAN") {
    throw "launch verification PrintCommand OutputFile must set Status=PLAN"
  }
  if (-not [bool]$audit.DryRun) {
    throw "launch verification PrintCommand OutputFile must set DryRun=true"
  }
  if (-not $audit.Evidence -or -not [bool]$audit.Evidence.PlanOnly -or [bool]$audit.Evidence.Operational -or [bool]$audit.Evidence.FormalReleaseEvidence) {
    throw "launch verification PrintCommand OutputFile must mark evidence as plan-only"
  }
  if ($audit.Mode -ne "InternalOnly") {
    throw "launch verification OutputFile must preserve InternalOnly mode"
  }
  if (-not $audit.Command -or $audit.Command -notmatch [regex]::Escape("verify-production-runtime.ps1")) {
    throw "launch verification OutputFile must include rendered runtime command"
  }
  if ($audit.Safety.WritesProductionData) {
    throw "launch verification OutputFile must mark launch checks as non-writing"
  }

  Write-Output "production launch command configuration ok"
} finally {
  if (Test-Path $envFile) {
    Remove-Item -LiteralPath $envFile -Force
  }
  if (Test-Path $auditFile) {
    Remove-Item -LiteralPath $auditFile -Force
  }
}
