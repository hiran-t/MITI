#!/usr/bin/env bash
# Puts the manual's screenshots in docs/manual/images. They live on the docs-images branch, with the
# scripts that take them, so the source tree stays free of images. docs/conf.py runs this when needed.
set -euo pipefail
cd "$(dirname "$0")/.."
if git fetch -q --depth 1 origin docs-images 2>/dev/null; then
  ref=FETCH_HEAD
else
  ref=refs/heads/docs-images # offline, or not pushed yet
fi
rm -rf docs/manual/images
mkdir -p docs/manual/images
git archive "$ref" images | tar -x --strip-components=1 -C docs/manual/images
