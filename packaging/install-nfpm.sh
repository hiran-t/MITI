#!/usr/bin/env bash
# Downloads nfpm (checksum verified) into the given folder: packaging/install-nfpm.sh <bin dir>
set -euo pipefail
dir="${1:?usage: packaging/install-nfpm.sh <bin dir>}"
version="${NFPM_VERSION:-2.48.0}"
case "$(uname -m)" in
  x86_64 | amd64) arch=x86_64 ;;
  aarch64 | arm64) arch=arm64 ;;
  *) echo "No nfpm build for $(uname -m)" >&2; exit 1 ;;
esac
tarball="nfpm_${version}_Linux_${arch}.tar.gz"
base="https://github.com/goreleaser/nfpm/releases/download/v$version"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
curl -fsSL "$base/$tarball" -o "$tmp/$tarball"
curl -fsSL "$base/checksums.txt" -o "$tmp/checksums.txt"
(cd "$tmp" && grep " $tarball\$" checksums.txt | sha256sum -c --quiet -)
mkdir -p "$dir"
tar -xzf "$tmp/$tarball" -C "$dir" nfpm
"$dir/nfpm" --version | head -1
