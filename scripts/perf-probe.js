/**
 * Browser-side half of the heavy-load harness (see docs/PERFORMANCE.md). Paste into the DevTools
 * console of a MITI tab, or evaluate it from an automation tool, then:
 *
 *   mitiPerf.setup('ws://localhost:8790', 3)  // heavy layout + bridge URL, then reloads
 *   await mitiPerf.measure(20)                // frame rate, worst frame and long tasks over 20 s
 */
(() => {
  /** 3D Scene (lidar, costmap, TF) on the left, cameras stacked on the right, Log below. */
  function layout(cams) {
    const cameras = Array.from({ length: cams }, (_, i) => ({
      i: `camera-${i}`,
      type: 'camera-viewer',
      title: `Camera ${i}`,
      x: 0,
      y: 0,
      w: 4,
      h: 9,
      props: { topic: `/camera${i}/color/image_raw` },
    }));
    const stack = (ids) =>
      ids.length === 1
        ? ids[0]
        : {
            direction: 'column',
            first: ids[0],
            second: stack(ids.slice(1)),
            splitPercentage: 100 / ids.length,
          };
    const widgets = [
      {
        i: 'scene',
        type: 'urdf-viewer',
        title: '3D',
        x: 0,
        y: 0,
        w: 6,
        h: 18,
        props: {
          fixedFrame: 'map',
          layers: [
            { topic: '/livox/lidar', type: 'pointcloud', enabled: true },
            { topic: '/local_costmap/costmap', type: 'map', enabled: true },
          ],
        },
      },
      { i: 'log', type: 'log', title: 'Log', x: 0, y: 18, w: 12, h: 8, props: {} },
      ...cameras,
    ];
    const top = cams
      ? {
          direction: 'row',
          first: 'scene',
          second: stack(cameras.map((c) => c.i)),
          splitPercentage: 50,
        }
      : 'scene';
    return {
      widgets,
      mosaic: { direction: 'column', first: top, second: 'log', splitPercentage: 72 },
    };
  }

  function setup(url = 'ws://localhost:8790', cams = 3) {
    localStorage.setItem('miti_bridge_url', JSON.stringify(url));
    localStorage.setItem('miti_layout_config', JSON.stringify(layout(cams)));
    location.reload();
  }

  /**
   * Frame times from requestAnimationFrame, main-thread long tasks (> 50 ms), and how long a task
   * posted every 50 ms waits before it runs: the delay a click or key press would see.
   */
  function measure(seconds = 20) {
    return new Promise((resolve) => {
      const frames = [];
      const longTasks = [];
      let observer = null;
      try {
        observer = new PerformanceObserver((list) =>
          list.getEntries().forEach((entry) => longTasks.push(entry.duration))
        );
        observer.observe({ type: 'longtask', buffered: false });
      } catch {
        /* Long tasks are a Chromium API. */
      }
      const delays = [];
      const channel = new MessageChannel();
      let posted = 0;
      channel.port1.onmessage = () => delays.push(performance.now() - posted);
      const ping = setInterval(() => {
        posted = performance.now();
        channel.port2.postMessage(0);
      }, 50);
      const start = performance.now();
      let last = start;
      const tick = (now) => {
        frames.push(now - last);
        last = now;
        if (now - start < seconds * 1000) requestAnimationFrame(tick);
        else finish(now);
      };
      requestAnimationFrame(tick);
      function finish(now) {
        observer?.disconnect();
        clearInterval(ping);
        const waits = [...delays].sort((a, b) => a - b);
        const sorted = [...frames].sort((a, b) => a - b);
        const pct = (p) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))];
        const round = (v) => Math.round(v * 10) / 10;
        resolve({
          seconds: round((now - start) / 1000),
          fps: round((frames.length * 1000) / (now - start)),
          frameP50: round(pct(0.5)),
          frameP95: round(pct(0.95)),
          worstFrame: round(sorted[sorted.length - 1]),
          framesOver50ms: frames.filter((f) => f > 50).length,
          longTasks: longTasks.length,
          longTaskMs: Math.round(longTasks.reduce((a, b) => a + b, 0)),
          longestTask: Math.round(Math.max(0, ...longTasks)),
          inputDelayP95: round(waits[Math.floor(waits.length * 0.95)] ?? 0),
          inputDelayMax: round(waits[waits.length - 1] ?? 0),
        });
      }
    });
  }

  window.mitiPerf = { setup, measure, layout };
})();
