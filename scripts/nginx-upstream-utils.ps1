function Set-LocationProxyPass {
  param(
    [string]$Content,
    [string]$LocationPattern,
    [string]$TargetUrl,
    [string]$Description
  )

  $pattern = "(?s)($LocationPattern\s*\{.*?proxy_pass\s+)http://127\.0\.0\.1:\d+(?:/memesee-post-images/)?;"
  $regex = [regex]::new($pattern)
  $matches = $regex.Matches($Content)
  if ($matches.Count -ne 1) {
    throw "Expected exactly one proxy_pass for $Description, found $($matches.Count)"
  }

  return $regex.Replace($Content, "`$1$TargetUrl;", 1)
}

function Set-NginxUpstreams {
  param(
    [string]$Path,
    [int]$Gateway,
    [int]$Frontend,
    [int]$Minio,
    [switch]$ReloadNginx
  )

  if (-not $Path) {
    return
  }
  if (-not (Test-Path $Path)) {
    throw "Nginx site path does not exist: $Path"
  }

  $content = Get-Content -Raw $Path
  $gatewayUrl = "http://127.0.0.1:$Gateway"
  $frontendUrl = "http://127.0.0.1:$Frontend"
  $mediaUrl = "http://127.0.0.1:$Minio/memesee-post-images/"

  $content = Set-LocationProxyPass -Content $content -LocationPattern 'location\s+/api/' -TargetUrl $gatewayUrl -Description "API gateway location"
  $content = Set-LocationProxyPass -Content $content -LocationPattern 'location\s+/share/' -TargetUrl $gatewayUrl -Description "share HTML location"
  $content = Set-LocationProxyPass -Content $content -LocationPattern 'location\s+@memesee_share_post' -TargetUrl $gatewayUrl -Description "share bot fallback location"
  $content = Set-LocationProxyPass -Content $content -LocationPattern 'location\s+/media/' -TargetUrl $mediaUrl -Description "media location"
  $content = Set-LocationProxyPass -Content $content -LocationPattern 'location\s+~\s+\^/posts/\[0-9\]\+/\?\$' -TargetUrl $frontendUrl -Description "post SPA location"
  $content = Set-LocationProxyPass -Content $content -LocationPattern 'location\s+/' -TargetUrl $frontendUrl -Description "frontend root location"

  Set-Content -Path $Path -Value $content -Encoding ascii

  if ($ReloadNginx) {
    & nginx -t
    if ($LASTEXITCODE -ne 0) {
      throw "nginx -t failed after writing $Path"
    }
    & nginx -s reload
    if ($LASTEXITCODE -ne 0) {
      throw "nginx reload failed"
    }
  }
}
