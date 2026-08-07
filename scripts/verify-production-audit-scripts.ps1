$ErrorActionPreference = "Stop"

function Assert-AuditPlan {
  param(
    [object]$Payload,
    [string]$Name
  )

  if ($Payload.AuditSchemaVersion -ne 1) {
    throw "$Name plan must include AuditSchemaVersion=1"
  }
  if (-not [bool]$Payload.DryRun) {
    throw "$Name plan must set DryRun=true"
  }
  if ($Payload.Status -ne "PLAN") {
    throw "$Name plan must set Status=PLAN"
  }
  if (-not $Payload.Action) {
    throw "$Name plan must include Action"
  }
  if (-not $Payload.GeneratedAt) {
    throw "$Name plan must include GeneratedAt"
  }
  if ($null -eq $Payload.Safety) {
    throw "$Name plan must include Safety"
  }
}

function Assert-AuditSourceContract {
  param(
    [string]$Path,
    [string]$Name
  )

  $content = Get-Content -Raw $Path
  $requiredPatterns = @(
    @{ Pattern = "\[string\]\s*\`$AuditFile\s*="; Description = "AuditFile parameter" },
    @{ Pattern = "\[switch\]\s*\`$Plan"; Description = "Plan switch" },
    @{ Pattern = "Write-JsonResult\s+-Path\s+\`$AuditFile"; Description = "AuditFile JSON writer" },
    @{ Pattern = "AuditSchemaVersion\s*=\s*1"; Description = "AuditSchemaVersion=1" },
    @{ Pattern = "Status\s*="; Description = "Status field" },
    @{ Pattern = "Safety\s*=\s*\["; Description = "Safety object" }
  )

  foreach ($item in $requiredPatterns) {
    if ($content -notmatch $item.Pattern) {
      throw "$Name audit source must include $($item.Description)"
    }
  }
}

function Convert-OutputToJson {
  param(
    [object[]]$Output,
    [string]$Name
  )

  $text = (@($Output) -join "`n").Trim()
  if (-not $text) {
    throw "$Name produced no output"
  }
  try {
    return $text | ConvertFrom-Json
  } catch {
    throw "$Name output was not JSON: $text"
  }
}

function New-TempPath {
  param([string]$Extension)
  return Join-Path $script:TempDirectory "memesee-audit-$([guid]::NewGuid().ToString('N'))$Extension"
}

function Invoke-AuditPlan {
  param(
    [string]$Name,
    [string]$ScriptName,
    [scriptblock]$Action
  )

  $scriptPath = Join-Path $PSScriptRoot $ScriptName
  Assert-AuditSourceContract -Path $scriptPath -Name $Name

  $auditFile = New-TempPath -Extension ".json"
  $tempPaths.Add($auditFile) | Out-Null

  $output = & $Action $scriptPath $auditFile
  $stdoutPayload = Convert-OutputToJson -Output $output -Name $Name
  Assert-AuditPlan -Payload $stdoutPayload -Name $Name

  if (-not (Test-Path $auditFile)) {
    throw "$Name did not write its -AuditFile plan"
  }

  $filePayload = Get-Content -Raw $auditFile | ConvertFrom-Json
  Assert-AuditPlan -Payload $filePayload -Name "$Name audit file"

  if ($stdoutPayload.Action -ne $filePayload.Action) {
    throw "$Name stdout and audit file Action differ"
  }
  if ($stdoutPayload.GeneratedAt -ne $filePayload.GeneratedAt) {
    throw "$Name stdout and audit file GeneratedAt differ"
  }

  return $stdoutPayload
}

$expectedAuditScripts = @(
  "deploy-bluegreen.ps1",
  "prime-content-command-metrics.ps1",
  "rabbitmq-dlq.ps1",
  "rollback-bluegreen.ps1"
)
$script:TempDirectory = [System.IO.Path]::GetTempPath()
$tempPaths = New-Object System.Collections.Generic.List[string]

