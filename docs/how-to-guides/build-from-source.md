# Build from Source

Building from source is for developing MITI. To use MITI, the [apt package](install-with-apt.md), [Docker](install-with-docker.md) or [pixi](install-with-pixi.md) is simpler.

## Install Node.js 22

For example with [nvm](https://github.com/nvm-sh/nvm):

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
nvm install 22
```

## Build and run

```bash
git clone https://github.com/hiran-t/MITI.git
cd MITI
npm ci
npm run build
npm start                          # http://localhost:3000
npm start -- --hostname 0.0.0.0    # reachable from other machines
npm run dev                        # development server with hot reload
```

`STANDALONE_BUILD=true npm run build` produces a self-contained server in `.next/standalone`, which the Docker image and the apt package use.

:::{note}
Don't build while `npm run dev` runs from the same folder: both use `.next`, and the dev server stops serving pages until it is restarted.
:::

To contribute, see [Contributing](../contributing/index.md).
