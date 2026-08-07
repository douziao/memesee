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

$gatewayPom = "backend/gateway-service/pom.xml"
$gatewayApplication = "backend/gateway-service/src/main/resources/application.yml"
$contentApplication = "backend/content-service/src/main/resources/application.yml"
$userApplication = "backend/user-service/src/main/resources/application.yml"
$gatewayFallbackController = "backend/gateway-service/src/main/java/com/memesee/gateway/config/GatewayFallbackController.java"
$gatewayFallbackTest = "backend/gateway-service/src/test/java/com/memesee/gateway/config/GatewayFallbackControllerTest.java"
$gatewayRelayFilter = "backend/gateway-service/src/main/java/com/memesee/gateway/config/RequestIdRelayFilter.java"
$requestCorrelation = "backend/platform-common/src/main/java/com/memesee/platform/web/RequestCorrelation.java"
$contentRequestFilter = "backend/content-service/src/main/java/com/memesee/content/common/config/RequestIdFilter.java"
$userRequestFilter = "backend/user-service/src/main/java/com/memesee/user/config/RequestIdFilter.java"
$mediaWorker = "media-worker/src/worker.js"
$compose = "docker-compose.prod.yml"
$productionEnv = "deploy/.env.production.example"
$architectureDoc = "docs/architecture-phase-1.md"
$ciWorkflow = ".github/workflows/quality.yml"

Assert-FileContains -Path $gatewayPom -Pattern "spring-cloud-starter-circuitbreaker-reactor-resilience4j" -Description "reactive circuit breaker dependency"
Assert-FileContains -Path $gatewayApplication -Pattern "(?s)default-filters:.*name:\s+Retry.*name:\s+CircuitBreaker.*fallbackUri:\s+forward:/__gateway/fallback" -Description "gateway retry and circuit breaker default filters"
Assert-FileContains -Path $gatewayApplication -Pattern "(?s)resilience4j:.*memeseeDownstream.*timeout-duration" -Description "gateway resilience4j timeout configuration"
Assert-FileContains -Path $gatewayFallbackController -Pattern "gateway_downstream_unavailable" -Description "traceable gateway fallback response"
Assert-FileContains -Path $gatewayFallbackTest -Pattern "returnsTraceableServiceUnavailableFallback" -Description "gateway fallback unit test"

foreach ($path in @($gatewayRelayFilter, $contentRequestFilter, $userRequestFilter, $requestCorrelation)) {
  Assert-FileContains -Path $path -Pattern "X-Request-Id|REQUEST_ID_HEADER" -Description "request id correlation"
  Assert-FileContains -Path $path -Pattern "traceparent|TRACEPARENT_HEADER" -Description "traceparent correlation"
}

foreach ($path in @($gatewayApplication, $contentApplication, $userApplication)) {
  Assert-FileContains -Path $path -Pattern "requestId=%X\{requestId:-none\}" -Description "request id log pattern"
  Assert-FileContains -Path $path -Pattern "traceId=%X\{traceId:-none\}" -Description "trace id log pattern"
}

Assert-FileContains -Path $mediaWorker -Pattern "exitForRabbitMqTopologyLoss" -Description "media worker restart-on-topology-loss hook"
Assert-FileContains -Path $mediaWorker -Pattern "process\.exit\(1\)" -Description "media worker exits for Compose restart"
Assert-FileContains -Path $mediaWorker -Pattern "JSON\.stringify\(payload\)" -Description "media worker JSON structured logging"
Assert-FileContains -Path $mediaWorker -Pattern "deadLetterExchange" -Description "media worker DLQ topology"

foreach ($pattern in @(
  "GATEWAY_RETRY_RETRIES",
  "GATEWAY_RETRY_FIRST_BACKOFF",
  "GATEWAY_RETRY_MAX_BACKOFF",
  "GATEWAY_CIRCUIT_BREAKER_SLIDING_WINDOW_SIZE",
  "GATEWAY_CIRCUIT_BREAKER_TIMEOUT"
)) {
  Assert-FileContains -Path $compose -Pattern $pattern -Description "gateway architecture setting in production compose"
  Assert-FileContains -Path $productionEnv -Pattern $pattern -Description "gateway architecture setting in production env example"
}

foreach ($section in @(
  "Current Service Boundaries",
  "First-Stage Upgrade Decisions",
  "Cache Layering",
  "Database Hotspots And Index Governance",
  "Failure Isolation",
  "Observability And OpenTelemetry Path",
  "Deployment Evolution",
  "Rollback remains image and configuration based"
)) {
  Assert-FileContains -Path $architectureDoc -Pattern $section -Description "architecture documentation section $section"
}

Assert-FileContains -Path $ciWorkflow -Pattern "verify-architecture-phase1\.ps1" -Description "architecture verification CI step"

Write-Output "architecture phase 1 configuration ok"
