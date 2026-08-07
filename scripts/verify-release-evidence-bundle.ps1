$ErrorActionPreference = "Stop"

function New-TempPath {
  param([string]$Extension)
  return Join-Path $env:TEMP "memesee-release-evidence-$([guid]::NewGuid().ToString('N'))$Extension"
}

function Write-JsonArtifact {
  param(
    [string]$Path,
    [object]$Value
  )

  $Value | ConvertTo-Json -Depth 20 | Set-Content -Path $Path -Encoding ascii
}

function ConvertTo-Sha256Hex {
  param([string]$Value)

  $bytes = [System.Text.Encoding]::UTF8.GetBytes($Value)
  $sha = [System.Security.Cryptography.SHA256]::Create()
  try {
    return (($sha.ComputeHash($bytes) | ForEach-Object { $_.ToString("x2") }) -join "").ToUpperInvariant()
  } finally {
    $sha.Dispose()
  }
}

function New-ManifestPayload {
  param([object]$Bundle)

  $payload = [ordered]@{
    ReleaseId = $Bundle.ReleaseId
    Complete = [bool]$Bundle.Complete
  }
  if ($Bundle.PSObject.Properties.Name -contains "OperationalComplete") {
    $payload.OperationalComplete = [bool]$Bundle.OperationalComplete
  }
  $payload.Summary = $Bundle.Summary
  $payload.Artifacts = @($Bundle.Artifacts | ForEach-Object {
      $artifactPayload = [ordered]@{
        Name = $_.Name
        Path = $_.Path
        Present = $_.Present
        Valid = $_.Valid
        Outcome = $_.Outcome
      }
      if ($_.PSObject.Properties.Name -contains "PlanOnly") {
        $artifactPayload.PlanOnly = [bool]$_.PlanOnly
      }
      $artifactPayload.Sha256 = $_.Sha256
      $artifactPayload.Action = $_.Action
      $artifactPayload.AuditSchemaVersion = $_.AuditSchemaVersion
      $artifactPayload.Status = $_.Status
      $artifactPayload.DryRun = $_.DryRun
      if ($_.PSObject.Properties.Name -contains "Evidence") {
        $artifactPayload.Evidence = $_.Evidence
      }
      $artifactPayload.StartedAt = $_.StartedAt
      $artifactPayload.CompletedAt = $_.CompletedAt
      $artifactPayload.GeneratedAt = $_.GeneratedAt
      $artifactPayload.Summary = $_.Summary
      $artifactPayload
    })
  return $payload
}

function Assert-ManifestHash {
  param(
    [object]$Bundle,
    [string]$Name
  )

  if (-not $Bundle.Manifest) {
    throw "$Name must include Manifest"
  }
  if ($Bundle.Manifest.SchemaVersion -ne 1) {
    throw "$Name Manifest must include SchemaVersion=1"
  }
  if ($Bundle.Manifest.Algorithm -ne "SHA256") {
    throw "$Name Manifest must use SHA256"
  }
  if (-not $Bundle.Manifest.Sha256 -or $Bundle.Manifest.Sha256.Length -ne 64) {
    throw "$Name Manifest must include 64-character SHA256"
  }

  $manifestPayload = New-ManifestPayload -Bundle $Bundle
  $manifestJson = $manifestPayload | ConvertTo-Json -Depth 30 -Compress
  $expectedSha = ConvertTo-Sha256Hex -Value $manifestJson
  if ($Bundle.Manifest.Sha256 -ne $expectedSha) {
    throw "$Name Manifest SHA256 is not reproducible"
  }
}

$tempPaths = New-Object System.Collections.Generic.List[string]

