param(
  [string]$NginxImage = "nginx:1.27-alpine"
)

$ErrorActionPreference = "Stop"

function Invoke-Docker {
  param([string[]]$Arguments)

  & docker @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "docker $($Arguments -join ' ') failed with exit code $LASTEXITCODE"
  }
}

function New-TemporaryCertificatePem {
  param([string]$Directory)

  $pwsh = Get-Command pwsh -ErrorAction SilentlyContinue
  if (-not $pwsh) {
    throw "nginx SSL configuration verification requires pwsh to generate a temporary PEM certificate without network access"
  }

  New-Item -ItemType Directory -Force -Path $Directory | Out-Null
  $generatorPath = Join-Path ([System.IO.Path]::GetTempPath()) "memesee-nginx-cert-$([Guid]::NewGuid().ToString('N')).ps1"
  @'
param([string]$Directory)

function ConvertTo-Pem {
  param(
    [string]$Label,
    [byte[]]$Bytes
  )

  $base64 = [Convert]::ToBase64String($Bytes)
  $lines = New-Object System.Collections.Generic.List[string]
  $lines.Add("-----BEGIN $Label-----") | Out-Null
  for ($index = 0; $index -lt $base64.Length; $index += 64) {
    $length = [Math]::Min(64, $base64.Length - $index)
    $lines.Add($base64.Substring($index, $length)) | Out-Null
  }
  $lines.Add("-----END $Label-----") | Out-Null
  return ($lines -join "`n") + "`n"
}

New-Item -ItemType Directory -Force -Path $Directory | Out-Null
$rsa = [System.Security.Cryptography.RSA]::Create(2048)
try {
  $request = [System.Security.Cryptography.X509Certificates.CertificateRequest]::new(
    "CN=memesee.world",
    $rsa,
    [System.Security.Cryptography.HashAlgorithmName]::SHA256,
    [System.Security.Cryptography.RSASignaturePadding]::Pkcs1
  )
  $san = [System.Security.Cryptography.X509Certificates.SubjectAlternativeNameBuilder]::new()
  $san.AddDnsName("memesee.world")
  $san.AddDnsName("www.memesee.world")
  $request.CertificateExtensions.Add($san.Build())
  $certificate = $request.CreateSelfSigned((Get-Date).AddDays(-1), (Get-Date).AddDays(7))
  try {
    $certificatePem = ConvertTo-Pem -Label "CERTIFICATE" -Bytes $certificate.Export([System.Security.Cryptography.X509Certificates.X509ContentType]::Cert)
    $privateKeyPem = ConvertTo-Pem -Label "PRIVATE KEY" -Bytes $rsa.ExportPkcs8PrivateKey()
    [System.IO.File]::WriteAllText((Join-Path $Directory "fullchain.pem"), $certificatePem, [System.Text.UTF8Encoding]::new($false))
    [System.IO.File]::WriteAllText((Join-Path $Directory "privkey.pem"), $privateKeyPem, [System.Text.UTF8Encoding]::new($false))
  } finally {
    $certificate.Dispose()
  }
} finally {
  $rsa.Dispose()
}
'@ | Set-Content -Path $generatorPath -Encoding ascii

  try {
    & pwsh -NoProfile -File $generatorPath $Directory
    if ($LASTEXITCODE -ne 0) {
      throw "temporary certificate generation failed with exit code $LASTEXITCODE"
    }
  } finally {
    if (Test-Path $generatorPath) {
      Remove-Item -LiteralPath $generatorPath -Force
    }
  }
}

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$nginxDir = (Resolve-Path (Join-Path $repoRoot "deploy/nginx")).Path
$httpConfig = (Resolve-Path (Join-Path $nginxDir "memesee.world.http.conf")).Path
$sslConfig = (Resolve-Path (Join-Path $nginxDir "memesee.world.ssl.conf")).Path

if (-not (Test-Path $sslConfig)) {
  throw "Missing nginx SSL config: $sslConfig"
}

