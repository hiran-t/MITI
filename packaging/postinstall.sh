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
  # Only services already running are restarted; nothing starts on its own.
  [ -n "$2" ] && systemctl try-restart miti.service miti-bridge.service || true
fi

if [ -z "$2" ]; then
  echo "Start MITI with: miti run   (Ctrl+C stops it; miti --help for options)"
  echo "To start it at boot instead: sudo systemctl enable --now miti"
fi
