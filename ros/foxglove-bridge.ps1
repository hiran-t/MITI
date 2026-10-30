# Windows version of foxglove-bridge.sh: runs foxglove_bridge on this machine, joined to the
# robot's ROS 2 network over DDS. Used by `pixi run -e <distro> bridge` and `miti-bridge` on
# Windows; it reads the same environment variables as the bash script:
#   ROS_DOMAIN_ID, RMW_IMPLEMENTATION, CYCLONEDDS_URI, BRIDGE_PORT, BRIDGE_ADDRESS,
#   BRIDGE_TOPIC_WHITELIST, BRIDGE_SEND_BUFFER_LIMIT, BRIDGE_MAX_QOS_DEPTH
$ErrorActionPreference = 'Stop'

function Get-Setting([string]$Name, [string]$Default) {
  $value = [Environment]::GetEnvironmentVariable($Name)
  if ([string]::IsNullOrEmpty($value)) { $Default } else { $value }
}

if (-not (Get-Command ros2 -ErrorAction SilentlyContinue)) {
  [Console]::Error.WriteLine('ros2 not found: run through pixi (pixi run -e humble bridge)')
  exit 1
}

# The robot's own message packages, built by ros/build-msgs.ps1.
$distro = $env:ROS_DISTRO
$overlay = Join-Path $PSScriptRoot "overlay\install\$distro\setup.ps1"
if ($distro -and (Test-Path $overlay)) { . $overlay }

$env:ROS_DOMAIN_ID = Get-Setting 'ROS_DOMAIN_ID' '0'
$env:RMW_IMPLEMENTATION = Get-Setting 'RMW_IMPLEMENTATION' 'rmw_fastrtps_cpp'
if ($env:RMW_IMPLEMENTATION -eq 'rmw_cyclonedds_cpp' -and -not $env:CYCLONEDDS_URI) {
  $env:CYCLONEDDS_URI = 'file://' + ((Join-Path $PSScriptRoot 'cyclonedds.xml') -replace '\\', '/')
}

$port = [int](Get-Setting 'BRIDGE_PORT' '8765')
$address = Get-Setting 'BRIDGE_ADDRESS' '0.0.0.0'

function Test-PortInUse([int]$Port) {
  $client = New-Object System.Net.Sockets.TcpClient
  try { $client.Connect('127.0.0.1', $Port); $true } catch { $false } finally { $client.Dispose() }
}

# A foxglove_bridge answers the WebSocket handshake with its own subprotocol.
function Test-Bridge([int]$Port) {
  $client = New-Object System.Net.Sockets.TcpClient
  try {
    $client.Connect('127.0.0.1', $Port)
    $stream = $client.GetStream()
    $stream.ReadTimeout = 2000
    $request = "GET / HTTP/1.1`r`nHost: localhost`r`nUpgrade: websocket`r`nConnection: Upgrade`r`n" +
      "Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==`r`nSec-WebSocket-Version: 13`r`n" +
      "Sec-WebSocket-Protocol: foxglove.sdk.v1, foxglove.websocket.v1`r`n`r`n"
    $bytes = [System.Text.Encoding]::ASCII.GetBytes($request)
    $stream.Write($bytes, 0, $bytes.Length)
    $reader = New-Object System.IO.StreamReader($stream)
    $lines = @()
    while ($null -ne ($line = $reader.ReadLine()) -and $line -ne '') { $lines += $line }
    [bool](($lines[0] -like 'HTTP/1.1 101*') -and
      ($lines | Where-Object { $_ -match '^sec-websocket-protocol:\s*foxglove' }))
  } catch { $false } finally { $client.Dispose() }
}

function Get-PortOwner([int]$Port) {
  if ($env:OS -ne 'Windows_NT') { return 'another program' }
  $listener = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue |
    Select-Object -First 1
  if (-not $listener) { return 'another program' }
  $id = $listener.OwningProcess
  $name = (Get-Process -Id $id -ErrorAction SilentlyContinue).ProcessName
  if ($name -eq 'svchost') {
    # A Windows service, usually IP Helper forwarding the port (netsh interface portproxy).
    return "a Windows service (svchost, PID $id; check: tasklist /svc /fi `"PID eq $id`" and " +
      'netsh interface portproxy show all)'
  }
  "$name (PID $id; stop it with: Stop-Process -Id $id)"
}

# A bridge already on the port: exit 3 (scripts/start-miti.mjs then uses it). Another program on
# the port: move to the next free one.
if (Test-PortInUse $port) {
  if (Test-Bridge $port) {
    [Console]::Error.WriteLine("foxglove_bridge already runs on port $port; use that one.")
    exit 3
  }
  $taken = $port
  $owner = Get-PortOwner $taken
  $port = 0
  foreach ($candidate in ($taken + 1)..($taken + 20)) {
    if (-not (Test-PortInUse $candidate)) { $port = $candidate; break }
  }
  if (-not $port) {
    [Console]::Error.WriteLine("Port $taken is used by $owner, and no port up to $($taken + 20) is free.")
    exit 1
  }
  [Console]::Error.WriteLine("Port $taken is used by $owner; foxglove_bridge uses $port instead. " +
    "pixi run miti finds it; otherwise enter ws://<this machine>:$port in MITI's connection settings.")
}

Write-Host "foxglove_bridge: ws://${address}:$port, ROS_DOMAIN_ID=$env:ROS_DOMAIN_ID, $env:RMW_IMPLEMENTATION"

& ros2 launch foxglove_bridge foxglove_bridge_launch.xml `
  "port:=$port" `
  "address:=$address" `
  "topic_whitelist:=$(Get-Setting 'BRIDGE_TOPIC_WHITELIST' "['.*']")" `
  "send_buffer_limit:=$(Get-Setting 'BRIDGE_SEND_BUFFER_LIMIT' '10000000')" `
  "max_qos_depth:=$(Get-Setting 'BRIDGE_MAX_QOS_DEPTH' '10')"
exit $LASTEXITCODE
