#!/bin/sh
set -e
if [ -d /run/systemd/system ]; then
  systemctl daemon-reload || true
fi
if [ "$1" = "purge" ]; then
  rm -rf /var/lib/miti /var/cache/miti
  if getent passwd miti >/dev/null; then
    userdel miti || true
  fi
fi
