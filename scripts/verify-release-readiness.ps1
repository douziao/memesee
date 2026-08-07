param(
  [switch]$SkipBackendTests,
  [switch]$SkipMediaWorkerQuality,
  [switch]$SkipFrontendQuality,
  [switch]$SkipDockerRuntime,
  [switch]$SkipOuterNginxProxyRuntime,
  [switch]$SkipFrontendContainerRuntime,
  [int]$FrontendContainerHostPort = 3100,
  [int]$ProxyFrontendHostPort = 3101,
  [int]$ProxyNginxHostPort = 3180,
  [int]$ProxyNginxHttpsHostPort = 3443,
  [int]$TimeoutSec = 30
)

$ErrorActionPreference = "Stop"

$scriptBoundParameters = @{}
foreach ($entry in $PSBoundParameters.GetEnumerator()) {
  $scriptBoundParameters[$entry.Key] = $entry.Value
}

$stepResults = New-Object System.Collections.Generic.List[object]

function Add-StepResult {
  param(
    [string]$Name,
    [string]$Status,
    [double]$Seconds = 0,
    [string]$Detail = ""
  )

  $stepResults.Add([PSCustomObject]@{
    Name = $Name
    Status = $Status
    Seconds = [math]::Round($Seconds, 1)
    Detail = $Detail
  }) | Out-Null
}

function Invoke-Step {
  param(
    [string]$Name,
    [scriptblock]$Action
  )

  Write-Host "==> $Name"
  $stopwatch = [System.Diagnostics.Stopwatch]::StartNew()
  try {
    & $Action
    $stopwatch.Stop()
    Add-StepResult -Name $Name -Status "OK" -Seconds $stopwatch.Elapsed.TotalSeconds
    Write-Host "ok: $Name ($([math]::Round($stopwatch.Elapsed.TotalSeconds, 1))s)"
  } catch {
    $stopwatch.Stop()
    Add-StepResult -Name $Name -Status "FAILED" -Seconds $stopwatch.Elapsed.TotalSeconds -Detail $_.Exception.Message
    Write-Host "failed: $Name ($([math]::Round($stopwatch.Elapsed.TotalSeconds, 1))s)"
    throw
  }
}

function Invoke-OptionalOutputStep {
  param(
    [string]$Name,
    [scriptblock]$Action,
    [string]$SkippedPattern
  )

  Write-Host "==> $Name"
  $stopwatch = [System.Diagnostics.Stopwatch]::StartNew()
  try {
    $output = @(& $Action)
    $stopwatch.Stop()
    $detail = (@($output) -join "`n").Trim()
    if ($detail -match $SkippedPattern) {
      Add-StepResult -Name $Name -Status "SKIPPED" -Seconds $stopwatch.Elapsed.TotalSeconds -Detail $detail
      if ($detail) {
        Write-Host $detail
      }
      Write-Host "skipped: $Name ($([math]::Round($stopwatch.Elapsed.TotalSeconds, 1))s)"
      return
    }
    Add-StepResult -Name $Name -Status "OK" -Seconds $stopwatch.Elapsed.TotalSeconds -Detail $detail
    if ($detail) {
      Write-Host $detail
    }
    Write-Host "ok: $Name ($([math]::Round($stopwatch.Elapsed.TotalSeconds, 1))s)"
  } catch {
    $stopwatch.Stop()
    Add-StepResult -Name $Name -Status "FAILED" -Seconds $stopwatch.Elapsed.TotalSeconds -Detail $_.Exception.Message
    Write-Host "failed: $Name ($([math]::Round($stopwatch.Elapsed.TotalSeconds, 1))s)"
    throw
  }
}

function Invoke-RepoScript {
  param(
    [string]$Path,
    [string[]]$Arguments = @(),
    [string]$Executable = "powershell"
  )

  if ($Executable -eq "pwsh") {
    & pwsh -NoProfile -File $Path @Arguments
  } else {
    & powershell -NoProfile -ExecutionPolicy Bypass -File $Path @Arguments
  }
  if ($LASTEXITCODE -ne 0) {
    throw "$Executable $Path failed with exit code $LASTEXITCODE"
  }
}

function Test-PowerShellSyntax {
  param([string[]]$Paths)

  foreach ($path in $Paths) {
    $errors = $null
    [void][System.Management.Automation.PSParser]::Tokenize((Get-Content -Raw $path), [ref]$errors)
    if ($errors.Count -gt 0) {
      $summary = $errors | ForEach-Object { "$($_.Message) at line $($_.Token.StartLine)" }
      throw "$path has PowerShell syntax errors: $($summary -join '; ')"
    }
  }
}

