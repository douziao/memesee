param(
  [string]$EnvFile = ".env",
  [string]$StateFile = "deploy/bluegreen-state.json",
  [switch]$AllowPlaceholders,
  [switch]$RunLaunchVerification,
  [switch]$SkipRollbackPlan,
  [string]$OutputFile = "",
  [string]$ReleaseId = "",
  [string]$ArtifactDir = ""
)

$ErrorActionPreference = "Stop"
$startedAt = (Get-Date).ToUniversalTime()
$steps = New-Object System.Collections.Generic.List[object]

function Add-StepResult {
  param(
    [string]$Name,
    [string]$Status,
    [double]$Seconds = 0,
    [object]$Output = $null,
    [string]$Detail = ""
  )

  $steps.Add([PSCustomObject]@{
    Name = $Name
    Status = $Status
    Seconds = [math]::Round($Seconds, 2)
    Detail = $Detail
    Output = $Output
  }) | Out-Null
}

function Invoke-PreflightStep {
  param(
    [string]$Name,
    [scriptblock]$Action
  )

  $stopwatch = [System.Diagnostics.Stopwatch]::StartNew()
  try {
    $output = & $Action
    $stopwatch.Stop()
    Add-StepResult -Name $Name -Status "OK" -Seconds $stopwatch.Elapsed.TotalSeconds -Output @($output)
  } catch {
    $stopwatch.Stop()
    Add-StepResult -Name $Name -Status "FAILED" -Seconds $stopwatch.Elapsed.TotalSeconds -Detail $_.Exception.Message
  }
}

function Convert-CommandOutputToJsonObject {
  param([object[]]$Output)

  $text = (@($Output) -join "`n").Trim()
  if (-not $text) {
    return $null
  }
  try {
    return $text | ConvertFrom-Json
  } catch {
    return $text
  }
}

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

function Join-ArtifactPath {
  param(
    [string]$Directory,
    [string]$FileName
  )

  if (-not $Directory) {
    return ConvertTo-PortablePath -Path $FileName
  }
  return ConvertTo-PortablePath -Path (Join-Path $Directory $FileName)
}

function ConvertTo-PortablePath {
  param([string]$Path)

  return $Path -replace "\\", "/"
}

function Format-CommandArgument {
  param([string]$Value)

  if ($Value -match "^[A-Za-z0-9_./:=?&,%+-]+$") {
    return $Value
  }
  return "'" + ($Value -replace "'", "''") + "'"
}

