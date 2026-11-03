#!/usr/bin/env bash
# Builds miti_bridge (https://github.com/hiran-t/MITI-sdk) from source, where it does not come
# from apt: the pixi environments (`pixi run -e <distro> build-bridge`, which `bridge` and
# `miti-bridge` run first) and the miti-bridge Docker image. Needs a ROS 2 environment with a C++
# compiler, CMake, colcon, Boost, nlohmann/json, TurboJPEG and pkg-config; pixi brings them.
#
# The MITI-sdk source of MITI_SDK_REF is downloaded once into ros/miti-sdk/src, and the build
# goes to ros/miti-sdk/install/<distro>, which ros/miti-bridge.sh uses. A build of the same
# ref is kept, so this returns at once after the first run.
set -euo pipefail

# The MITI-sdk version MITI is tested with.
ref="${MITI_SDK_REF:-v0.1.1}"
distro="${ROS_DISTRO:?run in a ROS 2 environment, e.g. pixi run -e humble build-bridge}"
here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
root="$here/miti-sdk"
install="$root/install/$distro"
stamp="$install/.miti-sdk-ref"

if [ -f "$stamp" ] && [ "$(cat "$stamp")" = "$ref" ]; then
  exit 0
fi

src="$root/src/$ref"
if [ ! -d "$src" ]; then
  echo "Downloading MITI-sdk $ref"
  mkdir -p "$root/src"
  # Python rather than curl or tar: both ROS 2 and pixi have it.
  python3 - "$ref" "$root/src" <<'PY'
import io, os, sys, tarfile, urllib.request
ref, into = sys.argv[1], sys.argv[2]
url = f"https://github.com/hiran-t/MITI-sdk/archive/{ref}.tar.gz"
with urllib.request.urlopen(url, timeout=60) as response:
    data = response.read()
with tarfile.open(fileobj=io.BytesIO(data)) as archive:
    top = archive.getnames()[0].split("/")[0]
    archive.extractall(into, filter="data") if hasattr(tarfile, "data_filter") else archive.extractall(into)
os.rename(os.path.join(into, top), os.path.join(into, ref))
PY
fi

echo "Building miti_bridge for $distro (once; a few minutes)"
# A build folder keeps the source path it was configured with: start afresh for a new ref.
rm -rf "$install" "$root/build/$distro"
# Tests and examples need GoogleTest and are not needed to run the bridge.
colcon --log-base "$root/log/$distro" build --merge-install \
  --base-paths "$src/core" "$src/ros" \
  --build-base "$root/build/$distro" --install-base "$install" \
  --cmake-args -DCMAKE_BUILD_TYPE=Release -DMITI_BUILD_TESTS=OFF -DMITI_BUILD_EXAMPLES=OFF \
  -DBUILD_TESTING=OFF
echo "$ref" >"$stamp"
