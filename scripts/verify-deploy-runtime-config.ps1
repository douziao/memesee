$ErrorActionPreference = "Stop"

function Assert-Contains {
  param(
    [string]$Content,
    [string]$Pattern,
    [string]$Description,
    [string]$Path
  )

  if ($Content -notmatch [regex]::Escape($Pattern)) {
    throw "$Path is missing $Description`: $Pattern"
  }
}

function Assert-NotContains {
  param(
    [string]$Content,
    [string]$Pattern,
    [string]$Description,
    [string]$Path
  )

  if ($Content -match [regex]::Escape($Pattern)) {
    throw "$Path unexpectedly includes $Description`: $Pattern"
  }
}

$deployScriptPath = Join-Path "deploy" "deploy.sh"
$productionEnvPath = Join-Path "deploy" ".env.production.example"
$deployAuditWriterPath = Join-Path "scripts" "write-deploy-audit.ps1"
$productionRuntimeVerifierPath = Join-Path "scripts" "verify-production-runtime.ps1"
$productionEnvVerifierPath = Join-Path "scripts" "verify-production-env.ps1"
$productionEnvReportPath = Join-Path "scripts" "verify-production-env-report.ps1"

if (-not (Test-Path $deployScriptPath)) {
  throw "missing $deployScriptPath"
}
if (-not (Test-Path $productionEnvPath)) {
  throw "missing $productionEnvPath"
}
if (-not (Test-Path $deployAuditWriterPath)) {
  throw "missing $deployAuditWriterPath"
}
if (-not (Test-Path $productionRuntimeVerifierPath)) {
  throw "missing $productionRuntimeVerifierPath"
}
if (-not (Test-Path $productionEnvVerifierPath)) {
  throw "missing $productionEnvVerifierPath"
}
if (-not (Test-Path $productionEnvReportPath)) {
  throw "missing $productionEnvReportPath"
}

$deployScript = Get-Content -Raw $deployScriptPath
$productionEnv = Get-Content -Raw $productionEnvPath
$deployAuditWriter = Get-Content -Raw $deployAuditWriterPath
$productionRuntimeVerifier = Get-Content -Raw $productionRuntimeVerifierPath
$productionEnvVerifier = Get-Content -Raw $productionEnvVerifierPath
$productionEnvReport = Get-Content -Raw $productionEnvReportPath

foreach ($requiredPattern in @(
  "run_production_runtime_verification()",
  "write_deploy_audit()",
  "handle_deploy_exit()",
  'trap ''handle_deploy_exit $?'' EXIT',
  "wait_for_service_health prometheus",
  'DEPLOY_VERIFY_PRODUCTION_RUNTIME="$(env_file_value DEPLOY_VERIFY_PRODUCTION_RUNTIME "$DEPLOY_VERIFY_PRODUCTION_RUNTIME")"',
  'DEPLOY_AUDIT_FILE="$(env_file_value DEPLOY_AUDIT_FILE "$DEPLOY_AUDIT_FILE")"',
  'DEPLOY_LAUNCH_AUDIT_FILE="$(env_file_value DEPLOY_LAUNCH_AUDIT_FILE "$DEPLOY_LAUNCH_AUDIT_FILE")"',
  'DEPLOY_LAUNCH_AUDIT_FILE="${DEPLOY_AUDIT_FILE%.json}.launch.json"',
  "DEPLOY_GIT_BEFORE",
  "DEPLOY_GIT_AFTER",
  "DEPLOY_VERIFY_PRODUCTION_RUNTIME",
  "DEPLOY_AUDIT_FILE",
  "DEPLOY_LAUNCH_AUDIT_FILE",
  "command -v pwsh",
  "-File scripts/write-deploy-audit.ps1",
  "-File scripts/verify-production-launch.ps1",
  "-FromEnvFile .env",
  "-OutputFile `"`$DEPLOY_LAUNCH_AUDIT_FILE`"",
  "-File scripts/verify-production-env.ps1",
  "-File scripts/verify-production-container-hardening.ps1",
  "run_production_runtime_verification"
)) {
  Assert-Contains -Content $deployScript -Pattern $requiredPattern -Description "deploy runtime verification wiring" -Path $deployScriptPath
}

