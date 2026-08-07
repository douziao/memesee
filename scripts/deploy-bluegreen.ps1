param(
  [ValidateSet("blue", "green")]
  [string]$TargetColor = "green",
  [ValidateSet("blue", "green")]
  [string]$ActiveColor = "blue",
  [string]$EnvFile = ".env",
  [string]$ComposeFile = "docker-compose.prod.yml",
  [string]$ProjectPrefix = "memesee",
  [string]$GeneratedEnvDir = "deploy/.generated",
  [string]$StateFile = "deploy/bluegreen-state.json",
  [int]$GatewayPort = 18081,
  [int]$FrontendPort = 13001,
  [int]$PrometheusPort = 19091,
  [int]$MysqlPort = 13308,
  [int]$RedisPort = 16380,
  [int]$RabbitMqPort = 15674,
  [int]$RabbitMqManagementPort = 25673,
  [int]$MinioApiPort = 19002,
  [int]$MinioConsolePort = 19003,
  [int]$MeiliPort = 17701,
  [int]$OtelGrpcPort = 14319,
  [int]$OtelHttpPort = 14320,
  [switch]$SkipBuild,
  [switch]$Promote,
  [string]$NginxSitePath = "",
  [switch]$ReloadNginx,
  [switch]$Plan,
  [string]$AuditFile = ""
)

$ErrorActionPreference = "Stop"

if ($TargetColor -eq $ActiveColor) {
  throw "TargetColor must be different from ActiveColor."
}

function Read-EnvFile {
  param([string]$Path)
  if (-not (Test-Path $Path)) {
    throw "Missing env file: $Path"
  }
  $values = [ordered]@{}
  Get-Content $Path | ForEach-Object {
    $line = $_
    if (-not $line.Trim() -or $line.TrimStart().StartsWith("#") -or $line -notmatch "=") {
      return
    }
    $name, $value = $line -split "=", 2
    $values[$name.Trim()] = $value.Trim()
  }
  return $values
}

function Write-EnvFile {
  param(
    [string]$Path,
    [hashtable]$Values
  )
  $directory = Split-Path -Parent $Path
  if ($directory -and -not (Test-Path $directory)) {
    New-Item -ItemType Directory -Path $directory | Out-Null
  }
  $lines = @($Values.GetEnumerator() | Sort-Object Name | ForEach-Object { "$($_.Name)=$($_.Value)" })
  Set-Content -Path $Path -Value $lines -Encoding ascii
}

function Write-JsonResult {
  param(
    [object]$Value,
    [string]$Path = ""
  )

  $json = $Value | ConvertTo-Json -Depth 12
  if ($Path) {
    $directory = Split-Path -Parent $Path
    if ($directory -and -not (Test-Path $directory)) {
      New-Item -ItemType Directory -Path $directory | Out-Null
    }
    Set-Content -Path $Path -Value $json -Encoding ascii
  }
  $json
}

