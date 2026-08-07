$ErrorActionPreference = "Stop"

function New-TempPath {
  param([string]$Extension)
  return Join-Path $env:TEMP "memesee-release-artifacts-$([guid]::NewGuid().ToString('N'))$Extension"
}

$tempPaths = New-Object System.Collections.Generic.List[string]

try {
  $artifactDir = Join-Path $env:TEMP "memesee-release-artifacts-$([guid]::NewGuid().ToString('N'))"
  $preflightFile = Join-Path $artifactDir "production-preflight.json"
  $portableArtifactDir = $artifactDir -replace "\\", "/"
  $portablePreflightFile = $preflightFile -replace "\\", "/"
  $bundleFile = New-TempPath -Extension ".bundle.json"
  $tempPaths.Add($artifactDir) | Out-Null
  $tempPaths.Add($bundleFile) | Out-Null

  & (Join-Path $PSScriptRoot "verify-production-preflight.ps1") `
    -EnvFile "deploy/.env.production.example" `
    -AllowPlaceholders `
    -SkipRollbackPlan `
    -ReleaseId "release-suggestion-test" `
    -ArtifactDir $artifactDir `
    -OutputFile $preflightFile | Out-Null

  if (-not (Test-Path $preflightFile)) {
    throw "preflight did not write suggested output file"
  }

  $preflight = Get-Content -Raw $preflightFile | ConvertFrom-Json
  if ($preflight.ReleaseId -ne "release-suggestion-test") {
    throw "preflight must preserve explicit ReleaseId"
  }
  if (-not $preflight.SuggestedArtifacts) {
    throw "preflight must include SuggestedArtifacts"
  }
  if (-not $preflight.SuggestedArtifacts.ProductionEvidenceRequirement) {
    throw "preflight must include ProductionEvidenceRequirement"
  }
  if (-not [bool]$preflight.SuggestedArtifacts.ProductionEvidenceRequirement.RequireOperationalComplete) {
    throw "preflight ProductionEvidenceRequirement must require operational completion"
  }
  if ($preflight.SuggestedArtifacts.ProductionEvidenceRequirement.RequiredPlanOnly -ne 0) {
    throw "preflight ProductionEvidenceRequirement must require zero plan-only artifacts"
  }
  if ($preflight.SuggestedArtifacts.Directory -ne $portableArtifactDir) {
    throw "preflight SuggestedArtifacts must preserve ArtifactDir"
  }
  if ($preflight.SuggestedArtifacts.PreflightFile -ne $portablePreflightFile) {
    throw "preflight SuggestedArtifacts must point at its OutputFile"
  }

  foreach ($name in @(
    "DeployAuditFile",
    "DeployLaunchAuditFile",
    "PostLaunchFile",
    "ContentPrivacyFile",
    "EvidenceBundleFile",
    "EvidenceBundleVerificationFile",
    "ArchiveVerificationFile"
  )) {
    if (-not $preflight.SuggestedArtifacts.$name) {
      throw "preflight SuggestedArtifacts is missing $name"
    }
  }

  if ($preflight.SuggestedArtifacts.Commands.EvidenceBundle -notmatch [regex]::Escape("write-release-evidence-bundle.ps1")) {
    throw "preflight SuggestedArtifacts must include evidence bundle command"
  }
  if ($preflight.SuggestedArtifacts.Commands.EvidenceBundle -notmatch [regex]::Escape("-DeployLaunchAuditFile")) {
    throw "preflight SuggestedArtifacts must include deploy launch audit in evidence bundle command"
  }
  if ($preflight.SuggestedArtifacts.Commands.EvidenceBundle -notmatch [regex]::Escape($preflight.SuggestedArtifacts.DeployLaunchAuditFile)) {
    throw "preflight evidence bundle command must point at the suggested launch audit file"
  }
  if ($preflight.SuggestedArtifacts.Commands.ContentPrivacy -notmatch [regex]::Escape("verify-content-privacy-regression.ps1")) {
    throw "preflight SuggestedArtifacts must include content privacy command"
  }
  if ($preflight.SuggestedArtifacts.Commands.ContentPrivacy -notmatch [regex]::Escape("-OutputFile")) {
    throw "preflight content privacy command must write a JSON artifact"
  }
  if ($preflight.SuggestedArtifacts.Commands.ContentPrivacy -notmatch [regex]::Escape($preflight.SuggestedArtifacts.ContentPrivacyFile)) {
    throw "preflight content privacy command must point at the suggested content privacy file"
  }
  if ($preflight.SuggestedArtifacts.Commands.EvidenceBundle -notmatch [regex]::Escape("-ContentPrivacyFile")) {
    throw "preflight SuggestedArtifacts must include content privacy artifact in evidence bundle command"
  }
  if ($preflight.SuggestedArtifacts.Commands.EvidenceBundle -notmatch [regex]::Escape($preflight.SuggestedArtifacts.ContentPrivacyFile)) {
    throw "preflight evidence bundle command must point at the suggested content privacy file"
  }
  if ($preflight.SuggestedArtifacts.Commands.VerifyEvidenceBundle -notmatch [regex]::Escape("-VerifyExisting")) {
    throw "preflight SuggestedArtifacts must include evidence bundle verification command"
  }
  if ($preflight.SuggestedArtifacts.Commands.VerifyEvidenceBundle -notmatch [regex]::Escape($preflight.SuggestedArtifacts.EvidenceBundleFile)) {
    throw "preflight evidence verification command must point at the suggested bundle file"
  }
  if ($preflight.SuggestedArtifacts.Commands.VerifyEvidenceBundle -notmatch [regex]::Escape($preflight.SuggestedArtifacts.EvidenceBundleVerificationFile)) {
    throw "preflight evidence verification command must write the suggested verification file"
  }
  if ($preflight.SuggestedArtifacts.Commands.VerifyReleaseArchive -notmatch [regex]::Escape("verify-release-evidence-archive.ps1")) {
    throw "preflight SuggestedArtifacts must include release archive verification command"
  }
  if ($preflight.SuggestedArtifacts.Commands.VerifyReleaseArchive -notmatch [regex]::Escape($preflight.SuggestedArtifacts.Directory)) {
    throw "preflight release archive verification command must point at the suggested artifact directory"
  }
  if ($preflight.SuggestedArtifacts.Commands.VerifyReleaseArchive -notmatch [regex]::Escape($preflight.SuggestedArtifacts.ArchiveVerificationFile)) {
    throw "preflight release archive verification command must write the suggested archive verification file"
  }
  if ($preflight.SuggestedArtifacts.Commands.VerifyReleaseArchive -notmatch [regex]::Escape("-RequireOperationalComplete")) {
    throw "preflight release archive verification command must require operational completion"
  }
  if ($preflight.SuggestedArtifacts.Commands.Deploy -notmatch [regex]::Escape("DEPLOY_AUDIT_FILE=")) {
    throw "preflight SuggestedArtifacts must include deploy audit env wiring"
  }

  & (Join-Path $PSScriptRoot "write-release-evidence-bundle.ps1") `
    -ReleaseId $preflight.ReleaseId `
    -PreflightFile $preflight.SuggestedArtifacts.PreflightFile `
    -DeployAuditFile $preflight.SuggestedArtifacts.DeployAuditFile `
    -DeployLaunchAuditFile $preflight.SuggestedArtifacts.DeployLaunchAuditFile `
    -PostLaunchFile $preflight.SuggestedArtifacts.PostLaunchFile `
    -ContentPrivacyFile $preflight.SuggestedArtifacts.ContentPrivacyFile `
    -OutputFile $bundleFile `
    -AllowIncomplete | Out-Null

  $bundle = Get-Content -Raw $bundleFile | ConvertFrom-Json
  if ($bundle.Action -ne "ReleaseEvidenceBundle") {
    throw "suggested artifact paths must be accepted by evidence bundle writer"
  }
  if ($bundle.Summary.Ok -ne 1 -or $bundle.Summary.Missing -ne 4) {
    throw "suggested artifact path bundle should report one present and four missing artifacts"
  }

  Write-Output "release artifact suggestions ok"
} finally {
  foreach ($path in $tempPaths) {
    if (Test-Path $path) {
      Remove-Item -LiteralPath $path -Recurse -Force
    }
  }
}
