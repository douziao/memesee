param(
  [string]$FromEnvFile = "",
  [string]$GatewayUrl = "http://127.0.0.1:8080",
  [string]$FrontendUrl = "http://127.0.0.1:3000",
  [string]$PrometheusUrl = "http://127.0.0.1:9090",
  [string]$PublicHttpBaseUrl = "http://127.0.0.1",
  [string]$PublicHttpsBaseUrl = "https://memesee.world",
  [string]$Domain = "memesee.world",
  [string]$ShareHtmlBaseUrl = "",
  [string]$ShareHtmlOuterBaseUrl = "",
  [string]$ShareHtmlHost = "",
  [string]$HttpsRedirectHost = "",
  [string]$HstsHost = "",
  [long]$MainPostId = 1,
  [long]$SubPostId = 0,
  [string]$ShareHtmlPrimePaths = "",
  [string]$ShareHtmlOuterRoutePaths = "",
  [string]$HttpsRedirectPaths = "",
  [string]$HstsPaths = "",
  [string]$MediaUrl = "",
  [int]$MetricScrapeWaitSec = 20,
  [int]$LatencyIterations = 50,
  [int]$MaxP95Ms = 500,
  [double]$MaxErrorRatePercent = 0,
  [int]$MinCacheHitRatePercent = 60,
  [switch]$IncludeCacheMetrics,
  [switch]$IncludeContentCommandMetricDefinitions,
  [switch]$IncludeContentCommandMetrics,
  [switch]$IncludeInternalAdminMetricDefinitions,
  [switch]$IncludeInternalAdminMetrics,
  [switch]$SkipOtelCollectorMetrics,
  [switch]$HstsSkipCertificateCheck,
  [switch]$InternalOnly,
  [switch]$PrintCommand,
  [string]$OutputFile = ""
)

$ErrorActionPreference = "Stop"
$startedAt = (Get-Date).ToUniversalTime()

$scriptBoundParameters = @{}
foreach ($entry in $PSBoundParameters.GetEnumerator()) {
  $scriptBoundParameters[$entry.Key] = $entry.Value
}

function Read-EnvFile {
  param([string]$Path)

  if (-not (Test-Path $Path)) {
    throw "missing env file: $Path"
  }

  $values = @{}
  Get-Content $Path | ForEach-Object {
    $line = $_.Trim()
    if (-not $line -or $line.StartsWith("#") -or $line -notmatch "=") {
      return
    }
    $name, $value = $line -split "=", 2
    $values[$name.Trim()] = $value.Trim().Trim('"').Trim("'")
  }
  return $values
}

function Get-EnvValue {
  param(
    [hashtable]$Values,
    [string]$Name,
    [string]$Fallback = ""
  )

  if ($Values.ContainsKey($Name) -and [string]$Values[$Name]) {
    return [string]$Values[$Name]
  }
  return $Fallback
}

function Use-EnvDefault {
  param(
    [string]$Name,
    [object]$DefaultValue
  )

  return -not $scriptBoundParameters.ContainsKey($Name)
}

function ConvertTo-Boolean {
  param(
    [string]$Name,
    [string]$Value
  )

  if ($Value -eq "true") {
    return $true
  }
  if ($Value -eq "false") {
    return $false
  }
  throw "$Name must be true or false, got '$Value'"
}

function Assert-AbsoluteUrl {
  param(
    [string]$Name,
    [string]$Value
  )

  $uri = $null
  if (-not [Uri]::TryCreate($Value, [UriKind]::Absolute, [ref]$uri) -or $uri.Scheme -notin @("http", "https")) {
    throw "$Name must be an absolute http/https URL, got '$Value'"
  }
}

function Join-PathList {
  param([string[]]$Items)

  return (@($Items | Where-Object { $_ }) -join ",")
}

function Split-ConfiguredList {
  param([string]$Value)

  return @($Value -split "," |
    ForEach-Object { $_.Trim() } |
    Where-Object { $_ })
}

function Format-Command {
  param(
    [string]$ScriptPath,
    [string[]]$Arguments
  )

  $parts = @(
    "pwsh",
    "-NoProfile",
    "-File",
    $ScriptPath
  ) + $Arguments

  return ($parts | ForEach-Object {
    if ($_ -match "^[A-Za-z0-9_./:=?&,%+-]+$") {
      $_
    } else {
      "'" + ($_ -replace "'", "''") + "'"
    }
  }) -join " "
}

