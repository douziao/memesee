$ErrorActionPreference = "Stop"

$servletServices = @("user-service", "content-service")
$allServices = @("user-service", "content-service", "gateway-service")

foreach ($service in $allServices) {
  $applicationPath = Join-Path "backend" "$service/src/main/resources/application.yml"
  $application = Get-Content -Raw $applicationPath

  if ($application -notmatch "shutdown:\s+graceful") {
    throw "$service must enable graceful shutdown"
  }

  if ($application -notmatch "timeout-per-shutdown-phase") {
    throw "$service must configure shutdown phase timeout"
  }

  if ($application -notmatch "compression:\s*\r?\n\s+enabled:\s+true") {
    throw "$service must enable response compression"
  }

  if ($application -notmatch "forward-headers-strategy:\s+framework") {
    throw "$service must trust framework-parsed forwarded headers"
  }
}

foreach ($service in $servletServices) {
  $applicationPath = Join-Path "backend" "$service/src/main/resources/application.yml"
  $application = Get-Content -Raw $applicationPath
  $prodApplicationPath = Join-Path "backend" "$service/src/main/resources/application-prod.yml"
  $prodApplication = Get-Content -Raw $prodApplicationPath

  foreach ($required in @(
    "maximum-pool-size",
    "minimum-idle",
    "connection-timeout",
    "validation-timeout",
    "idle-timeout",
    "max-lifetime"
  )) {
    if ($application -notmatch $required) {
      throw "$service datasource.hikari is missing $required"
    }
  }

  if ($prodApplication -notmatch "\$\{APP_SECURITY_INTERNAL_SERVICE_TOKEN\}") {
    throw "$service production profile must require APP_SECURITY_INTERNAL_SERVICE_TOKEN without a fallback"
  }

  foreach ($forbiddenFallback in @(
    "USER_INTERNAL_SERVICE_TOKEN",
    "change_me_internal_service_token"
  )) {
    if ($prodApplication -match [regex]::Escape($forbiddenFallback)) {
      throw "$service production profile must not allow internal service token fallback $forbiddenFallback"
    }
  }
}

$gatewayApplication = Get-Content -Raw "backend/gateway-service/src/main/resources/application.yml"
if ($gatewayApplication -notmatch "connect-timeout") {
  throw "gateway-service must configure backend connect timeout"
}

if ($gatewayApplication -notmatch "response-timeout") {
  throw "gateway-service must configure backend response timeout"
}

$prodCompose = Get-Content -Raw "docker-compose.prod.yml"
foreach ($requiredEnvironment in @(
  "USER_DB_POOL_MAX_SIZE",
  "USER_DB_POOL_MIN_IDLE",
  "USER_DB_POOL_CONNECTION_TIMEOUT_MS",
  "CONTENT_DB_POOL_MAX_SIZE",
  "CONTENT_DB_POOL_MIN_IDLE",
  "CONTENT_DB_POOL_CONNECTION_TIMEOUT_MS",
  "CONTENT_PROJECTION_QUERY_SLOW_THRESHOLD",
  "GATEWAY_HTTPCLIENT_CONNECT_TIMEOUT_MS",
  "GATEWAY_HTTPCLIENT_RESPONSE_TIMEOUT",
  "USER_SHUTDOWN_TIMEOUT",
  "CONTENT_SHUTDOWN_TIMEOUT",
  "GATEWAY_SHUTDOWN_TIMEOUT"
)) {
  if ($prodCompose -notmatch $requiredEnvironment) {
    throw "docker-compose.prod.yml is missing environment $requiredEnvironment"
  }
}

$internalTokenRequirement = '${APP_SECURITY_INTERNAL_SERVICE_TOKEN:?set APP_SECURITY_INTERNAL_SERVICE_TOKEN in .env}'
$internalTokenOccurrences = ([regex]::Matches($prodCompose, [regex]::Escape($internalTokenRequirement))).Count
if ($internalTokenOccurrences -lt 2) {
  throw "docker-compose.prod.yml must require APP_SECURITY_INTERNAL_SERVICE_TOKEN for both servlet services"
}

$adminRequestLimits = "backend/content-service/src/main/java/com/memesee/content/common/admin/InternalAdminRequestLimits.java"
if (-not (Test-Path $adminRequestLimits)) {
  throw "content-service must define internal admin request limits"
}
$adminRequestLimitsContent = Get-Content -Raw $adminRequestLimits
foreach ($requiredPattern in @(
  "DEFAULT_REBUILD_BATCH_SIZE = 200",
  "MAX_REBUILD_BATCH_SIZE = 1000",
  "DEFAULT_MEDIA_RETRY_LIMIT = 20",
  "MAX_MEDIA_RETRY_LIMIT = 100",
  "requirePositiveIntAtMost",
  "HttpStatus.BAD_REQUEST",
  "ApiErrorCode.INVALID_REQUEST"
)) {
  if ($adminRequestLimitsContent -notmatch [regex]::Escape($requiredPattern)) {
    throw "InternalAdminRequestLimits is missing $requiredPattern"
  }
}

