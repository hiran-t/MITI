#!/bin/sh
set -e

if [ "$1" = "configure" ]; then
  if ! getent passwd miti >/dev/null; then
    useradd --system --user-group --home-dir /var/lib/miti --no-create-home \
      --shell /usr/sbin/nologin --comment "MITI web dashboard" miti
  fi
  mkdir -p /var/lib/miti /var/cache/miti
  chown miti:miti /var/lib/miti /var/cache/miti
fi

if [ -d /run/systemd/system ]; then
  systemctl daemon-reload
  if [ -z "$2" ]; then
    # First install: start MITI now and at every boot.
    systemctl enable --now miti.service || echo "Could not start the miti service; see: journalctl -u miti"
    echo "MITI runs on http://<this machine>:3000 (settings: /etc/miti/miti.env)."
  else
    systemctl try-restart miti.service miti-bridge.service || true
  fi
else
  echo "systemd is not running; start MITI with: miti"
fi
