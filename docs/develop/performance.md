# Performance under robot-sized data

MITI has to stay responsive while a robot streams raw cameras, a lidar cloud, TF and logs. This page
describes the load harness used to measure that and what it measured.

## Load harness

Two scripts that need only MITI's own npm packages (run `npm ci` first) and, for `perf-run.js`,
Google Chrome (set `CHROME_PATH` if it is not in the default place):

- `scripts/heavy-bridge.js`: a local foxglove_bridge stand-in that streams robot-sized data: raw
  `rgb8` 1280×720 cameras, a Livox-style `PointCloud2` (x y z intensity tag line timestamp), TF,
  a 200×200 costmap and `/rosout` in the shape of the robot's nav2 / pick-and-place logs. Like
  foxglove_bridge, it drops a message for a client whose send buffer is over 10 MB, and it reports
  what it sent per topic on `http://localhost:<port + 1>/stats`.
- `scripts/perf-run.js`: opens MITI in Chrome with a throwaway profile over the DevTools protocol,
  sets up a 3D Scene (lidar, costmap, TF) + Log + cameras layout (`scripts/perf-probe.js`), and
  prints one JSON line: frame rate and frame-time percentiles (requestAnimationFrame), long tasks,
  input delay (how long a task posted every 50 ms waits), main-thread busy time (DevTools
  `TaskDuration` / `ScriptDuration`), what the bridge delivered, console errors and the GPU.
  `--profile` adds the functions that used the most main-thread time; `--cpu-throttle N` slows the
  page's CPU N times to approximate a robot or kiosk computer; `--expand <title>` expands a panel.

```bash
node scripts/heavy-bridge.js --cams 4 --cam-hz 30          # ws://localhost:8790
npm run build && npm start                                 # http://localhost:3000
node scripts/perf-run.js --app http://localhost:3000 --cams 4 --seconds 20 --cpu-throttle 4
```

`perf-run.js` points MITI at the stand-in bridge (`--bridge`, default `ws://localhost:8790`) and
sets up its layout in the throwaway profile, so nothing changes in your own browser. The results
below use production builds; `next dev` is slower, so compare runs of the same kind.
`pixi run miti` also builds and serves a production build on port 3000. Stop `npm run dev` before
`npm run build` in the same folder: both use `.next`, and the build breaks the running dev server.

Defaults: 3 cameras at 15 Hz, 100,000 points at 10 Hz, TF at 100 Hz, 50 log messages per second.

## Results (MITI 3.0.1 → 3.1.0)

Production builds (`next build` + `next start`), headless Chrome 152 on an Apple M5 (Metal),
1440×900 at 2× scale; 4 cameras at 30 Hz, 100k points at 10 Hz, TF at 100 Hz, `/rosout` 50/s;
20-second runs after an 8-second warm-up. The full-speed and CPU ×4 runs were repeated; ranges show
both runs.

| Run                       | Version | Frame rate | Frame p95 / worst | Long tasks (20 s) | Input delay p95 / max | Main thread busy (JS) | Data taken in            |
| ------------------------- | ------- | ---------: | ----------------: | ----------------: | --------------------: | --------------------: | ------------------------ |
| Full speed                | 3.0.1   |     60 fps |    16.8 / 16.8 ms |                 0 |          0.6–8.9 / 16 |    54.7 % (39.3 % JS) | 356 MB/s, 119 fr/s       |
|                           | 3.1.0   |     60 fps |    16.7 / 16.8 ms |                 0 |               1–2 / 7 |    29.7 % (12.8 % JS) | 356 MB/s, 120 fr/s       |
| CPU ×4                    | 3.0.1   |   54.1 fps |    33.3 / 66.7 ms | 32–36 (1.9–2.2 s) |         18–19 / 33–42 |        94 % (68 % JS) | 142–149 MB/s, 48–50 fr/s |
|                           | 3.1.0   |     60 fps |    16.8 / 16.8 ms |                 0 |           4–6 / 10–23 |        81 % (33 % JS) | 343 MB/s, 115 fr/s       |
| CPU ×6                    | 3.0.1   |   53.5 fps |   33.3 / 116.7 ms |        28 (2.2 s) |               17 / 40 |        95 % (68 % JS) | 76 MB/s, 25 fr/s         |
|                           | 3.1.0   |   59.3 fps |    16.8 / 33.5 ms |                 0 |                8 / 38 |        87 % (38 % JS) | 207 MB/s, 69 fr/s        |
| CPU ×4, 3D panel expanded | 3.0.1   |   53.8 fps |    33.4 / 66.7 ms |        35 (2.2 s) |               20 / 40 |        94 % (70 % JS) | 141 MB/s, 47 fr/s        |
|                           | 3.1.0   |     60 fps |    16.7 / 16.8 ms |                 0 |                3 / 23 |        73 % (30 % JS) | 354 MB/s, 119 fr/s       |

