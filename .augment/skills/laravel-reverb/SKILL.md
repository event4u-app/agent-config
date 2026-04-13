---
name: laravel-reverb
description: "Use when configuring Laravel Reverb — the first-party WebSocket server with Pusher protocol compatibility, horizontal scaling, and Pulse monitoring."
---

# laravel-reverb

## When to use

Reverb install/config/deploy/scaling/debug/monitoring. General WebSocket → `websocket` skill.

## What is Reverb

Laravel Reverb is Laravel's first-party, blazing-fast WebSocket server. It uses the
**Pusher protocol**, making it compatible with Laravel Echo and any Pusher-compatible client.
A single Reverb server can handle thousands of concurrent connections.

## Installation

```bash
php artisan install:broadcasting
```

This scaffolds:
- `config/broadcasting.php` with Reverb driver
- `config/reverb.php` with server settings
- `routes/channels.php` for channel authorization
- `.env` variables for Reverb

## Configuration

### Environment variables

```env
REVERB_APP_ID=455493
REVERB_APP_KEY=your-app-key
REVERB_APP_SECRET=your-app-secret
REVERB_HOST="localhost"
REVERB_PORT=8080
REVERB_SCHEME=http

# Client-side (Vite)
VITE_REVERB_APP_KEY="${REVERB_APP_KEY}"
VITE_REVERB_HOST="${REVERB_HOST}"
VITE_REVERB_PORT="${REVERB_PORT}"
VITE_REVERB_SCHEME="${REVERB_SCHEME}"
```

### config/reverb.php

Note: `REVERB_HOST` / `REVERB_PORT` are for client connections (hostname/port the client connects to).
`REVERB_SERVER_HOST` / `REVERB_SERVER_PORT` are for the server binding (interface/port the server listens on).

```php
'servers' => [
    'reverb' => [
        'host' => env('REVERB_SERVER_HOST', '0.0.0.0'),
        'port' => env('REVERB_SERVER_PORT', 8080),
        'hostname' => env('REVERB_HOST'),
        'options' => [
            'tls' => [],
        ],
        'max_request_size' => 10_000,  // bytes
        'scaling' => [
            'enabled' => env('REVERB_SCALING_ENABLED', false),
            'channel' => env('REVERB_SCALING_CHANNEL', 'reverb'),
        ],
        'pulse_ingest_interval' => 15,
    ],
],
```

### config/broadcasting.php

```php
'connections' => [
    'reverb' => [
        'driver' => 'reverb',
        'key' => env('REVERB_APP_KEY'),
        'secret' => env('REVERB_APP_SECRET'),
        'app_id' => env('REVERB_APP_ID'),
        'options' => [
            'host' => env('REVERB_HOST'),
            'port' => env('REVERB_PORT', 443),
            'scheme' => env('REVERB_SCHEME', 'https'),
            'useTLS' => env('REVERB_SCHEME', 'https') === 'https',
        ],
    ],
],
```

## Running the server

```bash
# Start Reverb (foreground)
php artisan reverb:start

# Start with verbose output (debugging)
php artisan reverb:start --debug

# Production — use Supervisor or systemd
# Reverb is a long-running process, it must be managed by a process monitor
```

### Supervisor config (production)

```ini
[program:reverb]
command=php /path/to/artisan reverb:start
autostart=true
autorestart=true
user=www-data
redirect_stderr=true
stdout_logfile=/var/log/reverb.log
stopwaitsecs=3600
```

## Horizontal scaling

Enable Redis-based scaling to run multiple Reverb instances behind a load balancer:

```env
REVERB_SCALING_ENABLED=true
REVERB_SCALING_CHANNEL=reverb
```

Requires a shared Redis instance accessible by all Reverb servers.
Connections and channel subscriptions are synced across servers via Redis pub/sub.

## Monitoring with Pulse

Reverb has built-in Laravel Pulse integration. Add the Reverb Pulse cards:

```php
// In your Pulse dashboard
<livewire:reverb.connections />
<livewire:reverb.messages />
```

## SSL/TLS in production

Reverb itself does **not** handle TLS. Use a reverse proxy (Nginx, Traefik, Caddy)
to terminate SSL and proxy WebSocket connections to Reverb:

```nginx
location /app {
    proxy_pass http://127.0.0.1:8080;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_read_timeout 60s;
    proxy_send_timeout 60s;
}
```

## Core rules

- **Reverb is a long-running process** — always use Supervisor/systemd in production.
- **TLS via reverse proxy** — Reverb doesn't handle SSL directly.
- **Scale with Redis** — enable `REVERB_SCALING_ENABLED` for multi-server setups.
- **Monitor with Pulse** — use the built-in Pulse cards for connection/message metrics.
- **Pusher protocol** — any Pusher-compatible client works (Laravel Echo, pusher-js, etc.).
- **Max request size** — default 10KB, increase for large payloads if needed.

## Gotcha: persistent process (no serverless), set REVERB_HOST/PORT, WebSocket bypasses middleware.

## Do NOT: expose without reverse proxy (TLS), no process monitor in prod, confuse with Pusher SaaS, skip Redis for multi-instance.