function Write-JsonResult {
  param(
    [object]$Value,
    [string]$Path = ""
  )

  if (-not $Path) {
    return
  }

  $directory = Split-Path -Parent $Path
  if ($directory -and -not (Test-Path $directory)) {
    New-Item -ItemType Directory -Path $directory | Out-Null
  }
  $Value | ConvertTo-Json -Depth 20 | Set-Content -Path $Path -Encoding ascii
}

function New-LaunchAuditResult {
  param(
    [string]$Status,
    [string]$Command,
    [string]$Detail = "",
    [datetime]$CompletedAt = (Get-Date).ToUniversalTime(),
    [int]$ExitCode = 0
  )

  $planOnly = $Status -eq "PLAN"
  $operationalEvidence = $Status -eq "OK"

  return [ordered]@{
    Action = "ProductionLaunchVerification"
    AuditSchemaVersion = 1
    Status = $Status
    DryRun = $planOnly
    Evidence = [ordered]@{
      Kind = if ($planOnly) { "plan" } elseif ($operationalEvidence) { "operational" } else { "failed" }
      Operational = $operationalEvidence
      PlanOnly = $planOnly
      FormalReleaseEvidence = $operationalEvidence
      Detail = if ($planOnly) { "Command preview only; not valid as completed production launch evidence." } elseif ($operationalEvidence) { "Completed production launch verification evidence." } else { "Failed launch verification evidence." }
    }
    StartedAt = $startedAt.ToString("o")
    CompletedAt = $CompletedAt.ToString("o")
    DurationSeconds = [math]::Round(($CompletedAt - $startedAt).TotalSeconds, 2)
    ExitCode = $ExitCode
    Detail = $Detail
    Mode = if ($InternalOnly) { "InternalOnly" } else { "Public" }
    EnvFile = if ($FromEnvFile.Trim()) { (Resolve-Path $FromEnvFile.Trim()).Path } else { "" }
    RuntimeScript = $runtimeScript
    Command = $Command
    RuntimeArguments = $runtimeArgs
    Targets = [ordered]@{
      GatewayUrl = $GatewayUrl
      FrontendUrl = $FrontendUrl
      PrometheusUrl = $PrometheusUrl
      ShareHtmlBaseUrl = if ($InternalOnly) { "" } else { $shareHtmlBaseUrlToVerify }
      ShareHtmlOuterBaseUrl = if ($InternalOnly) { "" } else { $shareHtmlOuterBaseUrlToVerify }
      PublicHttpBaseUrl = if ($InternalOnly) { "" } else { $PublicHttpBaseUrl }
      PublicHttpsBaseUrl = if ($InternalOnly) { "" } else { $PublicHttpsBaseUrl }
      MediaUrl = if ($MediaUrl.Trim()) { $MediaUrl.Trim() } else { "" }
    }
    Verification = [ordered]@{
      ApiMetrics = $true
      ProjectionQueryMetrics = $true
      MediaWorkerMetrics = $true
      FrontendAssetCache = $true
      FrontendAssetCompression = $true
      FrontendDiscoveryAssets = $true
      ApiLatency = $true
      ShareHtmlMetrics = -not [bool]$InternalOnly
      ShareHtmlOuterRoute = -not [bool]$InternalOnly
      HttpsRedirect = -not [bool]$InternalOnly
      Hsts = -not [bool]$InternalOnly
      OtelCollectorMetrics = -not [bool]$SkipOtelCollectorMetrics
      CacheMetrics = [bool]$IncludeCacheMetrics
      ContentCommandMetricDefinitions = [bool]$IncludeContentCommandMetricDefinitions
      ContentCommandMetrics = [bool]$IncludeContentCommandMetrics
      InternalAdminMetricDefinitions = [bool]$IncludeInternalAdminMetricDefinitions
      InternalAdminMetrics = [bool]$IncludeInternalAdminMetrics
      MediaRangeRequest = [bool]$MediaUrl.Trim()
    }
    Safety = [ordered]@{
      ReadsProductionData = $true
      WritesProductionData = $false
      DeletesProductionData = $false
      RequiresConfirmDestructive = $false
    }
  }
}

