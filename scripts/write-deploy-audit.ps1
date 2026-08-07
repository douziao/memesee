param(
  [string]$OutputFile,
  [string]$Status,
  [string]$StartedAt,
  [int]$ExitCode = 0,
  [string]$Detail = "",
  [string]$AppDir = "",
  [string]$Domain = "",
  [string]$ComposeFile = "",
  [string]$NginxSiteName = "",
  [string]$NginxSource = "",
  [string]$SkipPull = "",
  [string]$RuntimeVerification = "",
  [string]$GatewayPort = "",
  [string]$FrontendPort = "",
  [string]$PrometheusPort = "",
  [string]$GitBefore = "",
  [string]$GitAfter = "",
  [string]$LaunchAuditFile = ""
)

$ErrorActionPreference = "Stop"

function ConvertTo-BooleanValue {
  param([string]$Value)

  if ($Value -eq "true") {
    return $true
  }
  if ($Value -eq "false") {
    return $false
  }
  return $null
}

function Read-JsonFile {
  param([string]$Path)

  if (-not $Path -or -not (Test-Path $Path)) {
    return $null
  }
  try {
    return Get-Content -Raw $Path | ConvertFrom-Json
  } catch {
    return [ordered]@{
      Error = "failed to parse launch audit file"
      Path = $Path
      Detail = $_.Exception.Message
    }
  }
}

function ConvertTo-UtcDate {
  param([string]$Value)

  if (-not $Value) {
    return (Get-Date).ToUniversalTime()
  }
  return ([datetime]::Parse($Value)).ToUniversalTime()
}

if (-not $OutputFile) {
  throw "OutputFile is required"
}
if ($Status -notin @("OK", "FAILED")) {
  throw "Status must be OK or FAILED"
}

$startedAtUtc = ConvertTo-UtcDate -Value $StartedAt
$completedAtUtc = (Get-Date).ToUniversalTime()
$launchAudit = Read-JsonFile -Path $LaunchAuditFile

$result = [ordered]@{
  Action = "RegularDeploy"
  AuditSchemaVersion = 1
  Status = $Status
  StartedAt = $startedAtUtc.ToString("o")
  CompletedAt = $completedAtUtc.ToString("o")
  DurationSeconds = [math]::Round(($completedAtUtc - $startedAtUtc).TotalSeconds, 2)
  ExitCode = $ExitCode
  Detail = $Detail
  AppDir = $AppDir
  Domain = $Domain
  ComposeFile = $ComposeFile
  Git = [ordered]@{
    PullSkipped = ConvertTo-BooleanValue -Value $SkipPull
    Before = $GitBefore
    After = $GitAfter
  }
  Ports = [ordered]@{
    Gateway = $GatewayPort
    Frontend = $FrontendPort
    Prometheus = $PrometheusPort
  }
  Nginx = [ordered]@{
    SiteName = $NginxSiteName
    Source = $NginxSource
    ReloadAttempted = [bool]$NginxSource
  }
  RuntimeVerification = [ordered]@{
    Enabled = ConvertTo-BooleanValue -Value $RuntimeVerification
    LaunchAuditFile = $LaunchAuditFile
    LaunchAudit = $launchAudit
  }
  Safety = [ordered]@{
    ReadsProductionData = $true
    WritesProductionData = $true
    DeletesProductionData = $false
    StartsContainers = $true
    ReloadsNginx = [bool]$NginxSource
    RequiresConfirmDestructive = $false
  }
}

$directory = Split-Path -Parent $OutputFile
if ($directory -and -not (Test-Path $directory)) {
  New-Item -ItemType Directory -Path $directory | Out-Null
}
$result | ConvertTo-Json -Depth 20 | Set-Content -Path $OutputFile -Encoding ascii
Write-Output "deploy audit written: $OutputFile"
