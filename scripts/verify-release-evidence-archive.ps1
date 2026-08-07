param(
  [string]$ArtifactDir = "",
  [string]$ReleaseId = "",
  [string]$OutputFile = "",
  [switch]$AllowIncomplete,
  [switch]$RequireOperationalComplete
)

$ErrorActionPreference = "Stop"

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

function Get-JsonProperty {
  param(
    [object]$Value,
    [string]$Name
  )

  if ($null -eq $Value) {
    return $null
  }
  if ($Value.PSObject.Properties.Name -contains $Name) {
    return $Value.$Name
  }
  return $null
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
  param([object]$Bundle)

  if (-not $Bundle.Manifest) {
    throw "release-evidence.json is missing Manifest"
  }
  if ($Bundle.Manifest.SchemaVersion -ne 1) {
    throw "release-evidence.json Manifest must include SchemaVersion=1"
  }
  if ($Bundle.Manifest.Algorithm -ne "SHA256") {
    throw "release-evidence.json Manifest must use SHA256"
  }

  $manifestPayload = New-ManifestPayload -Bundle $Bundle
  $manifestJson = $manifestPayload | ConvertTo-Json -Depth 30 -Compress
  $expectedSha = ConvertTo-Sha256Hex -Value $manifestJson
  if ($Bundle.Manifest.Sha256 -ne $expectedSha) {
    throw "release-evidence.json Manifest SHA256 mismatch"
  }
}

function Get-PortableLeafName {
  param([string]$Path)

  if (-not $Path) {
    return ""
  }
  $parts = ($Path -replace "\\", "/").Split("/")
  return $parts[$parts.Length - 1]
}

function Get-ExpectedArtifactFileName {
  param([object]$Artifact)

  $leaf = Get-PortableLeafName -Path ([string]$Artifact.Path)
  if ($leaf) {
    return $leaf
  }

  switch ([string]$Artifact.Name) {
    "preflight" { return "production-preflight.json" }
    "deploy" { return "deploy-audit.json" }
    "deploy-launch" { return "deploy-audit.launch.json" }
    "post-launch" { return "post-launch-monitoring.json" }
    "content-privacy" { return "content-privacy-regression.json" }
    default { return "$($Artifact.Name).json" }
  }
}

function Read-JsonFile {
  param([string]$Path)

  return Get-Content -Raw $Path | ConvertFrom-Json
}

function Test-ArchiveArtifact {
  param(
    [string]$Directory,
    [object]$Artifact
  )

  $fileName = Get-ExpectedArtifactFileName -Artifact $Artifact
  $path = Join-Path $Directory $fileName
  if (-not [bool]$Artifact.Present) {
    return [ordered]@{
      Name = $Artifact.Name
      FileName = $fileName
      Path = $path
      Status = "SKIPPED"
      Detail = "artifact was not present when bundle was generated"
      PlanOnly = [bool]$Artifact.PlanOnly
    }
  }
  if (-not (Test-Path $path)) {
    return [ordered]@{
      Name = $Artifact.Name
      FileName = $fileName
      Path = $path
      Status = "MISSING"
      Detail = "artifact file is missing from archive directory"
      PlanOnly = [bool]$Artifact.PlanOnly
    }
  }

  $actualSha = (Get-FileHash -Algorithm SHA256 -Path $path).Hash
  if ($actualSha -ne ([string]$Artifact.Sha256)) {
    return [ordered]@{
      Name = $Artifact.Name
      FileName = $fileName
      Path = $path
      Status = "MISMATCH"
      ExpectedSha256 = $Artifact.Sha256
      ActualSha256 = $actualSha
      PlanOnly = [bool]$Artifact.PlanOnly
    }
  }

  try {
    $payload = Read-JsonFile -Path $path
  } catch {
    return [ordered]@{
      Name = $Artifact.Name
      FileName = $fileName
      Path = $path
      Status = "INVALID"
      Detail = "artifact is not valid JSON: $($_.Exception.Message)"
      Sha256 = $actualSha
      PlanOnly = [bool]$Artifact.PlanOnly
    }
  }

  $actualAction = [string](Get-JsonProperty -Value $payload -Name "Action")
  if ($actualAction -ne ([string]$Artifact.Action)) {
    return [ordered]@{
      Name = $Artifact.Name
      FileName = $fileName
      Path = $path
      Status = "INVALID"
      Detail = "artifact Action '$actualAction' does not match bundle Action '$($Artifact.Action)'"
      Sha256 = $actualSha
      PlanOnly = [bool]$Artifact.PlanOnly
    }
  }

  return [ordered]@{
    Name = $Artifact.Name
    FileName = $fileName
    Path = $path
    Status = "OK"
    Sha256 = $actualSha
    Action = $actualAction
    PlanOnly = [bool]$Artifact.PlanOnly
  }
}

