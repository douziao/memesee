param(
  [string]$StateFile = "deploy/bluegreen-state.json",
  [string]$ComposeFile = "docker-compose.prod.yml",
  [string]$NginxSitePath = "",
  [switch]$ReloadNginx,
  [switch]$StopRolledBackProject,
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

  $json = $Value | ConvertTo-Json -Depth 10
  if ($Path) {
    $directory = Split-Path -Parent $Path
    if ($directory -and -not (Test-Path $directory)) {
      New-Item -ItemType Directory -Path $directory | Out-Null
    }
    Set-Content -Path $Path -Value $json -Encoding ascii
  }
  $json
}

function Invoke-LaunchVerification {
  param([string]$Path)

  $launcher = Join-Path $PSScriptRoot "verify-production-launch.ps1"
  $powerShellExe = (Get-Process -Id $PID).Path
  & $powerShellExe -NoProfile -ExecutionPolicy Bypass -File $launcher -FromEnvFile $Path -InternalOnly
  if ($LASTEXITCODE -ne 0) {
    throw "Runtime verification failed for $Path"
  }
}

function Get-LaunchVerificationCommand {
  param([string]$Path)

  $launcher = Join-Path $PSScriptRoot "verify-production-launch.ps1"
  $powerShellExe = (Get-Process -Id $PID).Path
  $output = & $powerShellExe -NoProfile -ExecutionPolicy Bypass -File $launcher -FromEnvFile $Path -InternalOnly -PrintCommand
  return (($output) -join "`n").Trim()
}

. (Join-Path $PSScriptRoot "nginx-upstream-utils.ps1")

if (-not (Test-Path $StateFile)) {
  throw "Missing blue/green state file: $StateFile"
}

$state = Get-Content -Raw $StateFile | ConvertFrom-Json
if (-not $state.previous) {
  throw "State file has no previous deployment to roll back to."
}

$previous = $state.previous
if (-not $previous.candidateEnvFile -or -not (Test-Path $previous.candidateEnvFile)) {
  throw "Previous deployment env file is missing: $($previous.candidateEnvFile)"
}

if ($Plan) {
  Write-JsonResult -Path $AuditFile -Value ([PSCustomObject]@{
    Action = "RollbackBlueGreenPlan"
    AuditSchemaVersion = 1
    DryRun = $true
    Status = "PLAN"
    GeneratedAt = (Get-Date).ToUniversalTime().ToString("o")
    StateFile = $StateFile
    ComposeFile = $ComposeFile
    CurrentProject = $state.candidateProject
    RollbackTargetProject = $previous.candidateProject
    RollbackTargetColor = $previous.candidateColor
    RollbackTargetEnvFile = $previous.candidateEnvFile
    Ports = $previous.ports
    Commands = @(
      "docker compose -p $($previous.candidateProject) --env-file $($previous.candidateEnvFile) -f $ComposeFile up -d",
      "powershell -NoProfile -ExecutionPolicy Bypass -File scripts/verify-production-launch.ps1 -FromEnvFile $($previous.candidateEnvFile) -InternalOnly",
      (Get-LaunchVerificationCommand -Path $previous.candidateEnvFile)
    )
    Nginx = [PSCustomObject]@{
      WillUpdate = [bool]$NginxSitePath
      SitePath = $NginxSitePath
      SitePathExists = if ($NginxSitePath) { Test-Path $NginxSitePath } else { $false }
      Reload = [bool]$ReloadNginx
      GatewayPort = $previous.ports.gateway
      FrontendPort = $previous.ports.frontend
      MinioPort = $previous.ports.minio
    }
    StopRolledBackProject = [bool]$StopRolledBackProject
    RolledBackProjectToStop = if ($StopRolledBackProject) { $state.candidateProject } else { "" }
    Safety = [PSCustomObject]@{
      RequiresConfirmDestructive = $false
      WritesProductionData = $true
      DeletesProductionData = [bool]$StopRolledBackProject
      ModifiesRuntimeRouting = [bool]$NginxSitePath
      ReloadsNginx = [bool]$ReloadNginx
      StopsContainers = [bool]$StopRolledBackProject
    }
    WouldWriteStateFile = $true
    WouldStartContainers = $true
    WouldModifyNginx = [bool]$NginxSitePath
    WouldReloadNginx = [bool]$ReloadNginx
    WouldStopContainers = [bool]$StopRolledBackProject
  })
  return
}

