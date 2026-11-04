# Install on Windows

pixi runs MITI on Windows 10 and 11 (x86-64) with the same commands as on Linux. Windows support is new; please report problems.

:::{note}
miti_bridge does not support Windows yet. On Windows, pixi installs a prebuilt bridge from RoboStack instead, and the bridge tasks start it beside MITI with the PowerShell versions of the scripts in `ros/` (`*.ps1`). JPEG compression, point clouds reduced on the robot, rate limits applied by the bridge and the link statistics need miti_bridge: run it on the robot, or beside MITI in WSL 2 (see below).
:::

## Install and run

Install pixi in PowerShell, then open a new terminal and clone MITI, somewhere outside OneDrive (see below):

```powershell
powershell -ExecutionPolicy ByPass -c "irm -useb https://pixi.sh/install.ps1 | iex"
git clone https://github.com/hiran-t/MITI.git C:\MITI
cd C:\MITI
```

```powershell
pixi run miti                       # MITI on http://<this machine>:3000
pixi run -e humble miti-bridge      # MITI and the bridge beside it (-e jazzy for Jazzy)
pixi run -e humble bridge           # the bridge only (on Linux and macOS: miti_bridge)
```

## Change the settings

Settings are environment variables, set before `pixi run`:

```powershell
$env:ROS_DOMAIN_ID = "5"
$env:ROS_STATIC_PEERS = "192.168.10.27"   # find the robot by IP
pixi run -e jazzy miti-bridge
```

## Allow MITI through the firewall

The first start asks whether to allow Node.js, Python and the bridge on the network; allow them on private networks. Or open the ports once, in PowerShell as administrator:

```powershell
New-NetFirewallRule -DisplayName "MITI web and bridge" -Direction Inbound -Protocol TCP -LocalPort 3000,8765 -Action Allow -Profile Private
New-NetFirewallRule -DisplayName "ROS 2 DDS" -Direction Inbound -Protocol UDP -LocalPort 7400-7700 -Action Allow -Profile Private
```

Set the network the robot is on to _Private_ (Settings > Network > Properties); public networks block discovery.

## Build the robot's message types

`build-msgs` compiles C++ and needs the Visual Studio 2022 Build Tools with the C++ workload, installed once:

```powershell
winget install Microsoft.VisualStudio.2022.BuildTools --override "--wait --passive --add Microsoft.VisualStudio.Workload.VCTools --includeRecommended"
```

## Start MITI at login

Use Task Scheduler, for example (adjust the folder):

```powershell
schtasks /Create /TN MITI /SC ONLOGON /TR "cmd /c cd /d C:\MITI && pixi run miti"
```

## Common problems

### Port 8765 is used by svchost

A Windows service holds the port, usually IP Helper forwarding it with `netsh interface portproxy` (often set up for WSL). The bridge moves to the next free port by itself and MITI follows. To free 8765, check with `tasklist /svc /fi "PID eq <pid>"` and `netsh interface portproxy show all`, and remove an unused forward in an administrator PowerShell: `netsh interface portproxy delete v4tov4 listenport=8765 listenaddress=0.0.0.0`.

### MITI is in a OneDrive folder

Put the folder somewhere like `C:\MITI`, not under `Desktop` or `Documents` when those sync to OneDrive: pixi installs thousands of files in `.pixi`, which OneDrive then tries to upload.

### The bridge fails with LoadLibrary error 4551

With an error such as `LoadLibrary error: 4551` on `rmw_fastrtps_cpp.dll`, Windows blocked a library pixi downloaded, because it is not signed. Error 4551 means _An Application Control policy has blocked this file_: Smart App Control (Windows 11) or an App Control policy set by your organization. To confirm, run in PowerShell:

```powershell
(Get-MpComputerStatus).SmartAppControlState     # On / Evaluation / Off
Get-WinEvent -LogName "Microsoft-Windows-CodeIntegrity/Operational" -MaxEvents 20 |
  Where-Object Id -in 3033,3077 | Format-List TimeCreated, Message
```

Then, depending on the machine:

- **Smart App Control is On or Evaluation**: turn it off in Windows Security > App & browser control > Smart App Control. Windows can only turn it back on by resetting or reinstalling Windows.
- **A company-managed PC**: ask IT to allow the MITI folder (its `.pixi` directory), or use one of the options below.
- **Without changing Windows**: run the bridge in **WSL 2** (mirrored networking, as below) with `pixi run -e humble bridge` there, which runs miti_bridge, and MITI on Windows with `pixi run miti`; or run miti_bridge on the robot.

## Docker Desktop and WSL 2

**Docker Desktop** can run MITI (`docker compose up -d`) but not the `bridge` profile, which needs Linux host networking. **WSL 2** works like Linux for MITI itself; for the bridge, turn on mirrored networking (`networkingMode=mirrored` in `%UserProfile%\.wslconfig`, Windows 11) so DDS can reach the robot.