$adminAuditRecorder = "backend/content-service/src/main/java/com/memesee/content/common/admin/InternalAdminAuditRecorder.java"
if (-not (Test-Path $adminAuditRecorder)) {
  throw "content-service must define internal admin audit recorder"
}
$adminAuditRecorderContent = Get-Content -Raw $adminAuditRecorder
foreach ($requiredPattern in @(
  "INTERNAL_OPERATOR_HEADER",
  "REQUEST_ID_HEADER",
  "USER_AGENT_HEADER",
  "memesee.internal.admin.operation",
  "memesee.internal.admin.operation.duration",
  "STARTUP_EVENT",
  "registerStartupMeters",
  "internal_admin_operation",
  "Counter.builder",
  "Timer.builder"
)) {
  if ($adminAuditRecorderContent -notmatch [regex]::Escape($requiredPattern)) {
    throw "InternalAdminAuditRecorder is missing $requiredPattern"
  }
}

foreach ($controllerPath in @(
  "backend/content-service/src/main/java/com/memesee/content/feed/api/FeedProjectionAdminController.java",
  "backend/content-service/src/main/java/com/memesee/content/search/api/SearchIndexAdminController.java",
  "backend/content-service/src/main/java/com/memesee/content/media/api/MediaProcessingAdminController.java"
)) {
  $controller = Get-Content -Raw $controllerPath
  if ($controller -notmatch "InternalAdminRequestLimits") {
    throw "$controllerPath must use InternalAdminRequestLimits"
  }
  if ($controller -notmatch "requirePositiveIntAtMost") {
    throw "$controllerPath must fail fast on unsafe internal admin numeric parameters"
  }
  foreach ($requiredPattern in @(
    "InternalAdminAuditRecorder",
    "INTERNAL_OPERATOR_HEADER",
    "REQUEST_ID_HEADER",
    "USER_AGENT_HEADER",
    "recordAudit",
    "success",
    "failed"
  )) {
    if ($controller -notmatch $requiredPattern) {
      throw "$controllerPath must record internal admin audit events including $requiredPattern"
    }
  }
}

if ($prodCompose -notmatch "(?s)media-worker:.*healthcheck:") {
  throw "media-worker must have a production healthcheck"
}

foreach ($requiredEnvironment in @(
  "MEDIA_WORKER_HEALTH_PORT",
  "MEDIA_WORKER_DB_POOL"
)) {
  if ($prodCompose -notmatch $requiredEnvironment) {
    throw "docker-compose.prod.yml is missing media worker environment $requiredEnvironment"
  }
}

$mediaWorker = Get-Content -Raw "media-worker/src/worker.js"
foreach ($requiredPattern in @(
  "SIGTERM",
  "db.end",
  "amqpChannel.cancel"
)) {
  if ($mediaWorker -notmatch [regex]::Escape($requiredPattern)) {
    throw "media-worker runtime is missing $requiredPattern"
  }
}

$mediaWorkerHealth = Get-Content -Raw "media-worker/src/media-health.js"
foreach ($requiredPattern in @(
  "createServer",
  "/healthz",
  "/metrics",
  "Cache-Control",
  "no-store",
  "getMediaWorkerHealthStatus"
)) {
  if ($mediaWorkerHealth -notmatch [regex]::Escape($requiredPattern)) {
    throw "media-worker health runtime is missing $requiredPattern"
  }
}

$mediaWorkerPackage = Get-Content -Raw "media-worker/package.json"
foreach ($requiredCheck in @(
  "node --check src/worker.js",
  "node --check src/media-health.js",
  "node --check src/media-utils.js"
)) {
  if ($mediaWorkerPackage -notmatch [regex]::Escape($requiredCheck)) {
    throw "media-worker package.json check script must include $requiredCheck"
  }
}

$mediaWorkerDockerfile = Get-Content -Raw "media-worker/Dockerfile"
if ($mediaWorkerDockerfile -notmatch "npm ci --omit=dev") {
  throw "media-worker Dockerfile must use npm ci --omit=dev"
}

if ($mediaWorkerDockerfile -notmatch "EXPOSE 8088") {
  throw "media-worker Dockerfile must expose the health port"
}

Write-Output "backend runtime configuration ok"
