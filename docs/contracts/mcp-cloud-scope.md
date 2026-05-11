---
stability: experimental
---

# MCP Server — Cloud Scope (A0-cloud Hard Contract)

> **Status:** Active · covers `workers/mcp/` (TypeScript Cloudflare
> Worker bridge), MVP-1 surface. Extends — does **not** supersede —
> [`mcp-phase-1-scope.md`](mcp-phase-1-scope.md), which retains
> exclusive ownership of `scripts/mcp_server/` (local stdio).
> **Stability:** experimental — not linked from README, AGENTS.md, or
> `docs/architecture.md`. Internal index reference only per `STABILITY.md`.

## Purpose

Locks the **execution-safety boundary** for the hosted MCP Worker. Any
code under `workers/mcp/` must satisfy this contract verbatim. The
local stdio kernel and the hosted Worker are two distinct surfaces; a
deviation in one is **not** authorized by a precedent in the other.

The Worker IS the bridge described in
[`mcp-request-signing § Appendix`](../guidelines/agent-infra/mcp-request-signing.md#appendix--http-bridge-stdio-kernel-pattern-reference)
— but with two material differences from the appendix pattern: (1) no
spawned stdio child (content is read from a release-pinned R2 blob,
not a sub-process), and (2) no HMAC for MVP-1 (content is OSS and
read-only; the appendix pattern's `verifyRequest` is deferred to MVP-2
alongside auth).

## In-scope (MVP-1)

- **Transport:** HTTP + SSE (Cloudflare Worker `fetch` handler). The
  local stdio kernel is out-of-scope for this contract and stays
  governed by `mcp-phase-1-scope.md`.
- **MCP primitives:** `prompts/list` + `prompts/get` + `resources/list`
  + `resources/read` — read-only, parity with the local stdio surface.
- **Source data:** release-pinned content blob in R2 under the key
  shape `releases/v<X.Y.Z>-<sha>/` (immutable per release). The blob
  bundles `.agent-src/skills/<name>/SKILL.md`,
  `.agent-src/commands/**/*.md`, and `docs/guidelines/` (the same
  projection the local kernel reads). Never reads `.agent-src.uncompressed/`.
- **Identity surface:** `serverInfo.version` reads from a Worker-
  bundled constant, `_meta.packageVersion` reads from a
  `wrangler.toml` env var, `_meta.skillSetSignature` reads from a
  **prebaked manifest JSON** shipped with the content blob. The
  Worker never computes the signature at runtime.
- **URL shape:** two pinned shapes only —
  `mcp.<host>/v<X.Y.Z>/sse` (immutable, cache TTL 1 h) and
  `mcp.<host>/latest/sse` (pointer, cache TTL 5 min). The `latest`
  pointer is repointed atomically by the release pipeline after a
  green smoke run; pre-smoke failures leave it on the previous
  release.
- **Pagination + hot-reload parity:** `prompts/list` paginates with
  `nextCursor` the same way the stdio kernel does; the Worker has no
  hot-reload because the content blob is immutable per release —
  the **release** is the cache-bust event.
- **Deprecated tool stubs:** `tools/list` returns exactly two entries,
  `lint_skills` and `chat_history_append`, both with
  `deprecated: true` and a description pointing to the local stdio
  server. `tools/call` against either returns `isError=true` with a
  message naming the local-stdio successor. No other tool name is
  reachable.

## Out-of-scope (MVP-1)

- **Tool execution.** `lint_skills` and `chat_history_append` are
  exposed as deprecated stubs only — no TS port, no FS access, no
  shell, no Python runtime in the Worker. Restoration is the
  Phase-7-DEFERRED block of the roadmap, gated on a real consumer ask
  plus a multi-tenant security review.
- **`.agent-settings.yml` exposure.** Consumer-machine config, never
  surfaced as a resource. The Worker has no access to consumer FS at
  any layer.
- **Agent memory** — separate MCP server, different roadmap.
- **Chat history persistence** — the local kernel writes to
  `agents/.agent-chat-history`; the Worker has no equivalent. Listed
  as a deprecated stub per above.
- **Authentication / multi-tenancy.** MVP-1 is open (OSS content,
  read-only). Bearer / CF Access / HMAC moves to MVP-2 alongside
  tool restoration.
- **Network egress from the Worker** beyond an **explicit subrequest
  allowlist** — see invariants below.

## A0-cloud invariants

The Worker code must satisfy all of:

1. **Origin allowlist** — `fetch()` calls from the Worker are limited
   to R2 (content read) and an explicit observability sink (optional).
   No calls to consumer infrastructure, no calls to upstream LLM
   APIs, no calls to `api.github.com`, no DNS-based egress. Enforced
   in `wrangler.toml` via Worker-level network policies.
2. **R2 write boundary** — the Worker never writes to R2. The release
   pipeline writes under `releases/v<X.Y.Z>-<sha>/` and atomically
   repoints `releases/latest.txt`; the Worker only reads.
3. **Per-versioned-URL immutability** — for any
   `mcp.<host>/v<X.Y.Z>/sse`, the response body is deterministic for
   the lifetime of the deployment. Patch fixes ship a new version key;
   the existing key is never rewritten. R2 eventual consistency is
   handled by the unique-key-per-release shape.
4. **Cache-TTL policy** — pinned URLs cache at the edge for 1 h
   (safe because immutable); `latest` caches for 5 min (bounded
   staleness window after a repoint). No client may rely on `latest`
   for reproducibility — that is what the pinned URL is for.
5. **Prebaked signature** — `skillSetSignature` is computed once by
   the release pipeline against the worktree at the tag and stored in
   `releases/v<X.Y.Z>-<sha>/manifest.json`. The Worker reads, never
   computes. Any signature drift at runtime is a contract violation.
6. **No consumer code execution.** No `eval`, no dynamic import of
   content, no shelling out, no spawning a runtime. The Worker is a
   read-and-route function.
7. **Single deployment per release.** One `wrangler deploy` per tag.
   Concurrent deployments are not supported; the release pipeline
   serializes through `release: published` + `workflow_dispatch`
   hotfix paths.
8. **Ingress protection = edge cache + platform rate limit.** MVP-1
   is auth-less by design; the public surface is shielded by two
   layers Cloudflare provides without code: (a) edge caching per
   invariant 4 (1 h on pinned URLs, 5 min on `latest`) absorbs
   read-loop traffic before it reaches the Worker, and (b)
   Cloudflare's account-level anti-abuse + DDoS shielding caps
   per-IP burst on `*.workers.dev`. These two together **are** the
   MVP-1 auth surrogate. **Promotion triggers** — any of these
   flips HMAC (currently MVP-2 §Out-of-scope) from deferred to
   active before the wake-up triggers below would otherwise fire:
   sustained 429 spikes from origin (cache miss storm), Workers
   request-cost line item exceeding the free-tier budget for two
   consecutive billing periods, or a CVE-class abuse report
   against the endpoint. A per-Worker `[[unsafe.bindings]]`
   rate-limiter in `wrangler.toml` is **not** configured in MVP-1
   — adding one is a contract amendment, not a free hand.

## Deprecated tool stub contract

`tools/list` returns:

```json
[
  {
    "name": "lint_skills",
    "description": "Deprecated on hosted MCP — use the local stdio server (scripts/mcp_server/) which retains this tool. See road-to-cloudflare-mcp-hosting Phase 7 for restoration triggers.",
    "deprecated": true
  },
  {
    "name": "chat_history_append",
    "description": "Deprecated on hosted MCP — filesystem-bound, local-only. Use the local stdio server.",
    "deprecated": true
  }
]
```

`tools/call` against either name returns `isError=true` with the same
deprecation message. No other tool name is reachable.

## MVP-2 wake-up triggers

The Phase-7 deferred items in the roadmap (tool restoration, history
persistence, auth) wake up only when **all** of these fire:

- A named consumer (internal or external) requests hosted lint or
  history.
- A security review has approved the validation layer for
  `lint_skills` (URI regex allowlist, size limits, timeout,
  concurrency cap).
- An auth model has been selected (bearer vs. CF Access vs. HMAC).
- The server stability label has been promoted from *experimental*
  to *beta*.

## Revision policy

This contract is **experimental** — breaking changes are allowed in
any release with a CHANGELOG note. Promotion to `beta` requires at
least one shipped client connecting to the hosted endpoint end-to-end
without a contract amendment.

## See also

- [`mcp-phase-1-scope.md`](mcp-phase-1-scope.md) — local-stdio kernel
  contract (sibling, not parent).
- [`STABILITY.md`](../../STABILITY.md) — stability policy for
  `docs/contracts/`.
- [`mcp-request-signing § Appendix`](../guidelines/agent-infra/mcp-request-signing.md#appendix--http-bridge-stdio-kernel-pattern-reference)
  — bridge pattern reference (the Worker is a flavor of this).