if ($FromEnvFile.Trim()) {
  $envValues = Read-EnvFile -Path $FromEnvFile.Trim()
  $gatewayPort = Get-EnvValue -Values $envValues -Name "GATEWAY_HOST_PORT" -Fallback "8080"
  $frontendPort = Get-EnvValue -Values $envValues -Name "FRONTEND_HOST_PORT" -Fallback "3000"
  $prometheusPort = Get-EnvValue -Values $envValues -Name "PROMETHEUS_HOST_PORT" -Fallback "9090"
  $frontendOrigin = Get-EnvValue -Values $envValues -Name "FRONTEND_ORIGIN" -Fallback "https://memesee.world"
  $frontendUri = [Uri]$frontendOrigin
  $domainFromOrigin = $frontendUri.Host

  if (Use-EnvDefault -Name "GatewayUrl" -DefaultValue "http://127.0.0.1:8080") {
    $GatewayUrl = "http://127.0.0.1:${gatewayPort}"
  }
  if (Use-EnvDefault -Name "FrontendUrl" -DefaultValue "http://127.0.0.1:3000") {
    $FrontendUrl = "http://127.0.0.1:${frontendPort}"
  }
  if (Use-EnvDefault -Name "PrometheusUrl" -DefaultValue "http://127.0.0.1:9090") {
    $PrometheusUrl = "http://127.0.0.1:${prometheusPort}"
  }
  if (Use-EnvDefault -Name "PublicHttpBaseUrl" -DefaultValue "http://127.0.0.1") {
    $PublicHttpBaseUrl = Get-EnvValue -Values $envValues -Name "DEPLOY_VERIFY_HTTPS_REDIRECT_BASE_URL" -Fallback "http://127.0.0.1"
  }
  if (Use-EnvDefault -Name "PublicHttpsBaseUrl" -DefaultValue "https://memesee.world") {
    $PublicHttpsBaseUrl = Get-EnvValue -Values $envValues -Name "DEPLOY_VERIFY_HSTS_BASE_URL" -Fallback $frontendOrigin
  }
  if (Use-EnvDefault -Name "Domain" -DefaultValue "memesee.world") {
    $Domain = Get-EnvValue -Values $envValues -Name "DEPLOY_VERIFY_HSTS_HOST" -Fallback (Get-EnvValue -Values $envValues -Name "DEPLOY_VERIFY_HTTPS_REDIRECT_HOST" -Fallback $domainFromOrigin)
  }
  if (Use-EnvDefault -Name "ShareHtmlBaseUrl" -DefaultValue "") {
    $ShareHtmlBaseUrl = Get-EnvValue -Values $envValues -Name "DEPLOY_VERIFY_SHARE_HTML_BASE_URL" -Fallback $GatewayUrl
  }
  if (Use-EnvDefault -Name "ShareHtmlOuterBaseUrl" -DefaultValue "") {
    $ShareHtmlOuterBaseUrl = Get-EnvValue -Values $envValues -Name "DEPLOY_VERIFY_SHARE_HTML_OUTER_BASE_URL" -Fallback $PublicHttpsBaseUrl
  }
  if (Use-EnvDefault -Name "ShareHtmlHost" -DefaultValue "") {
    $ShareHtmlHost = Get-EnvValue -Values $envValues -Name "DEPLOY_VERIFY_SHARE_HTML_HOST" -Fallback $Domain
  }
  if (Use-EnvDefault -Name "HttpsRedirectHost" -DefaultValue "") {
    $HttpsRedirectHost = Get-EnvValue -Values $envValues -Name "DEPLOY_VERIFY_HTTPS_REDIRECT_HOST" -Fallback $Domain
  }
  if (Use-EnvDefault -Name "HstsHost" -DefaultValue "") {
    $HstsHost = Get-EnvValue -Values $envValues -Name "DEPLOY_VERIFY_HSTS_HOST" -Fallback $Domain
  }
  if (Use-EnvDefault -Name "ShareHtmlPrimePaths" -DefaultValue "") {
    $ShareHtmlPrimePaths = Get-EnvValue -Values $envValues -Name "DEPLOY_VERIFY_SHARE_HTML_PATH"
  }
  if (Use-EnvDefault -Name "ShareHtmlOuterRoutePaths" -DefaultValue "") {
    $ShareHtmlOuterRoutePaths = Get-EnvValue -Values $envValues -Name "DEPLOY_VERIFY_SHARE_HTML_OUTER_PATH"
  }
  if (Use-EnvDefault -Name "HttpsRedirectPaths" -DefaultValue "") {
    $HttpsRedirectPaths = Get-EnvValue -Values $envValues -Name "DEPLOY_VERIFY_HTTPS_REDIRECT_PATH"
  }
  if (Use-EnvDefault -Name "HstsPaths" -DefaultValue "") {
    $HstsPaths = Get-EnvValue -Values $envValues -Name "DEPLOY_VERIFY_HSTS_PATH"
  }
  if (Use-EnvDefault -Name "MediaUrl" -DefaultValue "") {
    $MediaUrl = Get-EnvValue -Values $envValues -Name "DEPLOY_VERIFY_MEDIA_URL"
  }
  if (Use-EnvDefault -Name "MetricScrapeWaitSec" -DefaultValue 20) {
    $MetricScrapeWaitSec = [int](Get-EnvValue -Values $envValues -Name "DEPLOY_VERIFY_METRIC_SCRAPE_WAIT_SECONDS" -Fallback "20")
  }
  if (Use-EnvDefault -Name "LatencyIterations" -DefaultValue 50) {
    $LatencyIterations = [int](Get-EnvValue -Values $envValues -Name "DEPLOY_VERIFY_API_LATENCY_ITERATIONS" -Fallback "50")
  }
  if (Use-EnvDefault -Name "MaxP95Ms" -DefaultValue 500) {
    $MaxP95Ms = [int](Get-EnvValue -Values $envValues -Name "DEPLOY_VERIFY_API_MAX_P95_MS" -Fallback "500")
  }
  if (Use-EnvDefault -Name "MaxErrorRatePercent" -DefaultValue 0) {
    $MaxErrorRatePercent = [double](Get-EnvValue -Values $envValues -Name "DEPLOY_VERIFY_API_MAX_ERROR_RATE_PERCENT" -Fallback "0")
  }
  if (Use-EnvDefault -Name "MinCacheHitRatePercent" -DefaultValue 60) {
    $MinCacheHitRatePercent = [int](Get-EnvValue -Values $envValues -Name "DEPLOY_VERIFY_MIN_CACHE_HIT_RATE_PERCENT" -Fallback "60")
  }
  if (-not $PSBoundParameters.ContainsKey("IncludeCacheMetrics")) {
    $IncludeCacheMetrics = ConvertTo-Boolean -Name "DEPLOY_VERIFY_CACHE_METRICS" -Value (Get-EnvValue -Values $envValues -Name "DEPLOY_VERIFY_CACHE_METRICS" -Fallback "false")
  }
  if (-not $PSBoundParameters.ContainsKey("IncludeContentCommandMetricDefinitions")) {
    $IncludeContentCommandMetricDefinitions = ConvertTo-Boolean -Name "DEPLOY_VERIFY_CONTENT_COMMAND_METRIC_DEFINITIONS" -Value (Get-EnvValue -Values $envValues -Name "DEPLOY_VERIFY_CONTENT_COMMAND_METRIC_DEFINITIONS" -Fallback "true")
  }
  if (-not $PSBoundParameters.ContainsKey("IncludeContentCommandMetrics")) {
    $IncludeContentCommandMetrics = ConvertTo-Boolean -Name "DEPLOY_VERIFY_CONTENT_COMMAND_METRICS" -Value (Get-EnvValue -Values $envValues -Name "DEPLOY_VERIFY_CONTENT_COMMAND_METRICS" -Fallback "false")
  }
  if (-not $PSBoundParameters.ContainsKey("IncludeInternalAdminMetricDefinitions")) {
    $IncludeInternalAdminMetricDefinitions = ConvertTo-Boolean -Name "DEPLOY_VERIFY_INTERNAL_ADMIN_METRIC_DEFINITIONS" -Value (Get-EnvValue -Values $envValues -Name "DEPLOY_VERIFY_INTERNAL_ADMIN_METRIC_DEFINITIONS" -Fallback "true")
  }
  if (-not $PSBoundParameters.ContainsKey("IncludeInternalAdminMetrics")) {
    $IncludeInternalAdminMetrics = ConvertTo-Boolean -Name "DEPLOY_VERIFY_INTERNAL_ADMIN_METRICS" -Value (Get-EnvValue -Values $envValues -Name "DEPLOY_VERIFY_INTERNAL_ADMIN_METRICS" -Fallback "false")
  }
  if (-not $PSBoundParameters.ContainsKey("SkipOtelCollectorMetrics")) {
    $SkipOtelCollectorMetrics = -not (ConvertTo-Boolean -Name "DEPLOY_VERIFY_OTEL_COLLECTOR_METRICS" -Value (Get-EnvValue -Values $envValues -Name "DEPLOY_VERIFY_OTEL_COLLECTOR_METRICS" -Fallback "true"))
  }
  if (-not $PSBoundParameters.ContainsKey("HstsSkipCertificateCheck")) {
    $HstsSkipCertificateCheck = ConvertTo-Boolean -Name "DEPLOY_VERIFY_HSTS_SKIP_CERTIFICATE_CHECK" -Value (Get-EnvValue -Values $envValues -Name "DEPLOY_VERIFY_HSTS_SKIP_CERTIFICATE_CHECK" -Fallback "false")
  }
}

