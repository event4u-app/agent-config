---
complexity: standard
---

# Road to Cloudflare-hosted MCP

**Status:** Not started — active (consumer ask = Matze, 2026-05-10).
**Started:** 2026-05-10
**Trigger:** Matze requests "every release should also publish a remote
MCP server". This is the wake-up trigger
`road-to-mcp-distribution.md` was waiting for. The locked design is
**not** native SSE — the Worker IS the bridge (per
`mcp-phase-6-distribution-verdict.md` Anthropic R3).
**Verdict:** [`cloudflare-mcp-hosting-verdict.md`](../council-responses/cloudflare-mcp-hosting-verdict.md).
**Predecessor:** [`road-to-mcp-server.md`](archive/road-to-mcp-server.md)
(if archived) — Phase 6 F1 (identity), F3 (stdio Docker) shipped;
F2 (SSE) deferred-in is now absorbed by this roadmap.
**Absorbs:** `road-to-mcp-distribution.md` G1–G4 (bridge work, now
the Worker) and G5 (registry listing → Phase 6 below). The
predecessor roadmap is archived alongside this one.

## Purpose

Host the agent-config MCP server on **Cloudflare Workers** as a
**TypeScript bridge** serving prompts + resources from a release-pinned
content snapshot in **R2**, so every npm release of
`@event4u/agent-config` auto-publishes a remotely-reachable MCP
endpoint. Read-only MVP-1; tools and write surfaces deferred to MVP-2
behind a multi-tenant security review.

## Locked architecture

```
  npm release v1.37.0 (GitHub tag)
        │
        ▼
  GitHub Action (on: release: published)
        │
        ├── compute skillSetSignature from worktree at tag
        ├── upload .agent-src/ + signature to R2 releases/v1.37.0-<sha>/
        ├── wrangler deploy Worker with PACKAGE_VERSION=1.37.0
        └── repoint mcp.<host>/latest → v1.37.0 (atomic)
                │
                ▼
        Cloudflare Worker (TS, MCP TS SDK)
                │  ├── /v1.37.0/sse        (immutable, cache 1h)
                │  └── /latest/sse          (pointer, cache 5min)
                ▼
        prompts/resources from R2 (bundled JSON, edge-cached)
        tools/list returns deprecated:true stubs pointing to local stdio
```

**A0-cloud guarantees** (mirror of A0 with Worker-specific clauses):
no `fetch()` to non-allowlisted origins · no DO writes outside the
`releases/` allowlist · content is immutable per versioned URL ·
no consumer code execution surface · single deployment per release.

## Out of scope (MVP-1)

- `lint_skills` TS port — Python stays on local stdio.
- `chat_history_append` — filesystem-bound, local-only.
- `agent-settings.yml` exposure — consumer-machine config, not hosted.
- Agent memory — separate MCP server, different roadmap.
- Per-consumer auth, bearer tokens, HMAC — MVP-2.

## Phase 1 — A0-cloud contract

- [x] **1.1** Write `docs/contracts/mcp-cloud-scope.md` with: Worker
  invariants (allowlisted origins, no DO writes outside `releases/`,
  no `subrequest` to consumer infra), R2-key shape (`releases/v<X.Y.Z>-<sha>/`),
  immutability guarantee per versioned URL, cache-TTL policy (1h
  pinned, 5min `latest`), deprecated-tool stub contract, MVP-2 wake-up
  triggers.
- [x] **1.2** Amend `docs/contracts/mcp-phase-1-scope.md` with a
  one-line Phase-7 pointer to `mcp-cloud-scope.md`. Phase-1 contract
  retains local-stdio ownership; cloud doc owns hosted.
- [x] **1.3** Cross-link from `mcp-request-signing § Appendix` to
  the cloud contract (the Worker is the bridge that appendix
  describes).

## Phase 2 — TS Worker scaffold (read-only)

- [ ] **2.1** New directory `workers/mcp/` with `wrangler.toml`, TS
  config, `@modelcontextprotocol/sdk` (TS) dep. Single Worker module
  with `fetch` handler for HTTP + SSE.
