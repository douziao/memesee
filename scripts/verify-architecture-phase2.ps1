$ErrorActionPreference = "Stop"

function Assert-Contains {
  param(
    [string]$Content,
    [string]$Pattern,
    [string]$Description,
    [string]$Path
  )

  if ($Content -notmatch $Pattern) {
    throw "$Path is missing $Description"
  }
}

function Assert-FileContains {
  param(
    [string]$Path,
    [string]$Pattern,
    [string]$Description
  )

  if (-not (Test-Path $Path)) {
    throw "missing $Path"
  }
  Assert-Contains -Content (Get-Content -Raw $Path) -Pattern $Pattern -Description $Description -Path $Path
}

function Assert-JsonFileContains {
  param(
    [string]$Path,
    [string[]]$Patterns
  )

  if (-not (Test-Path $Path)) {
    throw "missing $Path"
  }
  $json = Get-Content -Raw $Path | ConvertFrom-Json
  $content = $json | ConvertTo-Json -Depth 50
  foreach ($pattern in $Patterns) {
    if ($content -notmatch $pattern) {
      throw "$Path is missing dashboard evidence matching $pattern"
    }
  }
}

$compose = "docker-compose.prod.yml"
$productionEnv = "deploy/.env.production.example"
$prometheusConfig = "deploy/prometheus/prometheus.yml"
$alertRules = "deploy/prometheus/alert-rules.yml"
$otelConfig = "deploy/otel-collector.yml"
$dashboard = "deploy/prometheus/dashboards/memesee-db-hotspots.json"
$dlqScript = "scripts/rabbitmq-dlq.ps1"
$blueGreenScript = "scripts/deploy-bluegreen.ps1"
$rollbackScript = "scripts/rollback-bluegreen.ps1"
$runtimeVerifier = "scripts/verify-production-runtime.ps1"
$doc = "docs/architecture-phase-2.md"
$ciWorkflow = ".github/workflows/quality.yml"

foreach ($service in @("gateway-service", "content-service", "user-service")) {
  $pom = "backend/$service/pom.xml"
  $application = "backend/$service/src/main/resources/application.yml"
  Assert-FileContains -Path $pom -Pattern "micrometer-tracing-bridge-otel" -Description "Micrometer OpenTelemetry bridge dependency"
  Assert-FileContains -Path $pom -Pattern "opentelemetry-exporter-otlp" -Description "OTLP exporter dependency"
  Assert-FileContains -Path $application -Pattern "MANAGEMENT_TRACING_ENABLED" -Description "tracing enablement configuration"
  Assert-FileContains -Path $application -Pattern "MANAGEMENT_TRACING_SAMPLING_PROBABILITY" -Description "tracing sampling configuration"
  Assert-FileContains -Path $application -Pattern "MANAGEMENT_OTLP_TRACING_ENDPOINT" -Description "OTLP tracing endpoint configuration"
}

Assert-FileContains -Path $compose -Pattern "otel-collector:" -Description "OTel Collector service"
Assert-FileContains -Path $compose -Pattern "COMPOSE_CONTAINER_PREFIX" -Description "container prefix for blue/green deployment"
Assert-FileContains -Path $compose -Pattern "MANAGEMENT_OTLP_TRACING_ENDPOINT" -Description "OTLP endpoint environment"
Assert-FileContains -Path $compose -Pattern "otel-collector:4318/v1/traces" -Description "collector OTLP HTTP endpoint"
Assert-FileContains -Path $otelConfig -Pattern "(?s)receivers:.*otlp:.*processors:.*batch:.*exporters:.*debug:" -Description "collector OTLP trace pipeline"
Assert-FileContains -Path $prometheusConfig -Pattern "memesee-otel-collector" -Description "collector Prometheus scrape job"
Assert-FileContains -Path $runtimeVerifier -Pattern "memesee-otel-collector" -Description "runtime verifier collector target"

foreach ($key in @(
  "COMPOSE_CONTAINER_PREFIX",
  "OTEL_COLLECTOR_IMAGE",
  "OTEL_COLLECTOR_OTLP_GRPC_HOST_PORT",
  "OTEL_COLLECTOR_OTLP_HTTP_HOST_PORT",
  "MANAGEMENT_TRACING_ENABLED",
  "MANAGEMENT_TRACING_SAMPLING_PROBABILITY",
  "MANAGEMENT_OTLP_TRACING_ENDPOINT",
  "DEPLOY_VERIFY_OTEL_COLLECTOR_METRICS"
)) {
  Assert-FileContains -Path $productionEnv -Pattern $key -Description "production env key $key"
}

Assert-FileContains -Path $alertRules -Pattern "MemeseeCacheHitRateLow" -Description "cache hit-rate alert"
Assert-FileContains -Path $alertRules -Pattern "memesee_cache_operations_total" -Description "cache metric alert expression"
Assert-JsonFileContains -Path $dashboard -Patterns @(
  "memesee_projection_query_duration_seconds_bucket",
  "memesee_projection_query_slow_total",
  "hikaricp_connections_active",
  "hikaricp_connections_pending"
)

Assert-FileContains -Path $dlqScript -Pattern 'ValidateSet\("Inspect", "Peek", "Requeue", "Purge"\)' -Description "DLQ action set"
Assert-FileContains -Path $dlqScript -Pattern "ConfirmDestructive" -Description "DLQ destructive action safety gate"
Assert-FileContains -Path $dlqScript -Pattern "/api/queues/.*/get" -Description "DLQ peek/requeue API usage"
Assert-FileContains -Path $dlqScript -Pattern "/api/exchanges/.*/publish" -Description "DLQ replay publish API usage"

Assert-FileContains -Path $blueGreenScript -Pattern "deploy/bluegreen-state\.json" -Description "blue/green state file"
Assert-FileContains -Path $blueGreenScript -Pattern "COMPOSE_CONTAINER_PREFIX" -Description "blue/green container prefix override"
Assert-FileContains -Path $blueGreenScript -Pattern "verify-production-launch\.ps1" -Description "blue/green launch verification"
Assert-FileContains -Path $blueGreenScript -Pattern "InternalOnly" -Description "blue/green internal candidate verification mode"
Assert-FileContains -Path $rollbackScript -Pattern "verify-production-launch\.ps1" -Description "rollback launch verification"
Assert-FileContains -Path $rollbackScript -Pattern "InternalOnly" -Description "rollback internal verification mode"
Assert-FileContains -Path $rollbackScript -Pattern "StopRolledBackProject" -Description "rollback cleanup option"

foreach ($section in @(
  "OpenTelemetry Tracing",
  "Blue/Green Deployment",
  "Rollback",
  "Cache Hit-Rate Alerting",
  "Database Hotspot Dashboard",
  "RabbitMQ DLQ Operations",
  "Verification Contract"
)) {
  Assert-FileContains -Path $doc -Pattern $section -Description "phase 2 documentation section $section"
}

Assert-FileContains -Path $ciWorkflow -Pattern "verify-architecture-phase2\.ps1" -Description "architecture phase 2 CI step"

Write-Output "architecture phase 2 configuration ok"