Assert-AbsoluteUrl -Name "GatewayUrl" -Value $GatewayUrl
Assert-AbsoluteUrl -Name "FrontendUrl" -Value $FrontendUrl
Assert-AbsoluteUrl -Name "PrometheusUrl" -Value $PrometheusUrl
Assert-AbsoluteUrl -Name "PublicHttpBaseUrl" -Value $PublicHttpBaseUrl
Assert-AbsoluteUrl -Name "PublicHttpsBaseUrl" -Value $PublicHttpsBaseUrl
$shareHtmlBaseUrlToVerify = if ($ShareHtmlBaseUrl.Trim()) { $ShareHtmlBaseUrl.Trim() } else { $GatewayUrl }
$shareHtmlOuterBaseUrlToVerify = if ($ShareHtmlOuterBaseUrl.Trim()) { $ShareHtmlOuterBaseUrl.Trim() } else { $PublicHttpsBaseUrl }
$shareHtmlHostToVerify = if ($ShareHtmlHost.Trim()) { $ShareHtmlHost.Trim() } else { $Domain }
$httpsRedirectHostToVerify = if ($HttpsRedirectHost.Trim()) { $HttpsRedirectHost.Trim() } else { $Domain }
$hstsHostToVerify = if ($HstsHost.Trim()) { $HstsHost.Trim() } else { $Domain }

