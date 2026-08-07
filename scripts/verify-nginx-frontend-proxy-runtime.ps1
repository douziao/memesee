param(
  [string]$FrontendImageTag = "memesee-frontend:proxy-runtime-check",
  [string]$FrontendContainerName = "memesee-frontend-proxy-runtime-check",
  [string]$ShareContainerName = "memesee-share-proxy-runtime-check",
  [string]$NginxContainerName = "memesee-nginx-proxy-runtime-check",
  [string]$NetworkName = "memesee-proxy-runtime-check",
  [string]$NginxImage = "nginx:1.27-alpine",
  [ValidateSet("http", "ssl")]
  [string]$NginxConfigVariant = "http",
  [int]$FrontendHostPort = 3101,
  [int]$NginxHostPort = 3180,
  [int]$NginxHttpsHostPort = 3443,
  [int]$TimeoutSec = 30,
  [switch]$PullBaseImages,
  [switch]$KeepFrontendImage,
  [switch]$KeepContainers
)

$ErrorActionPreference = "Stop"

function Invoke-Docker {
  param([string[]]$Arguments)

  & docker @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "docker $($Arguments -join ' ') failed with exit code $LASTEXITCODE"
  }
}

function Stop-ContainerIfExists {
  param([string]$Name)

  $containerId = docker ps -a --filter "name=^/${Name}$" --format "{{.ID}}"
  if ($containerId) {
    docker rm -f $Name | Out-Null
  }
}

function Remove-NetworkIfExists {
  param([string]$Name)

  $networkId = docker network ls --filter "name=^${Name}$" --format "{{.ID}}"
  if ($networkId) {
    docker network rm $Name | Out-Null
  }
}

function Join-Url {
  param(
    [string]$BaseUrl,
    [string]$Path
  )

  $normalizedBase = $BaseUrl.TrimEnd("/")
  $normalizedPath = if ($Path.StartsWith("/")) { $Path } else { "/$Path" }
  return "$normalizedBase$normalizedPath"
}

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

