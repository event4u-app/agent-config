---
stability: experimental
mcp_scope: lite
---

# MCP Server — Cloud Scope (A0-cloud Hard Contract)

> **Status:** Active · covers `internal/workers/mcp/` (TypeScript Cloudflare
> Worker bridge), MVP-1 surface. Extends — does **not** supersede —
> [`mcp-phase-1-scope.md`](mcp-phase-1-scope.md), which retains
> exclusive ownership of `scripts/mcp_server/` (local stdio).
> **Stability:** experimental — not linked from README, AGENTS.md, or
> `docs/architecture.md`. Internal index reference only per `STABILITY.md`.

## Purpose

Locks the **execution-safety boundary** for the hosted MCP Worker. Any
code under `internal/workers/mcp/` must satisfy this contract verbatim. The
local stdio kernel and the hosted Worker are two distinct surfaces; a
deviation in one is **not** authorized by a precedent in the other.

The Worker IS the bridge described in
[`mcp-request-signing § Appendix`](../guidelines/agent-infra/mcp-request-signing.md#appendix--http-bridge-stdio-kernel-pattern-reference)
— but with two material differences from the appendix pattern: (1) no
spawned stdio child (content is read from a release-pinned R2 blob,
not a sub-process), and (2) no HMAC for MVP-1 (content is OSS and
read-only; the appendix pattern's `verifyRequest` is deferred to MVP-2
alongside auth).

## MCP scope: Lite vs Full

The package ships **two MCP surfaces** governed by named scopes. Every
MCP-related doc, ADR, and code path carries `mcp_scope: lite|full|deferred`
in its frontmatter (Phase 1 Step 6 of the distribution-maturity roadmap,
under `agents/roadmaps/`) so the boundary is machine-checkable, not
prose-only.

### `mcp_scope: lite` — hosted, read-only knowledge surfaces

- **What it serves:** the governance content as MCP `prompts` and
  `resources` — skills (`.agent-src/skills/<name>/SKILL.md`), commands
  (`.agent-src/commands/**/*.md`), rules (`.agent-src/rules/*.md`),
  guidelines (`docs/guidelines/`), and the docs index. Plus a small
  set of **read-only tools** (`memory_lookup`, `chat_history_read`,
  `list_*`, `read_resource_body`) that touch the content blob only.
- **What it never does:** execute Python scripts, shell out, spawn
  runtimes, touch consumer FS, write to R2, mutate consumer state,
  call upstream LLM APIs, or read `.agent-src.uncompressed/`.
- **Owner code path:** `internal/workers/mcp/` (TypeScript, Cloudflare Worker).
  This contract is the normative spec.
- **Auth model:** `public` (default) or `bearer-auth` (operator opt-in)
  per `## Auth surface`. HMAC and CF Access are declared but deferred.
- **Invariant 8 binding:** **layered, mode-aware ingress protection**
  (edge cache + Cloudflare DDoS shielding + per-request bearer when
  set) is the **only** access control. Anything that would require a
  finer-grained policy — per-tool ACLs, per-tenant scoping, mutation
  authorization — is **out of `lite` scope by construction**, and
  per `## A0-cloud invariants § 8` would require a contract amendment,
  not a Worker code change.

### `mcp_scope: full` — local stdio kernel, MVP-2+ execution

- **What it serves:** the full local kernel — `prompts/list`,
  `prompts/get`, `resources/list`, `resources/read` **plus**
  execution-side tools (`lint_skills`, `chat_history_append`, and
  the MVP-2 deferred tool set). Reads from the live worktree
  (`.agent-src/` projection), not a release-pinned blob.
- **What it requires:** a local install per Quickstart (`npx
  @event4u/agent-config init` or `task mcp:setup`) — Python runtime,
  the package's ~112 scripts on disk, and a consumer-side
  `.agent-settings.yml`.
- **Owner code path:** `scripts/mcp_server/` (Python stdio). Governed
  by [`mcp-phase-1-scope.md`](mcp-phase-1-scope.md), not this
  contract — the two surfaces are siblings, not parent / child.
- **Auth model:** filesystem-trusted (stdio child of the consumer
  agent). No network surface, so no per-request auth applies.
- **Invariant 8 binding:** the hosted-surface ingress protection
  declared in `## A0-cloud invariants § 8` **does not apply** to
  `mcp_scope: full` — the trust boundary is the local FS, not the
  Cloudflare edge. Promotion of a `full`-scope tool into the hosted
  Worker is a **scope migration** (lite ← full), gated on the wake-up
  triggers in `## MVP-2 wake-up triggers` plus a security review per
  `## A0-cloud invariants § 1 + § 6`.

### `mcp_scope: deferred` — declared, not yet shipped

- Modes named in this contract (`hmac-deferred`, `cf-access-deferred`)
  and tools listed as deprecated stubs (`lint_skills`,
  `chat_history_append` on the hosted Worker) carry `mcp_scope:
  deferred` until their wake-up triggers fire. README MUST NOT
  recommend a `deferred` mode or tool — the bidirectional drift
  test enforces this per `## Auth surface § Bidirectional contract ↔
  README drift`.

### Boundary properties

- **README citations are normative.** The README MCP section names
  `mcp_scope: lite` and `mcp_scope: full` as canonical scopes (see
  [`README.md`](../../README.md) § "Self-hosted MCP on Cloudflare").
  The bidirectional drift test ensures the names this contract
  declares match the names the README cites.
- **No scope inheritance.** A `lite`-scope code path may not assume a
  `full`-scope capability is available (e.g., the Worker may not
  assume `lint_skills` is reachable via a fallback to the local
  server). Each scope is self-contained.
- **Scope migration is a contract event.** Moving a tool from
  `full` to `lite` (e.g., restoring `lint_skills` on the hosted
  Worker in MVP-2+) requires this contract's `## In-scope (MVP-1)` /
  `## Deprecated tool stub contract` sections to be updated in the
  same PR that lands the implementation — not a follow-up.

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
  `agents/runtime/.agent-chat-history`; the Worker has no equivalent.
  Listed as a deprecated stub per above.
- **HMAC request signing.** Deferred to MVP-2 alongside tool
  restoration — see `## Auth surface` § `hmac-deferred`.
- **Cloudflare Access integration.** Deferred to MVP-2 — see
  `## Auth surface` § `cf-access-deferred`.
- **Multi-tenancy.** No per-tenant content, no tenant routing,
  no tenant-scoped tokens. Future scope.
- **Network egress from the Worker** beyond an **explicit subrequest
  allowlist** — see invariants below.

## Auth surface

The Worker ships with **two MVP-1 modes** (operator-selectable at deploy
time) and **two deferred modes**. The mode in effect is determined by
which Wrangler secrets are set on the deployed Worker — there is no
runtime mode switch.

### Mode `public` (MVP-1 default)

- **Trigger:** `MCP-Token` Wrangler secret is **unset**.
- **Ingress protection:** edge cache (Invariant 4) + Cloudflare
  account-level anti-abuse + DDoS shielding (Invariant 8). No
  per-request auth check.
- **README allowed to recommend:** mode `public` for OSS,
  read-only deploys where the catalog URL is shared widely.
- **Out of scope:** any guarantee of privacy. The content is OSS;
  the URL is the gate, the catalog is not.

### Mode `bearer-auth` (MVP-1 operator opt-in)

- **Trigger:** `MCP-Token` Wrangler secret is **set** (via
  `task mcp:cloud:secret-put` → `wrangler secret put MCP-Token`).
  The secret value is the bearer token clients must present.
- **Enforcement:** every `POST /` request must carry
  `Authorization: Bearer <MCP-Token>`. On mismatch the Worker
  returns HTTP `401` with a JSON-RPC error envelope (code `-32001`,
  message `"Unauthorized"`) and the RFC 6750
  `WWW-Authenticate: Bearer realm="agent-config-mcp"` header.
  Implementation: `internal/workers/mcp/src/index.ts` § auth gate (the
  `if (requiredToken) { … }` block).
- **Liveness carve-out:** the `GET /` liveness probe is
  unauthenticated by design — health checks and `curl` smoke tests
  keep working without the token. Only `POST /` (the JSON-RPC
  surface) is gated.
- **Token handling:** the secret is prompted for interactively by
  `wrangler` — never accepted via argv per
  [`tool-safety`](../../.agent-src/rules/tool-safety.md). The
  Worker never logs the secret, never echoes it in error bodies,
  and never includes it in telemetry sinks.
- **README allowed to recommend:** mode `bearer-auth` for private
  deploys where the catalog URL must be unguessable but a shared
  token is acceptable.
- **Out of scope:** per-client token rotation, token expiry,
  token-scoped tool subsets, OAuth flows. Operators rotate the
  secret by re-running `task mcp:cloud:secret-put` and updating
  client config — there is no in-band rotation path.

### Mode `hmac-deferred` (MVP-2)

- **Status:** deferred. Wake-up triggers per `## MVP-2 wake-up
  triggers` below.
- **Shape (if and when restored):** request signing per
  [`mcp-request-signing`](../guidelines/agent-infra/mcp-request-signing.md)
  § HMAC pattern. Replaces `bearer-auth` for the same operator
  cohort; not additive in MVP-2.
- **README allowed to recommend:** none until the mode ships. A
  README that names `hmac-deferred` as available is a contract
  violation.

### Mode `cf-access-deferred` (MVP-2)

- **Status:** deferred. Same wake-up triggers as `hmac-deferred`.
- **Shape (if and when restored):** Cloudflare Access policy in
  front of the Worker — SSO-fronted, per-identity. Replaces
  `bearer-auth` for the corporate-SSO operator cohort.
- **README allowed to recommend:** none until the mode ships.

### Bidirectional contract ↔ README drift

The README MCP section may **only** name modes that this `## Auth
surface` section declares. This contract must declare every mode the
README names. The drift test
`tests/test_mcp_contract_readme_sync.py` enforces both directions
per Phase 1 Step 4 of the distribution-maturity roadmap (under
`agents/roadmaps/`).

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
8. **Ingress protection — layered, mode-aware.** MVP-1's default
   mode is `public` (`## Auth surface` § `public`); operators may
   opt into `bearer-auth` by setting the `MCP-Token` Wrangler secret.
   Two infrastructure layers apply unconditionally and one
   per-request layer applies only in `bearer-auth`:
   - (a) **Edge cache** per invariant 4 (1 h on pinned URLs, 5 min
     on `latest`) absorbs read-loop traffic before it reaches the
     Worker.
   - (b) **Cloudflare account-level anti-abuse + DDoS shielding**
     caps per-IP burst on `*.workers.dev`.
   - (c) **Per-request bearer check** when `MCP-Token` is set:
     `POST /` mismatches return HTTP 401 + JSON-RPC error +
     RFC 6750 `WWW-Authenticate`; `GET /` liveness is exempt.
   Layers (a)+(b) are the **public-mode** auth surrogate. Layer
   (c) is the **bearer-auth-mode** narrowing. **Promotion triggers**
   — any of these flips HMAC (currently `hmac-deferred` per
   `## Auth surface`) from deferred to active before the wake-up
   triggers below would otherwise fire: sustained 429 spikes from
   origin (cache miss storm), Workers request-cost line item
   exceeding the free-tier budget for two consecutive billing
   periods, or a CVE-class abuse report against the endpoint. A
   per-Worker `[[unsafe.bindings]]` rate-limiter in `wrangler.toml`
   is **not** configured in MVP-1 — adding one is a contract
   amendment, not a free hand.

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
persistence, `hmac-deferred` / `cf-access-deferred` from `## Auth
surface`) wake up only when **all** of these fire:

- A named consumer (internal or external) requests hosted lint or
  history.
- A security review has approved the validation layer for
  `lint_skills` (URI regex allowlist, size limits, timeout,
  concurrency cap).
- A second auth model beyond `bearer-auth` has been selected
  (HMAC or CF Access). Bearer is already MVP-1 per `## Auth
  surface` § `bearer-auth`; the wake-up gates the **second** mode.
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
