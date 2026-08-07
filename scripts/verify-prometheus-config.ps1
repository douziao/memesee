param(
  [string]$PrometheusImage = "prom/prometheus:v3.12.0"
)

$ErrorActionPreference = "Stop"

function Invoke-Docker {
  param([string[]]$Arguments)

  & docker @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "docker $($Arguments -join ' ') failed with exit code $LASTEXITCODE"
  }
}

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$prometheusDir = (Resolve-Path (Join-Path $repoRoot "deploy/prometheus")).Path

Invoke-Docker -Arguments @(
  "run",
  "--rm",
  "-v",
  "${prometheusDir}:/etc/prometheus:ro",
  "--entrypoint",
  "promtool",
  $PrometheusImage,
  "check",
  "config",
  "/etc/prometheus/prometheus.yml"
)

Write-Output "prometheus configuration ok"
