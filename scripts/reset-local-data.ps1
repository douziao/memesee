param(
  [switch] $ConfirmReset,
  [switch] $SkipRestart
)

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $repoRoot

if (-not $ConfirmReset) {
  Write-Error "This script deletes local Docker volumes. Re-run with -ConfirmReset when you want to reset local test data."
}

if (-not (Test-Path ".env")) {
  Write-Error "Missing .env. Copy .env.example to .env and fill the required values before resetting local data."
}

docker version | Out-Null

Write-Host "Stopping local infrastructure and deleting Docker volumes..."
docker compose down --volumes --remove-orphans

if ($SkipRestart) {
  Write-Host "Local data volumes were deleted. Restart skipped."
  exit 0
}

Write-Host "Starting local infrastructure with fresh volumes..."
docker compose up -d
docker compose ps
