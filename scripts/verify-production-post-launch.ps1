param(
  [string]$FromEnvFile = ".env",
  [string[]]$WindowMinutes = @("0", "5", "15", "60"),
  [switch]$InspectDlq,
  [int]$DlqInspectCount = 10,
  [switch]$FailFast,
  [switch]$Plan,
  [string]$OutputFile = ""
)

$ErrorActionPreference = "Stop"
$startedAt = (Get-Date).ToUniversalTime()
$checks = New-Object System.Collections.Generic.List[object]

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
    [string]$Name,
    [string]$Fallback = ""
  )

  if ($Values.ContainsKey($Name) -and [string]$Values[$Name]) {
    return [string]$Values[$Name]
  }
  return $Fallback
}

function ConvertTo-Boolean {
  param(
    [string]$Name,
    [string]$Value
  )

  if ($Value -eq "true") {
    return $true
  }
  if ($Value -eq "false") {
    return $false
  }
  throw "$Name must be true or false, got '$Value'"
}

function Split-MinuteList {
  param([string[]]$Value)

  return @($Value |
    ForEach-Object { [string]$_ } |
    ForEach-Object { $_ -split "," } |
    ForEach-Object { $_.Trim() } |
    Where-Object { $_ } |
    ForEach-Object { [double]$_ })
}

function Convert-CommandOutputToJsonObject {
  param([object[]]$Output)

  $text = (@($Output) -join "`n").Trim()
  if (-not $text) {
    return $null
  }
  try {
    return $text | ConvertFrom-Json
  } catch {
    return $text
  }
}

function Write-JsonResult {
  param(
    [object]$Value,
    [string]$Path = ""
  )

  $json = $Value | ConvertTo-Json -Depth 30
  if ($Path) {
    $directory = Split-Path -Parent $Path
    if ($directory -and -not (Test-Path $directory)) {
      New-Item -ItemType Directory -Path $directory | Out-Null
    }
    Set-Content -Path $Path -Value $json -Encoding ascii
  }
  $json
}

function Add-CheckResult {
  param(
    [int]$Index,
    [double]$ScheduledMinute,
    [string]$Status,
    [double]$Seconds,
    [object]$LaunchVerification = $null,
    [object]$DlqInspect = $null,
    [string]$Detail = ""
  )

  $checks.Add([PSCustomObject]@{
    Index = $Index
    ScheduledMinute = $ScheduledMinute
    ObservedAt = (Get-Date).ToUniversalTime().ToString("o")
    Status = $Status
    Seconds = [math]::Round($Seconds, 2)
    Detail = $Detail
    LaunchVerification = $LaunchVerification
    DlqInspect = $DlqInspect
  }) | Out-Null
}

function Invoke-CapturedScript {
  param(
    [string]$Path,
    [string[]]$Arguments
  )

  $output = & $Path @Arguments
  return [PSCustomObject]@{
    Output = Convert-CommandOutputToJsonObject -Output @($output)
  }
}