function Get-ExcludedTcpPortRanges {
  $ranges = @()
  try {
    $output = netsh interface ipv4 show excludedportrange protocol=tcp 2>$null
    foreach ($line in @($output)) {
      if ($line -match "^\s*(\d+)\s+(\d+)\s*(\*?)\s*$") {
        $ranges += [PSCustomObject]@{
          Start = [int]$matches[1]
          End = [int]$matches[2]
        }
      }
    }
  } catch {
    return @()
  }

  return @($ranges)
}

function Test-ExcludedTcpPort {
  param(
    [int]$Port,
    [object[]]$ExcludedRanges
  )

  foreach ($range in @($ExcludedRanges)) {
    if ($Port -ge [int]$range.Start -and $Port -le [int]$range.End) {
      return $true
    }
  }
  return $false
}

function Get-FreeTcpPort {
  param(
    [int[]]$ReservedPorts = @(),
    [object[]]$ExcludedRanges = @()
  )

  while ($true) {
    $listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, 0)
    try {
      $listener.Start()
      $port = $listener.LocalEndpoint.Port
    } finally {
      $listener.Stop()
    }

    if ($ReservedPorts -notcontains $port -and -not (Test-ExcludedTcpPort -Port $port -ExcludedRanges $ExcludedRanges)) {
      return $port
    }
  }
}

function Use-DynamicPortDefault {
  param([string]$Name)

  return -not $scriptBoundParameters.ContainsKey($Name)
}

function Write-ReleaseSummary {
  $totalSeconds = ($stepResults | Measure-Object -Property Seconds -Sum).Sum
  $failedCount = @($stepResults | Where-Object { $_.Status -eq "FAILED" }).Count
  $skippedCount = @($stepResults | Where-Object { $_.Status -eq "SKIPPED" }).Count
  $okCount = @($stepResults | Where-Object { $_.Status -eq "OK" }).Count

  Write-Host ""
  Write-Host "Release readiness summary"
  $stepResults | Format-Table -AutoSize | Out-String -Width 200 | Write-Host
  Write-Host "summary: $okCount ok, $skippedCount skipped, $failedCount failed, $([math]::Round($totalSeconds, 1))s total"
}

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$backendDir = Join-Path $repoRoot "backend"
$frontendDir = Join-Path $repoRoot "frontend"
$mediaWorkerDir = Join-Path $repoRoot "media-worker"
$completed = $false
$excludedRuntimePortRanges = Get-ExcludedTcpPortRanges
$reservedRuntimePorts = @(
  $FrontendContainerHostPort,
  $ProxyFrontendHostPort,
  $ProxyNginxHostPort,
  $ProxyNginxHttpsHostPort
)

if (Use-DynamicPortDefault -Name "FrontendContainerHostPort") {
  $FrontendContainerHostPort = Get-FreeTcpPort -ReservedPorts $reservedRuntimePorts -ExcludedRanges $excludedRuntimePortRanges
  $reservedRuntimePorts += $FrontendContainerHostPort
}
if (Use-DynamicPortDefault -Name "ProxyFrontendHostPort") {
  $ProxyFrontendHostPort = Get-FreeTcpPort -ReservedPorts $reservedRuntimePorts -ExcludedRanges $excludedRuntimePortRanges
  $reservedRuntimePorts += $ProxyFrontendHostPort
}
$proxySslFrontendHostPort = $ProxyFrontendHostPort + 10
if (Use-DynamicPortDefault -Name "ProxyFrontendHostPort") {
  $proxySslFrontendHostPort = Get-FreeTcpPort -ReservedPorts $reservedRuntimePorts -ExcludedRanges $excludedRuntimePortRanges
}
$reservedRuntimePorts += $proxySslFrontendHostPort

if (Use-DynamicPortDefault -Name "ProxyNginxHostPort") {
  $ProxyNginxHostPort = Get-FreeTcpPort -ReservedPorts $reservedRuntimePorts -ExcludedRanges $excludedRuntimePortRanges
  $reservedRuntimePorts += $ProxyNginxHostPort
}
$proxySslNginxHostPort = $ProxyNginxHostPort + 1
if (Use-DynamicPortDefault -Name "ProxyNginxHostPort") {
  $proxySslNginxHostPort = Get-FreeTcpPort -ReservedPorts $reservedRuntimePorts -ExcludedRanges $excludedRuntimePortRanges
}
$reservedRuntimePorts += $proxySslNginxHostPort

