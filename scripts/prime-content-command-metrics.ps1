param(
  [string]$GatewayUrl = "http://127.0.0.1:8080",
  [string]$PrometheusUrl = "http://127.0.0.1:9090",
  [string]$AuthToken = $env:MEMESEE_CONTENT_COMMAND_SAMPLE_TOKEN,
  [string]$CommunitySlug = "daily",
  [string]$TitlePrefix = "Metric sample",
  [switch]$SkipSubPost,
  [switch]$SkipUpdates,
  [switch]$VerifyPrometheusMetrics,
  [int]$MetricScrapeWaitSec = 20,
  [switch]$ConfirmDestructive,
  [switch]$Plan,
  [string]$AuditFile = ""
)

$ErrorActionPreference = "Stop"
$startedAt = (Get-Date).ToUniversalTime()

function Write-JsonResult {
  param(
    [object]$Value,
    [string]$Path = ""
  )

  $json = $Value | ConvertTo-Json -Depth 20
  if ($Path) {
    $directory = Split-Path -Parent $Path
    if ($directory -and -not (Test-Path $directory)) {
      New-Item -ItemType Directory -Path $directory | Out-Null
    }
    Set-Content -Path $Path -Value $json -Encoding ascii
  }
  $json
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

function Join-Url {
  param(
    [string]$BaseUrl,
    [string]$Path
  )

  $normalizedBase = $BaseUrl.TrimEnd("/")
  $normalizedPath = if ($Path.StartsWith("/")) { $Path } else { "/$Path" }
  return "$normalizedBase$normalizedPath"
}

function Invoke-ContentApi {
  param(
    [ValidateSet("GET", "POST", "PUT", "DELETE")]
    [string]$Method,
    [string]$Path,
    [object]$Body = $null
  )

  $headers = @{
    Authorization = "Bearer $AuthToken"
  }
  $params = @{
    Uri = Join-Url -BaseUrl $GatewayUrl -Path $Path
    Method = $Method
    Headers = $headers
    UseBasicParsing = $true
    TimeoutSec = 30
  }
  if ($null -ne $Body) {
    $params.ContentType = "application/json; charset=utf-8"
    $params.Body = ($Body | ConvertTo-Json -Depth 10 -Compress)
  }
  Invoke-RestMethod @params
}

function Invoke-PrometheusQuery {
  param([string]$Query)

  $encodedQuery = [System.Uri]::EscapeDataString($Query)
  $queryUrl = Join-Url -BaseUrl $PrometheusUrl -Path "/api/v1/query?query=$encodedQuery"
  $response = Invoke-RestMethod -Uri $queryUrl -Method GET -UseBasicParsing -TimeoutSec 30
  if ($response.status -ne "success") {
    throw "Prometheus query returned status $($response.status): $Query"
  }
  $items = @($response.data.result)
  if ($items.Count -eq 0) {
    throw "Prometheus query returned no samples: $Query"
  }
  [PSCustomObject]@{
    Query = $Query
    Samples = $items.Count
  }
}

function Get-ResponseId {
  param(
    [object]$Payload,
    [string]$Name
  )

  $id = [long]0
  if ($null -ne $Payload -and $null -ne $Payload.id) {
    $id = [long]$Payload.id
  } elseif ($null -ne $Payload -and $null -ne $Payload.mainPostId) {
    $id = [long]$Payload.mainPostId
  } elseif ($null -ne $Payload -and $null -ne $Payload.subPostId) {
    $id = [long]$Payload.subPostId
  }
  if ($id -lt 1) {
    throw "$Name response did not include a positive id."
  }
  $id
}

Assert-AbsoluteUrl -Name "GatewayUrl" -Value $GatewayUrl
Assert-AbsoluteUrl -Name "PrometheusUrl" -Value $PrometheusUrl

if (-not $CommunitySlug.Trim()) {
  throw "-CommunitySlug is required."
}
if (-not $TitlePrefix.Trim()) {
  throw "-TitlePrefix is required."
}
if ($MetricScrapeWaitSec -lt 0 -or $MetricScrapeWaitSec -gt 500) {
  throw "-MetricScrapeWaitSec must be between 0 and 500."
}

$marker = "metric-$([guid]::NewGuid().ToString('N').Substring(0, 8))"
$safeTitlePrefix = $TitlePrefix.Trim()
if ($safeTitlePrefix.Length -gt 16) {
  $safeTitlePrefix = $safeTitlePrefix.Substring(0, 16)
}
$title = "$safeTitlePrefix $($marker.Substring(0, 8))"
$updatedTitle = "$safeTitlePrefix up $($marker.Substring(0, 5))"
$content = "Temporary content command metric sample $marker. This post should be created and deleted by the verifier."
$updatedContent = "Updated temporary content command metric sample $marker."
$subPostContent = "Temporary sub-post metric sample $marker."
$updatedSubPostContent = "Updated temporary sub-post metric sample $marker."
$plannedOperations = @("create-main-post", "update-main-post", "delete-main-post")
if (-not $SkipSubPost) {
  $plannedOperations = @(
    "create-main-post",
    "update-main-post",
    "create-sub-post",
    "update-sub-post",
    "delete-sub-post",
    "delete-main-post"
  )
}
if ($SkipUpdates) {
  $plannedOperations = @($plannedOperations | Where-Object { $_ -notmatch "^update-" })
}

if ($Plan) {
  Write-JsonResult -Path $AuditFile -Value ([PSCustomObject]@{
    Action = "PrimeContentCommandMetricsPlan"
    AuditSchemaVersion = 1
    DryRun = $true
    Status = "PLAN"
    GeneratedAt = (Get-Date).ToUniversalTime().ToString("o")
    GatewayUrl = $GatewayUrl
    PrometheusUrl = $PrometheusUrl
    CommunitySlug = $CommunitySlug
    PlannedOperations = $plannedOperations
    VerifyPrometheusMetrics = [bool]$VerifyPrometheusMetrics
    MetricScrapeWaitSec = $MetricScrapeWaitSec
    Safety = [PSCustomObject]@{
      RequiresConfirmDestructive = $true
      ConfirmDestructiveProvided = [bool]$ConfirmDestructive
      RequiresAuthToken = $true
      AuthTokenProvided = [bool]$AuthToken
      WritesProductionData = $true
      DeletesProductionData = $true
      TemporaryDataExpected = $true
    }
    WouldCreateTemporaryMainPost = $true
    WouldDeleteTemporaryMainPost = $true
    WouldCreateTemporarySubPost = -not [bool]$SkipSubPost
    WouldDeleteTemporarySubPost = -not [bool]$SkipSubPost
  })
  return
}

if (-not $ConfirmDestructive) {
  throw "This script creates and deletes temporary content. Re-run with -ConfirmDestructive after reviewing -Plan."
}
if (-not $AuthToken) {
  throw "Auth token is required. Pass -AuthToken or set MEMESEE_CONTENT_COMMAND_SAMPLE_TOKEN."
}

$mainPostId = $null
$subPostId = $null
$operations = New-Object System.Collections.Generic.List[object]
$cleanup = New-Object System.Collections.Generic.List[object]
$operationError = $null

try {
  $mainPost = Invoke-ContentApi -Method POST -Path "/api/main-posts" -Body @{
    communitySlug = $CommunitySlug.Trim()
    title = $title
    content = $content
    postMode = "long"
    mediaAssetIds = @()
    tags = @("ops")
  }
  $mainPostId = Get-ResponseId -Payload $mainPost -Name "create main post"
  $operations.Add([PSCustomObject]@{ Operation = "create-main-post"; MainPostId = $mainPostId }) | Out-Null

  if (-not $SkipUpdates) {
    Invoke-ContentApi -Method PUT -Path "/api/main-posts/$mainPostId" -Body @{
      title = $updatedTitle
      content = $updatedContent
      postMode = "long"
      mediaAssetIds = @()
      tags = @("ops")
    } | Out-Null
    $operations.Add([PSCustomObject]@{ Operation = "update-main-post"; MainPostId = $mainPostId }) | Out-Null
  }

  if (-not $SkipSubPost) {
    $subPost = Invoke-ContentApi -Method POST -Path "/api/main-posts/$mainPostId/sub-posts" -Body @{
      parentSubPostId = $null
      content = $subPostContent
      mediaAssetIds = @()
    }
    $subPostId = Get-ResponseId -Payload $subPost -Name "create sub-post"
    $operations.Add([PSCustomObject]@{ Operation = "create-sub-post"; MainPostId = $mainPostId; SubPostId = $subPostId }) | Out-Null

    if (-not $SkipUpdates) {
      Invoke-ContentApi -Method PUT -Path "/api/sub-posts/$subPostId" -Body @{
        content = $updatedSubPostContent
        mediaAssetIds = @()
      } | Out-Null
      $operations.Add([PSCustomObject]@{ Operation = "update-sub-post"; MainPostId = $mainPostId; SubPostId = $subPostId }) | Out-Null
    }

    Invoke-ContentApi -Method DELETE -Path "/api/sub-posts/$subPostId" | Out-Null
    $cleanup.Add([PSCustomObject]@{ Operation = "delete-sub-post"; SubPostId = $subPostId; Status = "OK" }) | Out-Null
    $operations.Add([PSCustomObject]@{ Operation = "delete-sub-post"; MainPostId = $mainPostId; SubPostId = $subPostId }) | Out-Null
    $subPostId = $null
  }
} catch {
  $operationError = $_
} finally {
  if ($null -ne $subPostId) {
    try {
      Invoke-ContentApi -Method DELETE -Path "/api/sub-posts/$subPostId" | Out-Null
      $cleanup.Add([PSCustomObject]@{ Operation = "delete-sub-post"; SubPostId = $subPostId; Status = "OK" }) | Out-Null
    } catch {
      $cleanup.Add([PSCustomObject]@{ Operation = "delete-sub-post"; SubPostId = $subPostId; Status = "FAILED"; Detail = $_.Exception.Message }) | Out-Null
    }
  }
  if ($null -ne $mainPostId) {
    try {
      Invoke-ContentApi -Method DELETE -Path "/api/main-posts/$mainPostId" | Out-Null
      $cleanup.Add([PSCustomObject]@{ Operation = "delete-main-post"; MainPostId = $mainPostId; Status = "OK" }) | Out-Null
      $operations.Add([PSCustomObject]@{ Operation = "delete-main-post"; MainPostId = $mainPostId }) | Out-Null
    } catch {
      $cleanup.Add([PSCustomObject]@{ Operation = "delete-main-post"; MainPostId = $mainPostId; Status = "FAILED"; Detail = $_.Exception.Message }) | Out-Null
    }
  }
}

if ($null -ne $operationError) {
  $completedAt = (Get-Date).ToUniversalTime()
  $cleanupFailures = @($cleanup.ToArray() | Where-Object { $_.Status -eq "FAILED" })
  Write-JsonResult -Path $AuditFile -Value ([PSCustomObject]@{
    Action = "PrimeContentCommandMetrics"
    AuditSchemaVersion = 1
    DryRun = $false
    Status = "FAILED"
    StartedAt = $startedAt.ToString("o")
    CompletedAt = $completedAt.ToString("o")
    DurationSeconds = [math]::Round(($completedAt - $startedAt).TotalSeconds, 2)
    GatewayUrl = $GatewayUrl
    PrometheusUrl = $PrometheusUrl
    CommunitySlug = $CommunitySlug
    Marker = $marker
    Operations = @($operations.ToArray())
    Cleanup = @($cleanup.ToArray())
    CleanupFailed = $cleanupFailures.Count -gt 0
    CleanupFailureCount = $cleanupFailures.Count
    Safety = [PSCustomObject]@{
      RequiresConfirmDestructive = $true
      ConfirmDestructiveProvided = [bool]$ConfirmDestructive
      AuthTokenProvided = [bool]$AuthToken
      WritesProductionData = $true
      DeletesProductionData = $true
      TemporaryDataExpected = $true
    }
    Detail = $operationError.Exception.Message
  }) | Out-Null
  throw $operationError
}

$metrics = @()
if ($VerifyPrometheusMetrics) {
  if ($MetricScrapeWaitSec -gt 0) {
    Start-Sleep -Seconds $MetricScrapeWaitSec
  }
  $metrics = @(
    Invoke-PrometheusQuery -Query "memesee_content_command_total"
    Invoke-PrometheusQuery -Query "memesee_content_command_duration_seconds_count"
  )
}

$completedAt = (Get-Date).ToUniversalTime()
$cleanupFailures = @($cleanup.ToArray() | Where-Object { $_.Status -eq "FAILED" })
$result = [PSCustomObject]@{
  Action = "PrimeContentCommandMetrics"
  AuditSchemaVersion = 1
  DryRun = $false
  Status = if ($cleanupFailures.Count -gt 0) { "CLEANUP_FAILED" } else { "OK" }
  StartedAt = $startedAt.ToString("o")
  CompletedAt = $completedAt.ToString("o")
  DurationSeconds = [math]::Round(($completedAt - $startedAt).TotalSeconds, 2)
  GatewayUrl = $GatewayUrl
  PrometheusUrl = $PrometheusUrl
  CommunitySlug = $CommunitySlug
  Marker = $marker
  Operations = @($operations.ToArray())
  Cleanup = @($cleanup.ToArray())
  CleanupFailed = $cleanupFailures.Count -gt 0
  CleanupFailureCount = $cleanupFailures.Count
  Safety = [PSCustomObject]@{
    RequiresConfirmDestructive = $true
    ConfirmDestructiveProvided = [bool]$ConfirmDestructive
    AuthTokenProvided = [bool]$AuthToken
    WritesProductionData = $true
    DeletesProductionData = $true
    TemporaryDataExpected = $true
  }
  VerifyPrometheusMetrics = [bool]$VerifyPrometheusMetrics
  Metrics = $metrics
}

Write-JsonResult -Path $AuditFile -Value $result
if ($cleanupFailures.Count -gt 0) {
  throw "Temporary content cleanup failed. Review the audit output and remove leftover sample data manually."
}
