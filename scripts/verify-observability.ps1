$ErrorActionPreference = "Stop"

$services = @("user-service", "content-service", "gateway-service")

foreach ($service in $services) {
  $pomPath = Join-Path "backend" "$service/pom.xml"
  $applicationPath = Join-Path "backend" "$service/src/main/resources/application.yml"
  $pom = Get-Content -Raw $pomPath
  $application = Get-Content -Raw $applicationPath

  if ($pom -notmatch "spring-boot-starter-actuator") {
    throw "$service is missing spring-boot-starter-actuator"
  }

  if ($pom -notmatch "micrometer-registry-prometheus") {
    throw "$service is missing micrometer-registry-prometheus"
  }

  if ($application -notmatch "prometheus") {
    throw "$service does not expose prometheus in management endpoints"
  }

  if ($application -notmatch "metrics") {
    throw "$service does not expose metrics in management endpoints"
  }

  if ($application -notmatch [regex]::Escape("http.server.requests: true")) {
    throw "$service must enable http.server.requests histogram buckets"
  }
}

$customRegistryConfigs = Get-ChildItem -Path "backend" -Recurse -Filter "MeterRegistryConfiguration.java"
if ($customRegistryConfigs.Count -gt 0) {
  $paths = $customRegistryConfigs | ForEach-Object { $_.FullName }
  throw "Custom MeterRegistryConfiguration files should not override Spring Boot metrics auto-configuration: $($paths -join ', ')"
}

$prodCompose = Get-Content -Raw "docker-compose.prod.yml"
$prometheusConfigPath = Join-Path "deploy" "prometheus/prometheus.yml"

if ($prodCompose -notmatch "(?m)^  prometheus:") {
  throw "docker-compose.prod.yml is missing the prometheus service"
}

if ($prodCompose -notmatch [regex]::Escape('127.0.0.1:${PROMETHEUS_HOST_PORT:-9090}:9090')) {
  throw "prometheus must bind to localhost by default"
}

if ($prodCompose -notmatch [regex]::Escape("./deploy/prometheus/prometheus.yml:/etc/prometheus/prometheus.yml:ro")) {
  throw "prometheus service must mount deploy/prometheus/prometheus.yml read-only"
}

if ($prodCompose -notmatch [regex]::Escape("./deploy/prometheus/alert-rules.yml:/etc/prometheus/alert-rules.yml:ro")) {
  throw "prometheus service must mount deploy/prometheus/alert-rules.yml read-only"
}

if ($prodCompose -notmatch "(?s)prometheus:.*healthcheck:") {
  throw "prometheus service must have a production healthcheck"
}

if ($prodCompose -notmatch [regex]::Escape("http://127.0.0.1:9090/-/ready")) {
  throw "prometheus healthcheck must verify the ready endpoint"
}

if ($prodCompose -notmatch "(?s)prometheus:.*depends_on:.*media-worker:\s*\r?\n\s*condition:\s*service_healthy") {
  throw "prometheus service must wait for media-worker to be healthy before scraping"
}

if (-not (Test-Path $prometheusConfigPath)) {
  throw "missing $prometheusConfigPath"
}

$prometheusConfig = Get-Content -Raw $prometheusConfigPath
if ($prometheusConfig -notmatch [regex]::Escape("/etc/prometheus/alert-rules.yml")) {
  throw "prometheus.yml must load alert-rules.yml"
}

$prometheusRulesPath = Join-Path "deploy" "prometheus/alert-rules.yml"
if (-not (Test-Path $prometheusRulesPath)) {
  throw "missing $prometheusRulesPath"
}

$prometheusRules = Get-Content -Raw $prometheusRulesPath
foreach ($alertName in @(
  "MemeseeTargetDown",
  "MemeseeApiP95High",
  "MemeseeApi5xxRateHigh",
  "MemeseeCacheHitRateLow",
  "MemeseeProjectionQuerySlow",
  "MemeseeContentCommandErrorRateHigh",
  "MemeseeContentCommandP95High",
  "MemeseeMediaWorkerNotReady",
  "MemeseeMediaWorkerFailures",
  "MemeseeShareHtmlRenderErrors",
  "MemeseeShareHtmlDefaultImageFallbackHigh",
  "MemeseeShareHtmlSubPostFallbackHigh"
)) {
  if ($prometheusRules -notmatch $alertName) {
    throw "alert-rules.yml is missing $alertName"
  }
}

