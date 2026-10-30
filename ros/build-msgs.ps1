# Windows version of build-msgs.sh: builds the robot's own message packages in ros/overlay/src
# so foxglove_bridge can offer their topics (`pixi run -e <distro> build-msgs`). Needs the
# Visual Studio 2022 Build Tools with "Desktop development with C++"; pixi sets up the compiler.
$ErrorActionPreference = 'Stop'
Set-Location (Join-Path $PSScriptRoot 'overlay')

$packages = Get-ChildItem -Path src -Force | Where-Object { $_.Name -ne '.gitkeep' }
if (-not $packages) {
  Write-Host 'No packages in ros/overlay/src; nothing to build.'
  exit 0
}
if (-not $env:ROS_DISTRO) {
  [Console]::Error.WriteLine('ROS_DISTRO is not set: run through pixi (pixi run -e humble build-msgs)')
  exit 1
}

$distro = $env:ROS_DISTRO
& colcon build --merge-install `
  --build-base "build/$distro" `
  --install-base "install/$distro" `
  --cmake-args -G Ninja -DBUILD_TESTING=OFF -DCMAKE_BUILD_TYPE=Release
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
Write-Host "Built into ros/overlay/install/$distro; restart the bridge to use it."
