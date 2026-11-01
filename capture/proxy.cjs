// Serves MITI from localhost:3000 on port 3010, answering /api/bridge as `miti run --bridge` would.
const http = require('http'), net = require('net');
const STATUS = { available: true, domainId: 0, peers: ['192.168.10.27'], distro: 'jazzy', rmw: 'rmw_fastrtps_cpp', port: 8765, state: 'running', exitCode: null,
  log: ['[foxglove_bridge] Server listening on port 8765'] };
http.createServer((req, res) => {
  if (req.url.startsWith('/api/bridge')) { res.setHeader('Content-Type', 'application/json'); return res.end(JSON.stringify(STATUS)); }
  const up = http.request({ host: '127.0.0.1', port: 3011, path: req.url, method: req.method, headers: req.headers }, (r) => { res.writeHead(r.statusCode, r.headers); r.pipe(res); });
  req.pipe(up);
}).on('upgrade', (req, sock) => { const up = net.connect(3011, '127.0.0.1', () => { up.write(`${req.method} ${req.url} HTTP/1.1\r\n` + Object.entries(req.headers).map(([k, v]) => `${k}: ${v}`).join('\r\n') + '\r\n\r\n'); sock.pipe(up).pipe(sock); }); })
  .listen(3010, '127.0.0.1', () => console.log('proxy on http://localhost:3010'));