if ($prometheusRules -notmatch "memesee_cache_operations_total") {
  throw "alert-rules.yml must include cache operation metrics"
}

if ($prometheusRules -notmatch "memesee_projection_query_slow_total") {
  throw "alert-rules.yml must include projection query slow metrics"
}

if ($prometheusRules -notmatch "memesee_content_command_total") {
  throw "alert-rules.yml must include content command counter metrics"
}

if ($prometheusRules -notmatch "memesee_content_command_duration_seconds_bucket") {
  throw "alert-rules.yml must include content command duration metrics"
}

if ($prometheusRules -notmatch "memesee_media_worker_failed_total") {
  throw "alert-rules.yml must include media worker failure metrics"
}

if ($prometheusRules -notmatch "memesee_share_html_render_total") {
  throw "alert-rules.yml must include share HTML render metrics"
}

$cacheMetricsRecorderPath = Join-Path "backend" "platform-common/src/main/java/com/memesee/platform/cache/CacheMetricsRecorder.java"
if (-not (Test-Path $cacheMetricsRecorderPath)) {
  throw "missing $cacheMetricsRecorderPath"
}

$cacheMetricsRecorder = Get-Content -Raw $cacheMetricsRecorderPath
if ($cacheMetricsRecorder -notmatch [regex]::Escape('"memesee.cache.operations"')) {
  throw "CacheMetricsRecorder must publish memesee.cache.operations"
}

foreach ($operation in @('"hit"', '"miss"')) {
  if ($cacheMetricsRecorder -notmatch [regex]::Escape($operation)) {
    throw "CacheMetricsRecorder must record cache operation $operation"
  }
}

$projectionMetricsRecorderPath = Join-Path "backend" "content-service/src/main/java/com/memesee/content/common/observability/ProjectionQueryMetricsRecorder.java"
if (-not (Test-Path $projectionMetricsRecorderPath)) {
  throw "missing $projectionMetricsRecorderPath"
}

$projectionMetricsRecorder = Get-Content -Raw $projectionMetricsRecorderPath
foreach ($metricName in @('"memesee.projection.query.duration"', '"memesee.projection.query.slow"')) {
  if ($projectionMetricsRecorder -notmatch [regex]::Escape($metricName)) {
    throw "ProjectionQueryMetricsRecorder must publish $metricName"
  }
}

$projectionMetricsConfigurationPath = Join-Path "backend" "content-service/src/main/java/com/memesee/content/common/observability/ProjectionQueryMetricsConfiguration.java"
if (-not (Test-Path $projectionMetricsConfigurationPath)) {
  throw "missing $projectionMetricsConfigurationPath"
}

$projectionMetricsConfiguration = Get-Content -Raw $projectionMetricsConfigurationPath
foreach ($requiredPattern in @(
  "ProjectionQueryMetricsRecorder projectionQueryMetricsRecorder",
  "new ProjectionQueryMetricsRecorder",
  "app.observability.projection-query"
)) {
  if ($projectionMetricsConfiguration -notmatch [regex]::Escape($requiredPattern)) {
    throw "ProjectionQueryMetricsConfiguration must wire projection query metrics recorder: $requiredPattern"
  }
}

$contentApplicationPath = Join-Path "backend" "content-service/src/main/resources/application.yml"
$contentApplication = Get-Content -Raw $contentApplicationPath
if ($contentApplication -notmatch [regex]::Escape('slow-threshold: ${CONTENT_PROJECTION_QUERY_SLOW_THRESHOLD:250ms}')) {
  throw "content-service must expose CONTENT_PROJECTION_QUERY_SLOW_THRESHOLD for projection query metrics"
}

$contentCommandTelemetryPath = Join-Path "backend" "content-service/src/main/java/com/memesee/content/common/observability/ContentCommandTelemetry.java"
if (-not (Test-Path $contentCommandTelemetryPath)) {
  throw "missing $contentCommandTelemetryPath"
}

$contentCommandTelemetry = Get-Content -Raw $contentCommandTelemetryPath
foreach ($requiredPattern in @(
  '"memesee.content.command"',
  '"memesee.content.command.duration"',
  '"aggregate"',
  '"operation"',
  '"outcome"',
  '"postMode"',
  'event=\"content_command\"'
)) {
  if ($contentCommandTelemetry -notmatch [regex]::Escape($requiredPattern)) {
    throw "ContentCommandTelemetry must publish content command metrics/log fields: $requiredPattern"
  }
}

