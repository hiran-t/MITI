#!/usr/bin/env bash
# Builds dist/miti_<version>_<arch>.deb (amd64 or arm64) with nfpm, from a standalone build:
#   STANDALONE_BUILD=true npm run build
#   packaging/build-deb.sh amd64
# The package carries its own Node.js (official build, checksum verified) because Ubuntu's
# nodejs package is too old on 22.04.
set -euo pipefail

arch="${1:?usage: packaging/build-deb.sh amd64|arm64}"
case "$arch" in
  amd64) node_arch=x64 ;;
  arm64) node_arch=arm64 ;;
  *) echo "Unknown architecture $arch: use amd64 or arm64" >&2; exit 1 ;;
esac
NODE_VERSION="${NODE_VERSION:-22.23.4}"

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$root"
[ -f .next/standalone/server.js ] || {
  echo "No standalone build: run STANDALONE_BUILD=true npm run build first" >&2
  exit 1
}
version="$(node -p "require('./package.json').version")"

stage="build/deb/miti"
rm -rf "$stage"
mkdir -p "$stage/.next" "$stage/ros" "$stage/node/bin"
cp -a .next/standalone/. "$stage/"
cp -a .next/static "$stage/.next/static"
cp -a public "$stage/public"
# The cache is a symlink to /var/cache/miti in the package; .env files never ship.
rm -rf "$stage/.next/cache" "$stage"/.env*
cp ros/foxglove-bridge.sh ros/cyclonedds.xml "$stage/ros/"

# Architecture-specific files would only run on the build machine.
native="$(find "$stage/node_modules" -name '*.node' 2>/dev/null || true)"
if [ -n "$native" ]; then
  echo "Native modules in the standalone build; the package would only work on this machine:" >&2
  echo "$native" >&2
  exit 1
fi

# Node.js for the target architecture.
mkdir -p build/node
tarball="node-v$NODE_VERSION-linux-$node_arch.tar.xz"
base="https://nodejs.org/dist/v$NODE_VERSION"
[ -f "build/node/SHASUMS256-$NODE_VERSION.txt" ] ||
  curl -fsSL "$base/SHASUMS256.txt" -o "build/node/SHASUMS256-$NODE_VERSION.txt"
[ -f "build/node/$tarball" ] || curl -fsSL "$base/$tarball" -o "build/node/$tarball"
expected="$(grep " $tarball\$" "build/node/SHASUMS256-$NODE_VERSION.txt" | cut -d' ' -f1)"
actual="$( (sha256sum "build/node/$tarball" 2>/dev/null || shasum -a 256 "build/node/$tarball") | cut -d' ' -f1)"
[ -n "$expected" ] && [ "$expected" = "$actual" ] || {
  echo "Checksum mismatch for $tarball" >&2
  exit 1
}
tar -xJf "build/node/$tarball" -C "$stage/node" --strip-components=1 \
  "node-v$NODE_VERSION-linux-$node_arch/bin/node" "node-v$NODE_VERSION-linux-$node_arch/LICENSE"

mkdir -p dist
DEB_ARCH="$arch" MITI_VERSION="$version" nfpm package --packager deb \
  --config packaging/nfpm.yaml --target dist/
ls -l "dist/miti_${version}_${arch}.deb"
