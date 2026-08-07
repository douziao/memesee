param(
  [string]$ImageTag = "memesee-frontend:runtime-check",
  [string]$ContainerName = "memesee-frontend-runtime-check",
  [int]$HostPort = 3000,
  [int]$TimeoutSec = 10,
  [switch]$PullBaseImages,
  [switch]$KeepImage
)

$ErrorActionPreference = "Stop"

function Invoke-Docker {
  param([string[]]$Arguments)

  & docker @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "docker $($Arguments -join ' ') failed with exit code $LASTEXITCODE"
  }
}

function Stop-FrontendContainer {
  param([string]$Name)

  $containerId = docker ps -a --filter "name=^/${Name}$" --format "{{.ID}}"
  if ($containerId) {
    docker rm -f $Name | Out-Null
  }
}

function Wait-FrontendReady {
  param(
    [string]$Url,
    [int]$TimeoutSec
  )

  $deadline = (Get-Date).AddSeconds($TimeoutSec)
  $lastError = $null
  while ((Get-Date) -lt $deadline) {
    try {
      $response = Invoke-WebRequest -Uri "$($Url.TrimEnd('/'))/healthz" -Method GET -UseBasicParsing -TimeoutSec 2
      if ([int]$response.StatusCode -ge 200 -and [int]$response.StatusCode -lt 300) {
        return
      }
    } catch {
      $lastError = $_.Exception.Message
    }
    Start-Sleep -Milliseconds 500
  }

  throw "frontend container did not become ready within ${TimeoutSec}s. Last error: $lastError"
}

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$frontendDir = Join-Path $repoRoot "frontend"
$frontendUrl = "http://127.0.0.1:$HostPort"
$buildPullFlag = if ($PullBaseImages) { "--pull=true" } else { "--pull=false" }

try {
  Stop-FrontendContainer -Name $ContainerName

  Invoke-Docker -Arguments @(
    "build",
    $buildPullFlag,
    "-t",
    $ImageTag,
    $frontendDir
  )

  Invoke-Docker -Arguments @(
    "run",
    "-d",
    "--rm",
    "--name",
    $ContainerName,
    "-p",
    "127.0.0.1:${HostPort}:80",
    $ImageTag
  )

  Wait-FrontendReady -Url $frontendUrl -TimeoutSec $TimeoutSec

  $runtimeScript = Join-Path $PSScriptRoot "verify-frontend-runtime.ps1"
  & $runtimeScript -FrontendUrl $frontendUrl -TimeoutSec $TimeoutSec -VerifyAssetCompression
  if ($LASTEXITCODE -ne 0) {
    throw "frontend runtime verification failed"
  }
} finally {
  Stop-FrontendContainer -Name $ContainerName
  if (-not $KeepImage) {
    docker rmi $ImageTag 2>$null | Out-Null
  }
}