Assert-AbsoluteUrl -Name "ShareHtmlBaseUrl" -Value $shareHtmlBaseUrlToVerify
Assert-AbsoluteUrl -Name "ShareHtmlOuterBaseUrl" -Value $shareHtmlOuterBaseUrlToVerify
if ($MediaUrl.Trim()) {
  Assert-AbsoluteUrl -Name "MediaUrl" -Value $MediaUrl
}
if ($MainPostId -lt 1) {
  throw "MainPostId must be positive"
}
if ($SubPostId -lt 0) {
  throw "SubPostId must be zero or positive"
}

$mainPostPath = "/posts/$MainPostId"
$sharePath = "/share/posts/$MainPostId"
$hstsPathItems = @("/", $mainPostPath)
$postPathItems = @($mainPostPath)
$sharePathItems = @($sharePath)

if ($SubPostId -gt 0) {
  $subPostQuery = "?subPost=$SubPostId"
  $postPathItems += "$mainPostPath$subPostQuery"
  $sharePathItems += "$sharePath$subPostQuery"
}

if ($ShareHtmlPrimePaths.Trim()) {
  $sharePathItems = @(Split-ConfiguredList -Value $ShareHtmlPrimePaths)
}
if ($ShareHtmlOuterRoutePaths.Trim()) {
  $postPathItems = @(Split-ConfiguredList -Value $ShareHtmlOuterRoutePaths)
}
$httpsRedirectPathsToVerify = if ($HttpsRedirectPaths.Trim()) {
  @(Split-ConfiguredList -Value $HttpsRedirectPaths)
} else {
  $postPathItems
}
if ($HstsPaths.Trim()) {
  $hstsPathItems = @(Split-ConfiguredList -Value $HstsPaths)
}

