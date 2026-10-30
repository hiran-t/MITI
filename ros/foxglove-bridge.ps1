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

$probe = New-Object System.Net.Sockets.TcpClient
try {
  $probe.Connect('127.0.0.1', $port)
  [Console]::Error.WriteLine("Port $port is already in use, probably by another foxglove_bridge. " +
    "Stop it, or set BRIDGE_PORT and enter ws://<this machine>:<port> in MITI's connection settings.")
  exit 1
} catch [System.Net.Sockets.SocketException] {
  # Nothing listens there: the port is free.
} finally {
  $probe.Dispose()
}

Write-Host "foxglove_bridge: ws://${address}:$port, ROS_DOMAIN_ID=$env:ROS_DOMAIN_ID, $env:RMW_IMPLEMENTATION"

& ros2 launch foxglove_bridge foxglove_bridge_launch.xml `
  "port:=$port" `
  "address:=$address" `
  "topic_whitelist:=$(Get-Setting 'BRIDGE_TOPIC_WHITELIST' "['.*']")" `
  "send_buffer_limit:=$(Get-Setting 'BRIDGE_SEND_BUFFER_LIMIT' '10000000')" `
  "max_qos_depth:=$(Get-Setting 'BRIDGE_MAX_QOS_DEPTH' '10')"
exit $LASTEXITCODE