function Assert-ConfigContains {
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

function Assert-ProductionNginxConfig {
  param(
    [string]$Path,
    [switch]$Ssl
  )

  $content = Get-Content -Raw $Path
  $mediaLocationPattern = "(?s)location\s+/media/\s*\{.*?proxy_pass\s+http://127\.0\.0\.1:9000/memesee-post-images/;.*?add_header\s+Cache-Control\s+`"public,\s*max-age=31536000,\s*immutable`"\s+always;.*?\}"
  Assert-ConfigContains -Content $content -Pattern $mediaLocationPattern -Description "immutable /media/ reverse proxy cache policy" -Path $Path
  Assert-ConfigContains -Content $content -Pattern "(?s)location\s+/media/\s*\{.*?proxy_force_ranges\s+on;.*?\}" -Description "/media/ range request support" -Path $Path
  Assert-ConfigContains -Content $content -Pattern "(?s)location\s+/media/\s*\{.*?add_header\s+Accept-Ranges\s+bytes\s+always;.*?\}" -Description "/media/ Accept-Ranges header" -Path $Path
  Assert-ConfigContains -Content $content -Pattern "(?s)location\s+/media/\s*\{.*?add_header\s+X-Content-Type-Options\s+`"nosniff`"\s+always;.*?\}" -Description "/media/ nosniff header" -Path $Path
  Assert-ConfigContains -Content $content -Pattern "(?s)location\s+/\s*\{.*?proxy_pass\s+http://127\.0\.0\.1:3000;.*?\}" -Description "frontend SPA reverse proxy" -Path $Path
  Assert-ConfigContains -Content $content -Pattern "(?s)location\s+/\s*\{.*?proxy_set_header\s+Host\s+[$]host;.*?\}" -Description "frontend Host forwarding" -Path $Path
  Assert-ConfigContains -Content $content -Pattern "(?s)location\s+/\s*\{.*?proxy_set_header\s+X-Forwarded-Host\s+[$]host;.*?\}" -Description "frontend forwarded host header" -Path $Path
  Assert-ConfigContains -Content $content -Pattern "(?s)map\s+[$]http_user_agent\s+[$]memesee_share_bot\s*\{.*?Twitterbot.*?Discordbot.*?TelegramBot.*?\}" -Description "share bot user-agent map" -Path $Path
  Assert-ConfigContains -Content $content -Pattern "(?s)location\s+/share/\s*\{.*?proxy_pass\s+http://127\.0\.0\.1:8080;.*?\}" -Description "share HTML gateway reverse proxy" -Path $Path
  Assert-ConfigContains -Content $content -Pattern "location\s+~\s+\^/posts/\[0-9\]\+/\?\$" -Description "numeric post route override" -Path $Path
  Assert-ConfigContains -Content $content -Pattern "(?s)location\s+~\s+\^/posts/\[0-9\]\+/\?\$.*?error_page\s+418\s+=\s+@memesee_share_post;" -Description "post route share-bot fork" -Path $Path
  Assert-ConfigContains -Content $content -Pattern "(?s)location\s+~\s+\^/posts/\[0-9\]\+/\?\$.*?return\s+418;" -Description "post route share-bot internal redirect" -Path $Path
  Assert-ConfigContains -Content $content -Pattern "(?s)location\s+~\s+\^/posts/\[0-9\]\+/\?\$.*?proxy_pass\s+http://127\.0\.0\.1:3000;" -Description "post route human SPA fallback" -Path $Path
  Assert-ConfigContains -Content $content -Pattern '(?m)^\s*rewrite\s+\^/posts/\(\[0-9\]\+\)/\?\$\s+/share/posts/\$1\s+break;' -Description "post share HTML internal rewrite" -Path $Path
  Assert-ConfigContains -Content $content -Pattern "(?s)location\s+@memesee_share_post\s*\{.*?proxy_pass\s+http://127\.0\.0\.1:8080;" -Description "post share HTML gateway proxy" -Path $Path
  Assert-ConfigContains -Content $content -Pattern "(?m)add_header\s+X-Content-Type-Options\s+`"nosniff`"\s+always;" -Description "X-Content-Type-Options security header" -Path $Path
  Assert-ConfigContains -Content $content -Pattern "(?m)add_header\s+X-Frame-Options\s+`"DENY`"\s+always;" -Description "X-Frame-Options security header" -Path $Path
  Assert-ConfigContains -Content $content -Pattern "(?m)add_header\s+Referrer-Policy\s+`"strict-origin-when-cross-origin`"\s+always;" -Description "Referrer-Policy security header" -Path $Path

  if ($Ssl) {
    Assert-ConfigContains -Content $content -Pattern "(?m)^\s*http2\s+on;" -Description "HTTP/2 enablement" -Path $Path
    Assert-ConfigContains -Content $content -Pattern "(?m)add_header\s+Strict-Transport-Security\s+`"max-age=31536000;\s*includeSubDomains`"\s+always;" -Description "HSTS header" -Path $Path
  }
}

Assert-ProductionNginxConfig -Path $httpConfig
Assert-ProductionNginxConfig -Path $sslConfig -Ssl

Invoke-Docker -Arguments @(
  "run",
  "--rm",
  "-v",
  "${httpConfig}:/etc/nginx/conf.d/default.conf:ro",
  "--entrypoint",
  "nginx",
  $NginxImage,
  "-t"
)

$tempCertDir = Join-Path ([System.IO.Path]::GetTempPath()) "memesee-nginx-config-cert-$([Guid]::NewGuid().ToString('N'))"
New-TemporaryCertificatePem -Directory $tempCertDir

$sslValidationCommand = @"
cp /input/memesee.world.ssl.conf /etc/nginx/conf.d/default.conf &&
nginx -t
"@

try {
  Invoke-Docker -Arguments @(
    "run",
    "--rm",
    "-v",
    "${nginxDir}:/input:ro",
    "-v",
    "${tempCertDir}:/etc/letsencrypt/live/memesee.world:ro",
    "--entrypoint",
    "sh",
    $NginxImage,
    "-c",
    $sslValidationCommand
  )
} finally {
  if (Test-Path $tempCertDir) {
    Remove-Item -LiteralPath $tempCertDir -Recurse -Force
  }
}

Write-Output "nginx configuration ok"