function Test-VerificationFile {
  param(
    [string]$Path,
    [string]$ExpectedReleaseId
  )

  if (-not (Test-Path $Path)) {
    return [ordered]@{
      FileName = "release-evidence.verification.json"
      Path = $Path
      Status = "MISSING"
      Detail = "release evidence verification file is missing"
    }
  }

  try {
    $payload = Read-JsonFile -Path $Path
  } catch {
    return [ordered]@{
      FileName = "release-evidence.verification.json"
      Path = $Path
      Status = "INVALID"
      Detail = "verification file is not valid JSON: $($_.Exception.Message)"
    }
  }

  if ($payload.Action -ne "ReleaseEvidenceBundleVerification") {
    return [ordered]@{
      FileName = "release-evidence.verification.json"
      Path = $Path
      Status = "INVALID"
      Detail = "unexpected Action '$($payload.Action)'"
    }
  }
  if ($ExpectedReleaseId -and $payload.ReleaseId -ne $ExpectedReleaseId) {
    return [ordered]@{
      FileName = "release-evidence.verification.json"
      Path = $Path
      Status = "INVALID"
      Detail = "verification ReleaseId '$($payload.ReleaseId)' does not match bundle ReleaseId '$ExpectedReleaseId'"
    }
  }
  if ($payload.Summary -and $payload.Summary.Failed -gt 0) {
    return [ordered]@{
      FileName = "release-evidence.verification.json"
      Path = $Path
      Status = "FAILED"
      Detail = "archived bundle verification reported failed artifacts"
      Sha256 = (Get-FileHash -Algorithm SHA256 -Path $Path).Hash
    }
  }

  return [ordered]@{
    FileName = "release-evidence.verification.json"
    Path = $Path
    Status = "OK"
    ReleaseId = $payload.ReleaseId
    Sha256 = (Get-FileHash -Algorithm SHA256 -Path $Path).Hash
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
    $json | Set-Content -Path $Path -Encoding ascii
  }
  $json
}