function New-TemporaryCertificatePem {
  param([string]$Directory)

  if ($PSVersionTable.PSEdition -ne "Core") {
    throw "SSL proxy runtime verification requires PowerShell 7+ because Windows PowerShell cannot export PEM private keys. Run with pwsh."
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
    $san.AddIpAddress([System.Net.IPAddress]::Parse("127.0.0.1"))
    $request.CertificateExtensions.Add($san.Build())
    $request.CertificateExtensions.Add(
      [System.Security.Cryptography.X509Certificates.X509BasicConstraintsExtension]::new($false, $false, 0, $true)
    )
    $request.CertificateExtensions.Add(
      [System.Security.Cryptography.X509Certificates.X509KeyUsageExtension]::new(
        [System.Security.Cryptography.X509Certificates.X509KeyUsageFlags]::DigitalSignature,
        $true
      )
    )

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
}

function Invoke-RuntimeWebRequest {
  param(
    [string]$Url,
    [hashtable]$Headers = @{},
    [int]$TimeoutSec
  )

  $requestParams = @{
    Uri = $Url
    Method = "GET"
    UseBasicParsing = $true
    TimeoutSec = $TimeoutSec
  }
  if ($Headers.Count -gt 0) {
    $requestParams.Headers = $Headers
  }
  $uri = [Uri]$Url
  if ($uri.Scheme -eq "https") {
    $requestParams.SkipCertificateCheck = $true
  }

  Invoke-WebRequest @requestParams
}

function Wait-UrlReady {
  param(
    [string]$Url,
    [string]$Name,
    [int]$TimeoutSec
  )

  $deadline = (Get-Date).AddSeconds($TimeoutSec)
  $lastError = $null
  while ((Get-Date) -lt $deadline) {
    try {
      $response = Invoke-RuntimeWebRequest -Url $Url -TimeoutSec 2
      if ([int]$response.StatusCode -ge 200 -and [int]$response.StatusCode -lt 300) {
        return
      }
    } catch {
      $lastError = $_.Exception.Message
    }
    Start-Sleep -Milliseconds 500
  }

  throw "$Name did not become ready within ${TimeoutSec}s. Last error: $lastError"
}

function Assert-AppShellRoute {
  param(
    [string]$BaseUrl,
    [string]$Path,
    [string]$Name,
    [int]$TimeoutSec
  )

  $url = Join-Url -BaseUrl $BaseUrl -Path $Path
  $response = Invoke-RuntimeWebRequest -Url $url -TimeoutSec $TimeoutSec
  if ([int]$response.StatusCode -lt 200 -or [int]$response.StatusCode -ge 400) {
    throw "$Name returned HTTP $($response.StatusCode): $url"
  }

  $cacheControl = @($response.Headers["Cache-Control"]) -join ", "
  if ($cacheControl -notmatch "no-cache") {
    throw "$Name Cache-Control must include no-cache, got '$cacheControl': $url"
  }
  if ($response.Content -notmatch '<div\s+id="root"\s*>') {
    throw "$Name did not return the frontend app shell: $url"
  }

  [PSCustomObject]@{
    Name = $Name
    Url = $url
    StatusCode = [int]$response.StatusCode
    CacheControl = $cacheControl
    XFrameOptions = @($response.Headers["X-Frame-Options"]) -join ", "
    XContentTypeOptions = @($response.Headers["X-Content-Type-Options"]) -join ", "
    StrictTransportSecurity = @($response.Headers["Strict-Transport-Security"]) -join ", "
  }
}

function Assert-ShareCrawlerRoute {
  param(
    [string]$BaseUrl,
    [string]$Path,
    [string]$ExpectedUpstreamUri,
    [string]$Name,
    [int]$TimeoutSec
  )

  $url = Join-Url -BaseUrl $BaseUrl -Path $Path
  $response = Invoke-RuntimeWebRequest `
    -Url $url `
    -Headers @{ "User-Agent" = "Twitterbot/1.0" } `
    -TimeoutSec $TimeoutSec
  if ([int]$response.StatusCode -lt 200 -or [int]$response.StatusCode -ge 400) {
    throw "$Name returned HTTP $($response.StatusCode): $url"
  }

  $contentType = @($response.Headers["Content-Type"]) -join ", "
  if ($contentType -notmatch "text/html") {
    throw "$Name Content-Type must include text/html, got '$contentType': $url"
  }
  if ($response.Content -notmatch '<meta\s+property="og:title"') {
    throw "$Name did not return share HTML with og:title: $url"
  }
  if ($response.Content -match '<div\s+id="root"\s*>') {
    throw "$Name unexpectedly returned the frontend app shell: $url"
  }
  if ($response.Content -notmatch '<meta\s+property="og:url"') {
    throw "$Name did not return share HTML with og:url: $url"
  }
  $escapedExpectedUpstreamUri = [regex]::Escape($ExpectedUpstreamUri)
  if ($response.Content -notmatch $escapedExpectedUpstreamUri) {
    throw "$Name share HTML did not preserve upstream URI '$ExpectedUpstreamUri': $url"
  }

  $actualUpstreamUri = @($response.Headers["X-Memesee-Mock-Share-Uri"]) -join ", "
  if ($actualUpstreamUri -ne $ExpectedUpstreamUri) {
    throw "$Name expected upstream URI '$ExpectedUpstreamUri', got '$actualUpstreamUri': $url"
  }

  [PSCustomObject]@{
    Name = $Name
    Url = $url
    StatusCode = [int]$response.StatusCode
    ContentType = $contentType
    UpstreamUri = $actualUpstreamUri
    ShareHtmlContainsUpstreamUri = $true
  }
}

function Assert-HttpsRedirectRoute {
  param(
    [string]$BaseUrl,
    [string]$Path,
    [string]$ExpectedLocation,
    [string]$Name,
    [int]$TimeoutSec
  )

  $url = Join-Url -BaseUrl $BaseUrl -Path $Path
  $handler = [System.Net.Http.HttpClientHandler]::new()
  $handler.AllowAutoRedirect = $false
  $client = [System.Net.Http.HttpClient]::new($handler)
  $client.Timeout = [TimeSpan]::FromSeconds($TimeoutSec)
  $request = [System.Net.Http.HttpRequestMessage]::new([System.Net.Http.HttpMethod]::Get, $url)
  $request.Headers.Host = "memesee.world"

  try {
    $response = $client.SendAsync($request).GetAwaiter().GetResult()
    if ([int]$response.StatusCode -ne 301) {
      throw "$Name must return HTTP 301, got HTTP $([int]$response.StatusCode): $url"
    }

    $actualLocation = [string]$response.Headers.Location
    if ($actualLocation -ne $ExpectedLocation) {
      throw "$Name expected Location '$ExpectedLocation', got '$actualLocation': $url"
    }

    [PSCustomObject]@{
      Name = $Name
      Url = $url
      StatusCode = [int]$response.StatusCode
      Location = $actualLocation
    }
  } finally {
    if ($response) {
      $response.Dispose()
    }
    $request.Dispose()
    $client.Dispose()
    $handler.Dispose()
  }
}

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$frontendDir = Join-Path $repoRoot "frontend"
$nginxConfigFile = if ($NginxConfigVariant -eq "ssl") { "memesee.world.ssl.conf" } else { "memesee.world.http.conf" }
$nginxConfigPath = Join-Path $repoRoot "deploy/nginx/$nginxConfigFile"
$frontendUrl = "http://127.0.0.1:$FrontendHostPort"
$nginxHttpUrl = "http://127.0.0.1:$NginxHostPort"
$nginxUrl = if ($NginxConfigVariant -eq "ssl") { "https://127.0.0.1:$NginxHttpsHostPort" } else { "http://127.0.0.1:$NginxHostPort" }
$buildPullFlag = if ($PullBaseImages) { "--pull=true" } else { "--pull=false" }
$tempNginxConfig = Join-Path ([System.IO.Path]::GetTempPath()) "memesee-nginx-proxy-runtime-$([Guid]::NewGuid().ToString('N')).conf"
$tempShareConfig = Join-Path ([System.IO.Path]::GetTempPath()) "memesee-share-proxy-runtime-$([Guid]::NewGuid().ToString('N')).conf"
$tempCertDir = Join-Path ([System.IO.Path]::GetTempPath()) "memesee-nginx-proxy-runtime-cert-$([Guid]::NewGuid().ToString('N'))"

try {
  if ($NginxConfigVariant -eq "ssl") {
    New-TemporaryCertificatePem -Directory $tempCertDir
  }

  Stop-ContainerIfExists -Name $NginxContainerName
  Stop-ContainerIfExists -Name $ShareContainerName
  Stop-ContainerIfExists -Name $FrontendContainerName
  Remove-NetworkIfExists -Name $NetworkName

  Invoke-Docker -Arguments @(
    "network",
    "create",
    $NetworkName
  )

  Invoke-Docker -Arguments @(
    "build",
    $buildPullFlag,
    "-t",
    $FrontendImageTag,
    $frontendDir
  )

  $frontendRunArgs = @(
    "run",
    "-d",
    "--name",
    $FrontendContainerName,
    "--network",
    $NetworkName,
    "-p",
    "127.0.0.1:${FrontendHostPort}:80",
    $FrontendImageTag
  )
  if (-not $KeepContainers) {
    $frontendRunArgs = @("run", "-d", "--rm") + $frontendRunArgs[2..($frontendRunArgs.Count - 1)]
  }
  Invoke-Docker -Arguments $frontendRunArgs
  Wait-UrlReady -Url (Join-Url -BaseUrl $frontendUrl -Path "/healthz") -Name "frontend container" -TimeoutSec $TimeoutSec
  $frontendInspect = (docker inspect $FrontendContainerName | ConvertFrom-Json)[0]
  $frontendNetwork = $frontendInspect.NetworkSettings.Networks.PSObject.Properties[$NetworkName].Value
  $frontendContainerIp = [string]$frontendNetwork.IPAddress
  if (-not $frontendContainerIp) {
    throw "Unable to resolve frontend container IP on $NetworkName"
  }

  $shareContent = @"
server {
  listen 80;
  server_name _;
  location / {
    default_type text/html;
    add_header X-Memesee-Mock-Share-Uri "`$request_uri" always;
    return 200 '<!doctype html><html><head><meta property="og:title" content="mock share"><meta property="og:url" content="https://memesee.world`$request_uri"><link rel="canonical" href="https://memesee.world`$request_uri"></head><body data-request-uri="`$request_uri">share `$request_uri</body></html>';
  }
}
"@
  [System.IO.File]::WriteAllText($tempShareConfig, $shareContent, [System.Text.UTF8Encoding]::new($false))

  $shareRunArgs = @(
    "run",
    "-d",
    "--name",
    $ShareContainerName,
    "--network",
    $NetworkName,
    "-v",
    "${tempShareConfig}:/etc/nginx/conf.d/default.conf:ro",
    $NginxImage
  )
  if (-not $KeepContainers) {
    $shareRunArgs = @("run", "-d", "--rm") + $shareRunArgs[2..($shareRunArgs.Count - 1)]
  }
  Invoke-Docker -Arguments $shareRunArgs
  $shareInspect = (docker inspect $ShareContainerName | ConvertFrom-Json)[0]
  $shareNetwork = $shareInspect.NetworkSettings.Networks.PSObject.Properties[$NetworkName].Value
  $shareContainerIp = [string]$shareNetwork.IPAddress
  if (-not $shareContainerIp) {
    throw "Unable to resolve share container IP on $NetworkName"
  }

  $nginxContent = Get-Content -Raw $nginxConfigPath
  $nginxContent = $nginxContent -replace "proxy_pass\s+http://127\.0\.0\.1:3000;", "proxy_pass http://${frontendContainerIp}:80;"
  $nginxContent = $nginxContent -replace "proxy_pass\s+http://127\.0\.0\.1:8080;", "proxy_pass http://${shareContainerIp}:80;"
  [System.IO.File]::WriteAllText($tempNginxConfig, $nginxContent, [System.Text.UTF8Encoding]::new($false))

  $nginxRunArgs = @(
    "run",
    "-d",
    "--name",
    $NginxContainerName,
    "--network",
    $NetworkName,
    "-p",
    "127.0.0.1:${NginxHostPort}:80"
  )
  if ($NginxConfigVariant -eq "ssl") {
    $nginxRunArgs += @(
      "-p",
      "127.0.0.1:${NginxHttpsHostPort}:443",
      "-v",
      "${tempCertDir}:/etc/letsencrypt/live/memesee.world:ro"
    )
  }
  $nginxRunArgs += @(
    "-v",
    "${tempNginxConfig}:/etc/nginx/conf.d/default.conf:ro",
    $NginxImage
  )
  if (-not $KeepContainers) {
    $nginxRunArgs = @("run", "-d", "--rm") + $nginxRunArgs[2..($nginxRunArgs.Count - 1)]
  }
  Invoke-Docker -Arguments $nginxRunArgs
  Wait-UrlReady -Url $nginxUrl -Name "outer nginx container" -TimeoutSec $TimeoutSec

  $checks = @(
    Assert-AppShellRoute -BaseUrl $nginxUrl -Path "/" -Name "outer nginx frontend index" -TimeoutSec $TimeoutSec
    Assert-AppShellRoute -BaseUrl $nginxUrl -Path "/posts/42" -Name "outer nginx post route" -TimeoutSec $TimeoutSec
    Assert-AppShellRoute -BaseUrl $nginxUrl -Path "/compose" -Name "outer nginx compose route" -TimeoutSec $TimeoutSec
    Assert-ShareCrawlerRoute -BaseUrl $nginxUrl -Path "/posts/42" -ExpectedUpstreamUri "/share/posts/42" -Name "outer nginx crawler post share route" -TimeoutSec $TimeoutSec
    Assert-ShareCrawlerRoute -BaseUrl $nginxUrl -Path "/posts/42?subPost=7" -ExpectedUpstreamUri "/share/posts/42?subPost=7" -Name "outer nginx crawler sub-post share route" -TimeoutSec $TimeoutSec
  )
  if ($NginxConfigVariant -eq "ssl") {
    $checks += @(
      Assert-HttpsRedirectRoute -BaseUrl $nginxHttpUrl -Path "/posts/42" -ExpectedLocation "https://memesee.world/posts/42" -Name "outer nginx http post redirect" -TimeoutSec $TimeoutSec
      Assert-HttpsRedirectRoute -BaseUrl $nginxHttpUrl -Path "/posts/42?subPost=7" -ExpectedLocation "https://memesee.world/posts/42?subPost=7" -Name "outer nginx http sub-post redirect" -TimeoutSec $TimeoutSec
    )
  }

  [PSCustomObject]@{
    NginxConfigVariant = $NginxConfigVariant
    FrontendUrl = $frontendUrl
    NginxHttpUrl = $nginxHttpUrl
    NginxUrl = $nginxUrl
    Checks = $checks
  } | ConvertTo-Json -Depth 4
} finally {
  if (-not $KeepContainers) {
    Stop-ContainerIfExists -Name $NginxContainerName
    Stop-ContainerIfExists -Name $ShareContainerName
    Stop-ContainerIfExists -Name $FrontendContainerName
    Remove-NetworkIfExists -Name $NetworkName
  }
  if ((-not $KeepContainers) -and (Test-Path $tempNginxConfig)) {
    Remove-Item -LiteralPath $tempNginxConfig -Force
  }
  if ((-not $KeepContainers) -and (Test-Path $tempShareConfig)) {
    Remove-Item -LiteralPath $tempShareConfig -Force
  }
  if ((-not $KeepContainers) -and (Test-Path $tempCertDir)) {
    Remove-Item -LiteralPath $tempCertDir -Recurse -Force
  }
  if (-not $KeepFrontendImage -and -not $KeepContainers) {
    docker rmi $FrontendImageTag 2>$null | Out-Null
  }
}