try {
  $preflightFile = New-TempPath -Extension ".preflight.json"
  $deployFile = New-TempPath -Extension ".deploy.json"
  $deployLaunchFile = New-TempPath -Extension ".launch.json"
  $postLaunchFile = New-TempPath -Extension ".postlaunch.json"
  $contentPrivacyFile = New-TempPath -Extension ".privacy.json"
  $bundleFile = New-TempPath -Extension ".bundle.json"
  $verificationFile = New-TempPath -Extension ".verification.json"
  $planLaunchFile = New-TempPath -Extension ".plan-launch.json"
  $planPostLaunchFile = New-TempPath -Extension ".plan-postlaunch.json"
  $planBundleFile = New-TempPath -Extension ".plan-bundle.json"
  $incompleteBundleFile = New-TempPath -Extension ".incomplete.json"
  $tamperBundleFile = New-TempPath -Extension ".tamper.json"
  foreach ($path in @($preflightFile, $deployFile, $deployLaunchFile, $postLaunchFile, $contentPrivacyFile, $bundleFile, $verificationFile, $planLaunchFile, $planPostLaunchFile, $planBundleFile, $incompleteBundleFile)) {
    $tempPaths.Add($path) | Out-Null
  }
  $tempPaths.Add($tamperBundleFile) | Out-Null

  Write-JsonArtifact -Path $preflightFile -Value ([ordered]@{
    Action = "ProductionPreflight"
    StartedAt = "2026-06-08T00:00:00Z"
    CompletedAt = "2026-06-08T00:00:01Z"
    Summary = [ordered]@{
      Ok = 5
      Skipped = 1
      Failed = 0
    }
  })

  Write-JsonArtifact -Path $deployFile -Value ([ordered]@{
    Action = "RegularDeploy"
    AuditSchemaVersion = 1
    Status = "OK"
    StartedAt = "2026-06-08T00:01:00Z"
    CompletedAt = "2026-06-08T00:02:00Z"
    Safety = [ordered]@{
      WritesProductionData = $true
      StartsContainers = $true
    }
  })

  Write-JsonArtifact -Path $deployLaunchFile -Value ([ordered]@{
    Action = "ProductionLaunchVerification"
    AuditSchemaVersion = 1
    Status = "OK"
    StartedAt = "2026-06-08T00:02:00Z"
    CompletedAt = "2026-06-08T00:02:30Z"
    Command = "pwsh -NoProfile -File scripts/verify-production-runtime.ps1"
    ExitCode = 0
  })

  Write-JsonArtifact -Path $postLaunchFile -Value ([ordered]@{
    Action = "ProductionPostLaunchMonitoring"
    StartedAt = "2026-06-08T00:02:00Z"
    CompletedAt = "2026-06-08T00:03:00Z"
    Summary = [ordered]@{
      Ok = 1
      Failed = 0
    }
  })

  Write-JsonArtifact -Path $contentPrivacyFile -Value ([ordered]@{
    Action = "ContentPrivacyRegressionVerification"
    AuditSchemaVersion = 1
    Status = "OK"
    GeneratedAt = "2026-06-08T00:00:00Z"
    Summary = [ordered]@{
      Ok = 42
      Failed = 0
    }
  })

  & (Join-Path $PSScriptRoot "write-release-evidence-bundle.ps1") `
    -OutputFile $bundleFile `
    -ReleaseId "release-test" `
    -PreflightFile $preflightFile `
    -DeployAuditFile $deployFile `
    -DeployLaunchAuditFile $deployLaunchFile `
    -PostLaunchFile $postLaunchFile `
    -ContentPrivacyFile $contentPrivacyFile | Out-Null
  if (-not (Test-Path $bundleFile)) {
    throw "write-release-evidence-bundle.ps1 did not write complete bundle"
  }

  $bundle = Get-Content -Raw $bundleFile | ConvertFrom-Json
  if ($bundle.Action -ne "ReleaseEvidenceBundle") {
    throw "bundle must include Action=ReleaseEvidenceBundle"
  }
  if ($bundle.AuditSchemaVersion -ne 1) {
    throw "bundle must include AuditSchemaVersion=1"
  }
  if (-not [bool]$bundle.Complete) {
    throw "complete bundle should set Complete=true"
  }
  if (-not [bool]$bundle.OperationalComplete) {
    throw "complete bundle with real artifacts should set OperationalComplete=true"
  }
  if ($bundle.Summary.Ok -ne 5 -or $bundle.Summary.Missing -ne 0 -or $bundle.Summary.Invalid -ne 0 -or $bundle.Summary.Failed -ne 0 -or $bundle.Summary.PlanOnly -ne 0) {
    throw "complete bundle summary is wrong"
  }
  Assert-ManifestHash -Bundle $bundle -Name "complete bundle"
  foreach ($artifact in $bundle.Artifacts) {
    if (-not $artifact.Sha256 -or $artifact.Sha256.Length -ne 64) {
      throw "artifact $($artifact.Name) must include SHA256"
    }
  }

  $verificationOutput = & (Join-Path $PSScriptRoot "write-release-evidence-bundle.ps1") `
    -VerifyExisting `
    -BundleFile $bundleFile `
    -OutputFile $verificationFile
  $verification = ($verificationOutput | ConvertFrom-Json)
  if ($verification.Action -ne "ReleaseEvidenceBundleVerification") {
    throw "VerifyExisting must output ReleaseEvidenceBundleVerification"
  }
  if (-not (Test-Path $verificationFile)) {
    throw "VerifyExisting must write verification output file when OutputFile is provided"
  }
  $archivedVerification = Get-Content -Raw $verificationFile | ConvertFrom-Json
  if ($archivedVerification.Action -ne "ReleaseEvidenceBundleVerification") {
    throw "VerifyExisting output file must contain ReleaseEvidenceBundleVerification"
  }
  if ($verification.Summary.Failed -ne 0 -or $verification.Summary.Ok -ne 5) {
    throw "VerifyExisting should verify all complete bundle artifacts"
  }

  Write-JsonArtifact -Path $planLaunchFile -Value ([ordered]@{
    Action = "ProductionLaunchVerification"
    AuditSchemaVersion = 1
    Status = "OK"
    DryRun = $false
    Evidence = [ordered]@{
      Kind = "plan"
      Operational = $false
      PlanOnly = $true
      FormalReleaseEvidence = $false
    }
    Command = "pwsh -NoProfile -File scripts/verify-production-runtime.ps1"
  })

  Write-JsonArtifact -Path $planPostLaunchFile -Value ([ordered]@{
    Action = "ProductionPostLaunchMonitoringPlan"
    DryRun = $true
    Evidence = [ordered]@{
      Kind = "plan"
      Operational = $false
      PlanOnly = $true
      FormalReleaseEvidence = $false
    }
    GeneratedAt = "2026-06-08T00:03:00Z"
    Summary = [ordered]@{
      Ok = 1
      Failed = 0
    }
  })

  & (Join-Path $PSScriptRoot "write-release-evidence-bundle.ps1") `
    -OutputFile $planBundleFile `
    -ReleaseId "release-test-plan" `
    -PreflightFile $preflightFile `
    -DeployAuditFile $deployFile `
    -DeployLaunchAuditFile $planLaunchFile `
    -PostLaunchFile $planPostLaunchFile `
    -ContentPrivacyFile $contentPrivacyFile | Out-Null
  $planBundle = Get-Content -Raw $planBundleFile | ConvertFrom-Json
  if (-not [bool]$planBundle.Complete) {
    throw "plan-only bundle should still set Complete=true when all files are present and valid"
  }
  if ([bool]$planBundle.OperationalComplete) {
    throw "plan-only bundle should set OperationalComplete=false"
  }
  if ($planBundle.Summary.PlanOnly -lt 2) {
    throw "plan-only bundle should report plan-only artifacts"
  }
  Assert-ManifestHash -Bundle $planBundle -Name "plan-only bundle"

  & (Join-Path $PSScriptRoot "write-release-evidence-bundle.ps1") `
    -OutputFile $incompleteBundleFile `
    -ReleaseId "release-test-incomplete" `
    -PreflightFile $preflightFile `
    -DeployAuditFile $deployFile `
    -AllowIncomplete | Out-Null
  if (-not (Test-Path $incompleteBundleFile)) {
    throw "write-release-evidence-bundle.ps1 did not write incomplete bundle"
  }

  $incompleteBundle = Get-Content -Raw $incompleteBundleFile | ConvertFrom-Json
  if ([bool]$incompleteBundle.Complete) {
    throw "incomplete bundle should set Complete=false"
  }
  if ($incompleteBundle.Summary.Missing -ne 3) {
    throw "incomplete bundle should report three missing artifacts"
  }
  Assert-ManifestHash -Bundle $incompleteBundle -Name "incomplete bundle"

  Copy-Item -LiteralPath $bundleFile -Destination $tamperBundleFile -Force
  Add-Content -Path $deployFile -Value "tampered" -Encoding ascii
  $tamperOutput = powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot "write-release-evidence-bundle.ps1") -VerifyExisting -BundleFile $tamperBundleFile 2>$null
  if ($LASTEXITCODE -eq 0) {
    throw "VerifyExisting must fail after an artifact is tampered"
  }
  $tamperText = (@($tamperOutput) -join "`n").Trim()
  if ($tamperText) {
    $tamperVerification = $tamperText | ConvertFrom-Json
    if ($tamperVerification.Summary.Failed -lt 1) {
      throw "VerifyExisting tamper result must report failed artifacts"
    }
  }

  Write-Output "release evidence bundle ok"
} finally {
  foreach ($path in $tempPaths) {
    if (Test-Path $path) {
      Remove-Item -LiteralPath $path -Force
    }
  }
}
