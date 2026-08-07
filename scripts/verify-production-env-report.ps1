param(
  [string]$EnvFile = "deploy/.env.production.example",
  [switch]$AllowPlaceholders,
  [switch]$Json
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

function Get-EnvValue {
  param(
    [hashtable]$Values,
    [string]$Name
  )

  if ($Values.ContainsKey($Name)) {
    return [string]$Values[$Name]
  }
  return ""
}

function Test-PlaceholderValue {
  param([string]$Value)

  return $Value -match "replace-with-|same-value-as|^change[_-]?me"
}

function Get-SecretStatus {
  param(
    [hashtable]$Values,
    [string]$Name
  )

  $value = Get-EnvValue -Values $Values -Name $Name
  [PSCustomObject]@{
    Name = $Name
    Present = $Values.ContainsKey($Name)
    Placeholder = Test-PlaceholderValue -Value $value
    Length = $value.Length
    Redacted = if ($value) { "<redacted>" } else { "" }
  }
}

function Get-SettingStatus {
  param(
    [hashtable]$Values,
    [string]$Name
  )

  [PSCustomObject]@{
    Name = $Name
    Value = Get-EnvValue -Values $Values -Name $Name
  }
}

function Get-PathListStatus {
  param(
    [hashtable]$Values,
    [string]$Name
  )

  $value = Get-EnvValue -Values $Values -Name $Name
  [PSCustomObject]@{
    Name = $Name
    Count = @($value -split "," | ForEach-Object { $_.Trim() } | Where-Object { $_ }).Count
    Value = $value
  }
}

$validator = Join-Path $PSScriptRoot "verify-production-env.ps1"
$validatorParams = @{
  EnvFile = $EnvFile
}
if ($AllowPlaceholders) {
  $validatorParams.AllowPlaceholders = $true
}
$validationOutput = & $validator @validatorParams 2>&1

$values = Read-EnvFile -Path $EnvFile
$secretKeys = @(
  "MYSQL_ROOT_PASSWORD",
  "MYSQL_APP_PASSWORD",
  "REDIS_PASSWORD",
  "RABBITMQ_DEFAULT_PASS",
  "MINIO_ROOT_USER",
  "MINIO_ROOT_PASSWORD",
  "MEILI_MASTER_KEY",
  "APP_SECURITY_JWT_SECRET",
  "APP_SECURITY_INTERNAL_SERVICE_TOKEN"
)

$report = [ordered]@{
  EnvFile = (Resolve-Path $EnvFile).Path
  Validation = ($validationOutput -join "`n").Trim()
  PlaceholderValues = @($values.GetEnumerator() | Where-Object { Test-PlaceholderValue -Value ([string]$_.Value) } | ForEach-Object { $_.Key } | Sort-Object)
  Secrets = @($secretKeys | ForEach-Object { Get-SecretStatus -Values $values -Name $_ })
  PublicOrigins = @(
    Get-SettingStatus -Values $values -Name "FRONTEND_ORIGIN"
    Get-SettingStatus -Values $values -Name "CONTENT_MEDIA_PUBLIC_BASE_URL"
  )
  LocalPorts = @(
    Get-SettingStatus -Values $values -Name "MYSQL_HOST_PORT"
    Get-SettingStatus -Values $values -Name "REDIS_HOST_PORT"
    Get-SettingStatus -Values $values -Name "RABBITMQ_HOST_PORT"
    Get-SettingStatus -Values $values -Name "RABBITMQ_MANAGEMENT_HOST_PORT"
    Get-SettingStatus -Values $values -Name "MINIO_API_HOST_PORT"
    Get-SettingStatus -Values $values -Name "MINIO_CONSOLE_HOST_PORT"
    Get-SettingStatus -Values $values -Name "MEILI_HOST_PORT"
    Get-SettingStatus -Values $values -Name "FRONTEND_HOST_PORT"
    Get-SettingStatus -Values $values -Name "GATEWAY_HOST_PORT"
    Get-SettingStatus -Values $values -Name "PROMETHEUS_HOST_PORT"
    Get-SettingStatus -Values $values -Name "MEDIA_WORKER_HEALTH_PORT"
    Get-SettingStatus -Values $values -Name "OTEL_COLLECTOR_OTLP_GRPC_HOST_PORT"
    Get-SettingStatus -Values $values -Name "OTEL_COLLECTOR_OTLP_HTTP_HOST_PORT"
  )
  RuntimeVerification = @(
    Get-SettingStatus -Values $values -Name "DEPLOY_VERIFY_PRODUCTION_RUNTIME"
    Get-SettingStatus -Values $values -Name "DEPLOY_AUDIT_FILE"
    Get-SettingStatus -Values $values -Name "DEPLOY_LAUNCH_AUDIT_FILE"
    Get-SettingStatus -Values $values -Name "DEPLOY_VERIFY_API_LATENCY"
    Get-SettingStatus -Values $values -Name "DEPLOY_VERIFY_API_LATENCY_ITERATIONS"
    Get-SettingStatus -Values $values -Name "DEPLOY_VERIFY_API_MAX_P95_MS"
    Get-SettingStatus -Values $values -Name "DEPLOY_VERIFY_API_MAX_ERROR_RATE_PERCENT"
    Get-SettingStatus -Values $values -Name "DEPLOY_VERIFY_METRIC_SCRAPE_WAIT_SECONDS"
    Get-SettingStatus -Values $values -Name "DEPLOY_VERIFY_CACHE_METRICS"
    Get-SettingStatus -Values $values -Name "DEPLOY_VERIFY_CONTENT_COMMAND_METRIC_DEFINITIONS"
    Get-SettingStatus -Values $values -Name "DEPLOY_VERIFY_CONTENT_COMMAND_METRICS"
    Get-SettingStatus -Values $values -Name "DEPLOY_VERIFY_INTERNAL_ADMIN_METRIC_DEFINITIONS"
    Get-SettingStatus -Values $values -Name "DEPLOY_VERIFY_INTERNAL_ADMIN_METRICS"
    Get-SettingStatus -Values $values -Name "DEPLOY_VERIFY_MIN_CACHE_HIT_RATE_PERCENT"
    Get-SettingStatus -Values $values -Name "DEPLOY_VERIFY_OTEL_COLLECTOR_METRICS"
    Get-SettingStatus -Values $values -Name "DEPLOY_VERIFY_SHARE_HTML_METRICS"
    Get-SettingStatus -Values $values -Name "DEPLOY_VERIFY_SHARE_HTML_BASE_URL"
    Get-PathListStatus -Values $values -Name "DEPLOY_VERIFY_SHARE_HTML_PATH"
    Get-SettingStatus -Values $values -Name "DEPLOY_VERIFY_SHARE_HTML_OUTER_ROUTE"
    Get-SettingStatus -Values $values -Name "DEPLOY_VERIFY_SHARE_HTML_OUTER_BASE_URL"
    Get-PathListStatus -Values $values -Name "DEPLOY_VERIFY_SHARE_HTML_OUTER_PATH"
    Get-SettingStatus -Values $values -Name "DEPLOY_VERIFY_SHARE_HTML_HOST"
    Get-SettingStatus -Values $values -Name "DEPLOY_VERIFY_HTTPS_REDIRECT"
    Get-SettingStatus -Values $values -Name "DEPLOY_VERIFY_HTTPS_REDIRECT_BASE_URL"
    Get-PathListStatus -Values $values -Name "DEPLOY_VERIFY_HTTPS_REDIRECT_PATH"
    Get-SettingStatus -Values $values -Name "DEPLOY_VERIFY_HTTPS_REDIRECT_HOST"
    Get-SettingStatus -Values $values -Name "DEPLOY_VERIFY_HSTS"
    Get-SettingStatus -Values $values -Name "DEPLOY_VERIFY_HSTS_BASE_URL"
    Get-PathListStatus -Values $values -Name "DEPLOY_VERIFY_HSTS_PATH"
    Get-SettingStatus -Values $values -Name "DEPLOY_VERIFY_HSTS_HOST"
    Get-SettingStatus -Values $values -Name "DEPLOY_VERIFY_HSTS_SKIP_CERTIFICATE_CHECK"
    Get-SettingStatus -Values $values -Name "DEPLOY_VERIFY_MEDIA_URL"
  )
}

if ($Json) {
  $report | ConvertTo-Json -Depth 6
  return
}

Write-Output "production env redacted report"
Write-Output "env file: $($report.EnvFile)"
Write-Output "validation: $($report.Validation)"
Write-Output "placeholder keys: $(@($report.PlaceholderValues) -join ', ')"
Write-Output ""
Write-Output "Secrets"
$report.Secrets | Format-Table -AutoSize | Out-String -Width 200 | Write-Output
Write-Output "Public origins"
$report.PublicOrigins | Format-Table -AutoSize | Out-String -Width 200 | Write-Output
Write-Output "Local ports"
$report.LocalPorts | Format-Table -AutoSize | Out-String -Width 200 | Write-Output
Write-Output "Runtime verification"
$report.RuntimeVerification | Format-Table -AutoSize | Out-String -Width 200 | Write-Output
