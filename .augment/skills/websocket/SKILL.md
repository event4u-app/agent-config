---
name: websocket
description: "Use when implementing WebSocket communication, real-time features, broadcasting patterns, or connection management."
---

# websocket

## When to use

Real-time: WebSockets, SSE, Broadcasting, persistent connections. Reverb-specific → `laravel-reverb`. NOT for: REST (`api-design`), one-time HTTP.

## Laravel Broadcasting

### Setup

```php
// config/broadcasting.php — Pusher, Ably, or Laravel Reverb
'connections' => [
    'reverb' => [
        'driver' => 'reverb',
        'key' => env('REVERB_APP_KEY'),
        'secret' => env('REVERB_APP_SECRET'),
    ],
],
```

### Broadcasting events

```php
class OrderStatusUpdated implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(
        public readonly Order $order,
    ) {}

    public function broadcastOn(): array
    {
        return [new PrivateChannel('orders.' . $this->order->customer_id)];
    }

    public function broadcastAs(): string
    {
        return 'order.status.updated';
    }

    public function broadcastWith(): array
    {
        return [
            'order_id' => $this->order->id,
            'status' => $this->order->status,
            'updated_at' => $this->order->updated_at->toISOString(),
        ];
    }
}
```

### Channel authorization

```php
// routes/channels.php
Broadcast::channel('orders.{customerId}', function (User $user, int $customerId) {
    return $user->customer_id === $customerId;
});
```

### Client (Laravel Echo)

```ts
import Echo from 'laravel-echo'

const echo = new Echo({
  broadcaster: 'reverb',
  key: import.meta.env.VITE_REVERB_APP_KEY,
  wsHost: import.meta.env.VITE_REVERB_HOST,
  wsPort: import.meta.env.VITE_REVERB_PORT,
})

// Private channel
echo.private(`orders.${customerId}`)
  .listen('.order.status.updated', (event) => {
    console.log('Order updated:', event.order_id, event.status)
  })

// Presence channel (who's online)
echo.join(`project.${projectId}`)
  .here((users) => console.log('Online:', users))
  .joining((user) => console.log('Joined:', user))
  .leaving((user) => console.log('Left:', user))
```

## Channel types

| Type | Prefix | Auth | Use case |
|---|---|---|---|
| **Public** | none | No | Public notifications, live feeds |
| **Private** | `private-` | Yes | User-specific updates |
| **Presence** | `presence-` | Yes | Who's online, collaborative editing |

## Raw WebSocket (non-Laravel)

```ts
// Server (Node.js / Cloudflare Durable Objects)
const wss = new WebSocketServer({ port: 8080 })

wss.on('connection', (ws) => {
  ws.on('message', (data) => {
    const message = JSON.parse(data.toString())
    // Handle message
    ws.send(JSON.stringify({ type: 'ack', id: message.id }))
  })

  ws.on('close', () => { /* cleanup */ })
})

// Client
const ws = new WebSocket('wss://example.com/ws')
ws.onopen = () => ws.send(JSON.stringify({ type: 'subscribe', channel: 'updates' }))
ws.onmessage = (event) => {
  const data = JSON.parse(event.data)
  // Handle message
}
ws.onclose = () => { /* reconnect logic */ }
```

## Connection management

### Reconnection

```ts
function createReconnectingWebSocket(url: string) {
  let ws: WebSocket
  let retryCount = 0
  const maxRetries = 10

  function connect() {
    ws = new WebSocket(url)
    ws.onopen = () => { retryCount = 0 }
    ws.onclose = () => {
      if (retryCount < maxRetries) {
        const delay = Math.min(1000 * Math.pow(2, retryCount), 30000)
        setTimeout(connect, delay)
        retryCount++
      }
    }
  }

  connect()
}
```

### Heartbeat

Send periodic pings to detect dead connections:
- Server sends ping every 30s.
- Client responds with pong.
- If no pong within 10s, close and reconnect.

## Core rules

- **Always authorize** private and presence channels.
- **Keep payloads small** — send IDs and changed fields, not full objects.
- **Implement reconnection** with exponential backoff.
- **Use heartbeats** to detect dead connections.
- **Handle offline gracefully** — queue messages, sync on reconnect.
- **Broadcast specific data** — use `broadcastWith()` to control the payload.

## Gotcha: stateful connections (don't assume persistence), always reconnect with backoff, sensitive data → private/presence channels.

## Do NOT: send entire models (select fields), rely on delivery (use acks), skip channel auth, too many channels.
