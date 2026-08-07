param(
  [string]$EnvFile = "deploy/.env.production.example",
  [switch]$AllowPlaceholders
)

$ErrorActionPreference = "Stop"

function Read-EnvFile {
  param([string]$Path)

  if (-not (Test-Path $Path)) {
    throw "missing env file: $Path"
  }

  $values = @{}
  Get-Content $Path | ForEach-Object {
    $line = $_.Trim()
    if (-not $line -or $line.StartsWith("#") -or $line -notmatch "=") {
      return
    }
    $name, $value = $line -split "=", 2
    $values[$name.Trim()] = $value.Trim().Trim('"').Trim("'")
  }
  return $values
}

function Require-Key {
  param(
    [hashtable]$Values,
    [string]$Name
  )

  if (-not $Values.ContainsKey($Name)) {
    throw "$EnvFile is missing required key $Name"
  }
  return [string]$Values[$Name]
}

function Assert-Boolean {
  param(
    [hashtable]$Values,
    [string]$Name
  )

  $value = Require-Key -Values $Values -Name $Name
  if ($value -notin @("true", "false")) {
    throw "$Name must be true or false, got '$value'"
  }
}

function Assert-IntegerRange {
  param(
    [hashtable]$Values,
    [string]$Name,
    [int]$Min,
    [int]$Max
  )

  $raw = Require-Key -Values $Values -Name $Name
  $value = 0
  if (-not [int]::TryParse($raw, [ref]$value) -or $value -lt $Min -or $value -gt $Max) {
    throw "$Name must be an integer from $Min to $Max, got '$raw'"
  }
}

function Assert-NumberRange {
  param(
    [hashtable]$Values,
    [string]$Name,
    [double]$Min,
    [double]$Max
  )

  $raw = Require-Key -Values $Values -Name $Name
  $value = 0.0
  if (-not [double]::TryParse($raw, [Globalization.NumberStyles]::Float, [Globalization.CultureInfo]::InvariantCulture, [ref]$value) -or $value -lt $Min -or $value -gt $Max) {
    throw "$Name must be a number from $Min to $Max, got '$raw'"
  }
}

function Assert-HttpUrl {
  param(
    [hashtable]$Values,
    [string]$Name,
    [switch]$AllowEmpty
  )

  $raw = Require-Key -Values $Values -Name $Name
  if ($AllowEmpty -and -not $raw) {
    return
  }

  $uri = $null
  if (-not [Uri]::TryCreate($raw, [UriKind]::Absolute, [ref]$uri) -or $uri.Scheme -notin @("http", "https")) {
    throw "$Name must be an absolute http/https URL, got '$raw'"
  }
}

function Assert-HostName {
  param(
    [hashtable]$Values,
    [string]$Name
  )

  $raw = Require-Key -Values $Values -Name $Name
  if ($raw -notmatch "^[a-zA-Z0-9][a-zA-Z0-9.-]{0,252}[a-zA-Z0-9]$") {
    throw "$Name must be a valid host name, got '$raw'"
  }
}

function Assert-DurationLiteral {
  param(
    [hashtable]$Values,
    [string]$Name
  )

  $raw = Require-Key -Values $Values -Name $Name
  if ($raw -notmatch "^[1-9][0-9]*(ms|s|m)$") {
    throw "$Name must be a positive duration ending with ms, s, or m, got '$raw'"
  }
}

function Split-DelimitedValue {
  param([string]$Value)

  return @($Value -split "," |
    ForEach-Object { $_.Trim() } |
    Where-Object { $_ })
}

function Assert-PathList {
  param(
    [hashtable]$Values,
    [string]$Name
  )

  $raw = Require-Key -Values $Values -Name $Name
  $items = @(Split-DelimitedValue -Value $raw)
  if ($items.Count -eq 0) {
    throw "$Name must include at least one path"
  }

  foreach ($item in $items) {
    if (-not $item.StartsWith("/")) {
      throw "$Name entries must start with '/', got '$item' from '$raw'"
    }
  }
}

function Test-PlaceholderValue {
  param([string]$Value)

  return $Value -match "replace-with-|same-value-as|^change[_-]?me"
}