function Invoke-ArchiveVerification {
  param(
    [string]$Directory,
    [string]$ExpectedReleaseId = "",
    [string]$ResultFile = "",
    [bool]$AllowIncompleteArchive = $false,
    [bool]$RequireOperationalCompleteArchive = $false
  )

  if (-not $Directory) {
    throw "ArtifactDir is required"
  }
  if (-not (Test-Path $Directory)) {
    throw "missing artifact directory: $Directory"
  }

  $resolvedDirectory = (Resolve-Path $Directory).Path
  $bundleFile = Join-Path $resolvedDirectory "release-evidence.json"
  if (-not (Test-Path $bundleFile)) {
    throw "missing release evidence bundle: $bundleFile"
  }

  $bundle = Read-JsonFile -Path $bundleFile
  if ($bundle.Action -ne "ReleaseEvidenceBundle") {
    throw "release-evidence.json is not a ReleaseEvidenceBundle"
  }
  Assert-ManifestHash -Bundle $bundle
  if ($ExpectedReleaseId -and $bundle.ReleaseId -ne $ExpectedReleaseId) {
    throw "bundle ReleaseId '$($bundle.ReleaseId)' does not match expected '$ExpectedReleaseId'"
  }

  $artifactResults = @($bundle.Artifacts | ForEach-Object {
    Test-ArchiveArtifact -Directory $resolvedDirectory -Artifact $_
  })
  $verificationFile = Join-Path $resolvedDirectory "release-evidence.verification.json"
  $verificationResult = Test-VerificationFile -Path $verificationFile -ExpectedReleaseId $bundle.ReleaseId

  $failedArtifacts = @($artifactResults | Where-Object { $_.Status -in @("MISSING", "MISMATCH", "INVALID") })
  $failedSupportFiles = @($verificationResult | Where-Object { $_.Status -in @("MISSING", "INVALID", "FAILED") })
  $bundleIncomplete = (-not [bool]$bundle.Complete)
  $operationalIncomplete = ($RequireOperationalCompleteArchive -and -not [bool]$bundle.OperationalComplete)
  $failedCount = $failedArtifacts.Count + $failedSupportFiles.Count
  if ($bundleIncomplete -and -not $AllowIncompleteArchive) {
    $failedCount += 1
  }
  if ($operationalIncomplete) {
    $failedCount += 1
  }
  $status = if ($failedCount -eq 0) { "OK" } else { "FAILED" }

  $result = [ordered]@{
    Action = "ReleaseEvidenceArchiveVerification"
    AuditSchemaVersion = 1
    Status = $status
    ArtifactDir = $resolvedDirectory
    VerifiedAt = (Get-Date).ToUniversalTime().ToString("o")
    ReleaseId = $bundle.ReleaseId
    Bundle = [ordered]@{
      FileName = "release-evidence.json"
      Path = $bundleFile
      Complete = [bool]$bundle.Complete
      OperationalComplete = [bool]$bundle.OperationalComplete
      OperationalCompleteRequired = $RequireOperationalCompleteArchive
      ManifestStatus = "OK"
      Sha256 = (Get-FileHash -Algorithm SHA256 -Path $bundleFile).Hash
    }
    Verification = $verificationResult
    Summary = [ordered]@{
      Ok = @($artifactResults | Where-Object { $_.Status -eq "OK" }).Count
      Skipped = @($artifactResults | Where-Object { $_.Status -eq "SKIPPED" }).Count
      Missing = @($artifactResults | Where-Object { $_.Status -eq "MISSING" }).Count + @($verificationResult | Where-Object { $_.Status -eq "MISSING" }).Count
      Invalid = @($artifactResults | Where-Object { $_.Status -eq "INVALID" }).Count + @($verificationResult | Where-Object { $_.Status -eq "INVALID" }).Count
      HashMismatch = @($artifactResults | Where-Object { $_.Status -eq "MISMATCH" }).Count
      PlanOnly = @($artifactResults | Where-Object { $_.PlanOnly }).Count
      Failed = $failedCount
      Complete = ([bool]$bundle.Complete -or $AllowIncompleteArchive)
      OperationalComplete = [bool]$bundle.OperationalComplete
      OperationalCompleteRequired = $RequireOperationalCompleteArchive
      OperationalIncomplete = $operationalIncomplete
    }
    Artifacts = $artifactResults
    Safety = [ordered]@{
      ReadsProductionData = $false
      WritesProductionData = $false
      DeletesProductionData = $false
      RequiresConfirmDestructive = $false
    }
  }

  Write-JsonResult -Value $result -Path $ResultFile
  if ($status -ne "OK") {
    exit 1
  }
}

function New-TempArchivePath {
  return Join-Path $env:TEMP "memesee-release-archive-$([guid]::NewGuid().ToString('N'))"
}

function Write-JsonArtifact {
  param(
    [string]$Path,
    [object]$Value
  )

  $Value | ConvertTo-Json -Depth 20 | Set-Content -Path $Path -Encoding ascii
}