- [ ] **2.2** Reimplement `prompts.py` in TS: load prompts from bundled
  content blob, return `prompts/list` and `prompts/get` MCP responses.
  Test against the live-replay baseline already used by the Python
  server (parity test in CI).
- [ ] **2.3** Reimplement `resources.py` in TS: load resources from
  bundled content blob, return `resources/list` and `resources/read`.
  URI shape stays identical (`agent-config://skills/...` etc.).
- [ ] **2.4** Identity surface: `serverInfo.version` reads from
  Worker-bundled constant, `_meta.packageVersion` reads from
  `wrangler.toml` env var, `_meta.skillSetSignature` reads from the
  prebaked manifest JSON shipped with the content blob (never
  computed at runtime in the Worker).
- [ ] **2.5** Deprecated tool stubs: `tools/list` returns the two
  stubs exactly as specified in `mcp-cloud-scope.md`, with
  `deprecated: true` and the local-server hint in the description.
- [ ] **2.6** Worker-local smoke: `wrangler dev` + a small TS test
  harness that runs the live-replay baseline against the local dev
  Worker and diffs against the Python server's recorded output.

## Phase 3 — Content sync (R2)

- [ ] **3.1** New R2 bucket `agent-config-mcp` (Terraform-managed if
  the repo already has TF; otherwise a one-time wrangler bootstrap
  doc + bucket-name pin in `mcp-cloud-scope.md`).
- [ ] **3.2** Content packer script (`scripts/pack_mcp_content.py`)
  that walks `.agent-src/` + `docs/guidelines/` at a given git ref,
  emits a single gzipped JSON blob with `(uri, body)` pairs, plus a
  sidecar `signature.json` with the precomputed
  `skillSetSignature`. Local-stdio remains untouched.
- [ ] **3.3** Wrangler bundle step: pack-script output is committed
  to the Worker bundle at deploy time. Worker reads bundled blob, not
  R2 at runtime. (R2 is the **archive of past releases** + the
  pointer store; the live Worker serves from its bundle.)
- [ ] **3.4** R2 archival upload: deploy-time GitHub Action uploads
  the same blob to `releases/v<X.Y.Z>-<sha>/content.json.gz`
  alongside `releases/v<X.Y.Z>-<sha>/signature.json`. Past releases
  remain inspectable, future tooling can serve from R2 directly.
- [ ] **3.5** `latest` pointer: `releases/latest.txt` in R2 holds
  the current `v<X.Y.Z>-<sha>` string, repointed atomically by the
  release pipeline post-smoke.

## Phase 4 — Release auto-deploy pipeline

