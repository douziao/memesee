param(
  [string]$OutputFile,
  [string]$ReleaseId = "",
  [string]$EnvFile = "",
  [string]$PreflightFile = "",
  [string]$DeployAuditFile = "",
  [string]$DeployLaunchAuditFile = "",
  [string]$PostLaunchFile = "",
  [string]$ContentPrivacyFile = "",
  [switch]$AllowIncomplete,
  [switch]$VerifyExisting,
  [string]$BundleFile = ""
)

$ErrorActionPreference = "Stop"

function Resolve-OptionalPath {
  param([string]$Path)

  if (-not $Path) {
    return ""
  }
  if (Test-Path $Path) {
    return (Resolve-Path $Path).Path
  }
  return $Path
}

function Read-JsonArtifact {
  param([string]$Path)

  return Get-Content -Raw $Path | ConvertFrom-Json
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

function Test-ObjectProperty {
  param(
    [object]$Value,
    [string]$Name
  )

  if ($null -eq $Value) {
    return $false
  }
  if ($Value -is [System.Collections.IDictionary]) {
    return $Value.Contains($Name)
  }
  return $Value.PSObject.Properties.Name -contains $Name
}

function Test-ArtifactFailure {
  param([object]$Payload)

  $status = [string](Get-JsonProperty -Value $Payload -Name "Status")
  if ($status -eq "FAILED") {
    return $true
  }

  $summary = Get-JsonProperty -Value $Payload -Name "Summary"
  if ($summary -and $summary.PSObject.Properties.Name -contains "Failed") {
    return ([int]$summary.Failed) -gt 0
  }

  return $false
}

function Test-TruthyJsonValue {
  param([object]$Value)

  if ($null -eq $Value) {
    return $false
  }
  if ($Value -is [bool]) {
    return [bool]$Value
  }

  $text = ([string]$Value).Trim().ToLowerInvariant()
  return $text -in @("true", "1", "yes")
}

function Test-PlanOnlyArtifact {
  param(
    [object]$Payload,
    [string]$Action,
    [string]$Status
  )

  $evidence = Get-JsonProperty -Value $Payload -Name "Evidence"
  if (Test-ObjectProperty -Value $evidence -Name "PlanOnly") {
    return Test-TruthyJsonValue -Value (Get-JsonProperty -Value $evidence -Name "PlanOnly")
  }

  $dryRun = Get-JsonProperty -Value $Payload -Name "DryRun"
  return (
    $Status.Trim().ToUpperInvariant() -eq "PLAN" -or
    (Test-TruthyJsonValue -Value $dryRun) -or
    $Action -eq "ProductionPostLaunchMonitoringPlan"
  )
}

function New-ArtifactRecord {
  param(
    [string]$Name,
    [string]$Path,
    [string[]]$ExpectedActions
  )

  $resolvedPath = Resolve-OptionalPath -Path $Path
  if (-not $resolvedPath -or -not (Test-Path $resolvedPath)) {
    return [ordered]@{
      Name = $Name
      Path = $resolvedPath
      Present = $false
      Valid = $false
      Outcome = "MISSING"
      Detail = "artifact is missing"
      PlanOnly = $false
    }
  }

  try {
    $payload = Read-JsonArtifact -Path $resolvedPath
  } catch {
    return [ordered]@{
      Name = $Name
      Path = $resolvedPath
      Present = $true
      Valid = $false
      Outcome = "INVALID"
      Detail = "artifact is not valid JSON: $($_.Exception.Message)"
      PlanOnly = $false
    }
  }

  $action = [string](Get-JsonProperty -Value $payload -Name "Action")
  $status = [string](Get-JsonProperty -Value $payload -Name "Status")
  $planOnly = Test-PlanOnlyArtifact -Payload $payload -Action $action -Status $status
  $actionValid = $ExpectedActions -contains $action
  $failed = Test-ArtifactFailure -Payload $payload
  $outcome = "OK"
  $detail = ""

  if (-not $actionValid) {
    $outcome = "INVALID"
    $detail = "unexpected Action '$action'"
  } elseif ($failed) {
    $outcome = "FAILED"
    $detail = "artifact reports failed checks"
  }

  return [ordered]@{
    Name = $Name
    Path = $resolvedPath
    Present = $true
    Valid = ($actionValid -and -not $failed)
    Outcome = $outcome
    Detail = $detail
    PlanOnly = $planOnly
    Sha256 = (Get-FileHash -Algorithm SHA256 -Path $resolvedPath).Hash
    Action = $action
    AuditSchemaVersion = Get-JsonProperty -Value $payload -Name "AuditSchemaVersion"
    Status = $status
    DryRun = Get-JsonProperty -Value $payload -Name "DryRun"
    Evidence = Get-JsonProperty -Value $payload -Name "Evidence"
    StartedAt = Get-JsonProperty -Value $payload -Name "StartedAt"
    CompletedAt = Get-JsonProperty -Value $payload -Name "CompletedAt"
    GeneratedAt = Get-JsonProperty -Value $payload -Name "GeneratedAt"
    Summary = Get-JsonProperty -Value $payload -Name "Summary"
  }
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
  param(
    [string]$ReleaseId,
    [bool]$Complete,
    [object]$OperationalComplete = $null,
    [object]$Summary,
    [object[]]$Artifacts
  )

  $payload = [ordered]@{
    ReleaseId = $ReleaseId
    Complete = $Complete
  }
  if ($PSBoundParameters.ContainsKey("OperationalComplete")) {
    $payload.OperationalComplete = [bool]$OperationalComplete
  }
  $payload.Summary = $Summary
  $payload.Artifacts = @($Artifacts | ForEach-Object {
      $artifactPayload = [ordered]@{
        Name = $_.Name
        Path = $_.Path
        Present = $_.Present
        Valid = $_.Valid
        Outcome = $_.Outcome
      }
      if (Test-ObjectProperty -Value $_ -Name "PlanOnly") {
        $artifactPayload.PlanOnly = [bool]$_.PlanOnly
      }
      $artifactPayload.Sha256 = $_.Sha256
      $artifactPayload.Action = $_.Action
      $artifactPayload.AuditSchemaVersion = $_.AuditSchemaVersion
      $artifactPayload.Status = $_.Status
      $artifactPayload.DryRun = $_.DryRun
      if (Test-ObjectProperty -Value $_ -Name "Evidence") {
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
    throw "bundle is missing Manifest"
  }
  if ($Bundle.Manifest.SchemaVersion -ne 1) {
    throw "bundle Manifest must include SchemaVersion=1"
  }
  if ($Bundle.Manifest.Algorithm -ne "SHA256") {
    throw "bundle Manifest must use SHA256"
  }

  $manifestParams = @{
    ReleaseId = $Bundle.ReleaseId
    Complete = [bool]$Bundle.Complete
    Summary = $Bundle.Summary
    Artifacts = @($Bundle.Artifacts)
  }
  if ($Bundle.PSObject.Properties.Name -contains "OperationalComplete") {
    $manifestParams.OperationalComplete = [bool]$Bundle.OperationalComplete
  }
  $manifestPayload = New-ManifestPayload @manifestParams
  $manifestJson = $manifestPayload | ConvertTo-Json -Depth 30 -Compress
  $expectedSha = ConvertTo-Sha256Hex -Value $manifestJson
  if ($Bundle.Manifest.Sha256 -ne $expectedSha) {
    throw "bundle Manifest SHA256 mismatch"
  }
}

function Test-ExistingArtifactHashes {
  param([object]$Bundle)

  $results = @($Bundle.Artifacts | ForEach-Object {
    $artifact = $_
    $expected = [string]$artifact.Sha256
    $path = [string]$artifact.Path

    if (-not [bool]$artifact.Present) {
      [ordered]@{
        Name = $artifact.Name
        Path = $path
        Status = "SKIPPED"
        Detail = "artifact was not present when bundle was generated"
        PlanOnly = [bool]$artifact.PlanOnly
      }
      return
    }
    if (-not $path -or -not (Test-Path $path)) {
      [ordered]@{
        Name = $artifact.Name
        Path = $path
        Status = "MISSING"
        Detail = "artifact file is missing"
        PlanOnly = [bool]$artifact.PlanOnly
      }
      return
    }

    $actual = (Get-FileHash -Algorithm SHA256 -Path $path).Hash
    if ($actual -ne $expected) {
      [ordered]@{
        Name = $artifact.Name
        Path = $path
        Status = "MISMATCH"
        ExpectedSha256 = $expected
        ActualSha256 = $actual
        PlanOnly = [bool]$artifact.PlanOnly
      }
      return
    }

    [ordered]@{
      Name = $artifact.Name
      Path = $path
      Status = "OK"
      Sha256 = $actual
      PlanOnly = [bool]$artifact.PlanOnly
    }
  })

  return $results
}

if ($VerifyExisting) {
  if (-not $BundleFile) {
    if ($OutputFile) {
      $BundleFile = $OutputFile
    } else {
      throw "BundleFile is required with -VerifyExisting"
    }
  }
  if (-not (Test-Path $BundleFile)) {
    throw "missing bundle file: $BundleFile"
  }

  $bundle = Get-Content -Raw $BundleFile | ConvertFrom-Json
  if ($bundle.Action -ne "ReleaseEvidenceBundle") {
    throw "BundleFile is not a ReleaseEvidenceBundle: $BundleFile"
  }
  Assert-ManifestHash -Bundle $bundle
  $artifactResults = @(Test-ExistingArtifactHashes -Bundle $bundle)
  $failedArtifacts = @($artifactResults | Where-Object { $_.Status -in @("MISSING", "MISMATCH") })
  $result = [ordered]@{
    Action = "ReleaseEvidenceBundleVerification"
    AuditSchemaVersion = 1
    BundleFile = (Resolve-Path $BundleFile).Path
    VerifiedAt = (Get-Date).ToUniversalTime().ToString("o")
    ReleaseId = $bundle.ReleaseId
    Bundle = [ordered]@{
      Complete = [bool]$bundle.Complete
      OperationalComplete = [bool]$bundle.OperationalComplete
    }
    Manifest = [ordered]@{
      Status = "OK"
      Sha256 = $bundle.Manifest.Sha256
    }
    Summary = [ordered]@{
      Ok = @($artifactResults | Where-Object { $_.Status -eq "OK" }).Count
      Skipped = @($artifactResults | Where-Object { $_.Status -eq "SKIPPED" }).Count
      PlanOnly = @($artifactResults | Where-Object { $_.PlanOnly }).Count
      Failed = $failedArtifacts.Count
    }
    Artifacts = $artifactResults
  }

  $json = $result | ConvertTo-Json -Depth 30
  if ($OutputFile -and $BundleFile -ne $OutputFile) {
    $directory = Split-Path -Parent $OutputFile
    if ($directory -and -not (Test-Path $directory)) {
      New-Item -ItemType Directory -Path $directory | Out-Null
    }
    $json | Set-Content -Path $OutputFile -Encoding ascii
  }
  $json
  if ($failedArtifacts.Count -gt 0) {
    exit 1
  }
  return
}

if (-not $OutputFile) {
  throw "OutputFile is required"
}

if (-not $ReleaseId) {
  $ReleaseId = "release-$((Get-Date).ToUniversalTime().ToString('yyyyMMddHHmmss'))"
}

$artifacts = @(
  New-ArtifactRecord `
    -Name "preflight" `
    -Path $PreflightFile `
    -ExpectedActions @("ProductionPreflight")
  New-ArtifactRecord `
    -Name "deploy" `
    -Path $DeployAuditFile `
    -ExpectedActions @("RegularDeploy", "DeployBlueGreen", "RollbackBlueGreen")
  New-ArtifactRecord `
    -Name "deploy-launch" `
    -Path $DeployLaunchAuditFile `
    -ExpectedActions @("ProductionLaunchVerification")
  New-ArtifactRecord `
    -Name "post-launch" `
    -Path $PostLaunchFile `
    -ExpectedActions @("ProductionPostLaunchMonitoring", "ProductionPostLaunchMonitoringPlan")
  New-ArtifactRecord `
    -Name "content-privacy" `
    -Path $ContentPrivacyFile `
    -ExpectedActions @("ContentPrivacyRegressionVerification")
)

$missing = @($artifacts | Where-Object { $_.Outcome -eq "MISSING" }).Count
$invalid = @($artifacts | Where-Object { $_.Outcome -eq "INVALID" }).Count
$failed = @($artifacts | Where-Object { $_.Outcome -eq "FAILED" }).Count
$ok = @($artifacts | Where-Object { $_.Outcome -eq "OK" }).Count
$planOnly = @($artifacts | Where-Object { $_.PlanOnly }).Count
$complete = ($missing -eq 0 -and $invalid -eq 0 -and $failed -eq 0)
$operationalComplete = ($complete -and $planOnly -eq 0)
$summary = [ordered]@{
  Ok = $ok
  Missing = $missing
  Invalid = $invalid
  Failed = $failed
  PlanOnly = $planOnly
}
$manifestPayload = New-ManifestPayload `
  -ReleaseId $ReleaseId `
  -Complete $complete `
  -OperationalComplete $operationalComplete `
  -Summary $summary `
  -Artifacts $artifacts
$manifestJson = $manifestPayload | ConvertTo-Json -Depth 30 -Compress
$manifestSha256 = ConvertTo-Sha256Hex -Value $manifestJson

$result = [ordered]@{
  Action = "ReleaseEvidenceBundle"
  AuditSchemaVersion = 1
  ReleaseId = $ReleaseId
  GeneratedAt = (Get-Date).ToUniversalTime().ToString("o")
  EnvFile = Resolve-OptionalPath -Path $EnvFile
  Complete = $complete
  OperationalComplete = $operationalComplete
  Summary = $summary
  Manifest = [ordered]@{
    SchemaVersion = 1
    Algorithm = "SHA256"
    Scope = "ReleaseId, Complete, OperationalComplete, Summary, and normalized artifact identity/status/hash fields"
    Sha256 = $manifestSha256
  }
  Artifacts = $artifacts
  Safety = [ordered]@{
    ReadsProductionData = $false
    WritesProductionData = $false
    DeletesProductionData = $false
    RequiresConfirmDestructive = $false
  }
}

$directory = Split-Path -Parent $OutputFile
if ($directory -and -not (Test-Path $directory)) {
  New-Item -ItemType Directory -Path $directory | Out-Null
}
$result | ConvertTo-Json -Depth 30 | Set-Content -Path $OutputFile -Encoding ascii
$result | ConvertTo-Json -Depth 30

if (-not $complete -and -not $AllowIncomplete) {
  exit 1
}