$values = Read-EnvFile -Path $EnvFile

$requiredKeys = @(
  "MYSQL_ROOT_PASSWORD",
  "MYSQL_APP_PASSWORD",
  "REDIS_PASSWORD",
  "RABBITMQ_DEFAULT_PASS",
  "MINIO_ROOT_USER",
  "MINIO_ROOT_PASSWORD",
  "MEILI_MASTER_KEY",
  "APP_SECURITY_JWT_SECRET",
  "APP_SECURITY_INTERNAL_SERVICE_TOKEN",
  "FRONTEND_ORIGIN",
  "CONTENT_MEDIA_PUBLIC_BASE_URL",
  "DEPLOY_VERIFY_PRODUCTION_RUNTIME",
  "DEPLOY_AUDIT_FILE",
  "DEPLOY_LAUNCH_AUDIT_FILE",
  "DEPLOY_VERIFY_API_LATENCY",
  "DEPLOY_VERIFY_API_MAX_P95_MS",
  "DEPLOY_VERIFY_CACHE_METRICS",
  "DEPLOY_VERIFY_CONTENT_COMMAND_METRIC_DEFINITIONS",
  "DEPLOY_VERIFY_CONTENT_COMMAND_METRICS",
  "DEPLOY_VERIFY_INTERNAL_ADMIN_METRIC_DEFINITIONS",
  "DEPLOY_VERIFY_INTERNAL_ADMIN_METRICS",
  "DEPLOY_VERIFY_OTEL_COLLECTOR_METRICS",
  "DEPLOY_VERIFY_SHARE_HTML_METRICS",
  "DEPLOY_VERIFY_SHARE_HTML_BASE_URL",
  "DEPLOY_VERIFY_SHARE_HTML_PATH",
  "DEPLOY_VERIFY_SHARE_HTML_OUTER_ROUTE",
  "DEPLOY_VERIFY_SHARE_HTML_OUTER_BASE_URL",
  "DEPLOY_VERIFY_SHARE_HTML_OUTER_PATH",
  "DEPLOY_VERIFY_SHARE_HTML_HOST",
  "DEPLOY_VERIFY_HTTPS_REDIRECT",
  "DEPLOY_VERIFY_HTTPS_REDIRECT_BASE_URL",
  "DEPLOY_VERIFY_HTTPS_REDIRECT_PATH",
  "DEPLOY_VERIFY_HTTPS_REDIRECT_HOST",
  "DEPLOY_VERIFY_HSTS",
  "DEPLOY_VERIFY_HSTS_BASE_URL",
  "DEPLOY_VERIFY_HSTS_PATH",
  "DEPLOY_VERIFY_HSTS_HOST",
  "DEPLOY_VERIFY_HSTS_SKIP_CERTIFICATE_CHECK",
  "DEPLOY_VERIFY_MEDIA_URL",
  "COMPOSE_CONTAINER_PREFIX",
  "OTEL_COLLECTOR_IMAGE",
  "OTEL_COLLECTOR_OTLP_GRPC_HOST_PORT",
  "OTEL_COLLECTOR_OTLP_HTTP_HOST_PORT",
  "MANAGEMENT_TRACING_ENABLED",
  "MANAGEMENT_TRACING_SAMPLING_PROBABILITY",
  "MANAGEMENT_OTLP_TRACING_ENDPOINT",
  "GATEWAY_RETRY_RETRIES",
  "GATEWAY_RETRY_FIRST_BACKOFF",
  "GATEWAY_RETRY_MAX_BACKOFF",
  "GATEWAY_RETRY_BACKOFF_FACTOR",
  "GATEWAY_CIRCUIT_BREAKER_SLIDING_WINDOW_SIZE",
  "GATEWAY_CIRCUIT_BREAKER_MINIMUM_CALLS",
  "GATEWAY_CIRCUIT_BREAKER_FAILURE_RATE_THRESHOLD",
  "GATEWAY_CIRCUIT_BREAKER_OPEN_STATE_WAIT",
  "GATEWAY_CIRCUIT_BREAKER_HALF_OPEN_CALLS",
  "GATEWAY_CIRCUIT_BREAKER_TIMEOUT"
)

