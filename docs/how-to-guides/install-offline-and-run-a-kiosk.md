# Install Offline and Run a Kiosk Screen

This guide covers machines without internet access and screens that show MITI all the time, such as a monitor on the shop floor.

## Install without internet

Download `miti_<version>_<arch>.deb` from the [GitHub release](https://github.com/hiran-t/MITI/releases/latest) on a connected machine, copy it over, and install it with `sudo apt install ./miti_<version>_<arch>.deb`. For Docker, save the image with `docker save ghcr.io/hiran-t/miti:latest | gzip > miti.tar.gz` and load it on the target with `docker load < miti.tar.gz`.

## Show MITI full screen on a kiosk

Start MITI at boot (`sudo systemctl enable --now miti`), then open it full screen after login with an autostart entry, `~/.config/autostart/miti-kiosk.desktop`:

```ini
[Desktop Entry]
Type=Application
Name=MITI
Exec=sh -c 'sleep 5; chromium --kiosk --noerrdialogs http://localhost:3000'
```

Use `google-chrome` instead of `chromium` if that is the browser installed.
