# Install with Docker

MITI is published as a Docker image for linux/amd64 and linux/arm64, `ghcr.io/hiran-t/miti`. Docker restarts it with the machine.

## Install Docker

On Ubuntu:

```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER      # log out and in again to use docker without sudo
sudo systemctl enable --now docker # start Docker at boot, so MITI comes back after a restart
```

## Run the image

```bash
docker run -d --restart unless-stopped -p 3000:3000 --name miti ghcr.io/hiran-t/miti:latest
```

Use a version tag such as `ghcr.io/hiran-t/miti:3.3.6` to stay on one release. To update, pull the new image and start the container again:

```bash
docker pull ghcr.io/hiran-t/miti:latest
docker rm -f miti
docker run -d --restart unless-stopped -p 3000:3000 --name miti ghcr.io/hiran-t/miti:latest
```

## Run with Docker Compose

From a clone of MITI, [docker-compose.yml](https://github.com/hiran-t/MITI/blob/main/docker-compose.yml) runs MITI as the `miti` service, and its `bridge` profile adds foxglove_bridge beside it:

```bash
git clone https://github.com/hiran-t/MITI.git
cd MITI
cp .env.example .env                    # optional settings
docker compose up -d                    # MITI only
docker compose --profile bridge up -d   # MITI and foxglove_bridge beside it
docker compose logs -f                  # follow logs
docker compose down                     # stop
docker compose up -d --build            # rebuild after updating MITI
```

The bridge container uses host networking, which DDS discovery needs, so the `bridge` profile runs on Linux only; Docker Desktop on macOS and Windows cannot join the robot's DDS network.

## Build the image yourself

```bash
docker build -t miti:latest .
docker run -d --restart unless-stopped -p 3000:3000 --name miti miti:latest
```

`NEXT_PUBLIC_BRIDGE_URL` is built into the app, so pass it as a build argument: `docker build --build-arg NEXT_PUBLIC_BRIDGE_URL=ws://robot:8765 -t miti:latest .`. Setting it with `docker run -e` has no effect.