function Get-NormalizedWindows {
  param([string[]]$Windows)

  $items = @(Split-MinuteList -Value $Windows | Sort-Object -Unique)
  if ($items.Count -eq 0) {
    throw "WindowMinutes must include at least one value."
  }
  $negative = @($items | Where-Object { $_ -lt 0 })
  if ($negative.Count -gt 0) {
    throw "WindowMinutes cannot include negative values: $($negative -join ', ')"
  }
  return $items
}

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
Push-Location $repoRoot
try {
  $envValues = Read-EnvFile -Path $FromEnvFile

  if (-not $PSBoundParameters.ContainsKey("WindowMinutes")) {
    $configuredWindows = Get-EnvValue -Values $envValues -Name "DEPLOY_POST_LAUNCH_WINDOW_MINUTES"
    if ($configuredWindows) {
      $WindowMinutes = Split-MinuteList -Value $configuredWindows
    }
  }

  if (-not $PSBoundParameters.ContainsKey("InspectDlq")) {
    $InspectDlq = ConvertTo-Boolean `
      -Name "DEPLOY_POST_LAUNCH_INSPECT_DLQ" `
      -Value (Get-EnvValue -Values $envValues -Name "DEPLOY_POST_LAUNCH_INSPECT_DLQ" -Fallback "false")
  }

  $windows = @(Get-NormalizedWindows -Windows $WindowMinutes)
  $resolvedEnvFile = (Resolve-Path $FromEnvFile).Path

  if ($Plan) {
    $result = [ordered]@{
      Action = "ProductionPostLaunchMonitoringPlan"
      DryRun = $true
      Evidence = [ordered]@{
        Kind = "plan"
        Operational = $false
        PlanOnly = $true
        FormalReleaseEvidence = $false
        Detail = "Monitoring schedule preview only; not valid as completed post-launch monitoring evidence."
      }
      EnvFile = $resolvedEnvFile
      GeneratedAt = (Get-Date).ToUniversalTime().ToString("o")
      WindowMinutes = $windows
      InspectDlq = [bool]$InspectDlq
      DlqInspectCount = $DlqInspectCount
      FailFast = [bool]$FailFast
      WouldRunLaunchVerification = $true
      WouldInspectDlq = [bool]$InspectDlq
      OutputFile = $OutputFile
    }
    Write-JsonResult -Path $OutputFile -Value $result
    return
  }

  $launchScript = Join-Path $PSScriptRoot "verify-production-launch.ps1"
  $dlqScript = Join-Path $PSScriptRoot "rabbitmq-dlq.ps1"
  $rabbitManagementPort = Get-EnvValue -Values $envValues -Name "RABBITMQ_MANAGEMENT_HOST_PORT" -Fallback "15672"
  $rabbitManagementUrl = "http://127.0.0.1:${rabbitManagementPort}"
  $rabbitUser = Get-EnvValue -Values $envValues -Name "RABBITMQ_DEFAULT_USER" -Fallback "memesee"
  $rabbitPassword = Get-EnvValue -Values $envValues -Name "RABBITMQ_DEFAULT_PASS"

  for ($i = 0; $i -lt $windows.Count; $i++) {
    $scheduledMinute = [double]$windows[$i]
    $scheduledAt = $startedAt.AddMinutes($scheduledMinute)
    $sleepSeconds = [math]::Ceiling(($scheduledAt - (Get-Date).ToUniversalTime()).TotalSeconds)
    if ($sleepSeconds -gt 0) {
      Start-Sleep -Seconds $sleepSeconds
    }

    $stopwatch = [System.Diagnostics.Stopwatch]::StartNew()
    $launchOutput = $null
    $dlqOutput = $null
    $detail = ""
    try {
      $launchOutput = (Invoke-CapturedScript `
        -Path $launchScript `
        -Arguments @("-FromEnvFile", $resolvedEnvFile)).Output

      if ($InspectDlq) {
        if (-not $rabbitPassword) {
          throw "DEPLOY_POST_LAUNCH_INSPECT_DLQ=true requires RABBITMQ_DEFAULT_PASS in $FromEnvFile."
        }
        $dlqOutput = (Invoke-CapturedScript `
          -Path $dlqScript `
          -Arguments @(
            "-Action", "Inspect",
            "-ManagementUrl", $rabbitManagementUrl,
            "-Username", $rabbitUser,
            "-Password", $rabbitPassword,
            "-Count", [string]$DlqInspectCount
          )).Output
      }

      $stopwatch.Stop()
      Add-CheckResult `
        -Index ($i + 1) `
        -ScheduledMinute $scheduledMinute `
        -Status "OK" `
        -Seconds $stopwatch.Elapsed.TotalSeconds `
        -LaunchVerification $launchOutput `
        -DlqInspect $dlqOutput
    } catch {
      $stopwatch.Stop()
      $detail = $_.Exception.Message
      Add-CheckResult `
        -Index ($i + 1) `
        -ScheduledMinute $scheduledMinute `
        -Status "FAILED" `
        -Seconds $stopwatch.Elapsed.TotalSeconds `
        -LaunchVerification $launchOutput `
        -DlqInspect $dlqOutput `
        -Detail $detail
      if ($FailFast) {
        break
      }
    }
  }

  $completedAt = (Get-Date).ToUniversalTime()
  $checkItems = @($checks.ToArray())
  $failedCount = @($checkItems | Where-Object { $_.Status -eq "FAILED" }).Count
  $okCount = @($checkItems | Where-Object { $_.Status -eq "OK" }).Count
  $result = [ordered]@{
    Action = "ProductionPostLaunchMonitoring"
    DryRun = $false
    Evidence = [ordered]@{
      Kind = if ($failedCount -eq 0) { "operational" } else { "failed" }
      Operational = ($failedCount -eq 0)
      PlanOnly = $false
      FormalReleaseEvidence = ($failedCount -eq 0)
      Detail = if ($failedCount -eq 0) { "Completed post-launch monitoring evidence." } else { "Post-launch monitoring evidence with failed checks." }
    }
    EnvFile = $resolvedEnvFile
    StartedAt = $startedAt.ToString("o")
    CompletedAt = $completedAt.ToString("o")
    DurationSeconds = [math]::Round(($completedAt - $startedAt).TotalSeconds, 2)
    WindowMinutes = $windows
    InspectDlq = [bool]$InspectDlq
    Summary = [ordered]@{
      Ok = $okCount
      Failed = $failedCount
    }
    Checks = $checkItems
  }

  Write-JsonResult -Path $OutputFile -Value $result
  if ($failedCount -gt 0) {
    exit 1
  }
} finally {
  Pop-Location
}
