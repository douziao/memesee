param(
  [string]$OutputFile = "",
  [switch]$RunBackendTests
)

$ErrorActionPreference = "Stop"
$script:CheckResults = New-Object System.Collections.Generic.List[object]
$script:BackendTestResult = $null

function Add-CheckResult {
  param(
    [string]$Name,
    [string]$Path,
    [string]$Status,
    [string]$Detail = ""
  )

  $script:CheckResults.Add([pscustomobject][ordered]@{
    Name = $Name
    Path = $Path
    Status = $Status
    Detail = $Detail
  }) | Out-Null
}

function Write-VerificationResult {
  param(
    [string]$Status,
    [string]$Detail = ""
  )

  $okCount = 0
  $failedChecks = New-Object System.Collections.Generic.List[object]
  $checks = New-Object System.Collections.Generic.List[object]
  foreach ($check in $script:CheckResults) {
    $checks.Add($check) | Out-Null
    $checkStatus = [string]$check.PSObject.Properties["Status"].Value
    if ($checkStatus -eq "OK") {
      $okCount += 1
    } elseif ($checkStatus -eq "FAILED") {
      $failedChecks.Add($check) | Out-Null
    }
  }

  $result = [ordered]@{
    Action = "ContentPrivacyRegressionVerification"
    AuditSchemaVersion = 1
    Status = $Status
    GeneratedAt = (Get-Date).ToUniversalTime().ToString("o")
    Summary = [ordered]@{
      Ok = $okCount
      Failed = $failedChecks.Count
    }
    Detail = $Detail
    Checks = $checks.ToArray()
    BackendTests = $script:BackendTestResult
    Safety = [ordered]@{
      ReadsProductionData = $false
      WritesProductionData = $false
      DeletesProductionData = $false
      RequiresConfirmDestructive = $false
    }
  }

  if ($OutputFile) {
    $directory = Split-Path -Parent $OutputFile
    if ($directory -and -not (Test-Path $directory)) {
      New-Item -ItemType Directory -Path $directory | Out-Null
    }
    $result | ConvertTo-Json -Depth 20 | Set-Content -Path $OutputFile -Encoding ascii
  }
}

function Get-OutputTail {
  param(
    [object[]]$Output,
    [int]$LineCount = 80
  )

  $lines = @($Output | ForEach-Object { [string]$_ })
  if ($lines.Count -le $LineCount) {
    return $lines
  }
  return @($lines | Select-Object -Last $LineCount)
}

