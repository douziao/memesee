param(
  [string]$Path = "deploy/deploy.sh",
  [switch]$RequireBash
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path $Path)) {
  throw "missing bash script: $Path"
}

$bash = Get-Command bash -ErrorAction SilentlyContinue
if (-not $bash) {
  if ($RequireBash) {
    throw "bash is required to validate $Path"
  }
  Write-Output "deploy bash syntax skipped: bash is not available"
  return
}

$process = [System.Diagnostics.Process]::new()
$process.StartInfo.FileName = $bash.Source
$escapedPath = '"' + ($Path -replace '"', '\"') + '"'
$process.StartInfo.Arguments = "-n $escapedPath"
$process.StartInfo.RedirectStandardOutput = $true
$process.StartInfo.RedirectStandardError = $true
$process.StartInfo.UseShellExecute = $false
[void]$process.Start()
$stdout = $process.StandardOutput.ReadToEnd()
$stderr = $process.StandardError.ReadToEnd()
$process.WaitForExit()
$outputText = (@($stdout, $stderr) | Where-Object { $_ } | ForEach-Object { $_.Trim() }) -join "`n"
$exitCode = $process.ExitCode
if ($exitCode -eq 0) {
  Write-Output "deploy bash syntax ok"
  return
}

$looksLikeMissingUnixBash = $outputText -match "execvpe\(/bin/bash\) failed" -or $outputText -match "No such file or directory"
if (-not $RequireBash -and $looksLikeMissingUnixBash) {
  Write-Output "deploy bash syntax skipped: bash exists but cannot launch /bin/bash in this environment"
  return
}

throw "bash -n $Path failed with exit code $exitCode`: $outputText"
