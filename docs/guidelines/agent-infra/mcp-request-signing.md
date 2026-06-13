# MCP Request Signing (HMAC-SHA256)

Reference guideline for signing JSON-RPC requests crossing any non-stdio
MCP transport — HTTP, SSE, WebSocket, anything routable. Stdio over a
trusted parent-child pipe is **outside** the scope of this guideline; only
network-exposed transports require signing.

Lands ahead of any HTTP-MCP transport so the security floor is in place
when one becomes a real consumer use case (paired with the allowlist
gate tracked in the active mcp-server plate under `agents/roadmaps/`).

Adapted from an external reference — the request-signing primitive
(`CRYPTO_SEG`). The full Express bridge (~1.6k LOC) stays out of
scope; this guideline takes the **primitive**, not the runtime.

## When signing is mandatory

- Any HTTP / SSE / WebSocket MCP transport — the wire is shared with
  arbitrary callers.
- Any cross-host stdio bridge (parent and child on different machines).
- Any MCP server reachable from a browser context.

## When signing is **not** required

- Plain stdio MCP server invoked as a child process by one trusted client
  on the same host. The OS pipe is the trust boundary.
- Local-only loopback served behind a Unix domain socket with `0700`
  permissions on the socket file.

If unsure → sign. The cost is one HMAC per request.

## Signing pattern (~30 LOC reference)

`KERNEL_SECRET` is a per-installation shared secret loaded from env or a
secrets store. Never commit it. `randomUUID()` is Node's
`crypto.randomUUID`.

```js
import { createHmac, randomUUID } from 'node:crypto';

const KERNEL_SECRET = process.env.MCP_KERNEL_SECRET;
const KERNEL_ID = `mcp-kernel-${process.pid}`;

function signRequest(payload) {
  const timestamp = Date.now();
  const nonce = randomUUID();
  const data = `${timestamp}:${nonce}:${JSON.stringify(payload)}`;
  const signature = createHmac('sha256', KERNEL_SECRET)
    .update(data)
    .digest('hex');
  return { timestamp, nonce, signature, kernelId: KERNEL_ID };
}

// On every outbound MCP request:
const sig = signRequest(body);
headers['X-MCP-Kernel'] = sig.kernelId;
headers['X-MCP-Signature'] = sig.signature;
headers['X-MCP-Timestamp'] = String(sig.timestamp);
headers['X-MCP-Nonce'] = sig.nonce;
```

Header names are project-namespaced; the upstream the external runtime file uses
`X-RVF-*`, the convention here is `X-MCP-*`.

## Verification pattern (server-side counterpart)

```js
import { createHmac, timingSafeEqual } from 'node:crypto';

const KERNEL_SECRET = process.env.MCP_KERNEL_SECRET;
const MAX_SKEW_MS = 5 * 60 * 1000;        // 5 min
const seenNonces = new Map();             // nonce -> expiresAt

function verifyRequest(headers, rawBody) {
  const ts = Number(headers['x-mcp-timestamp']);
  const nonce = headers['x-mcp-nonce'];
  const sig = headers['x-mcp-signature'];
  if (!ts || !nonce || !sig) return false;
  if (Math.abs(Date.now() - ts) > MAX_SKEW_MS) return false;
  if (seenNonces.has(nonce)) return false;          // replay
  const data = `${ts}:${nonce}:${rawBody}`;
  const expected = createHmac('sha256', KERNEL_SECRET).update(data).digest();
  const got = Buffer.from(sig, 'hex');
  if (got.length !== expected.length) return false;
  if (!timingSafeEqual(got, expected)) return false;
  seenNonces.set(nonce, Date.now() + MAX_SKEW_MS);
  return true;
}
```

`timingSafeEqual` is non-negotiable — `===` on a hex string is a timing
oracle. The nonce store must evict on `expiresAt` to bound memory; a
plain `setInterval` sweep every minute is enough.

## Threat model

| Threat | Mitigation in this pattern |
|---|---|
| **Replay** — attacker captures a valid request and resends it | `nonce` + `seenNonces` set; replays inside the skew window are rejected, replays outside it fail the timestamp check |
| **MITM (non-stdio)** — wire-level rewrite | HMAC over `${ts}:${nonce}:${body}` — any payload tamper invalidates the signature; pair with TLS in production |
| **Clock skew abuse** — long-lived request | `MAX_SKEW_MS = 5 min` rejects out-of-window timestamps |
| **Timing oracle on signature compare** | `timingSafeEqual`, never `===` |
| **Secret exfil via repo / log** | `KERNEL_SECRET` from env or secrets store; never log raw headers; redact `X-MCP-Signature` in any audit trail |
| **Allowlist bypass** | Signing **does not** authorize what's called — pair with the allowlist enforced at server boot (mcp-server plate under `agents/roadmaps/`, Phase 4 **D4**); a valid signature on a non-allowlisted tool name still rejects |