foreach ($forbiddenPattern in @(
  "verify-production-runtime.ps1",
  "DEPLOY_VERIFY_GATEWAY_URL",
  "DEPLOY_VERIFY_FRONTEND_URL",
  "DEPLOY_VERIFY_PROMETHEUS_URL",
  "DEPLOY_VERIFY_RUNTIME_ARGS",
  "DEPLOY_VERIFY_SHARE_HTML_PRIME_PATHS",
  "DEPLOY_VERIFY_SHARE_HTML_OUTER_ROUTE_PATHS"
)) {
  Assert-NotContains -Content $deployScript -Pattern $forbiddenPattern -Description "legacy hand-written runtime verification wiring" -Path $deployScriptPath
}

foreach ($requiredPattern in @(
  "VerifyInternalAdminMetricDefinitions",
  "InternalAdminMetricDefinitionQueries",
  "memesee_internal_admin_operation_total",
  "memesee_internal_admin_operation_duration_seconds_count",
  "VerifyInternalAdminMetrics",
  "InternalAdminMetricQueries",
  "InternalAdminMetricDefinitions",
  "InternalAdminMetrics"
)) {
  Assert-Contains -Content $productionRuntimeVerifier -Pattern $requiredPattern -Description "production runtime internal admin metric verification" -Path $productionRuntimeVerifierPath
}

foreach ($requiredPattern in @(
  "Action = `"RegularDeploy`"",
  "AuditSchemaVersion = 1",
  "Status = `$Status",
  "RuntimeVerification = [ordered]@",
  "LaunchAudit = `$launchAudit",
  "Safety = [ordered]@",
  "WritesProductionData = `$true",
  "StartsContainers = `$true",
  "ConvertTo-Json -Depth 20"
)) {
  Assert-Contains -Content $deployAuditWriter -Pattern $requiredPattern -Description "deploy audit writer contract" -Path $deployAuditWriterPath
}

$blueGreenScriptPath = Join-Path "scripts" "deploy-bluegreen.ps1"
$rollbackScriptPath = Join-Path "scripts" "rollback-bluegreen.ps1"
$productionLaunchVerifierPath = Join-Path "scripts" "verify-production-launch.ps1"
if (-not (Test-Path $blueGreenScriptPath)) {
  throw "missing $blueGreenScriptPath"
}
if (-not (Test-Path $rollbackScriptPath)) {
  throw "missing $rollbackScriptPath"
}
if (-not (Test-Path $productionLaunchVerifierPath)) {
  throw "missing $productionLaunchVerifierPath"
}

$blueGreenScript = Get-Content -Raw $blueGreenScriptPath
$rollbackScript = Get-Content -Raw $rollbackScriptPath
$productionLaunchVerifier = Get-Content -Raw $productionLaunchVerifierPath
foreach ($requiredPattern in @(
  "verify-production-env.ps1",
  "Invoke-ProductionEnvValidation -Path `$EnvFile",
  "WouldValidateProductionEnv",
  "ValidatedProductionEnv",
  "verify-production-launch.ps1",
  "-InternalOnly",
  "Invoke-LaunchVerification -Path `$targetEnvFile",
  "Launcher = `"verify-production-launch.ps1`"",
  "InternalOnly = `$true",
  "nginx-upstream-utils.ps1"
)) {
  Assert-Contains -Content $blueGreenScript -Pattern $requiredPattern -Description "blue/green deployment runtime wiring" -Path $blueGreenScriptPath
}

foreach ($requiredPattern in @(
  "verify-production-launch.ps1",
  "-InternalOnly",
  "Invoke-LaunchVerification -Path `$previous.candidateEnvFile",
  "Launcher = `"verify-production-launch.ps1`"",
  "InternalOnly = `$true",
  "nginx-upstream-utils.ps1"
)) {
  Assert-Contains -Content $rollbackScript -Pattern $requiredPattern -Description "rollback deployment runtime wiring" -Path $rollbackScriptPath
}

