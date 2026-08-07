$ErrorActionPreference = "Stop"

function Assert-Contains {
  param(
    [string]$Content,
    [string]$Pattern,
    [string]$Description
  )

  if ($Content -notmatch [regex]::Escape($Pattern)) {
    throw "production runbook is missing $Description`: $Pattern"
  }
}

function Get-PrometheusAlertNames {
  param([string]$Path)

  $content = Get-Content -Raw $Path
  return @([regex]::Matches($content, "(?m)^\s*-\s+alert:\s+([A-Za-z0-9_:-]+)\s*$") |
    ForEach-Object { $_.Groups[1].Value } |
    Sort-Object -Unique)
}

$runbookPath = Join-Path "docs" "production-incident-runbook.md"
$alertRulesPath = Join-Path (Join-Path "deploy" "prometheus") "alert-rules.yml"

if (-not (Test-Path $runbookPath)) {
  throw "missing $runbookPath"
}
if (-not (Test-Path $alertRulesPath)) {
  throw "missing $alertRulesPath"
}

$runbook = Get-Content -Raw $runbookPath
$alerts = Get-PrometheusAlertNames -Path $alertRulesPath
if ($alerts.Count -eq 0) {
  throw "no Prometheus alerts found in $alertRulesPath"
}

foreach ($alert in $alerts) {
  Assert-Contains -Content $runbook -Pattern $alert -Description "Prometheus alert response entry"
}

foreach ($requiredPattern in @(
  "verify-production-env-report.ps1",
  "verify-production-preflight.ps1",
  "verify-production-post-launch.ps1",
  "verify-production-launch.ps1",
  "prime-content-command-metrics.ps1",
  "deploy-bluegreen.ps1",
  "rollback-bluegreen.ps1",
  "rabbitmq-dlq.ps1",
  "measure-api-latency.ps1",
  "verify-content-db-indexes.ps1",
  "verify-nginx-config.ps1",
  "verify-nginx-frontend-proxy-runtime.ps1",
  "-Plan",
  "AuditFile",
  "AuditSchemaVersion",
  "Status",
  "Safety",
  "CLEANUP_FAILED",
  "incident-preflight.json",
  "incident-deploy-plan.json",
  "incident-deploy-audit.json",
  "post-launch-monitoring.json",
  "incident-rollback-audit.json",
  "incident-dlq-audit.json",
  "content-command-sample-audit.json",
  "DEPLOY_VERIFY_CONTENT_COMMAND_METRIC_DEFINITIONS",
  "ConfirmDestructive",
  "MEMESEE_CONTENT_COMMAND_SAMPLE_TOKEN",
  "StopRolledBackProject",
  "Never paste",
  "RabbitMQ credentials",
  "MinIO credentials",
  "Post-Incident Closure"
)) {
  Assert-Contains -Content $runbook -Pattern $requiredPattern -Description "incident response guidance"
}

Write-Output "production incident runbook ok"
