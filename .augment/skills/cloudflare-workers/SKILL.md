---
name: cloudflare-workers
description: "Use when building Cloudflare Workers, KV stores, D1 databases, R2 storage, Durable Objects, Queues, or edge computing logic."
source: package
---

# cloudflare-workers

## When to use

Cloudflare Workers/Pages/edge services. Before: `wrangler.toml`, framework, bindings, environment.

## Worker structure

```ts
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url)

    if (url.pathname === '/api/users') {
      const users = await env.DB.prepare('SELECT * FROM users').all()
      return Response.json(users.results)
    }

    return new Response('Not Found', { status: 404 })
  },
} satisfies ExportedHandler<Env>
```

## Bindings

### KV (Key-Value Store)

```ts
// Read
const value = await env.MY_KV.get('key')
const data = await env.MY_KV.get('key', 'json')

// Write (with optional TTL)
await env.MY_KV.put('key', 'value', { expirationTtl: 3600 })

// Delete
await env.MY_KV.delete('key')
```

Best for: Configuration, cached data, session storage. Eventually consistent.

### D1 (SQL Database)

```ts
// Query
const { results } = await env.DB.prepare('SELECT * FROM users WHERE id = ?')
  .bind(userId)
  .all()

// Insert
await env.DB.prepare('INSERT INTO users (name, email) VALUES (?, ?)')
  .bind(name, email)
  .run()

// Batch
await env.DB.batch([
  env.DB.prepare('INSERT INTO users (name) VALUES (?)').bind('Alice'),
  env.DB.prepare('INSERT INTO users (name) VALUES (?)').bind('Bob'),
])
```

Best for: Relational data, complex queries. SQLite-based.

### R2 (Object Storage)

```ts
// Upload
await env.MY_BUCKET.put('file.pdf', fileData, {
  httpMetadata: { contentType: 'application/pdf' },
})

// Download
const object = await env.MY_BUCKET.get('file.pdf')
if (object) return new Response(object.body, { headers: { 'Content-Type': 'application/pdf' } })

// List
const listed = await env.MY_BUCKET.list({ prefix: 'uploads/' })
```

Best for: File storage, media, backups. S3-compatible.

### Durable Objects

```ts
export class Counter implements DurableObject {
  private count = 0

  async fetch(request: Request): Promise<Response> {
    this.count++
    return Response.json({ count: this.count })
  }
}

// Usage from Worker
const id = env.COUNTER.idFromName('global')
const stub = env.COUNTER.get(id)
const response = await stub.fetch(request)
```

Best for: Stateful coordination, WebSockets, rate limiting. Single-instance guarantee.

### Queues

```ts
// Producer
await env.MY_QUEUE.send({ type: 'email', to: 'user@example.com' })

// Consumer
export default {
  async queue(batch: MessageBatch<QueueMessage>, env: Env) {
    for (const message of batch.messages) {
      await processMessage(message.body)
      message.ack()
    }
  },
}
```

Best for: Background processing, decoupling, retry logic.

## Hono framework

```ts
import { Hono } from 'hono'

const app = new Hono<{ Bindings: Env }>()

app.get('/api/users', async (c) => {
  const users = await c.env.DB.prepare('SELECT * FROM users').all()
  return c.json(users.results)
})

app.post('/api/users', async (c) => {
  const body = await c.req.json()
  await c.env.DB.prepare('INSERT INTO users (name) VALUES (?)').bind(body.name).run()
  return c.json({ success: true }, 201)
})

export default app
```

## Core rules

- **Always parameterize D1 queries** — use `.bind()`, never string interpolation.
- **Handle errors gracefully** — Workers should never throw unhandled exceptions.
- **Use `ctx.waitUntil()`** for background work that shouldn't block the response.
- **Respect size limits** — Worker script: 10MB, KV value: 25MB, D1 row: 1MB.
- **Use TypeScript** — type your `Env` bindings for safety.


## Gotcha: 10ms CPU limit (free), KV eventually consistent, `fetch()` infinite loops possible.

## Do NOT: Node.js APIs (use Web Standards), secrets in code, KV for frequent writes, exceed CPU limits, interpolate D1 queries.