foreach ($requiredPattern in @(
  "IncludeInternalAdminMetricDefinitions",
  "IncludeInternalAdminMetrics",
  "DEPLOY_VERIFY_INTERNAL_ADMIN_METRIC_DEFINITIONS",
  "DEPLOY_VERIFY_INTERNAL_ADMIN_METRICS",
  "-VerifyInternalAdminMetricDefinitions",
  "-VerifyInternalAdminMetrics"
)) {
  Assert-Contains -Content $productionLaunchVerifier -Pattern $requiredPattern -Description "production launch internal admin metric wiring" -Path $productionLaunchVerifierPath
}

foreach ($requiredPattern in @(
  "DEPLOY_VERIFY_INTERNAL_ADMIN_METRIC_DEFINITIONS",
  "DEPLOY_VERIFY_INTERNAL_ADMIN_METRICS"
)) {
  Assert-Contains -Content $productionEnvVerifier -Pattern $requiredPattern -Description "production env internal admin metric validation" -Path $productionEnvVerifierPath
  Assert-Contains -Content $productionEnvReport -Pattern $requiredPattern -Description "production env internal admin metric report" -Path $productionEnvReportPath
}

foreach ($requiredPattern in @(
  "DEPLOY_VERIFY_PRODUCTION_RUNTIME=true",
  "DEPLOY_AUDIT_FILE=",
  "DEPLOY_LAUNCH_AUDIT_FILE=",
  "DEPLOY_VERIFY_API_LATENCY=true",
  "DEPLOY_VERIFY_API_LATENCY_ITERATIONS=50",
  "DEPLOY_VERIFY_API_MAX_P95_MS=500",
  "DEPLOY_VERIFY_API_MAX_ERROR_RATE_PERCENT=0",
  "DEPLOY_VERIFY_METRIC_SCRAPE_WAIT_SECONDS=20",
  "DEPLOY_VERIFY_CACHE_METRICS=false",
  "DEPLOY_VERIFY_CONTENT_COMMAND_METRIC_DEFINITIONS=true",
  "DEPLOY_VERIFY_CONTENT_COMMAND_METRICS=false",
  "DEPLOY_VERIFY_INTERNAL_ADMIN_METRIC_DEFINITIONS=true",
  "DEPLOY_VERIFY_INTERNAL_ADMIN_METRICS=false",
  "DEPLOY_VERIFY_OTEL_COLLECTOR_METRICS=true",
  "DEPLOY_VERIFY_SHARE_HTML_METRICS=false",
  "DEPLOY_VERIFY_SHARE_HTML_BASE_URL=http://127.0.0.1:8080",
  "DEPLOY_VERIFY_SHARE_HTML_PATH=/share/posts/1",
  "DEPLOY_VERIFY_SHARE_HTML_OUTER_ROUTE=false",
  "DEPLOY_VERIFY_SHARE_HTML_OUTER_BASE_URL=http://127.0.0.1",
  "DEPLOY_VERIFY_SHARE_HTML_OUTER_PATH=/posts/1",
  "DEPLOY_VERIFY_SHARE_HTML_HOST=",
  "DEPLOY_VERIFY_HTTPS_REDIRECT=false",
  "DEPLOY_VERIFY_HTTPS_REDIRECT_BASE_URL=http://127.0.0.1",
  "DEPLOY_VERIFY_HTTPS_REDIRECT_PATH=/posts/1",
  "DEPLOY_VERIFY_HTTPS_REDIRECT_HOST=memesee.world",
  "DEPLOY_VERIFY_HSTS=false",
  "DEPLOY_VERIFY_HSTS_BASE_URL=https://memesee.world",
  "DEPLOY_VERIFY_HSTS_PATH=/",
  "DEPLOY_VERIFY_HSTS_HOST=memesee.world",
  "DEPLOY_VERIFY_HSTS_SKIP_CERTIFICATE_CHECK=false",
  "DEPLOY_VERIFY_MIN_CACHE_HIT_RATE_PERCENT=60",
  "DEPLOY_VERIFY_MEDIA_URL="
)) {
  Assert-Contains -Content $productionEnv -Pattern $requiredPattern -Description "production deploy runtime verification default" -Path $productionEnvPath
}

Write-Output "deploy runtime configuration ok"