function Invoke-BackendPrivacyTests {
  $selector = "ContentReferenceAvailabilityServiceTest,MainPostFeedQueryApplicationServiceTest,NotificationApplicationServiceTest,InteractionQueryApplicationServiceTest,MediaAssetApplicationServiceTest"
  $command = "mvn -pl content-service `"-Dtest=$selector`" test"
  $repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
  $backendDir = Join-Path $repoRoot "backend"
  $startedAt = (Get-Date).ToUniversalTime()
  $output = @()
  $exitCode = 0
  $previousErrorActionPreference = $ErrorActionPreference

  Push-Location $backendDir
  try {
    $ErrorActionPreference = "Continue"
    $output = @(mvn -pl content-service "-Dtest=$selector" test 2>&1)
    $exitCode = $LASTEXITCODE
  } finally {
    $ErrorActionPreference = $previousErrorActionPreference
    Pop-Location
  }

  $completedAt = (Get-Date).ToUniversalTime()
  $status = if ($exitCode -eq 0) { "OK" } else { "FAILED" }
  $script:BackendTestResult = [ordered]@{
    Status = $status
    Command = $command
    WorkingDirectory = $backendDir
    ExitCode = $exitCode
    StartedAt = $startedAt.ToString("o")
    CompletedAt = $completedAt.ToString("o")
    DurationSeconds = [math]::Round(($completedAt - $startedAt).TotalSeconds, 2)
    OutputTail = @(Get-OutputTail -Output $output)
  }

  if ($exitCode -ne 0) {
    Add-CheckResult -Name "backend privacy test group" -Path "backend/content-service" -Status "FAILED" -Detail "mvn privacy test group failed with exit code $exitCode"
    throw "backend privacy test group failed with exit code $exitCode"
  }

  Add-CheckResult -Name "backend privacy test group" -Path "backend/content-service" -Status "OK" -Detail $command
}

trap {
  Write-VerificationResult -Status "FAILED" -Detail $_.Exception.Message
  throw
}

function Assert-Contains {
  param(
    [string]$Content,
    [string]$Pattern,
    [string]$Description,
    [string]$Path
  )

  if ($Content -notmatch $Pattern) {
    Add-CheckResult -Name $Description -Path $Path -Status "FAILED" -Detail "missing pattern: $Pattern"
    throw "$Path is missing $Description"
  }
  Add-CheckResult -Name $Description -Path $Path -Status "OK"
}

function Assert-DoesNotContain {
  param(
    [string]$Content,
    [string]$Pattern,
    [string]$Description,
    [string]$Path
  )

  if ($Content -match $Pattern) {
    Add-CheckResult -Name $Description -Path $Path -Status "FAILED" -Detail "unexpected pattern: $Pattern"
    throw "$Path unexpectedly contains $Description"
  }
  Add-CheckResult -Name $Description -Path $Path -Status "OK"
}

function Read-RequiredFile {
  param([string]$Path)

  if (-not (Test-Path $Path)) {
    throw "missing $Path"
  }
  return Get-Content -Raw -Encoding UTF8 $Path
}

function Assert-FileContains {
  param(
    [string]$Path,
    [string]$Pattern,
    [string]$Description
  )

  Assert-Contains -Content (Read-RequiredFile -Path $Path) -Pattern $Pattern -Description $Description -Path $Path
}

function Assert-FileDoesNotContain {
  param(
    [string]$Path,
    [string]$Pattern,
    [string]$Description
  )

  Assert-DoesNotContain -Content (Read-RequiredFile -Path $Path) -Pattern $Pattern -Description $Description -Path $Path
}

$referenceService = "backend/content-service/src/main/java/com/memesee/content/common/application/ContentReferenceAvailabilityService.java"
$referenceServiceTest = "backend/content-service/src/test/java/com/memesee/content/common/application/ContentReferenceAvailabilityServiceTest.java"
$notificationService = "backend/content-service/src/main/java/com/memesee/content/notification/application/NotificationApplicationService.java"
$interactionService = "backend/content-service/src/main/java/com/memesee/content/interaction/application/InteractionQueryApplicationService.java"
$feedService = "backend/content-service/src/main/java/com/memesee/content/feed/application/MainPostFeedQueryApplicationService.java"
$mediaService = "backend/content-service/src/main/java/com/memesee/content/media/application/MediaAssetApplicationService.java"
$notificationTest = "backend/content-service/src/test/java/com/memesee/content/notification/application/NotificationApplicationServiceTest.java"
$interactionTest = "backend/content-service/src/test/java/com/memesee/content/interaction/application/InteractionQueryApplicationServiceTest.java"
$feedTest = "backend/content-service/src/test/java/com/memesee/content/feed/application/MainPostFeedQueryApplicationServiceTest.java"
$mediaTest = "backend/content-service/src/test/java/com/memesee/content/media/application/MediaAssetApplicationServiceTest.java"

foreach ($item in @(
  @{ Pattern = "class ContentReferenceAvailabilityService"; Description = "shared reference availability service" },
  @{ Pattern = "loadActiveMainPostIds"; Description = "active main post loader" },
  @{ Pattern = "findAllByIdInAndDeletedAtIsNull"; Description = "authoritative active main post repository check" },
  @{ Pattern = "loadActiveSubPostIdsWithActiveMainPost"; Description = "active sub-post with active parent loader" },
  @{ Pattern = "getDeletedAt\(\) == null"; Description = "sub-post deletion check" }
)) {
  Assert-FileContains -Path $referenceService -Pattern $item.Pattern -Description $item.Description
}

foreach ($item in @(
  @{ Pattern = "loadActiveMainPostIdsNormalizesIdsAndKeepsOnlyRepositoryActivePosts"; Description = "active main post normalization test" },
  @{ Pattern = "loadActiveSubPostIdsRequiresActiveSubPostAndActiveParentMainPost"; Description = "sub-post parent availability test" }
)) {
  Assert-FileContains -Path $referenceServiceTest -Pattern $item.Pattern -Description $item.Description
}

foreach ($path in @($notificationService, $interactionService, $feedService, $mediaService)) {
  Assert-FileContains `
    -Path $path `
    -Pattern "ContentReferenceAvailabilityService" `
    -Description "shared content reference availability dependency"

  Assert-FileDoesNotContain `
    -Path $path `
    -Pattern "import com\.memesee\.content\.mainpost\.infrastructure\.MainPostRepository;" `
    -Description "local main post availability repository import"

  Assert-FileDoesNotContain `
    -Path $path `
    -Pattern "import com\.memesee\.content\.subpost\.infrastructure\.SubPostRepository;" `
    -Description "local sub-post availability repository import"
}

