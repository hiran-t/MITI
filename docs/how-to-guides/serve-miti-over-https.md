# Serve MITI over HTTPS

To put MITI behind nginx, for example to give it a name and a certificate, forward WebSocket upgrades as well as pages.

## Configure nginx

```nginx
server {
    listen 80;
    server_name miti.example.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }
}
```

## The bridge over HTTPS

A page served over HTTPS can only open `wss://` bridges; MITI's default then becomes `wss://<host>:8765`, so terminate TLS for the bridge as well (for example a second `server` block proxying to port 8765), or use foxglove_bridge's own `tls:=true certfile:=... keyfile:=...`.