foreach ($key in $requiredKeys) {
  [void](Require-Key -Values $values -Name $key)
}

if (-not $AllowPlaceholders) {
  foreach ($entry in $values.GetEnumerator()) {
    if (Test-PlaceholderValue -Value ([string]$entry.Value)) {
      throw "$EnvFile still contains placeholder value for $($entry.Key)"
    }
  }

  foreach ($secretKey in @(
    "MYSQL_ROOT_PASSWORD",
    "MYSQL_APP_PASSWORD",
    "REDIS_PASSWORD",
    "RABBITMQ_DEFAULT_PASS",
    "MINIO_ROOT_PASSWORD",
    "MEILI_MASTER_KEY",
    "APP_SECURITY_JWT_SECRET",
    "APP_SECURITY_INTERNAL_SERVICE_TOKEN"
  )) {
    $value = Require-Key -Values $values -Name $secretKey
    if ($value.Length -lt 24) {
      throw "$secretKey must be at least 24 characters"
    }
  }
}

foreach ($name in @(
  "MYSQL_HOST_PORT",
  "REDIS_HOST_PORT",
  "RABBITMQ_HOST_PORT",
  "RABBITMQ_MANAGEMENT_HOST_PORT",
  "MINIO_API_HOST_PORT",
  "MINIO_CONSOLE_HOST_PORT",
  "MEILI_HOST_PORT",
  "FRONTEND_HOST_PORT",
  "GATEWAY_HOST_PORT",
  "PROMETHEUS_HOST_PORT",
  "MEDIA_WORKER_HEALTH_PORT",
  "OTEL_COLLECTOR_OTLP_GRPC_HOST_PORT",
  "OTEL_COLLECTOR_OTLP_HTTP_HOST_PORT"
)) {
  Assert-IntegerRange -Values $values -Name $name -Min 1 -Max 65535
}

foreach ($name in @(
  "CONTENT_MEDIA_PROCESSING_ASYNC_ENABLED",
  "CONTENT_MEDIA_DIRECT_DELIVERY_ENABLED",
  "CONTENT_OUTBOX_PROCESSOR_DISTRIBUTED_LOCK_ENABLED",
  "DEPLOY_VERIFY_PRODUCTION_RUNTIME",
  "DEPLOY_VERIFY_API_LATENCY",
  "DEPLOY_VERIFY_CACHE_METRICS",
  "DEPLOY_VERIFY_CONTENT_COMMAND_METRIC_DEFINITIONS",
  "DEPLOY_VERIFY_CONTENT_COMMAND_METRICS",
  "DEPLOY_VERIFY_INTERNAL_ADMIN_METRIC_DEFINITIONS",
  "DEPLOY_VERIFY_INTERNAL_ADMIN_METRICS",
  "DEPLOY_VERIFY_OTEL_COLLECTOR_METRICS",
  "DEPLOY_VERIFY_SHARE_HTML_METRICS",
  "DEPLOY_VERIFY_SHARE_HTML_OUTER_ROUTE",
  "DEPLOY_VERIFY_HTTPS_REDIRECT",
  "DEPLOY_VERIFY_HSTS",
  "DEPLOY_VERIFY_HSTS_SKIP_CERTIFICATE_CHECK",
  "MANAGEMENT_TRACING_ENABLED"
)) {
  Assert-Boolean -Values $values -Name $name
}

foreach ($name in @(
  "USER_DB_POOL_MAX_SIZE",
  "CONTENT_DB_POOL_MAX_SIZE",
  "MEDIA_WORKER_CONCURRENCY",
  "MEDIA_WORKER_DB_POOL",
  "DEPLOY_VERIFY_API_LATENCY_ITERATIONS",
  "GATEWAY_RETRY_BACKOFF_FACTOR",
  "GATEWAY_CIRCUIT_BREAKER_SLIDING_WINDOW_SIZE",
  "GATEWAY_CIRCUIT_BREAKER_MINIMUM_CALLS",
  "GATEWAY_CIRCUIT_BREAKER_HALF_OPEN_CALLS"
)) {
  Assert-IntegerRange -Values $values -Name $name -Min 1 -Max 500
}

