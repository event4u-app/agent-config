# WebSocket Guidelines

> WebSocket conventions — Laravel Broadcasting, channel types, connection management, payloads.

**Related Skills:** `websocket`, `laravel-reverb`

## Laravel Broadcasting Setup

```php
// config/broadcasting.php
'connections' => [
    'reverb' => [
        'driver' => 'reverb',
        'key' => env('REVERB_APP_KEY'),
        'secret' => env('REVERB_APP_SECRET'),
    ],
],
```

## Broadcasting Events

```php
class OrderStatusUpdated implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(public readonly Order $order) {}

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
        ];
    }
}
```

## Channel Types

| Type | Prefix | Auth | Use case |
|---|---|---|---|
| Public | none | No | Public notifications, live feeds |
| Private | `private-` | Yes | User-specific updates |
| Presence | `presence-` | Yes | Who's online, collaborative editing |

## Channel Authorization

```php
// routes/channels.php
Broadcast::channel('orders.{customerId}', function (User $user, int $customerId) {
    return $user->customer_id === $customerId;
});
```

## Client (Laravel Echo)

```ts
echo.private(`orders.${customerId}`)
  .listen('.order.status.updated', (event) => {
    console.log('Order updated:', event.order_id, event.status)
  })
```

## Connection Management

### Reconnection

Exponential backoff: `delay = min(1000 * 2^retryCount, 30000)`, max 10 retries.

### Heartbeat

- Server ping every 30s, client responds with pong.
- No pong within 10s → close and reconnect.

## Core Rules

- Always authorize private and presence channels.
- Keep payloads small — IDs and changed fields, not full objects.
- Implement reconnection with exponential backoff.
- Use heartbeats to detect dead connections.
- Handle offline gracefully — queue messages, sync on reconnect.
- Use `broadcastWith()` to control the payload.

## Do NOT

- Send entire model objects — select only needed fields.
- Rely on WebSocket delivery — use acknowledgments.
- Skip channel authorization for user-specific data.
- Create too many channels — group related events.