$contentCommandDashboardPath = Join-Path "deploy" "prometheus/dashboards/memesee-content-commands.json"
if (-not (Test-Path $contentCommandDashboardPath)) {
  throw "missing $contentCommandDashboardPath"
}

$contentCommandDashboard = Get-Content -Raw $contentCommandDashboardPath
foreach ($requiredPattern in @(
  "memesee_content_command_total",
  "memesee_content_command_duration_seconds_bucket",
  "Content Command Error Ratio",
  "Top Content Command Outcomes"
)) {
  if ($contentCommandDashboard -notmatch [regex]::Escape($requiredPattern)) {
    throw "content command dashboard must include $requiredPattern"
  }
}

$shareHtmlTelemetryPath = Join-Path "backend" "content-service/src/main/java/com/memesee/content/mainpost/share/MainPostShareHtmlTelemetry.java"
if (-not (Test-Path $shareHtmlTelemetryPath)) {
  throw "missing $shareHtmlTelemetryPath"
}

$shareHtmlTelemetry = Get-Content -Raw $shareHtmlTelemetryPath
foreach ($requiredPattern in @(
  '"memesee.share.html.render"',
  '"memesee.share.html.render.duration"',
  '"target"',
  '"outcome"',
  '"image"',
  'event=\"share_html_render\"'
)) {
  if ($shareHtmlTelemetry -notmatch [regex]::Escape($requiredPattern)) {
    throw "MainPostShareHtmlTelemetry must publish share HTML metrics/log fields: $requiredPattern"
  }
}

$shareHtmlDashboardPath = Join-Path "deploy" "prometheus/dashboards/memesee-share-html.json"
if (-not (Test-Path $shareHtmlDashboardPath)) {
  throw "missing $shareHtmlDashboardPath"
}

$shareHtmlDashboard = Get-Content -Raw $shareHtmlDashboardPath
foreach ($requiredPattern in @(
  "memesee_share_html_render_total",
  "memesee_share_html_render_duration_seconds_bucket",
  "Default Image Fallback Ratio",
  "Sub-post Fallback Ratio"
)) {
  if ($shareHtmlDashboard -notmatch [regex]::Escape($requiredPattern)) {
    throw "share HTML dashboard must include $requiredPattern"
  }
}

$scrapeTargets = @(
  "gateway-service:8080",
  "user-service:8081",
  "content-service:8083",
  "media-worker:8088"
)

foreach ($target in $scrapeTargets) {
  if ($prometheusConfig -notmatch [regex]::Escape($target)) {
    throw "prometheus.yml is missing scrape target $target"
  }
}

if ($prometheusConfig -notmatch [regex]::Escape("/actuator/prometheus")) {
  throw "prometheus.yml must scrape /actuator/prometheus"
}

if ($prometheusConfig -notmatch [regex]::Escape("/metrics")) {
  throw "prometheus.yml must scrape media-worker /metrics"
}

$mediaWorkerHealthPath = Join-Path "media-worker" "src/media-health.js"
if (-not (Test-Path $mediaWorkerHealthPath)) {
  throw "missing $mediaWorkerHealthPath"
}

$mediaWorkerHealth = Get-Content -Raw $mediaWorkerHealthPath
foreach ($requiredPattern in @(
  'request.url === "/metrics"',
  "formatPrometheusMetrics"
)) {
  if ($mediaWorkerHealth -notmatch [regex]::Escape($requiredPattern)) {
    throw "media-worker must expose prometheus metrics: $requiredPattern"
  }
}

$mediaWorkerUtilsPath = Join-Path "media-worker" "src/media-utils.js"
if (-not (Test-Path $mediaWorkerUtilsPath)) {
  throw "missing $mediaWorkerUtilsPath"
}

$mediaWorkerUtils = Get-Content -Raw $mediaWorkerUtilsPath
foreach ($metricName in @(
  "memesee_media_worker_ready",
  "memesee_media_worker_processed_total",
  "memesee_media_worker_failed_total"
)) {
  if ($mediaWorkerUtils -notmatch $metricName) {
    throw "media-worker metrics must publish $metricName"
  }
}

Write-Output "observability configuration ok"
