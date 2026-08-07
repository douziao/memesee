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

function Assert-FileContains {
  param(
    [string]$Path,
    [string]$Pattern,
    [string]$Description
  )

  if (-not (Test-Path $Path)) {
    throw "missing $Path"
  }
  Assert-Contains -Content (Get-Content -Raw -Encoding UTF8 $Path) -Pattern $Pattern -Description $Description -Path $Path
}

$ciWorkflow = ".github/workflows/quality.yml"
$releaseReadiness = "scripts/verify-release-readiness.ps1"
$frontendPackage = "frontend/package.json"
$bundleBudgetScript = "frontend/scripts/check-bundle-budget.mjs"
$readme = "README.md"

foreach ($scriptPath in @(
  "frontend/scripts/check-built-index-metadata.mjs",
  "frontend/scripts/check-production-routes.mjs",
  "frontend/scripts/check-production-render.mjs",
  "frontend/scripts/check-bundle-budget.mjs"
)) {
  if (-not (Test-Path $scriptPath)) {
    throw "missing frontend production quality script: $scriptPath"
  }
}

foreach ($item in @(
  @{ Pattern = "docker compose --env-file \.env\.example config"; Description = "local compose config validation" },
  @{ Pattern = "docker compose --env-file deploy/\.env\.production\.example -f docker-compose\.prod\.yml config"; Description = "production compose config validation" },
  @{ Pattern = "bash -n deploy/deploy\.sh"; Description = "deploy bash syntax validation" },
  @{ Pattern = "Get-ChildItem scripts -Filter \*\.ps1"; Description = "PowerShell syntax validation" },
  @{ Pattern = "verify-frontend-container-runtime\.ps1 -PullBaseImages"; Description = "frontend production container runtime validation" },
  @{ Pattern = "verify-content-privacy-regression\.ps1"; Description = "content privacy regression validation" },
  @{ Pattern = "verify-release-readiness\.ps1 -SkipDockerRuntime -SkipBackendTests -SkipMediaWorkerQuality -SkipFrontendQuality"; Description = "release readiness aggregate validation" },
  @{ Pattern = "verify-quality-gate-wiring\.ps1"; Description = "quality gate wiring validation" }
)) {
  Assert-FileContains -Path $ciWorkflow -Pattern $item.Pattern -Description $item.Description
}

foreach ($item in @(
  @{ Pattern = '"verify:metadata"\s*:\s*"node scripts/check-built-index-metadata\.mjs"'; Description = "frontend metadata verification script" },
  @{ Pattern = '"verify:routes"\s*:\s*"node scripts/check-production-routes\.mjs"'; Description = "frontend route synthesis verification script" },
  @{ Pattern = '"verify:render"\s*:\s*"node scripts/check-production-render\.mjs"'; Description = "frontend production render smoke script" },
  @{ Pattern = '"perf:bundle"\s*:\s*"node scripts/check-bundle-budget\.mjs"'; Description = "frontend bundle budget script" },
  @{ Pattern = '"quality"\s*:\s*"npm run audit && npm run test && npm run build && npm run verify:metadata && npm run verify:routes && npm run verify:render && npm run perf:bundle"'; Description = "frontend production checks in quality gate" }
)) {
  Assert-FileContains -Path $frontendPackage -Pattern $item.Pattern -Description $item.Description
}

foreach ($item in @(
  @{ Pattern = 'entryJsGzipBytes:\s*95 \* 1024'; Description = "frontend entry JS gzip budget" },
  @{ Pattern = 'initialJsGzipBytes:\s*120 \* 1024'; Description = "frontend initial JS gzip budget" },
  @{ Pattern = 'totalJsGzipBytes:\s*190 \* 1024'; Description = "frontend total JS gzip budget" },
  @{ Pattern = 'initialCssGzipBytes:\s*16 \* 1024'; Description = "frontend initial CSS gzip budget" },
  @{ Pattern = 'function assertLazyJsChunkContract'; Description = "lazy JS chunk contract helper" },
  @{ Pattern = 'function assertLazyCssChunkContract'; Description = "lazy CSS chunk contract helper" },
  @{ Pattern = '(?s)label:\s*"AuthModal".*?maxGzipBytes:\s*3 \* 1024'; Description = "AuthModal lazy JS gzip contract" },
  @{ Pattern = '(?s)label:\s*"FloatingActions".*?maxGzipBytes:\s*1536'; Description = "FloatingActions lazy JS gzip contract" },
  @{ Pattern = '(?s)label:\s*"sharePostLink".*?maxGzipBytes:\s*3 \* 1024'; Description = "sharePostLink lazy JS gzip contract" },
  @{ Pattern = '(?s)label:\s*"clipboard".*?maxGzipBytes:\s*1536'; Description = "clipboard lazy JS gzip contract" },
  @{ Pattern = '(?s)label:\s*"ComposerPage".*?pattern:\s*/\^ComposerPage-/i.*?maxGzipBytes:\s*9 \* 1024'; Description = "ComposerPage lazy JS gzip contract" },
  @{ Pattern = '(?s)label:\s*"ProfileCenter".*?pattern:\s*/\^ProfileCenter-/i.*?maxGzipBytes:\s*9 \* 1024'; Description = "ProfileCenter lazy JS gzip contract" },
  @{ Pattern = '(?s)label:\s*"PostDetailView".*?pattern:\s*/\^PostDetailView-/i.*?maxGzipBytes:\s*13 \* 1024'; Description = "PostDetailView lazy JS gzip contract" },
  @{ Pattern = '(?s)label:\s*"MarkdownRenderer".*?maxGzipBytes:\s*7 \* 1024'; Description = "MarkdownRenderer lazy JS gzip contract" },
  @{ Pattern = '(?s)label:\s*"ImageLightbox".*?pattern:\s*/\^ImageLightbox-/i.*?maxGzipBytes:\s*5 \* 1024'; Description = "ImageLightbox lazy JS gzip contract" },
  @{ Pattern = '(?s)label:\s*"RichGallery".*?maxGzipBytes:\s*5 \* 1024'; Description = "RichGallery lazy JS gzip contract" },
  @{ Pattern = '(?s)const lazyCssChunkContracts.*?label:\s*"ComposerPage".*?maxGzipBytes:\s*8 \* 1024'; Description = "ComposerPage lazy CSS gzip contract" },
  @{ Pattern = '(?s)const lazyCssChunkContracts.*?label:\s*"ProfileCenter".*?maxGzipBytes:\s*8 \* 1024'; Description = "ProfileCenter lazy CSS gzip contract" },
  @{ Pattern = '(?s)const lazyCssChunkContracts.*?label:\s*"PostDetailView".*?maxGzipBytes:\s*12 \* 1024'; Description = "PostDetailView lazy CSS gzip contract" },
  @{ Pattern = '(?s)const lazyCssChunkContracts.*?label:\s*"ImageLightbox".*?maxGzipBytes:\s*2 \* 1024'; Description = "ImageLightbox lazy CSS gzip contract" },
  @{ Pattern = 'markdown assets are preloaded in index\.html'; Description = "markdown initial-load regression guard" },
  @{ Pattern = 'lazy page CSS is preloaded in index\.html'; Description = "lazy page CSS initial-load regression guard" },
  @{ Pattern = 'ConfirmDialog must stay in the initial shell'; Description = "ConfirmDialog synchronous shell contract" },
  @{ Pattern = 'index\.html contains external Google font dependencies'; Description = "external font regression guard" }
)) {
  Assert-FileContains -Path $bundleBudgetScript -Pattern $item.Pattern -Description $item.Description
}