function Invoke-SelfTest {
  $sourceDir = New-TempArchivePath
  $copyDir = New-TempArchivePath
  $planDir = New-TempArchivePath
  $outputFile = Join-Path $copyDir "release-archive.verification.json"

  try {
    New-Item -ItemType Directory -Path $sourceDir | Out-Null
    New-Item -ItemType Directory -Path $copyDir | Out-Null
    New-Item -ItemType Directory -Path $planDir | Out-Null

    $preflightFile = Join-Path $sourceDir "production-preflight.json"
    $deployFile = Join-Path $sourceDir "deploy-audit.json"
    $launchFile = Join-Path $sourceDir "deploy-audit.launch.json"
    $postLaunchFile = Join-Path $sourceDir "post-launch-monitoring.json"
    $contentPrivacyFile = Join-Path $sourceDir "content-privacy-regression.json"
    $bundleFile = Join-Path $sourceDir "release-evidence.json"
    $verificationFile = Join-Path $sourceDir "release-evidence.verification.json"

    Write-JsonArtifact -Path $preflightFile -Value ([ordered]@{
      Action = "ProductionPreflight"
      ReleaseId = "archive-test"
      Summary = [ordered]@{ Ok = 5; Skipped = 0; Failed = 0 }
    })
    Write-JsonArtifact -Path $deployFile -Value ([ordered]@{
      Action = "RegularDeploy"
      AuditSchemaVersion = 1
      Status = "OK"
    })
    Write-JsonArtifact -Path $launchFile -Value ([ordered]@{
      Action = "ProductionLaunchVerification"
      AuditSchemaVersion = 1
      Status = "OK"
    })
    Write-JsonArtifact -Path $postLaunchFile -Value ([ordered]@{
      Action = "ProductionPostLaunchMonitoring"
      Summary = [ordered]@{ Ok = 1; Failed = 0 }
    })
    Write-JsonArtifact -Path $contentPrivacyFile -Value ([ordered]@{
      Action = "ContentPrivacyRegressionVerification"
      AuditSchemaVersion = 1
      Status = "OK"
      GeneratedAt = "2026-06-08T00:00:00Z"
      Summary = [ordered]@{ Ok = 42; Failed = 0 }
    })

    & (Join-Path $PSScriptRoot "write-release-evidence-bundle.ps1") `
      -OutputFile $bundleFile `
      -ReleaseId "archive-test" `
      -PreflightFile $preflightFile `
      -DeployAuditFile $deployFile `
      -DeployLaunchAuditFile $launchFile `
      -PostLaunchFile $postLaunchFile `
      -ContentPrivacyFile $contentPrivacyFile | Out-Null
    & (Join-Path $PSScriptRoot "write-release-evidence-bundle.ps1") `
      -VerifyExisting `
      -BundleFile $bundleFile `
      -OutputFile $verificationFile | Out-Null

    Copy-Item -Path (Join-Path $sourceDir "*") -Destination $copyDir -Force
    $result = Invoke-ArchiveVerification -Directory $copyDir -ExpectedReleaseId "archive-test" -ResultFile $outputFile
    $payload = $result | ConvertFrom-Json
    if ($payload.Action -ne "ReleaseEvidenceArchiveVerification" -or $payload.Status -ne "OK") {
      throw "archive verification should pass after archive directory is relocated"
    }
    if (-not [bool]$payload.Bundle.OperationalComplete -or $payload.Summary.PlanOnly -ne 0) {
      throw "archive verification should preserve operational-complete release evidence semantics"
    }
    $requiredResult = Invoke-ArchiveVerification -Directory $copyDir -ExpectedReleaseId "archive-test" -RequireOperationalCompleteArchive $true
    $requiredPayload = $requiredResult | ConvertFrom-Json
    if ($requiredPayload.Status -ne "OK" -or -not [bool]$requiredPayload.Summary.OperationalCompleteRequired) {
      throw "archive verification should pass operational-complete archives when required"
    }
    if (-not (Test-Path $outputFile)) {
      throw "archive verification should write OutputFile"
    }

    Copy-Item -Path (Join-Path $sourceDir "*") -Destination $planDir -Force
    $planLaunchFile = Join-Path $planDir "deploy-audit.launch.json"
    $planPostLaunchFile = Join-Path $planDir "post-launch-monitoring.json"
    $planBundleFile = Join-Path $planDir "release-evidence.json"
    $planVerificationFile = Join-Path $planDir "release-evidence.verification.json"
    Write-JsonArtifact -Path $planLaunchFile -Value ([ordered]@{
      Action = "ProductionLaunchVerification"
      AuditSchemaVersion = 1
      Status = "PLAN"
      DryRun = $true
    })
    Write-JsonArtifact -Path $planPostLaunchFile -Value ([ordered]@{
      Action = "ProductionPostLaunchMonitoringPlan"
      DryRun = $true
      Summary = [ordered]@{ Ok = 1; Failed = 0 }
    })
    & (Join-Path $PSScriptRoot "write-release-evidence-bundle.ps1") `
      -OutputFile $planBundleFile `
      -ReleaseId "archive-test" `
      -PreflightFile (Join-Path $planDir "production-preflight.json") `
      -DeployAuditFile (Join-Path $planDir "deploy-audit.json") `
      -DeployLaunchAuditFile $planLaunchFile `
      -PostLaunchFile $planPostLaunchFile `
      -ContentPrivacyFile (Join-Path $planDir "content-privacy-regression.json") | Out-Null
    & (Join-Path $PSScriptRoot "write-release-evidence-bundle.ps1") `
      -VerifyExisting `
      -BundleFile $planBundleFile `
      -OutputFile $planVerificationFile | Out-Null
    $planResult = Invoke-ArchiveVerification -Directory $planDir -ExpectedReleaseId "archive-test"
    $planPayload = $planResult | ConvertFrom-Json
    if ($planPayload.Status -ne "OK" -or [bool]$planPayload.Bundle.OperationalComplete -or $planPayload.Summary.PlanOnly -lt 2) {
      throw "archive verification should report plan-only archives without failing by default"
    }
    $requiredPlanOutput = powershell -NoProfile -ExecutionPolicy Bypass -File $PSCommandPath -ArtifactDir $planDir -ReleaseId "archive-test" -RequireOperationalComplete 2>$null
    if ($LASTEXITCODE -eq 0) {
      throw "archive verification must fail plan-only archives when operational completion is required"
    }
    $requiredPlanText = (@($requiredPlanOutput) -join "`n").Trim()
    if ($requiredPlanText) {
      $requiredPlanPayload = $requiredPlanText | ConvertFrom-Json
      if (-not [bool]$requiredPlanPayload.Summary.OperationalIncomplete -or $requiredPlanPayload.Summary.Failed -lt 1) {
        throw "operational-complete failure must be visible in archive verification summary"
      }
    }

    Write-JsonArtifact -Path (Join-Path $copyDir "deploy-audit.launch.json") -Value ([ordered]@{
      Action = "ProductionLaunchVerification"
      AuditSchemaVersion = 1
      Status = "FAILED"
    })
    $tamperOutput = powershell -NoProfile -ExecutionPolicy Bypass -File $PSCommandPath -ArtifactDir $copyDir -ReleaseId "archive-test" 2>$null
    if ($LASTEXITCODE -eq 0) {
      throw "archive verification must fail after an archived artifact changes"
    }
    $tamperText = (@($tamperOutput) -join "`n").Trim()
    if ($tamperText) {
      $tamperPayload = $tamperText | ConvertFrom-Json
      if ($tamperPayload.Summary.HashMismatch -lt 1 -and $tamperPayload.Summary.Failed -lt 1) {
        throw "archive tamper result must report failed verification"
      }
    }

    Write-Output "release evidence archive ok"
  } finally {
    foreach ($path in @($sourceDir, $copyDir, $planDir)) {
      if (Test-Path $path) {
        Remove-Item -LiteralPath $path -Recurse -Force
      }
    }
  }
}

if (-not $ArtifactDir) {
  Invoke-SelfTest
  return
}

Invoke-ArchiveVerification `
  -Directory $ArtifactDir `
  -ExpectedReleaseId $ReleaseId `
  -ResultFile $OutputFile `
  -AllowIncompleteArchive ([bool]$AllowIncomplete) `
  -RequireOperationalCompleteArchive ([bool]$RequireOperationalComplete)