foreach ($name in @(
  "USER_DB_POOL_MIN_IDLE",
  "CONTENT_DB_POOL_MIN_IDLE",
  "DEPLOY_VERIFY_METRIC_SCRAPE_WAIT_SECONDS"
)) {
  Assert-IntegerRange -Values $values -Name $name -Min 0 -Max 500
}

Assert-IntegerRange -Values $values -Name "CONTENT_MEDIA_MAX_BYTES" -Min 1 -Max 104857600
Assert-IntegerRange -Values $values -Name "APP_SECURITY_JWT_EXPIRATION_SECONDS" -Min 60 -Max 31536000
Assert-IntegerRange -Values $values -Name "DEPLOY_VERIFY_API_MAX_P95_MS" -Min 1 -Max 60000
Assert-IntegerRange -Values $values -Name "GATEWAY_RETRY_RETRIES" -Min 0 -Max 5
Assert-NumberRange -Values $values -Name "DEPLOY_VERIFY_API_MAX_ERROR_RATE_PERCENT" -Min 0 -Max 100
Assert-NumberRange -Values $values -Name "DEPLOY_VERIFY_MIN_CACHE_HIT_RATE_PERCENT" -Min 0 -Max 100
Assert-NumberRange -Values $values -Name "MANAGEMENT_TRACING_SAMPLING_PROBABILITY" -Min 0 -Max 1
Assert-NumberRange -Values $values -Name "GATEWAY_CIRCUIT_BREAKER_FAILURE_RATE_THRESHOLD" -Min 1 -Max 100
foreach ($name in @(
  "GATEWAY_RETRY_FIRST_BACKOFF",
  "GATEWAY_RETRY_MAX_BACKOFF",
  "GATEWAY_CIRCUIT_BREAKER_OPEN_STATE_WAIT",
  "GATEWAY_CIRCUIT_BREAKER_TIMEOUT",
  "GATEWAY_HTTPCLIENT_RESPONSE_TIMEOUT",
  "GATEWAY_SHUTDOWN_TIMEOUT"
)) {
  Assert-DurationLiteral -Values $values -Name $name
}
Assert-HttpUrl -Values $values -Name "FRONTEND_ORIGIN"
Assert-HttpUrl -Values $values -Name "CONTENT_MEDIA_PUBLIC_BASE_URL"
Assert-HttpUrl -Values $values -Name "DEPLOY_VERIFY_SHARE_HTML_BASE_URL"
Assert-HttpUrl -Values $values -Name "DEPLOY_VERIFY_SHARE_HTML_OUTER_BASE_URL"
Assert-HttpUrl -Values $values -Name "DEPLOY_VERIFY_HTTPS_REDIRECT_BASE_URL"
Assert-HttpUrl -Values $values -Name "DEPLOY_VERIFY_HSTS_BASE_URL"
Assert-HttpUrl -Values $values -Name "DEPLOY_VERIFY_MEDIA_URL" -AllowEmpty
Assert-HttpUrl -Values $values -Name "MANAGEMENT_OTLP_TRACING_ENDPOINT"
Assert-HostName -Values $values -Name "DEPLOY_VERIFY_HTTPS_REDIRECT_HOST"
Assert-HostName -Values $values -Name "DEPLOY_VERIFY_HSTS_HOST"

Assert-PathList -Values $values -Name "DEPLOY_VERIFY_SHARE_HTML_PATH"
Assert-PathList -Values $values -Name "DEPLOY_VERIFY_SHARE_HTML_OUTER_PATH"
Assert-PathList -Values $values -Name "DEPLOY_VERIFY_HTTPS_REDIRECT_PATH"
Assert-PathList -Values $values -Name "DEPLOY_VERIFY_HSTS_PATH"

$containerPrefix = Require-Key -Values $values -Name "COMPOSE_CONTAINER_PREFIX"
if ($containerPrefix -notmatch "^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,62}$") {
  throw "COMPOSE_CONTAINER_PREFIX must be a Docker-safe prefix, got '$containerPrefix'"
}

Write-Output "production env configuration ok"