function Invoke-ProductionEnvValidation {
  param([string]$Path)

  $validator = Join-Path $PSScriptRoot "verify-production-env.ps1"
  $powerShellExe = (Get-Process -Id $PID).Path
  & $powerShellExe -NoProfile -ExecutionPolicy Bypass -File $validator -EnvFile $Path
  if ($LASTEXITCODE -ne 0) {
    throw "Production env validation failed for $Path"
  }
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

$targetProject = "${ProjectPrefix}_${TargetColor}"
$activeProject = "${ProjectPrefix}_${ActiveColor}"
$targetPrefix = "${ProjectPrefix}-${TargetColor}"
$targetEnvFile = Join-Path $GeneratedEnvDir "$targetProject.env"

$envValues = Read-EnvFile -Path $EnvFile
$envValues["COMPOSE_CONTAINER_PREFIX"] = $targetPrefix
$envValues["GATEWAY_HOST_PORT"] = [string]$GatewayPort
$envValues["FRONTEND_HOST_PORT"] = [string]$FrontendPort
$envValues["PROMETHEUS_HOST_PORT"] = [string]$PrometheusPort
$envValues["MYSQL_HOST_PORT"] = [string]$MysqlPort
$envValues["REDIS_HOST_PORT"] = [string]$RedisPort
$envValues["RABBITMQ_HOST_PORT"] = [string]$RabbitMqPort
$envValues["RABBITMQ_MANAGEMENT_HOST_PORT"] = [string]$RabbitMqManagementPort
$envValues["MINIO_API_HOST_PORT"] = [string]$MinioApiPort
$envValues["MINIO_CONSOLE_HOST_PORT"] = [string]$MinioConsolePort
$envValues["MEILI_HOST_PORT"] = [string]$MeiliPort
$envValues["OTEL_COLLECTOR_OTLP_GRPC_HOST_PORT"] = [string]$OtelGrpcPort
$envValues["OTEL_COLLECTOR_OTLP_HTTP_HOST_PORT"] = [string]$OtelHttpPort

$composeArgs = @("compose", "-p", $targetProject, "--env-file", $targetEnvFile, "-f", $ComposeFile, "up", "-d")
if (-not $SkipBuild) {
  $composeArgs += "--build"
}

if ($Plan) {
  Write-JsonResult -Path $AuditFile -Value ([PSCustomObject]@{
    Action = "DeployBlueGreenPlan"
    AuditSchemaVersion = 1
    DryRun = $true
    Status = "PLAN"
    GeneratedAt = (Get-Date).ToUniversalTime().ToString("o")
    EnvFile = $EnvFile
    ComposeFile = $ComposeFile
    StateFile = $StateFile
    ProjectPrefix = $ProjectPrefix
    ActiveColor = $ActiveColor
    ActiveProject = $activeProject
    TargetColor = $TargetColor
    TargetProject = $targetProject
    TargetEnvFile = $targetEnvFile
    GeneratedEnvKeys = @($envValues.Keys | Sort-Object)
    Ports = [PSCustomObject]@{
      Gateway = $GatewayPort
      Frontend = $FrontendPort
      Prometheus = $PrometheusPort
      Mysql = $MysqlPort
      Redis = $RedisPort
      RabbitMq = $RabbitMqPort
      RabbitMqManagement = $RabbitMqManagementPort
      MinioApi = $MinioApiPort
      MinioConsole = $MinioConsolePort
      Meili = $MeiliPort
      OtelGrpc = $OtelGrpcPort
      OtelHttp = $OtelHttpPort
    }
    Commands = @(
      "docker $($composeArgs -join ' ')",
      "powershell -NoProfile -ExecutionPolicy Bypass -File scripts/verify-production-launch.ps1 -FromEnvFile $targetEnvFile -InternalOnly"
    )
    Promote = [bool]$Promote
    Nginx = [PSCustomObject]@{
      WillUpdate = [bool]($Promote -and $NginxSitePath)
      SitePath = $NginxSitePath
      SitePathExists = if ($NginxSitePath) { Test-Path $NginxSitePath } else { $false }
      Reload = [bool]($Promote -and $ReloadNginx)
      GatewayPort = $GatewayPort
      FrontendPort = $FrontendPort
      MinioPort = $MinioApiPort
    }
    Safety = [PSCustomObject]@{
      RequiresConfirmDestructive = $false
      WritesProductionData = $true
      DeletesProductionData = $false
      StartsContainers = $true
      WritesGeneratedEnvFile = $true
      WritesStateFile = $true
      ModifiesRuntimeRouting = [bool]($Promote -and $NginxSitePath)
      ReloadsNginx = [bool]($Promote -and $ReloadNginx)
    }
    WouldValidateProductionEnv = $true
    WouldWriteGeneratedEnvFile = $true
    WouldStartContainers = $true
    WouldRunRuntimeVerification = $true
    WouldWriteStateFile = $true
    WouldModifyNginx = [bool]($Promote -and $NginxSitePath)
    WouldReloadNginx = [bool]($Promote -and $ReloadNginx)
  })
  return
}

Invoke-ProductionEnvValidation -Path $EnvFile
Write-EnvFile -Path $targetEnvFile -Values $envValues

& docker @composeArgs
if ($LASTEXITCODE -ne 0) {
  throw "docker $($composeArgs -join ' ') failed"
}

Invoke-LaunchVerification -Path $targetEnvFile

$previousState = $null
if (Test-Path $StateFile) {
  $previousState = Get-Content -Raw $StateFile | ConvertFrom-Json
}

$state = [ordered]@{
  activeColor = if ($Promote) { $TargetColor } else { $ActiveColor }
  activeProject = if ($Promote) { $targetProject } else { $activeProject }
  candidateColor = $TargetColor
  candidateProject = $targetProject
  candidateEnvFile = $targetEnvFile
  generatedAt = (Get-Date).ToUniversalTime().ToString("o")
  ports = [ordered]@{
    gateway = $GatewayPort
    frontend = $FrontendPort
    prometheus = $PrometheusPort
    minio = $MinioApiPort
  }
  previous = $previousState
}

if ($Promote) {
  Set-NginxUpstreams -Path $NginxSitePath -Gateway $GatewayPort -Frontend $FrontendPort -Minio $MinioApiPort
}

$stateDirectory = Split-Path -Parent $StateFile
if ($stateDirectory -and -not (Test-Path $stateDirectory)) {
  New-Item -ItemType Directory -Path $stateDirectory | Out-Null
}
$state | ConvertTo-Json -Depth 10 | Set-Content -Path $StateFile -Encoding ascii
$completedAt = (Get-Date).ToUniversalTime()
$result = [ordered]@{
  Action = "DeployBlueGreen"
  AuditSchemaVersion = 1
  DryRun = $false
  Status = "OK"
  CompletedAt = $completedAt.ToString("o")
  EnvFile = $EnvFile
  ComposeFile = $ComposeFile
  StateFile = $StateFile
  ActiveColor = $state.activeColor
  ActiveProject = $state.activeProject
  TargetColor = $TargetColor
  TargetProject = $targetProject
  TargetEnvFile = $targetEnvFile
  Ports = $state.ports
  Promoted = [bool]$Promote
  RuntimeVerification = [ordered]@{
    GatewayUrl = "http://127.0.0.1:$GatewayPort"
    FrontendUrl = "http://127.0.0.1:$FrontendPort"
    PrometheusUrl = "http://127.0.0.1:$PrometheusPort"
    Launcher = "verify-production-launch.ps1"
    InternalOnly = $true
    Passed = $true
  }
  Nginx = [ordered]@{
    Updated = [bool]($Promote -and $NginxSitePath)
    SitePath = $NginxSitePath
    Reloaded = [bool]($Promote -and $NginxSitePath -and $ReloadNginx)
    GatewayPort = $GatewayPort
    FrontendPort = $FrontendPort
    MinioPort = $MinioApiPort
  }
  ValidatedProductionEnv = $true
  WroteGeneratedEnvFile = $true
  WroteStateFile = $true
  State = $state
  Safety = [ordered]@{
    RequiresConfirmDestructive = $false
    WritesProductionData = $true
    DeletesProductionData = $false
    StartsContainers = $true
    WritesGeneratedEnvFile = $true
    WritesStateFile = $true
    ModifiesRuntimeRouting = [bool]($Promote -and $NginxSitePath)
    ReloadsNginx = [bool]($Promote -and $NginxSitePath -and $ReloadNginx)
  }
}

Write-JsonResult -Path $AuditFile -Value $result