& docker compose -p $previous.candidateProject --env-file $previous.candidateEnvFile -f $ComposeFile up -d
if ($LASTEXITCODE -ne 0) {
  throw "Failed to ensure previous Compose project is running."
}

Invoke-LaunchVerification -Path $previous.candidateEnvFile

Set-NginxUpstreams -Path $NginxSitePath `
  -Gateway ([int]$previous.ports.gateway) `
  -Frontend ([int]$previous.ports.frontend) `
  -Minio ([int]$previous.ports.minio)

if ($StopRolledBackProject) {
  & docker compose -p $state.candidateProject --env-file $state.candidateEnvFile -f $ComposeFile stop
  if ($LASTEXITCODE -ne 0) {
    throw "Failed to stop rolled-back project $($state.candidateProject)"
  }
}

$completedAt = (Get-Date).ToUniversalTime()
$rollbackState = [ordered]@{
  activeColor = $previous.candidateColor
  activeProject = $previous.candidateProject
  candidateColor = $previous.candidateColor
  candidateProject = $previous.candidateProject
  candidateEnvFile = $previous.candidateEnvFile
  generatedAt = (Get-Date).ToUniversalTime().ToString("o")
  ports = $previous.ports
  previous = $previous.previous
  rolledBackFrom = $state.candidateProject
}

$rollbackState | ConvertTo-Json -Depth 10 | Set-Content -Path $StateFile -Encoding ascii
$result = [ordered]@{
  Action = "RollbackBlueGreen"
  AuditSchemaVersion = 1
  DryRun = $false
  Status = "OK"
  StartedAt = $startedAt.ToString("o")
  CompletedAt = $completedAt.ToString("o")
  DurationSeconds = [math]::Round(($completedAt - $startedAt).TotalSeconds, 2)
  StateFile = $StateFile
  ComposeFile = $ComposeFile
  RolledBackFrom = $state.candidateProject
  ActiveProject = $previous.candidateProject
  ActiveColor = $previous.candidateColor
  ActiveEnvFile = $previous.candidateEnvFile
  Ports = $previous.ports
  RuntimeVerification = [ordered]@{
    GatewayUrl = "http://127.0.0.1:$($previous.ports.gateway)"
    FrontendUrl = "http://127.0.0.1:$($previous.ports.frontend)"
    PrometheusUrl = "http://127.0.0.1:$($previous.ports.prometheus)"
    Launcher = "verify-production-launch.ps1"
    InternalOnly = $true
    Passed = $true
  }
  Nginx = [ordered]@{
    Updated = [bool]$NginxSitePath
    SitePath = $NginxSitePath
    Reloaded = [bool]($NginxSitePath -and $ReloadNginx)
    GatewayPort = $previous.ports.gateway
    FrontendPort = $previous.ports.frontend
    MinioPort = $previous.ports.minio
  }
  StoppedProject = if ($StopRolledBackProject) { $state.candidateProject } else { "" }
  WroteStateFile = $true
  Safety = [ordered]@{
    RequiresConfirmDestructive = $false
    WritesProductionData = $true
    DeletesProductionData = [bool]$StopRolledBackProject
    ModifiesRuntimeRouting = [bool]$NginxSitePath
    ReloadsNginx = [bool]($NginxSitePath -and $ReloadNginx)
    StopsContainers = [bool]$StopRolledBackProject
  }
}

Write-JsonResult -Path $AuditFile -Value $result
