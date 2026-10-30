# Windows version of miti-with-bridge.sh (`pixi run -e <distro> miti-bridge`): foxglove_bridge
# and MITI side by side. Stopping either one (or Ctrl+C) stops both.
$ErrorActionPreference = 'Stop'
Set-Location (Join-Path $PSScriptRoot '..')

$port = if ($env:MITI_PORT) { $env:MITI_PORT } else { '3000' }
$hostname = if ($env:MITI_HOST) { $env:MITI_HOST } else { '0.0.0.0' }

$bridge = Start-Process powershell -NoNewWindow -PassThru -ArgumentList @(
  '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', (Join-Path $PSScriptRoot 'foxglove-bridge.ps1'))
$web = $null
try {
  $web = Start-Process npm.cmd -NoNewWindow -PassThru -ArgumentList @(
    'run', 'start', '--', '--hostname', $hostname, '--port', $port)
  # Whichever exits first ends the pair.
  while (-not $bridge.HasExited -and -not $web.HasExited) { Start-Sleep -Seconds 1 }
} finally {
  foreach ($process in @($web, $bridge)) {
    if ($process -and -not $process.HasExited) { taskkill /PID $process.Id /T /F | Out-Null }
  }
}