foreach ($item in @(
  @{ Pattern = 'initial JS gzip.*120 KiB'; Description = "documented frontend initial JS budget" },
  @{ Pattern = 'CSS gzip.*16 KiB'; Description = "documented frontend initial CSS budget" },
  @{ Pattern = 'AuthModal'; Description = "documented AuthModal lazy chunk contract" },
  @{ Pattern = 'FloatingActions'; Description = "documented FloatingActions lazy chunk contract" },
  @{ Pattern = 'sharePostLink'; Description = "documented sharePostLink lazy chunk contract" },
  @{ Pattern = 'clipboard'; Description = "documented clipboard lazy chunk contract" },
  @{ Pattern = 'ComposerPage'; Description = "documented ComposerPage lazy chunk contract" },
  @{ Pattern = 'ProfileCenter'; Description = "documented ProfileCenter lazy chunk contract" },
  @{ Pattern = 'PostDetailView'; Description = "documented PostDetailView lazy chunk contract" },
  @{ Pattern = 'MarkdownRenderer'; Description = "documented MarkdownRenderer lazy chunk contract" },
  @{ Pattern = 'ImageLightbox'; Description = "documented ImageLightbox lazy chunk contract" },
  @{ Pattern = 'RichGallery'; Description = "documented RichGallery lazy chunk contract" },
  @{ Pattern = 'memesee_internal_admin_operation_total'; Description = "documented internal admin operation metric" },
  @{ Pattern = 'VerifyInternalAdminMetricDefinitions'; Description = "documented internal admin metric definition verification" },
  @{ Pattern = 'DEPLOY_VERIFY_INTERNAL_ADMIN_METRICS'; Description = "documented internal admin runtime metric sample toggle" }
)) {
  Assert-FileContains -Path $readme -Pattern $item.Pattern -Description $item.Description
}

foreach ($scriptName in @(
  "verify-production-env.ps1",
  "verify-production-env-report.ps1",
  "verify-production-image-sources.ps1",
  "verify-architecture-phase1.ps1",
  "verify-architecture-phase2.ps1",
  "verify-backend-runtime-config.ps1",
  "verify-deploy-bash-syntax.ps1",
  "verify-deploy-runtime-config.ps1",
  "verify-production-runbook.ps1",
  "verify-production-audit-scripts.ps1",
  "verify-production-preflight.ps1",
  "verify-production-post-launch.ps1",
  "verify-production-launch-config.ps1",
  "verify-release-evidence-bundle.ps1",
  "verify-release-evidence-archive.ps1",
  "verify-release-artifact-suggestions.ps1",
  "verify-release-artifact-privacy.ps1",
  "verify-bluegreen-nginx-upstreams.ps1",
  "verify-production-container-hardening.ps1",
  "verify-content-db-indexes.ps1",
  "verify-content-privacy-regression.ps1",
  "verify-observability.ps1",
  "verify-prometheus-config.ps1",
  "verify-frontend-nginx-config.ps1",
  "verify-nginx-config.ps1",
  "verify-quality-gate-wiring.ps1"
)) {
  Assert-FileContains `
    -Path $releaseReadiness `
    -Pattern ([regex]::Escape($scriptName)) `
    -Description "release readiness coverage for $scriptName"
}

foreach ($skipSwitch in @(
  "SkipBackendTests",
  "SkipMediaWorkerQuality",
  "SkipFrontendQuality",
  "SkipDockerRuntime"
)) {
  Assert-FileContains -Path $releaseReadiness -Pattern $skipSwitch -Description "fast release readiness skip switch $skipSwitch"
}

Write-Output "quality gate wiring ok"
