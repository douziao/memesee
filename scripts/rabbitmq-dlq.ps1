param(
  [ValidateSet("Inspect", "Peek", "Requeue", "Purge")]
  [string]$Action = "Inspect",
  [string]$ManagementUrl = "http://127.0.0.1:15672",
  [string]$Username = $env:RABBITMQ_DEFAULT_USER,
  [string]$Password = $env:RABBITMQ_DEFAULT_PASS,
  [string]$VHost = "/",
  [string]$DlqName = "memesee.media.variant-processing.dlq",
  [string]$ReplayExchange = "memesee.media",
  [string]$ReplayRoutingKey = "media.variant.process",
  [int]$Count = 10,
  [switch]$ConfirmDestructive,
  [switch]$Plan,
  [string]$AuditFile = ""
)

$ErrorActionPreference = "Stop"
$startedAt = (Get-Date).ToUniversalTime()

function Write-JsonResult {
  param(
    [object]$Value,
    [string]$Path = ""
  )

  $json = $Value | ConvertTo-Json -Depth 20
  if ($Path) {
    $directory = Split-Path -Parent $Path
    if ($directory -and -not (Test-Path $directory)) {
      New-Item -ItemType Directory -Path $directory | Out-Null
    }
    Set-Content -Path $Path -Value $json -Encoding ascii
  }
  $json
}

if (-not $Username) {
  $Username = "memesee"
}
if ($Count -lt 1 -or $Count -gt 500) {
  throw "-Count must be between 1 and 500."
}

if ($Plan) {
  Write-JsonResult -Path $AuditFile -Value ([PSCustomObject]@{
    Action = "${Action}Plan"
    AuditSchemaVersion = 1
    DryRun = $true
    Status = "PLAN"
    GeneratedAt = (Get-Date).ToUniversalTime().ToString("o")
    ManagementUrl = $ManagementUrl
    Username = $Username
    VHost = $VHost
    DlqName = $DlqName
    Count = $Count
    ReplayExchange = if ($Action -eq "Requeue") { $ReplayExchange } else { "" }
    ReplayRoutingKey = if ($Action -eq "Requeue") { $ReplayRoutingKey } else { "" }
    RequiresConfirmDestructive = $Action -in @("Requeue", "Purge")
    ConfirmDestructiveProvided = [bool]$ConfirmDestructive
    Safety = [PSCustomObject]@{
      RequiresConfirmDestructive = $Action -in @("Requeue", "Purge")
      ConfirmDestructiveProvided = [bool]$ConfirmDestructive
      WritesProductionData = $Action -eq "Requeue"
      DeletesProductionData = $Action -in @("Requeue", "Purge")
      ReadsProductionData = $true
    }
    WouldCallManagementApi = $true
    WouldRemoveMessages = $Action -eq "Requeue"
    WouldPublishMessages = $Action -eq "Requeue"
    WouldDeleteMessages = $Action -eq "Purge"
  })
  return
}

if (-not $Password) {
  throw "RabbitMQ password is required. Set RABBITMQ_DEFAULT_PASS or pass -Password."
}

function ConvertTo-RabbitPathSegment {
  param([string]$Value)
  return [System.Uri]::EscapeDataString($Value).Replace("%2F", "%2F")
}

function Invoke-RabbitApi {
  param(
    [ValidateSet("GET", "POST", "DELETE")]
    [string]$Method,
    [string]$Path,
    [object]$Body = $null
  )

  $base = $ManagementUrl.TrimEnd("/")
  $uri = "$base$Path"
  $securePassword = ConvertTo-SecureString $Password -AsPlainText -Force
  $credential = [pscredential]::new($Username, $securePassword)
  $params = @{
    Uri = $uri
    Method = $Method
    Credential = $credential
    UseBasicParsing = $true
    TimeoutSec = 30
  }
  if ($null -ne $Body) {
    $params.ContentType = "application/json"
    $params.Body = ($Body | ConvertTo-Json -Depth 20 -Compress)
  }
  return Invoke-RestMethod @params
}

$encodedVHost = ConvertTo-RabbitPathSegment $VHost
$encodedDlq = ConvertTo-RabbitPathSegment $DlqName
$encodedExchange = ConvertTo-RabbitPathSegment $ReplayExchange