if (Use-DynamicPortDefault -Name "ProxyNginxHttpsHostPort") {
  $ProxyNginxHttpsHostPort = Get-FreeTcpPort -ReservedPorts $reservedRuntimePorts -ExcludedRanges $excludedRuntimePortRanges
  $reservedRuntimePorts += $ProxyNginxHttpsHostPort
}

Push-Location $repoRoot
try {
  $staticChecks = @(
    @{ Name = "production env defaults"; Path = "scripts/verify-production-env.ps1"; Args = @("-AllowPlaceholders") },
    @{ Name = "production env redacted report"; Path = "scripts/verify-production-env-report.ps1"; Args = @("-AllowPlaceholders") },
    @{ Name = "quality gate wiring"; Path = "scripts/verify-quality-gate-wiring.ps1"; Args = @() },
    @{ Name = "production image sources"; Path = "scripts/verify-production-image-sources.ps1"; Args = @() },
    @{ Name = "architecture phase 1 config"; Path = "scripts/verify-architecture-phase1.ps1"; Args = @() },
    @{ Name = "architecture phase 2 config"; Path = "scripts/verify-architecture-phase2.ps1"; Args = @() },
    @{ Name = "backend runtime config"; Path = "scripts/verify-backend-runtime-config.ps1"; Args = @() },
    @{ Name = "deploy runtime wiring"; Path = "scripts/verify-deploy-runtime-config.ps1"; Args = @() },
    @{ Name = "production incident runbook"; Path = "scripts/verify-production-runbook.ps1"; Args = @() },
    @{ Name = "production audit script contracts"; Path = "scripts/verify-production-audit-scripts.ps1"; Args = @() },
    @{ Name = "production preflight checklist"; Path = "scripts/verify-production-preflight.ps1"; Args = @("-EnvFile", "deploy/.env.production.example", "-AllowPlaceholders", "-SkipRollbackPlan") },
    @{ Name = "production post-launch monitoring plan"; Path = "scripts/verify-production-post-launch.ps1"; Args = @("-FromEnvFile", "deploy/.env.production.example", "-WindowMinutes", "0,5,15,60", "-Plan") },
    @{ Name = "production launch command config"; Path = "scripts/verify-production-launch-config.ps1"; Args = @() },
    @{ Name = "release evidence bundle"; Path = "scripts/verify-release-evidence-bundle.ps1"; Args = @() },
    @{ Name = "release evidence archive"; Path = "scripts/verify-release-evidence-archive.ps1"; Args = @() },
    @{ Name = "release artifact suggestions"; Path = "scripts/verify-release-artifact-suggestions.ps1"; Args = @() },
    @{ Name = "release artifact privacy"; Path = "scripts/verify-release-artifact-privacy.ps1"; Args = @() },
    @{ Name = "blue/green nginx upstream rewrites"; Path = "scripts/verify-bluegreen-nginx-upstreams.ps1"; Args = @() },
    @{ Name = "production container hardening"; Path = "scripts/verify-production-container-hardening.ps1"; Args = @() },
    @{ Name = "content db indexes"; Path = "scripts/verify-content-db-indexes.ps1"; Args = @() },
    @{ Name = "content privacy regression contracts"; Path = "scripts/verify-content-privacy-regression.ps1"; Args = @() },
    @{ Name = "observability config"; Path = "scripts/verify-observability.ps1"; Args = @() },
    @{ Name = "prometheus config"; Path = "scripts/verify-prometheus-config.ps1"; Args = @() },
    @{ Name = "frontend nginx config"; Path = "scripts/verify-frontend-nginx-config.ps1"; Args = @() },
    @{ Name = "outer nginx config"; Path = "scripts/verify-nginx-config.ps1"; Args = @() }
  )

  foreach ($check in $staticChecks) {
    Invoke-Step -Name $check.Name -Action {
      Invoke-RepoScript -Path $check.Path -Arguments $check.Args
    }
  }

  Invoke-OptionalOutputStep -Name "deploy bash syntax" -SkippedPattern "^deploy bash syntax skipped:" -Action {
    & powershell -NoProfile -ExecutionPolicy Bypass -File "scripts/verify-deploy-bash-syntax.ps1"
    if ($LASTEXITCODE -ne 0) {
      throw "powershell scripts/verify-deploy-bash-syntax.ps1 failed with exit code $LASTEXITCODE"
    }
  }

  Invoke-Step -Name "powershell script syntax" -Action {
    $scriptPaths = Get-ChildItem -Path "scripts" -Filter "*.ps1" -File |
      Sort-Object Name |
      Select-Object -ExpandProperty FullName
    Test-PowerShellSyntax -Paths $scriptPaths
  }

  if (-not $SkipBackendTests) {
    Invoke-Step -Name "backend test gate" -Action {
      Push-Location $backendDir
      try {
        mvn test
        if ($LASTEXITCODE -ne 0) {
          throw "mvn test failed with exit code $LASTEXITCODE"
        }
      } finally {
        Pop-Location
      }
    }
  } else {
    Add-StepResult -Name "backend test gate" -Status "SKIPPED" -Detail "-SkipBackendTests"
  }

  if (-not $SkipMediaWorkerQuality) {
    Invoke-Step -Name "media worker quality gate" -Action {
      Push-Location $mediaWorkerDir
      try {
        npm run check
        if ($LASTEXITCODE -ne 0) {
          throw "npm run check failed with exit code $LASTEXITCODE"
        }
        npm run test
        if ($LASTEXITCODE -ne 0) {
          throw "npm run test failed with exit code $LASTEXITCODE"
        }
        npm audit --omit=dev
        if ($LASTEXITCODE -ne 0) {
          throw "npm audit --omit=dev failed with exit code $LASTEXITCODE"
        }
      } finally {
        Pop-Location
      }
    }
  } else {
    Add-StepResult -Name "media worker quality gate" -Status "SKIPPED" -Detail "-SkipMediaWorkerQuality"
  }

  if (-not $SkipFrontendQuality) {
    Invoke-Step -Name "frontend quality gate" -Action {
      Push-Location $frontendDir
      try {
        npm run quality
        if ($LASTEXITCODE -ne 0) {
          throw "npm run quality failed with exit code $LASTEXITCODE"
        }
      } finally {
        Pop-Location
      }
    }
  } else {
    Add-StepResult -Name "frontend quality gate" -Status "SKIPPED" -Detail "-SkipFrontendQuality"
  }

  if (-not $SkipDockerRuntime -and -not $SkipFrontendContainerRuntime) {
    Invoke-Step -Name "frontend container runtime" -Action {
      Invoke-RepoScript `
        -Path "scripts/verify-frontend-container-runtime.ps1" `
        -Arguments @("-HostPort", [string]$FrontendContainerHostPort, "-TimeoutSec", [string]$TimeoutSec)
    }
  } else {
    $detail = if ($SkipDockerRuntime) { "-SkipDockerRuntime" } else { "-SkipFrontendContainerRuntime" }
    Add-StepResult -Name "frontend container runtime" -Status "SKIPPED" -Detail $detail
  }

  if (-not $SkipDockerRuntime -and -not $SkipOuterNginxProxyRuntime) {
    Invoke-Step -Name "outer nginx frontend proxy runtime http" -Action {
      Invoke-RepoScript `
        -Path "scripts/verify-nginx-frontend-proxy-runtime.ps1" `
        -Arguments @(
          "-NginxConfigVariant",
          "http",
          "-FrontendHostPort",
          [string]$ProxyFrontendHostPort,
          "-NginxHostPort",
          [string]$ProxyNginxHostPort,
          "-TimeoutSec",
          [string]$TimeoutSec
        )
    }
    Invoke-Step -Name "outer nginx frontend proxy runtime ssl" -Action {
      Invoke-RepoScript `
        -Path "scripts/verify-nginx-frontend-proxy-runtime.ps1" `
        -Executable "pwsh" `
        -Arguments @(
          "-NginxConfigVariant",
          "ssl",
          "-FrontendHostPort",
          [string]$proxySslFrontendHostPort,
          "-NginxHostPort",
          [string]$proxySslNginxHostPort,
          "-NginxHttpsHostPort",
          [string]$ProxyNginxHttpsHostPort,
          "-TimeoutSec",
          [string]$TimeoutSec
        )
    }
  } else {
    $detail = if ($SkipDockerRuntime) { "-SkipDockerRuntime" } else { "-SkipOuterNginxProxyRuntime" }
    Add-StepResult -Name "outer nginx frontend proxy runtime http" -Status "SKIPPED" -Detail $detail
    Add-StepResult -Name "outer nginx frontend proxy runtime ssl" -Status "SKIPPED" -Detail $detail
  }

  $completed = $true
  Write-ReleaseSummary
  Write-Host "release readiness ok"
} finally {
  if (-not $completed) {
    Write-ReleaseSummary
  }
  Pop-Location
}
