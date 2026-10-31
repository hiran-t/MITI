# How to create a release

This guide describes how MITI releases are made. A release is a version bump, a CHANGELOG entry, release notes in `docs/releases/`, a git tag and a GitHub release. No build artifacts are attached: users run a release from the tagged source with pixi, Docker Compose or npm (see [DEPLOYMENT.md](DEPLOYMENT.md)).

## Release checklist

Before tagging:

- [ ] Lint passes (`npm run lint`)
- [ ] Type check passes (`npm run type-check`)
- [ ] Tests pass (`npm test`)
- [ ] Production build succeeds (`npm run build`; stop `npm run dev` first, since both use `.next`)
- [ ] Version updated in `package.json` and `package-lock.json`
- [ ] `bun.lock` in sync if dependencies changed (`bun install`)
- [ ] CHANGELOG.md has a `## [x.y.z] - YYYY-MM-DD` section
- [ ] Release notes written in `docs/releases/vX.Y.Z.md`
- [ ] README.md and `docs/` updated for changed behavior, and breaking changes described

## Steps

```bash
# 1. Bump the version in package.json and package-lock.json (no tag yet)
npm version 3.3.0 --no-git-tag-version

# 2. In CHANGELOG.md, move the [Unreleased] entries into a new section:
#      ## [3.3.0] - 2026-11-15
#    with Added / Changed / Fixed / Removed subsections.

# 3. Write the release notes: docs/releases/v3.3.0.md
#    First line: "# MITI v3.3.0 — <short summary>"

# 4. Commit. Use feat: for a release with new features, chore: for maintenance.
git add package.json package-lock.json CHANGELOG.md docs/releases/v3.3.0.md
git commit -m "feat: release MITI v3.3.0 with <short summary>"

# 5. Tag and push
git tag -a v3.3.0 -m "MITI v3.3.0"
git push origin main
git push origin v3.3.0

# 6. Create the GitHub release from the release notes
gh release create v3.3.0 --title "MITI v3.3.0" --notes-file docs/releases/v3.3.0.md --latest
```

Pushing to `main` runs two GitHub Actions workflows:

- **CI** (`.github/workflows/ci.yml`): ESLint, type check, production build and Jest tests on Node.js 22 with `npm ci`
- **Docker Build** (`.github/workflows/docker.yml`): builds the Docker image to check it builds

Pushing the tag (step 5) runs **Docker Build** again and publishes the image to `ghcr.io/hiran-t/miti` for linux/amd64 and linux/arm64, tagged `3.3.0`, `3.3` and `latest`. The first published image is private: on its package page (GitHub profile → Packages → miti → Package settings), set the visibility to public once. No workflow creates the release; step 6 does that.

## Debian packages and the apt repository

Publishing the release (step 6) runs **Packages** (`.github/workflows/packages.yml`): it builds `miti_<version>_amd64.deb` and `_arm64.deb` (`packaging/build-deb.sh`, with nfpm and the official Node.js 22 build), checks that they install and start on Ubuntu 22.04 and 24.04, attaches them to the release, and publishes the apt repository at `https://hiran-t.github.io/MITI` (`packaging/build-apt-repo.sh`, the `gh-pages` branch, with the packages of the last three releases).

One-time setup:

1. Create a signing key without a passphrase and store it as the secret `APT_GPG_PRIVATE_KEY`, on a trusted machine:

   ```bash
   export GNUPGHOME="$(mktemp -d)"
   gpg --batch --passphrase '' --quick-gen-key "MITI apt repository" rsa4096 sign never
   gpg --armor --export-secret-keys "MITI apt repository" | gh secret set APT_GPG_PRIVATE_KEY --repo hiran-t/MITI
   gpg --armor --export-secret-keys "MITI apt repository" > miti-apt-key.asc   # back it up offline
   rm -rf "$GNUPGHOME"
   ```

   Users trust this key once; changing it later means every user adds the new `key.gpg` again. Without the secret, the workflow only attaches the packages to the release.

2. After the first run, turn on GitHub Pages for the `gh-pages` branch (Settings → Pages → Deploy from a branch → `gh-pages`, `/ (root)`).

To rebuild the packages of a release, run **Packages** from the Actions tab with its tag.

## Who uses MITI