- [ ] **4.1** `.github/workflows/deploy-mcp-worker.yml` triggered on
  `release: published`. Inputs: tag name, target environment.
  Secrets: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`.
- [ ] **4.2** Pipeline steps: checkout tag → install deps → run
  `pack_mcp_content.py` against the tag worktree → upload blob to
  R2 `releases/<tag>-<sha>/` → `wrangler deploy` Worker with
  `PACKAGE_VERSION=<tag>` and `RELEASE_KEY=<tag>-<sha>` → run
  Phase-5 smoke against the new deployment → repoint
  `releases/latest.txt` to `<tag>-<sha>` → comment on the GH
  release with the deploy URLs.
- [ ] **4.3** `workflow_dispatch` manual path for hotfix-without-
  release. Same steps, no `release: published` trigger.
- [ ] **4.4** Failure mode: if smoke fails post-deploy, the pipeline
  rolls back by **not** repointing `latest`. Version-pinned URL stays
  live for inspection; `latest` keeps serving the previous release.

## Phase 5 — Smoke & cutover

- [ ] **5.1** Live-replay smoke: same baseline that
  `road-to-mcp-server.md` Phase 4 introduced, but pointed at the
  deployed Worker URL. Diff against the recorded local-stdio output.
- [ ] **5.2** Public DNS — `mcp.<chosen-domain>` CNAME to the Worker
  route, documented in `docs/setup/mcp-cloud-endpoints.md`. Pin the
  two URL shapes (`/latest/sse`, `/v<X.Y.Z>/sse`).
- [ ] **5.3** Stability label remains *experimental* per
  `mcp-phase-1-scope.md`. Add a one-line readme section
  ("Remote MCP: experimental") with the endpoint URL.
- [ ] **5.4** Update `STABILITY.md` (if it tracks wire-surface) with
  the hosted endpoint URL shape and the immutability promise.

## Phase 6 — Registry listing (adoption multiplier)

Absorbed from `road-to-mcp-distribution.md` G5. Listing makes the
hosted endpoint discoverable to people searching for MCP servers;
hosting without listing = the endpoint exists but nobody finds it.
The `experimental` stability label is **not** a blocker — MCP
catalog and `awesome-mcp-servers` accept experimental servers when
the label is honestly declared in the listing.

- [ ] **6.1** Submission package — draft a single source file
  `docs/setup/mcp-cloud-registry-listing.md` containing: project
  one-liner, hosted endpoint URLs (`/latest/sse` + `/v<X.Y.Z>/sse`
  shape), stability statement (*experimental*), wire surface
  (prompts + resources, no tools in MVP-1), license, contact, and
  the link to `mcp-phase-1-scope.md` + `mcp-cloud-scope.md`. Reuse
  this file for every registry submission.
- [ ] **6.2** PR to `awesome-mcp-servers` — lowest friction, widest
  reach. List under the appropriate category with the
  `experimental` tag. Link the hosted `/latest/sse` URL.
- [ ] **6.3** PR / submission to the `modelcontextprotocol.io`
  catalog — higher curation bar. Submit only after 6.2 has merged
  (gives evidence of community uptake). Same submission package
  from 6.1.

npm-launcher listing (would wrap the **local stdio** server, not
the hosted Worker) is out of scope for this roadmap — different
mechanism, different trigger. Capture as a follow-up if asked.

## Phase 7 — MVP-2 tool restoration (DEFERRED)

- [-] **7.1** `lint_skills` TS port with full security-validation
  layer (URI regex allowlist, size limits, timeout, concurrency cap).
  Gated on: (a) a real consumer asking for hosted lint AND
  (b) a multi-tenant security review of the validation layer.
- [-] **7.2** History persistence: D1 or R2 per-consumer namespaces
  with auth token. Gated on the same triggers as 7.1 plus an auth
  model decision.
- [-] **7.3** Bearer or CF Access auth model. Gated on 7.1/7.2.

All Phase-7 items are `[-]` deferred-out — they do **not** count
against the denominator. Surface them in this roadmap only so the
trigger is visible to the next reader; do not work them without an
explicit consumer ask plus a security review.

## Wake-up checklist for MVP-2

- A named consumer (internal or external) requests hosted lint or
  history.
- A security review has approved the validation layer for `lint_skills`.
- An auth model has been selected (bearer vs. CF Access vs. HMAC).
- The server stability label has been promoted from *experimental*
  to *beta*.

## References

- Verdict synthesis:
  [`agents/council-responses/cloudflare-mcp-hosting-verdict.md`](../council-responses/cloudflare-mcp-hosting-verdict.md)
- Council question:
  [`agents/council-questions/cloudflare-mcp-hosting.md`](../council-questions/cloudflare-mcp-hosting.md)
- Bridge pattern reference:
  [`docs/guidelines/agent-infra/mcp-request-signing.md § Appendix`](../../docs/guidelines/agent-infra/mcp-request-signing.md#appendix--http-bridge-stdio-kernel-pattern-reference)
- Local stdio server (predecessor, unchanged by this roadmap):
  `scripts/mcp_server/`
- Phase-1 contract (extended by `mcp-cloud-scope.md`):
  [`docs/contracts/mcp-phase-1-scope.md`](../../docs/contracts/mcp-phase-1-scope.md)
