param(
  [string]$EnvFile = "deploy/.env.production.example",
  [switch]$Pull
)

$ErrorActionPreference = "Stop"

function Read-EnvFileDefaults {
  param([string]$Path)

  $values = @{}
  if (-not (Test-Path $Path)) {
    return $values
  }

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

function Get-DockerfileImages {
  param(
    [string[]]$Paths,
    [hashtable]$EnvDefaults
  )

  foreach ($path in $Paths) {
    if (-not (Test-Path $path)) {
      throw "missing Dockerfile: $path"
    }
    $content = Get-Content -Raw $path
    $argDefaults = @{} + $EnvDefaults
    [regex]::Matches($content, "(?im)^\s*ARG\s+([A-Za-z_][A-Za-z0-9_]*)(?:=(\S+))?") | ForEach-Object {
      $name = $_.Groups[1].Value
      $value = $_.Groups[2].Value
      if ($value -and -not $argDefaults.ContainsKey($name)) {
        $argDefaults[$name] = $value
      }
    }
    [regex]::Matches($content, "(?im)^\s*FROM\s+([^\s]+)") | ForEach-Object {
      $rawImage = $_.Groups[1].Value
      $image = Resolve-ImageReference -Image $rawImage -Defaults $argDefaults -Source $path
      [PSCustomObject]@{
        Source = $path
        Image = $image
      }
    }
  }
}

function Get-ComposeImages {
  param(
    [string]$Path,
    [hashtable]$EnvDefaults
  )

  if (-not (Test-Path $Path)) {
    throw "missing compose file: $Path"
  }
  $content = Get-Content -Raw $Path
  [regex]::Matches($content, "(?im)^\s+image:\s+([^\s]+)") | ForEach-Object {
    $rawImage = $_.Groups[1].Value
    $image = Resolve-ImageReference -Image $rawImage -Defaults $EnvDefaults -Source $Path
    [PSCustomObject]@{
      Source = $Path
      Image = $image
    }
  }
}

function Resolve-ImageReference {
  param(
    [string]$Image,
    [hashtable]$Defaults,
    [string]$Source
  )

  $resolved = $Image
  $matches = [regex]::Matches($Image, "\$\{([A-Za-z_][A-Za-z0-9_]*)(?::-([^}]+))?\}")
  foreach ($match in $matches) {
    $name = $match.Groups[1].Value
    $inlineDefault = $match.Groups[2].Value
    $default = if ($Defaults.ContainsKey($name)) {
      $Defaults[$name]
    } elseif ($inlineDefault) {
      $inlineDefault
    } else {
      ""
    }

    if (-not $default) {
      throw "$Source image reference $Image does not provide a default for $name"
    }
    $resolved = $resolved.Replace($match.Value, $default)
  }

  if ($resolved -match "\$") {
    throw "$Source image reference is unresolved: $Image -> $resolved"
  }
  return $resolved
}

function Assert-TaggedImage {
  param(
    [string]$Image,
    [string]$Source
  )

  if ($Image -notmatch "@" -and $Image -notmatch ":[^/]+$") {
    throw "$Source uses an untagged image reference: $Image"
  }
}

function Invoke-DockerPull {
  param([string]$Image)

  & docker pull $Image
  if ($LASTEXITCODE -ne 0) {
    throw "docker pull failed for $Image"
  }
}

$envDefaults = Read-EnvFileDefaults -Path $EnvFile

$dockerfileImages = Get-DockerfileImages -Paths @(
  "backend/Dockerfile",
  "frontend/Dockerfile",
  "media-worker/Dockerfile"
) -EnvDefaults $envDefaults
$composeImages = Get-ComposeImages -Path "docker-compose.prod.yml" -EnvDefaults $envDefaults
$imageReferences = @($dockerfileImages + $composeImages)

if ($imageReferences.Count -eq 0) {
  throw "no production Docker image references found"
}

foreach ($reference in $imageReferences) {
  Assert-TaggedImage -Image $reference.Image -Source $reference.Source
}

$uniqueImages = $imageReferences |
  Select-Object -ExpandProperty Image -Unique |
  Sort-Object

if ($Pull) {
  $pullFailures = @()
  foreach ($image in $uniqueImages) {
    try {
      Invoke-DockerPull -Image $image
    } catch {
      $pullFailures += "${image}: $($_.Exception.Message)"
    }
  }
  if ($pullFailures.Count -gt 0) {
    throw "production image pull preflight failed: $($pullFailures -join '; ')"
  }
}

[PSCustomObject]@{
  EnvFile = $EnvFile
  ImageCount = $uniqueImages.Count
  PullVerified = [bool]$Pull
  Images = $uniqueImages
} | ConvertTo-Json -Depth 4
