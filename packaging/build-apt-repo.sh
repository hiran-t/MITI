#!/usr/bin/env bash
# Builds a signed apt repository (suite "stable", component "main") from .deb files:
#   packaging/build-apt-repo.sh <output dir> <gpg key id> dist/*.deb
# Needs apt-ftparchive (apt-utils) and gpg with the private key. Users add it with:
#   curl -fsSL <url>/key.gpg | sudo gpg --dearmor -o /usr/share/keyrings/miti.gpg
#   echo "deb [signed-by=/usr/share/keyrings/miti.gpg] <url> stable main" |
#     sudo tee /etc/apt/sources.list.d/miti.list
set -euo pipefail

out="${1:?usage: packaging/build-apt-repo.sh <output dir> <gpg key id> <deb>...}"
key="${2:?gpg key id}"
shift 2
[ $# -gt 0 ] || { echo "No .deb files given" >&2; exit 1; }

rm -rf "$out"
mkdir -p "$out/pool/main/m/miti"
cp "$@" "$out/pool/main/m/miti/"
cd "$out"

for arch in amd64 arm64; do
  dir="dists/stable/main/binary-$arch"
  mkdir -p "$dir"
  apt-ftparchive --arch "$arch" packages pool >"$dir/Packages"
  gzip -9kn "$dir/Packages"
done

apt-ftparchive \
  -o APT::FTPArchive::Release::Origin=MITI \
  -o APT::FTPArchive::Release::Label=MITI \
  -o APT::FTPArchive::Release::Suite=stable \
  -o APT::FTPArchive::Release::Codename=stable \
  -o APT::FTPArchive::Release::Architectures="amd64 arm64" \
  -o APT::FTPArchive::Release::Components=main \
  -o APT::FTPArchive::Release::Description="MITI web dashboard for ROS 2" \
  release dists/stable >dists/stable/Release

gpg --batch --yes --local-user "$key" --clearsign -o dists/stable/InRelease dists/stable/Release
gpg --batch --yes --local-user "$key" --armor --detach-sign -o dists/stable/Release.gpg \
  dists/stable/Release
gpg --armor --export "$key" >key.gpg

# GitHub Pages: serve files as they are, and say how to use the repository.
touch .nojekyll
cat >index.html <<'HTML'
<!doctype html>
<meta charset="utf-8">
<title>MITI apt repository</title>
<h1>MITI apt repository</h1>
<p>Ubuntu 22.04 and 24.04, amd64 and arm64:</p>
<pre>
curl -fsSL https://hiran-t.github.io/MITI/key.gpg | sudo gpg --dearmor -o /usr/share/keyrings/miti.gpg
echo "deb [signed-by=/usr/share/keyrings/miti.gpg] https://hiran-t.github.io/MITI stable main" | sudo tee /etc/apt/sources.list.d/miti.list
sudo apt-get update
sudo apt-get install miti
</pre>
<p>See <a href="https://github.com/hiran-t/MITI">github.com/hiran-t/MITI</a>.</p>
HTML
find . -type f | sort
