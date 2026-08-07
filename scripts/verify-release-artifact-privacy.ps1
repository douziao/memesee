$ErrorActionPreference = "Stop"

function Assert-Contains {
  param(
    [string]$Content,
    [string]$Pattern,
    [string]$Description,
    [string]$Path
  )

  if (-not $Content.Contains($Pattern)) {
    throw "$Path is missing $Description`: $Pattern"
  }
}

function Assert-DoesNotContain {
  param(
    [string]$Content,
    [string]$Pattern,
    [string]$Description,
    [string]$Path
  )

  if ($Content.Contains($Pattern)) {
    throw "$Path unexpectedly contains $Description`: $Pattern"
  }
}

$gitignorePath = ".gitignore"
$preflightPath = Join-Path "scripts" "verify-production-preflight.ps1"
$readmePath = "README.md"

foreach ($path in @($gitignorePath, $preflightPath, $readmePath)) {
  if (-not (Test-Path $path)) {
    throw "missing $path"
  }
}

$gitignore = Get-Content -Raw $gitignorePath
$preflight = Get-Content -Raw $preflightPath
$readme = Get-Content -Raw -Encoding UTF8 $readmePath

Assert-Contains `
  -Content $gitignore `
  -Pattern "deploy/release-artifacts/" `
  -Description "release evidence artifact ignore rule" `
  -Path $gitignorePath

Assert-Contains `
  -Content $preflight `
  -Pattern 'Join-Path "deploy/release-artifacts" $ReleaseId' `
  -Description "default release artifact directory" `
  -Path $preflightPath

Assert-Contains `
  -Content $preflight `
  -Pattern "SuggestedArtifacts = [ordered]@" `
  -Description "preflight suggested artifact payload" `
  -Path $preflightPath

Assert-Contains `
  -Content $readme `
  -Pattern "deploy/release-artifacts/" `
  -Description "release artifact documentation" `
  -Path $readmePath

Assert-Contains `
  -Content $readme `
  -Pattern "do not commit these artifacts" `
  -Description "release artifact privacy warning" `
  -Path $readmePath

$trackedArtifactFiles = @(git ls-files "deploy/release-artifacts/*" 2>$null)
if ($trackedArtifactFiles.Count -gt 0) {
  throw "release artifacts are tracked and may contain production evidence: $($trackedArtifactFiles -join ', ')"
}

$statusArtifactFiles = @(git status --short -- "deploy/release-artifacts" 2>$null)
if ($statusArtifactFiles.Count -gt 0) {
  throw "release artifacts are visible to git status despite .gitignore: $($statusArtifactFiles -join ', ')"
}

Assert-DoesNotContain `
  -Content $gitignore `
  -Pattern "!deploy/release-artifacts/" `
  -Description "release artifact unignore rule" `
  -Path $gitignorePath

Write-Output "release artifact privacy ok"
