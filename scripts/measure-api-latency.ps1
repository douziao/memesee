param(
  [string]$GatewayUrl = "http://127.0.0.1:8080",
  [int]$Iterations = 30,
  [int]$Warmup = 3,
  [int]$TimeoutSec = 15,
  [int]$MaxP95Ms = 0,
  [double]$MaxErrorRatePercent = -1,
  [string[]]$Paths = @(
    "/api/communities",
    "/api/feed?size=10"
  )
)

$ErrorActionPreference = "Stop"

function Get-Percentile {
  param(
    [double[]]$Values,
    [double]$Percentile
  )

  if ($Values.Count -eq 0) {
    return 0
  }

  $sorted = $Values | Sort-Object
  $index = [Math]::Ceiling(($Percentile / 100) * $sorted.Count) - 1
  $safeIndex = [Math]::Max(0, [Math]::Min($index, $sorted.Count - 1))
  return [Math]::Round($sorted[$safeIndex], 2)
}

function Measure-Request {
  param([string]$Url)

  $started = [System.Diagnostics.Stopwatch]::StartNew()
  try {
    $response = Invoke-WebRequest -Uri $Url -Method GET -UseBasicParsing -TimeoutSec $TimeoutSec
    $statusCode = [int]$response.StatusCode
  } catch {
    $statusCode = 0
    if ($_.Exception.Response -and $_.Exception.Response.StatusCode) {
      $statusCode = [int]$_.Exception.Response.StatusCode
    }
  } finally {
    $started.Stop()
  }

  [PSCustomObject]@{
    StatusCode = $statusCode
    DurationMs = [Math]::Round($started.Elapsed.TotalMilliseconds, 2)
  }
}

$normalizedGatewayUrl = $GatewayUrl.TrimEnd("/")
$results = @()

foreach ($path in $Paths) {
  $normalizedPath = if ($path.StartsWith("/")) { $path } else { "/$path" }
  $url = "$normalizedGatewayUrl$normalizedPath"

  for ($i = 0; $i -lt $Warmup; $i++) {
    Measure-Request -Url $url | Out-Null
  }

  $samples = @()
  for ($i = 0; $i -lt $Iterations; $i++) {
    $sample = Measure-Request -Url $url
    $samples += $sample
  }

  $durations = [double[]]($samples | ForEach-Object { $_.DurationMs })
  $errorCount = ($samples | Where-Object { $_.StatusCode -lt 200 -or $_.StatusCode -ge 400 }).Count
  $errorRatePercent = if ($samples.Count -eq 0) { 0 } else { [Math]::Round(($errorCount / $samples.Count) * 100, 2) }
  $statusCodes = $samples | Group-Object StatusCode | ForEach-Object {
    [PSCustomObject]@{
      StatusCode = [int]$_.Name
      Count = $_.Count
    }
  }

  $results += [PSCustomObject]@{
    Path = $normalizedPath
    Samples = $samples.Count
    MinMs = [Math]::Round(($durations | Measure-Object -Minimum).Minimum, 2)
    P50Ms = Get-Percentile -Values $durations -Percentile 50
    P95Ms = Get-Percentile -Values $durations -Percentile 95
    MaxMs = [Math]::Round(($durations | Measure-Object -Maximum).Maximum, 2)
    ErrorRatePercent = $errorRatePercent
    StatusCodes = $statusCodes
  }
}

$results | ConvertTo-Json -Depth 4

$violations = @()
foreach ($result in $results) {
  if ($MaxP95Ms -gt 0 -and $result.P95Ms -gt $MaxP95Ms) {
    $violations += "$($result.Path) p95 $($result.P95Ms)ms exceeds budget ${MaxP95Ms}ms"
  }
  if ($MaxErrorRatePercent -ge 0 -and $result.ErrorRatePercent -gt $MaxErrorRatePercent) {
    $violations += "$($result.Path) error rate $($result.ErrorRatePercent)% exceeds budget ${MaxErrorRatePercent}%"
  }
}

if ($violations.Count -gt 0) {
  throw "API latency budget failed: $($violations -join '; ')"
}