## Citation hooks

- mcp-server plate under `agents/roadmaps/` — **Phase 4 D4** allowlist
  enforced at server boot. Signing layers *under* the allowlist: verify
  signature → look up tool in allowlist → execute. Both gates must pass.
- mcp-server plate under `agents/roadmaps/` — **Phase 6 F2 / F3** SSE
  transport, cloud bundle. These are the triggers that make this
  guideline load-bearing; until then it is reference material for the
  deferred-with-trigger HTTP-bridge slot tracked
  (Phase 2 P2.1) under `agents/roadmaps/`.

## Operational notes

- **Secret rotation** — rotate `MCP_KERNEL_SECRET` on a fixed cadence
  (90 days minimum). Both client and server reload from env on the next
  request; in-flight requests fail and retry with the new secret.
- **Multi-client deployments** — give every client kernel a distinct
  `KERNEL_ID` so logs attribute to a source even though all use the
  same shared secret.
- **Don't sign `tools/list`** — `tools/list` is read-only metadata; it
  can stay unsigned in deployments where the metadata itself is public.
  `tools/call` must always be signed.

## Out-of-scope

- The full Express bridge in the external reference (~1.6k LOC,
  HTTP routing, SSE streaming, auth proxying) — out of scope,
  not forked. If we ever need an HTTP-MCP server, build on this
  guideline + the host's web framework, not on the external runtime.
- Asymmetric signing (Ed25519, ECDSA). HMAC-SHA256 is sufficient for
  shared-secret deployments. Asymmetric is only worth the complexity
  when keys cross trust boundaries the shared-secret model can't
  represent.

## Appendix — HTTP-bridge `stdio-kernel` pattern (reference)

Portable shape of an external reference's stdio kernel (~250 LOC), on
hand for the day a real HTTP-MCP consumer surfaces (`road-to-mcp-server.md`
Phase 6 F2 / F3). Full file stays **out of scope**.

**Trigger to inline more:** both — (a) Phase 1 ships stdio prompt fetch
in ≥1 confirmed client, (b) ≥1 consumer surfaces a concrete HTTP-MCP
use case. Until then, this appendix is the reference.

### Pattern shape

The kernel sits between the HTTP transport and the spawned stdio MCP
child. Inbound: HTTP → `verifyRequest` → JSON-RPC onto child stdin.
Outbound: child stdout → parsed → signed response → HTTP.

```
client ──HTTP──▶ kernel.verify ──stdin──▶ stdio MCP child
client ◀─HTTP── kernel.sign  ◀─stdout── stdio MCP child
```

Six load-bearing pieces:

1. **Process supervisor** — spawn with `stdio: ['pipe', 'pipe', 'inherit']`,
   restart on exit with bounded backoff, SIGTERM on shutdown.
2. **JSON-RPC framing** — newline-delimited JSON; buffer partial
   stdout reads; drop unparseable frames with a logged warning, never
   crash the bridge.
3. **Request-id correlation** — kernel generates outbound `id`, maps
   `kernelId → clientId`; slow calls can't cross-talk between HTTP
   clients.
4. **Verification gate** — `verifyRequest` (above) before stdin write;
   failure is a 401, never a 500; never log the raw signature.
5. **Allowlist enforcement** — after verify, look up the JSON-RPC
   `method` in the boot-time allowlist (`road-to-mcp-server.md` **D4**).
   Non-allowlisted → JSON-RPC `-32601 Method not found`; no enumeration
   leak.
6. **Backpressure** — bound the in-flight queue per kernel (the external runtime
   uses 32); beyond it, return `429`. Otherwise a flood OOMs the child.

### Out of this appendix

Express routes / middleware / SSE upgrade — host web framework.
The external reference's marketplace + `mcp__claude-flow__*` tools —
never adopted (see the related internal roadmap Sunset path).
Multi-tenant routing — out-of-scope until a consumer surfaces a
tenancy requirement.

### Citation hooks

- `road-to-mcp-server.md` **Phase 6 F2 / F3** — SSE / cloud-bundle work
  starts here; the upstream link is the authoritative source.
- An internal roadmap (local-only) **P2.1** — landed this appendix;
  full bridge fork stays out-of-scope unless the dual trigger fires.
- [`mcp-cloud-scope.md`](../../contracts/mcp-cloud-scope.md) —
  operationalizes this pattern as a TypeScript Cloudflare Worker (no
  spawned stdio child; R2 blob replaces the child process). HMAC
  `verifyRequest` is deferred to MVP-2 alongside auth.
