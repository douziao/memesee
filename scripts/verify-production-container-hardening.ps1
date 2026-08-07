$ErrorActionPreference = "Stop"

function Assert-Contains {
  param(
    [string]$Content,
    [string]$Pattern,
    [string]$Description,
    [string]$Path
  )

  if ($Content -notmatch $Pattern) {
    throw "$Path is missing $Description"
  }
}

function Get-ServiceBlock {
  param(
    [string]$Content,
    [string]$ServiceName,
    [string]$Path
  )

  $pattern = "(?ms)^  $([regex]::Escape($ServiceName)):\r?\n(?<body>.*?)(?=^  [A-Za-z0-9_-]+:\r?\n|\z)"
  $match = [regex]::Match($Content, $pattern)
  if (-not $match.Success) {
    throw "$Path is missing service $ServiceName"
  }
  return $match.Groups["body"].Value
}

$backendDockerfilePath = "backend/Dockerfile"
$mediaWorkerDockerfilePath = "media-worker/Dockerfile"
$prodComposePath = "docker-compose.prod.yml"

foreach ($path in @($backendDockerfilePath, $mediaWorkerDockerfilePath, $prodComposePath)) {
  if (-not (Test-Path $path)) {
    throw "missing $path"
  }
}

$backendDockerfile = Get-Content -Raw $backendDockerfilePath
$mediaWorkerDockerfile = Get-Content -Raw $mediaWorkerDockerfilePath
$prodCompose = Get-Content -Raw $prodComposePath

Assert-Contains `
  -Content $backendDockerfile `
  -Path $backendDockerfilePath `
  -Description "system runtime user creation" `
  -Pattern "(?m)^\s*&&\s+useradd\s+--system\s+--gid\s+memesee\s+--home-dir\s+/app\s+--shell\s+/usr/sbin/nologin\s+memesee\s*\\?$"
Assert-Contains `
  -Content $backendDockerfile `
  -Path $backendDockerfilePath `
  -Description "non-root backend runtime user" `
  -Pattern "(?m)^\s*USER\s+memesee\s*$"
Assert-Contains `
  -Content $backendDockerfile `
  -Path $backendDockerfilePath `
  -Description "backend app jar ownership" `
  -Pattern "(?m)^\s*COPY\s+--from=build\s+--chown=memesee:memesee\s+"

Assert-Contains `
  -Content $mediaWorkerDockerfile `
  -Path $mediaWorkerDockerfilePath `
  -Description "non-root media-worker runtime user" `
  -Pattern "(?m)^\s*USER\s+node\s*$"
Assert-Contains `
  -Content $mediaWorkerDockerfile `
  -Path $mediaWorkerDockerfilePath `
  -Description "media-worker source ownership" `
  -Pattern "(?m)^\s*COPY\s+--chown=node:node\s+src\s+\./src\s*$"
Assert-Contains `
  -Content $mediaWorkerDockerfile `
  -Path $mediaWorkerDockerfilePath `
  -Description "direct node worker entrypoint" `
  -Pattern '(?m)^\s*CMD\s+\["node",\s*"src/worker\.js"\]\s*$'

foreach ($serviceName in @("user-service", "content-service", "gateway-service", "media-worker", "frontend")) {
  $serviceBlock = Get-ServiceBlock -Content $prodCompose -ServiceName $serviceName -Path $prodComposePath
  Assert-Contains `
    -Content $serviceBlock `
    -Path $prodComposePath `
    -Description "$serviceName no-new-privileges security option" `
    -Pattern "(?ms)security_opt:\s*\r?\n\s*-\s*no-new-privileges:true"
}

Write-Output "production container hardening ok"
