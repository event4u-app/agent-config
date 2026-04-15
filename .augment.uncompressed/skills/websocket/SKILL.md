---
name: websocket
description: "Use when implementing WebSocket communication, real-time features, broadcasting patterns, or connection management."
source: package
---

# websocket

## When to use

Use when implementing real-time features — WebSockets, Broadcasting, or persistent connections.

Do NOT use when:
- REST API endpoints (use `api-design` skill)
- Reverb server setup/deployment (use `laravel-reverb` skill)

## Procedure: Create a broadcast event

### Step 0: Inspect

1. Check `config/broadcasting.php` for driver (Reverb, Pusher, Ably).
2. Check existing broadcast events — match patterns.
3. Check `routes/channels.php` for channel authorization.

### Step 1: Create event class

1. Implement `ShouldBroadcast`.
2. Define `broadcastOn()` with appropriate channel type (public/private/presence).
3. Define `broadcastAs()` for event name.
4. Define `broadcastWith()` — small payload (IDs + changed fields only).

### Step 2: Authorize channel

Add authorization in `routes/channels.php` for private/presence channels.

### Step 3: Client setup

Use Laravel Echo to listen on the channel. Wire up reconnection with exponential backoff.

## Conventions

→ See guideline `php/websocket.md` for broadcasting setup, channel types, connection management, Echo.

### Validate

- Verify private/presence channels have authorization in `routes/channels.php`.
- Confirm event implements `ShouldBroadcast` (or `ShouldBroadcastNow`).
- Check that no sensitive data is broadcast on public channels.
- Test client receives event — use browser console or Echo debug mode.

## Gotcha

- Connections are stateful — don't assume they persist after page navigation.
- Always implement reconnection with exponential backoff.
- Don't broadcast sensitive data on public channels — use private/presence.

## Do NOT

- Do NOT send entire model objects — select only needed fields.
- Do NOT skip channel authorization for user-specific data.
- Do NOT rely on WebSocket delivery — use acknowledgments for critical messages.

## Auto-trigger keywords

- WebSocket
- real-time
- broadcasting
- Laravel Echo
- channel authorization
- ShouldBroadcast