GitHub keeps a repository's traffic for 14 days. **Traffic archive** (`.github/workflows/traffic.yml`) runs daily and adds it to CSV files on the `traffic` branch (`views.csv`, `clones.csv`, `referrers.csv`, `paths.csv`, `repo.csv`; see `scripts/traffic-archive.py`). It needs the repository secret `TRAFFIC_TOKEN`, a fine-grained personal access token with **Administration: Read-only** on this repository; until the secret exists the workflow only warns. Other signals:

- **Image pulls**: the `miti` package page shows how often the published image is pulled.
- **Package downloads**: `gh release view <tag> --json assets --jq '.assets[] | "\(.name) \(.downloadCount)"'` counts `.deb` downloads from the release; downloads through the apt repository (GitHub Pages) are not counted.
- **Discussions** (Q&A, Show and tell) and issues from people outside the team are the clearest sign that MITI is in use.
- Clones include CI checkouts, so unique visitors and referrers say more than the clone count.

## Version numbering

Follow [Semantic Versioning](https://semver.org/):

- **Major** (`4.0.0`): breaking changes, for example a different bridge protocol or layouts that cannot be converted
- **Minor** (`3.3.0`): new features that keep existing layouts and settings working
- **Patch** (`3.2.1`): bug fixes and maintenance

Examples from MITI's history:

- `v2.1.0`: moved from rosbridge to foxglove_bridge
- `v3.1.0`: Foxglove-style Image panel
- `v3.1.1`: removed unused code and dependencies

## Release notes

- **CHANGELOG.md** follows [Keep a Changelog](https://keepachangelog.com/): one line per user-visible change under Added, Changed, Fixed or Removed.
- **`docs/releases/vX.Y.Z.md`** is the GitHub release text: a title, a sentence on what the release is for, then sections that show how to use what is new. Look at earlier files in `docs/releases/` for the format.

Commit messages follow [Conventional Commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`, `perf:`, `docs:`, `chore:`), which makes the CHANGELOG easier to write.

## Deployment helper scripts

Two older scripts in `scripts/` package MITI by hand. They are not part of the release process, and they do not match each other:

- **`scripts/deploy.sh`** asks for a method and builds either a Docker image saved as `miti-docker.tar`, or a standalone Next.js build packed as `miti-standalone.tar.gz` (a `deploy/` folder with `server.js`, run with `node server.js`).
- **`scripts/ubuntu-setup.sh`** is meant to run on the target Ubuntu machine. Option 1 offers to install Docker, loads a `miti-docker*.tar.gz` image and starts it with `docker run`. Option 2 offers to install Bun, extracts a `miti-standalone*.tar.gz` that contains a `miti/` or `deploy/miti/` folder, installs a systemd service `miti` from `scripts/auto-startapp.service` that runs `server.js` with Bun, and adds an autostart entry that opens Chrome or Chromium in kiosk mode on `http://localhost:3000` (`scripts/auto-launch-browser.sh`).

Because `deploy.sh` writes `miti-docker.tar` and a `deploy/` folder without `miti/`, `ubuntu-setup.sh` does not find its output without renaming or repacking. For new installs use pixi or Docker Compose as described in [DEPLOYMENT.md](DEPLOYMENT.md).

## Troubleshooting

### Build fails

```bash
rm -rf .next node_modules
npm ci
npm run build
```

If `npm run dev` is running from the same folder, stop it first; a build replaces `.next` under the dev server.

### Tag already exists

If a tag was created by mistake and not yet released:

```bash
git tag -d v3.3.0
git push --delete origin v3.3.0
git tag -a v3.3.0 -m "MITI v3.3.0"
git push origin v3.3.0
```

Do not move a tag after its GitHub release is published; make a patch release instead.

### Release not marked as latest

```bash
gh release edit v3.3.0 --latest
```

## After a release

1. Close the issues the release fixes.
2. Start a new `## [Unreleased]` section in CHANGELOG.md if it is not there.

## Resources

- [GitHub releases documentation](https://docs.github.com/en/repositories/releasing-projects-on-github)
- [Semantic Versioning](https://semver.org/)
- [Conventional Commits](https://www.conventionalcommits.org/)
- [Keep a Changelog](https://keepachangelog.com/)