"fr/s" is camera frames per second that reached the page (the bridge drops the rest). On the slow
runs 3.0.1 stutters (one frame in ten or more takes 33 ms, the worst up to 117 ms, and long tasks
add up to about two seconds in twenty) while taking in less than half the data; with 3.1.0
frames stay at or near 60 fps with no long tasks while taking in two to three times as much. At
full speed the same data costs about half the main-thread time and a third of the JavaScript time.
What remains on the main thread is mostly the browser receiving the WebSocket data itself
(hundreds of MB/s in these runs; a robot's Wi-Fi link carries far less).

## What changed, and what each step bought

Measured in `next dev` at full speed with 4 cameras at 30 Hz (main thread busy, 3.0.1 = 54–58 %):

1. **TF lines no longer recompile a shader every frame** (54–57 % → 46 %). drei's `<Line>`
   disposes its material whenever its points change, so TF at 100 Hz made three.js compile and link
   the line shader on every frame (~9 % of main-thread time here, and a frame-long hitch on a weak
   GPU). TF links and path lines now use `FatLine`, which keeps its material and updates the
   geometry in place.
2. **Point clouds and color maps without per-message allocation** (→ 37 % together with 3). One
   `BufferGeometry` per stream, grown only when a message has more points; color maps read a
   sampled table instead of allocating two arrays per point (`pointColors` 4.3 % → 0.9 %).
3. **Log rows are memoized**, so a flush every 200 ms renders only new rows.
4. **Hidden panels do no render work.** Panels covered by an expanded panel keep their newest data
   but skip React updates, and the 3D render loop pauses (CPU ×4 with the 3D panel expanded: 81 % →
   73 %).
5. **Heavy topics are decoded in Web Workers** (JavaScript 21 % → 13 %; raw image conversion,
   7 % of main-thread time, is gone from it). Images, point
   clouds and maps are CDR-decoded in up to three workers, which also convert raw images to RGBA
   and scan point clouds; bytes and results move between threads as transferable buffers. One
   message per topic decodes at a time and the newest waiting message wins, so a topic that outruns
   decoding shows its newest frames instead of falling behind.
6. **Frames a panel would throttle away are not decoded.** `useTopic` passes its throttle window to
   the client (`throttleMs`), so a camera drawn at 10 fps no longer has its other 20 frames per
   second decoded and converted. Steps 5 and 6 together bring the production build to 30 %.

Without Web Workers (Jest, server rendering), or if a worker fails to start, decoding stays on the
main thread as before.

## Not covered

- The harness runs on loopback, so the link is never the bottleneck. On the robot the link is: raw
  cameras at 2.8 MB a frame queue up behind each other (1 fps, seconds behind), and in the default
  synchronized stream mode TF waits behind them. Compressed image topics, or `separate` stream mode,
  address that; 3.1.0 does not.
- The WebSocket itself still lives on the main thread; receiving the data is the largest remaining
  main-thread cost in these runs.