switch ($Action) {
  "Inspect" {
    $queue = Invoke-RabbitApi -Method GET -Path "/api/queues/$encodedVHost/$encodedDlq"
    Write-JsonResult -Path $AuditFile -Value ([PSCustomObject]@{
      Action = "Inspect"
      AuditSchemaVersion = 1
      DryRun = $false
      Status = "OK"
      StartedAt = $startedAt.ToString("o")
      CompletedAt = (Get-Date).ToUniversalTime().ToString("o")
      ManagementUrl = $ManagementUrl
      Queue = $queue.name
      VHost = $queue.vhost
      Messages = $queue.messages
      Ready = $queue.messages_ready
      Unacked = $queue.messages_unacknowledged
      Consumers = $queue.consumers
      State = $queue.state
      Safety = [PSCustomObject]@{
        RequiresConfirmDestructive = $false
        ConfirmDestructiveProvided = [bool]$ConfirmDestructive
        WritesProductionData = $false
        DeletesProductionData = $false
        ReadsProductionData = $true
      }
    })
  }
  "Peek" {
    $messages = @(Invoke-RabbitApi -Method POST -Path "/api/queues/$encodedVHost/$encodedDlq/get" -Body @{
      count = $Count
      ackmode = "ack_requeue_true"
      encoding = "auto"
      truncate = 50000
    })
    Write-JsonResult -Path $AuditFile -Value ([PSCustomObject]@{
      Action = "Peek"
      AuditSchemaVersion = 1
      DryRun = $false
      Status = "OK"
      StartedAt = $startedAt.ToString("o")
      CompletedAt = (Get-Date).ToUniversalTime().ToString("o")
      ManagementUrl = $ManagementUrl
      DlqName = $DlqName
      VHost = $VHost
      RequestedCount = $Count
      Returned = $messages.Count
      AckMode = "ack_requeue_true"
      Messages = $messages
      Safety = [PSCustomObject]@{
        RequiresConfirmDestructive = $false
        ConfirmDestructiveProvided = [bool]$ConfirmDestructive
        WritesProductionData = $false
        DeletesProductionData = $false
        ReadsProductionData = $true
      }
    })
  }
  "Requeue" {
    if (-not $ConfirmDestructive) {
      throw "Requeue removes messages from $DlqName before publishing them to $ReplayExchange/$ReplayRoutingKey. Re-run with -ConfirmDestructive."
    }

    $messages = @(Invoke-RabbitApi -Method POST -Path "/api/queues/$encodedVHost/$encodedDlq/get" -Body @{
      count = $Count
      ackmode = "ack_requeue_false"
      encoding = "auto"
      truncate = 500000
    })

    $published = 0
    foreach ($message in $messages) {
      $payloadEncoding = if ($message.payload_encoding) { $message.payload_encoding } else { "string" }
      $publishResult = Invoke-RabbitApi -Method POST -Path "/api/exchanges/$encodedVHost/$encodedExchange/publish" -Body @{
        properties = $message.properties
        routing_key = $ReplayRoutingKey
        payload = $message.payload
        payload_encoding = $payloadEncoding
      }
      if (-not $publishResult.routed) {
        throw "RabbitMQ accepted a replay publish but did not route it to any queue."
      }
      $published += 1
    }

    $completedAt = (Get-Date).ToUniversalTime()
    Write-JsonResult -Path $AuditFile -Value ([PSCustomObject]@{
      Action = "Requeue"
      AuditSchemaVersion = 1
      DryRun = $false
      Status = "OK"
      StartedAt = $startedAt.ToString("o")
      CompletedAt = $completedAt.ToString("o")
      DurationSeconds = [math]::Round(($completedAt - $startedAt).TotalSeconds, 2)
      ManagementUrl = $ManagementUrl
      DlqName = $DlqName
      VHost = $VHost
      ReplayExchange = $ReplayExchange
      ReplayRoutingKey = $ReplayRoutingKey
      RequestedCount = $Count
      Fetched = $messages.Count
      Replayed = $published
      ConfirmDestructive = [bool]$ConfirmDestructive
      Safety = [PSCustomObject]@{
        RequiresConfirmDestructive = $true
        ConfirmDestructiveProvided = [bool]$ConfirmDestructive
        WritesProductionData = $true
        DeletesProductionData = $true
        ReadsProductionData = $true
      }
    })
  }
  "Purge" {
    if (-not $ConfirmDestructive) {
      throw "Purge permanently deletes messages from $DlqName. Re-run with -ConfirmDestructive."
    }
    Invoke-RabbitApi -Method DELETE -Path "/api/queues/$encodedVHost/$encodedDlq/contents" | Out-Null
    $completedAt = (Get-Date).ToUniversalTime()
    Write-JsonResult -Path $AuditFile -Value ([PSCustomObject]@{
      Action = "Purge"
      AuditSchemaVersion = 1
      DryRun = $false
      Status = "OK"
      StartedAt = $startedAt.ToString("o")
      CompletedAt = $completedAt.ToString("o")
      DurationSeconds = [math]::Round(($completedAt - $startedAt).TotalSeconds, 2)
      ManagementUrl = $ManagementUrl
      DlqName = $DlqName
      VHost = $VHost
      ConfirmDestructive = [bool]$ConfirmDestructive
      Purged = $true
      Safety = [PSCustomObject]@{
        RequiresConfirmDestructive = $true
        ConfirmDestructiveProvided = [bool]$ConfirmDestructive
        WritesProductionData = $false
        DeletesProductionData = $true
        ReadsProductionData = $true
      }
    })
  }
}