foreach ($item in @(
  @{ Pattern = "filterUnavailableCachedNotifications"; Description = "cached notification privacy filter" },
  @{ Pattern = "notification_list_cache_privacy_refresh_failed"; Description = "notification sanitized fallback logging" },
  @{ Pattern = "POST_DELETED_REASON"; Description = "deleted main post notification reason" },
  @{ Pattern = "SUB_POST_DELETED_REASON"; Description = "deleted sub-post notification reason" },
  @{ Pattern = "toResponse\(notification, activeMainPostIds, activeSubPostIds\)"; Description = "notification response availability mapping" }
)) {
  Assert-FileContains -Path $notificationService -Pattern $item.Pattern -Description $item.Description
}

foreach ($item in @(
  @{ Pattern = "filterUnavailableCachedReferences"; Description = "cached interaction privacy filter" },
  @{ Pattern = "my_interaction_list_cache_privacy_refresh_failed"; Description = "interaction sanitized fallback logging" },
  @{ Pattern = "loadActiveSubPostIdsWithActiveMainPost"; Description = "interaction active sub-post guard" }
)) {
  Assert-FileContains -Path $interactionService -Pattern $item.Pattern -Description $item.Description
}

foreach ($item in @(
  @{ Pattern = "loadActiveDatabaseFeedPage"; Description = "active database feed loader" },
  @{ Pattern = "filterActiveFeedPage"; Description = "feed page active reference filter" },
  @{ Pattern = "(?s)loadedResponse = loadActiveDatabaseFeedPage.*feedPageCache\.putFeedPage\(cacheKey, loadedResponse\)"; Description = "feed cache write after active filtering" },
  @{ Pattern = "(?s)refreshedResponse = loadActiveDatabaseFeedPage.*feedPageCache\.putFeedPage\(cacheKey, refreshedResponse\)"; Description = "feed async refresh write after active filtering" }
)) {
  Assert-FileContains -Path $feedService -Pattern $item.Pattern -Description $item.Description
}

foreach ($item in @(
  @{ Pattern = "loadActiveMainPostIds"; Description = "media active main-post guard" },
  @{ Pattern = "loadActiveSubPostIdsWithActiveMainPost"; Description = "media active sub-post guard" },
  @{ Pattern = "mainPostMediaCache::evictMedia"; Description = "stale main-post media cache eviction" },
  @{ Pattern = "subPostMediaCache::evictMedia"; Description = "stale sub-post media cache eviction" }
)) {
  Assert-FileContains -Path $mediaService -Pattern $item.Pattern -Description $item.Description
}

foreach ($item in @(
  @{ Path = $notificationTest; Pattern = "listNotificationsAnnotatesDeletedPostAndSubPostTargetsWithoutMutatingIds"; Description = "notification refresh redaction test" },
  @{ Path = $notificationTest; Pattern = "cachedNotificationListRedactsUnavailableReferencesEvenWhenRefreshFails"; Description = "cached notification redaction fallback test" },
  @{ Path = $interactionTest; Pattern = "cachedInteractionListDropsUnavailableReferencesEvenWhenRefreshFails"; Description = "cached interaction privacy fallback test" },
  @{ Path = $feedTest; Pattern = "cachedFeedPageDropsPostsThatAreNoLongerActiveInAuthoritativeStore"; Description = "cached feed privacy test" },
  @{ Path = $feedTest; Pattern = "cacheMissFeedPageDropsStaleProjectionRowsBeforeCaching"; Description = "feed cache miss stale projection privacy test" },
  @{ Path = $feedTest; Pattern = "searchFeedDropsRowsThatAreNoLongerActiveInAuthoritativeStore"; Description = "search feed privacy test" },
  @{ Path = $mediaTest; Pattern = "resolveMainPostMediaDropsCachedAttachmentsWhenMainPostIsNoLongerActive"; Description = "main post media stale cache privacy test" },
  @{ Path = $mediaTest; Pattern = "resolveSubPostMediaDropsCachedAttachmentsWhenSubPostParentMainPostIsNoLongerActive"; Description = "sub-post media parent privacy test" }
)) {
  Assert-FileContains -Path $item.Path -Pattern $item.Pattern -Description $item.Description
}

if ($RunBackendTests) {
  Invoke-BackendPrivacyTests
}

Write-VerificationResult -Status "OK"
Write-Output "content privacy regression contracts ok"