$runtimeScript = Join-Path $PSScriptRoot "verify-production-runtime.ps1"
$runtimeArgs = @(
  "-GatewayUrl", $GatewayUrl,
  "-FrontendUrl", $FrontendUrl,
  "-PrometheusUrl", $PrometheusUrl,
  "-PrimeMetrics",
  "-MetricScrapeWaitSec", [string]$MetricScrapeWaitSec,
  "-VerifyApiMetrics",
  "-VerifyProjectionQueryMetrics",
  "-VerifyMediaWorkerMetrics",
  "-VerifyFrontendAssetCache",
  "-VerifyFrontendAssetCompression",
  "-VerifyFrontendDiscoveryAssets",
  "-MeasureApiLatency",
  "-LatencyIterations", [string]$LatencyIterations,
  "-MaxP95Ms", [string]$MaxP95Ms,
  "-MaxErrorRatePercent", [string]$MaxErrorRatePercent
)

if (-not $InternalOnly) {
  $runtimeArgs += @(
    "-VerifyShareHtmlMetrics",
    "-ShareHtmlBaseUrl", $shareHtmlBaseUrlToVerify,
    "-ShareHtmlPrimePaths", (Join-PathList -Items $sharePathItems),
    "-VerifyShareHtmlOuterRoute",
    "-ShareHtmlOuterBaseUrl", $shareHtmlOuterBaseUrlToVerify,
    "-ShareHtmlOuterRoutePaths", (Join-PathList -Items $postPathItems),
    "-ShareHtmlHost", $shareHtmlHostToVerify,
    "-VerifyHttpsRedirect",
    "-HttpsRedirectBaseUrl", $PublicHttpBaseUrl,
    "-HttpsRedirectPaths", (Join-PathList -Items $httpsRedirectPathsToVerify),
    "-HttpsRedirectHost", $httpsRedirectHostToVerify,
    "-VerifyHsts",
    "-HstsBaseUrl", $PublicHttpsBaseUrl,
    "-HstsPaths", (Join-PathList -Items $hstsPathItems),
    "-HstsHost", $hstsHostToVerify
  )
}

if (-not $SkipOtelCollectorMetrics) {
  $runtimeArgs += "-VerifyOtelCollectorMetrics"
}
if ($HstsSkipCertificateCheck) {
  $runtimeArgs += "-HstsSkipCertificateCheck"
}
if ($MediaUrl.Trim()) {
  $runtimeArgs += @(
    "-MediaUrl", $MediaUrl.Trim(),
    "-VerifyMediaRangeRequest"
  )
}
if ($IncludeCacheMetrics) {
  $runtimeArgs += @(
    "-VerifyCacheMetrics",
    "-MinCacheHitRatePercent", [string]$MinCacheHitRatePercent
  )
}
if ($IncludeContentCommandMetricDefinitions) {
  $runtimeArgs += "-VerifyContentCommandMetricDefinitions"
}
if ($IncludeContentCommandMetrics) {
  $runtimeArgs += "-VerifyContentCommandMetrics"
}
if ($IncludeInternalAdminMetricDefinitions) {
  $runtimeArgs += "-VerifyInternalAdminMetricDefinitions"
}
if ($IncludeInternalAdminMetrics) {
  $runtimeArgs += "-VerifyInternalAdminMetrics"
}

$commandText = Format-Command -ScriptPath $runtimeScript -Arguments $runtimeArgs

if ($PrintCommand) {
  Write-JsonResult -Path $OutputFile -Value (New-LaunchAuditResult -Status "PLAN" -Command $commandText -Detail "PrintCommand")
  $commandText
  return
}

$powershellExecutable = if (Get-Command pwsh -ErrorAction SilentlyContinue) { "pwsh" } else { "powershell" }
if ($powershellExecutable -eq "pwsh") {
  & pwsh -NoProfile -File $runtimeScript @runtimeArgs
} else {
  & powershell -NoProfile -ExecutionPolicy Bypass -File $runtimeScript @runtimeArgs
}
if ($LASTEXITCODE -ne 0) {
  Write-JsonResult -Path $OutputFile -Value (New-LaunchAuditResult -Status "FAILED" -Command $commandText -Detail "$powershellExecutable $runtimeScript failed with exit code $LASTEXITCODE" -ExitCode $LASTEXITCODE)
  throw "$powershellExecutable $runtimeScript failed with exit code $LASTEXITCODE"
}
Write-JsonResult -Path $OutputFile -Value (New-LaunchAuditResult -Status "OK" -Command $commandText)