try {
  $auditParamScripts = Get-ChildItem -Path $PSScriptRoot -Filter "*.ps1" | Where-Object {
    (Get-Content -Raw $_.FullName) -match "\[string\]\s*\`$AuditFile\s*="
  } | Select-Object -ExpandProperty Name | Sort-Object

  $unexpectedAuditScripts = @($auditParamScripts | Where-Object { $expectedAuditScripts -notcontains $_ })
  if ($unexpectedAuditScripts.Count -gt 0) {
    throw "Scripts with AuditFile are missing from production audit verification: $($unexpectedAuditScripts -join ', ')"
  }

  foreach ($expectedScript in $expectedAuditScripts) {
    if ($auditParamScripts -notcontains $expectedScript) {
      throw "Expected production audit script is missing or no longer exposes AuditFile: $expectedScript"
    }
  }

  $contentCommandPlan = Invoke-AuditPlan `
    -Name "content command metric sample" `
    -ScriptName "prime-content-command-metrics.ps1" `
    -Action {
      param($ScriptPath, $AuditFile)
      & $ScriptPath -Plan -AuditFile $AuditFile
    }

  if (-not [bool]$contentCommandPlan.Safety.RequiresConfirmDestructive -or -not [bool]$contentCommandPlan.Safety.TemporaryDataExpected) {
    throw "content command metric sample plan must mark destructive temporary data safety impact"
  }

  $dlqPlan = Invoke-AuditPlan `
    -Name "DLQ requeue" `
    -ScriptName "rabbitmq-dlq.ps1" `
    -Action {
      param($ScriptPath, $AuditFile)
      & $ScriptPath -Action Requeue -Count 25 -Plan -AuditFile $AuditFile
    }
  if (-not [bool]$dlqPlan.Safety.RequiresConfirmDestructive -or -not [bool]$dlqPlan.Safety.DeletesProductionData) {
    throw "DLQ requeue plan must mark destructive safety impact"
  }

  $deployEnvPath = New-TempPath -Extension ".env"
  $deployAuditPath = New-TempPath -Extension ".json"
  $deployStatePath = New-TempPath -Extension ".json"
  $tempPaths.Add($deployEnvPath) | Out-Null
  $tempPaths.Add($deployAuditPath) | Out-Null
  $tempPaths.Add($deployStatePath) | Out-Null
  Set-Content -Path $deployEnvPath -Value "APP_SECURITY_INTERNAL_SERVICE_TOKEN=deployment-plan-token-1234567890" -Encoding ascii

  $deployPlan = Invoke-AuditPlan `
    -Name "blue green deploy" `
    -ScriptName "deploy-bluegreen.ps1" `
    -Action {
      param($ScriptPath, $AuditFile)
      & $ScriptPath `
        -EnvFile $deployEnvPath `
        -GeneratedEnvDir $script:TempDirectory `
        -StateFile $deployStatePath `
        -TargetColor green `
        -ActiveColor blue `
        -SkipBuild `
        -Plan `
        -AuditFile $AuditFile
    }
  if (-not [bool]$deployPlan.Safety.WritesProductionData -or -not [bool]$deployPlan.Safety.StartsContainers) {
    throw "blue green deploy plan must mark production container and state changes"
  }
  if (-not [bool]$deployPlan.WouldRunRuntimeVerification) {
    throw "blue green deploy plan must include runtime verification"
  }

  $rollbackEnvPath = New-TempPath -Extension ".env"
  $rollbackStatePath = New-TempPath -Extension ".json"
  $tempPaths.Add($rollbackEnvPath) | Out-Null
  $tempPaths.Add($rollbackStatePath) | Out-Null
  Set-Content -Path $rollbackEnvPath -Value "COMPOSE_PROJECT_NAME=memesee-test" -Encoding ascii
  [ordered]@{
    candidateProject = "memesee-green"
    candidateColor = "green"
    candidateEnvFile = $rollbackEnvPath
    ports = [ordered]@{
      gateway = 8080
      frontend = 3000
      prometheus = 9090
      minio = 9000
    }
    previous = [ordered]@{
      candidateProject = "memesee-blue"
      candidateColor = "blue"
      candidateEnvFile = $rollbackEnvPath
      ports = [ordered]@{
        gateway = 18080
        frontend = 13000
        prometheus = 19090
        minio = 19000
      }
      previous = $null
    }
  } | ConvertTo-Json -Depth 10 | Set-Content -Path $rollbackStatePath -Encoding ascii

  $rollbackPlan = Invoke-AuditPlan `
    -Name "rollback" `
    -ScriptName "rollback-bluegreen.ps1" `
    -Action {
      param($ScriptPath, $AuditFile)
      & $ScriptPath -StateFile $rollbackStatePath -Plan -AuditFile $AuditFile
    }
  if (-not [bool]$rollbackPlan.Safety.WritesProductionData) {
    throw "rollback plan must mark production state changes"
  }
} finally {
  foreach ($path in $tempPaths) {
    if (Test-Path $path) {
      Remove-Item -LiteralPath $path -Force
    }
  }
}

Write-Output "production audit script contracts ok"