function Format-PowerShellCommand {
  param(
    [string]$Script,
    [string[]]$Arguments
  )

  return ((".\$Script") + " " + (($Arguments | ForEach-Object { Format-CommandArgument -Value $_ }) -join " ")).Trim()
}

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
Push-Location $repoRoot
try {
  if (-not (Test-Path $EnvFile)) {
    throw "missing env file: $EnvFile"
  }

  if (-not $ReleaseId) {
    $ReleaseId = "memesee-$($startedAt.ToString('yyyyMMddHHmmss'))"
  }
  if (-not $ArtifactDir) {
    $ArtifactDir = Join-Path "deploy/release-artifacts" $ReleaseId
  }
  $ArtifactDir = ConvertTo-PortablePath -Path $ArtifactDir

  $preflightArtifact = if ($OutputFile) { ConvertTo-PortablePath -Path $OutputFile } else { Join-ArtifactPath -Directory $ArtifactDir -FileName "production-preflight.json" }
  $deployAuditArtifact = Join-ArtifactPath -Directory $ArtifactDir -FileName "deploy-audit.json"
  $launchAuditArtifact = Join-ArtifactPath -Directory $ArtifactDir -FileName "deploy-audit.launch.json"
  $postLaunchArtifact = Join-ArtifactPath -Directory $ArtifactDir -FileName "post-launch-monitoring.json"
  $contentPrivacyArtifact = Join-ArtifactPath -Directory $ArtifactDir -FileName "content-privacy-regression.json"
  $evidenceArtifact = Join-ArtifactPath -Directory $ArtifactDir -FileName "release-evidence.json"
  $evidenceVerificationArtifact = Join-ArtifactPath -Directory $ArtifactDir -FileName "release-evidence.verification.json"
  $archiveVerificationArtifact = Join-ArtifactPath -Directory $ArtifactDir -FileName "release-archive.verification.json"

  Invoke-PreflightStep -Name "env redacted report" -Action {
    $params = @{
      EnvFile = $EnvFile
      Json = $true
    }
    if ($AllowPlaceholders) {
      $params.AllowPlaceholders = $true
    }
    & (Join-Path $PSScriptRoot "verify-production-env-report.ps1") @params
  }

  Invoke-PreflightStep -Name "launch verify command" -Action {
    & (Join-Path $PSScriptRoot "verify-production-launch.ps1") -FromEnvFile $EnvFile -PrintCommand
  }

  Invoke-PreflightStep -Name "incident runbook coverage" -Action {
    & (Join-Path $PSScriptRoot "verify-production-runbook.ps1")
  }

  if ($SkipRollbackPlan) {
    Add-StepResult -Name "rollback plan" -Status "SKIPPED" -Detail "-SkipRollbackPlan"
  } elseif (-not (Test-Path $StateFile)) {
    Add-StepResult -Name "rollback plan" -Status "SKIPPED" -Detail "missing state file: $StateFile"
  } else {
    Invoke-PreflightStep -Name "rollback plan" -Action {
      & (Join-Path $PSScriptRoot "rollback-bluegreen.ps1") -StateFile $StateFile -Plan
    }
  }

  Invoke-PreflightStep -Name "DLQ requeue plan" -Action {
    & (Join-Path $PSScriptRoot "rabbitmq-dlq.ps1") -Action Requeue -Count 25 -Plan
  }

  Invoke-PreflightStep -Name "DLQ purge plan" -Action {
    & (Join-Path $PSScriptRoot "rabbitmq-dlq.ps1") -Action Purge -Plan
  }

  if ($RunLaunchVerification) {
    Invoke-PreflightStep -Name "launch runtime verification" -Action {
      & (Join-Path $PSScriptRoot "verify-production-launch.ps1") -FromEnvFile $EnvFile
    }
  } else {
    Add-StepResult -Name "launch runtime verification" -Status "SKIPPED" -Detail "pass -RunLaunchVerification to execute live runtime checks"
  }

  $completedAt = (Get-Date).ToUniversalTime()
  $failedCount = @($steps | Where-Object { $_.Status -eq "FAILED" }).Count
  $skippedCount = @($steps | Where-Object { $_.Status -eq "SKIPPED" }).Count
  $okCount = @($steps | Where-Object { $_.Status -eq "OK" }).Count

  $normalizedSteps = @($steps | ForEach-Object {
    [PSCustomObject]@{
      Name = $_.Name
      Status = $_.Status
      Seconds = $_.Seconds
      Detail = $_.Detail
      Output = Convert-CommandOutputToJsonObject -Output $_.Output
    }
  })

  $result = [ordered]@{
    Action = "ProductionPreflight"
    ReleaseId = $ReleaseId
    EnvFile = (Resolve-Path $EnvFile).Path
    StateFile = $StateFile
    StartedAt = $startedAt.ToString("o")
    CompletedAt = $completedAt.ToString("o")
    DurationSeconds = [math]::Round(($completedAt - $startedAt).TotalSeconds, 2)
    Summary = [ordered]@{
      Ok = $okCount
      Skipped = $skippedCount
      Failed = $failedCount
    }
    SuggestedArtifacts = [ordered]@{
      Directory = $ArtifactDir
      PreflightFile = $preflightArtifact
      DeployAuditFile = $deployAuditArtifact
      DeployLaunchAuditFile = $launchAuditArtifact
      PostLaunchFile = $postLaunchArtifact
      ContentPrivacyFile = $contentPrivacyArtifact
      EvidenceBundleFile = $evidenceArtifact
      EvidenceBundleVerificationFile = $evidenceVerificationArtifact
      ArchiveVerificationFile = $archiveVerificationArtifact
      ProductionEvidenceRequirement = [ordered]@{
        RequireOperationalComplete = $true
        RequiredOperationalComplete = $true
        RequiredPlanOnly = 0
        Detail = "Formal release archives must verify OperationalComplete=true so PLAN, DryRun, or monitoring-plan artifacts are not mistaken for completed operational evidence."
      }
      Commands = [ordered]@{
        Preflight = Format-PowerShellCommand -Script "scripts\verify-production-preflight.ps1" -Arguments @("-EnvFile", $EnvFile, "-ReleaseId", $ReleaseId, "-ArtifactDir", $ArtifactDir, "-OutputFile", $preflightArtifact)
        Deploy = "DEPLOY_AUDIT_FILE=$(Format-CommandArgument -Value $deployAuditArtifact) DEPLOY_LAUNCH_AUDIT_FILE=$(Format-CommandArgument -Value $launchAuditArtifact) bash deploy/deploy.sh"
        PostLaunch = Format-PowerShellCommand -Script "scripts\verify-production-post-launch.ps1" -Arguments @("-FromEnvFile", $EnvFile, "-OutputFile", $postLaunchArtifact)
        ContentPrivacy = Format-PowerShellCommand -Script "scripts\verify-content-privacy-regression.ps1" -Arguments @("-OutputFile", $contentPrivacyArtifact)
        EvidenceBundle = Format-PowerShellCommand -Script "scripts\write-release-evidence-bundle.ps1" -Arguments @("-ReleaseId", $ReleaseId, "-EnvFile", $EnvFile, "-PreflightFile", $preflightArtifact, "-DeployAuditFile", $deployAuditArtifact, "-DeployLaunchAuditFile", $launchAuditArtifact, "-PostLaunchFile", $postLaunchArtifact, "-ContentPrivacyFile", $contentPrivacyArtifact, "-OutputFile", $evidenceArtifact)
        VerifyEvidenceBundle = Format-PowerShellCommand -Script "scripts\write-release-evidence-bundle.ps1" -Arguments @("-VerifyExisting", "-BundleFile", $evidenceArtifact, "-OutputFile", $evidenceVerificationArtifact)
        VerifyReleaseArchive = Format-PowerShellCommand -Script "scripts\verify-release-evidence-archive.ps1" -Arguments @("-ArtifactDir", $ArtifactDir, "-ReleaseId", $ReleaseId, "-OutputFile", $archiveVerificationArtifact, "-RequireOperationalComplete")
      }
    }
    Steps = $normalizedSteps
  }

  Write-JsonResult -Path $OutputFile -Value $result
  if ($failedCount -gt 0) {
    exit 1
  }
} finally {
  Pop-Location
}
