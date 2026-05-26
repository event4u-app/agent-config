# Architectural drift inventory

**Source:** `road-to-product-adoption.md` Phase 5 Step 1.
**Scope:** code, contracts, ADRs, and roadmaps that ship for a *future*
consumer ("future third-party packs", "future marketplace", "future
demand cut", "documented-only") and have **zero consumer today**.
**Method:** keyword scan (`future:`, `documented-only`, `not_implemented`,
`speculative`, `not implemented`, `third-party pack`, `marketplace`,
`when…requested`, `Phase [4-9].*future`) across `packages/`,
`.agent-src.uncondensed/`, `scripts/`, `docs/`, `workers/`, plus the
strategic critique in `agents/tmp/feedback6.txt` §12.
**Last refreshed:** 2026-05-24.

## Findings

### F-1 · ADR-017 Phase 4.6 — Split distribution addendum

- **Where:** `docs/decisions/ADR-017-monorepo-physical-layout.md` §
  "Addendum — Optional split distribution (Phase 4.6, documented-only)"
  (lines 259–410).
- **Self-label:** "Status: documented, **not implemented**. Revisit
  only when a real consumer demands a single-pack install path."
- **Consumer today:** none. No `@event4u/agent-config-laravel`-style
  package exists; no consumer has asked.
- **Carrying cost:** ~150 lines of unsynced spec (version coupling
  rules, lockfile shape, release matrix) that drift every time the
  bundled-tarball model evolves.
- **Risk if kept as-is:** future readers treat the addendum as a
  binding contract; PRs land that "pre-empt" the split work and
  re-introduce zombie scaffolding.

### F-2 · MCP discovery-phase stubs (11 of 20 tools)

- **Where:** `docs/contracts/mcp-tool-inventory.md` (11 tools listed
  as `_stub-only_`) · `docs/contracts/mcp-tool-stub-envelope.md` ·
  `docs/contracts/mcp-discovery-phase-notice.md`.
- **Self-label:** "Discovery-First MCP coverage strategy" — Phase 1
  is *discovery*; stubs return a `not_implemented` envelope on call.
- **Consumer today:** unknown. The Phase 1 → Phase 2 gate fires at
  "≥ 4 weeks of healthy telemetry, ≥ 500 logged attempts, ≥ 50
  distinct `client_id_hash` values". No evidence in this branch
  that the gate is being measured against real numbers.
- **Carrying cost:** 11 catalog entries × schema + tests + lint +
  worker mirror in `workers/mcp/src/stubs.ts`. Every contract edit
  touches all of them.
- **Risk if kept as-is:** the discovery model is sound, but without
  a visible telemetry health-check the stubs become a permanent
  parking lot and the contract becomes a fiction.

### F-3 · `workers/mcp/` Cloudflare Worker bridge

- **Where:** `workers/mcp/` (full TypeScript Worker, `wrangler.toml`,
  tests). Contract: `docs/contracts/mcp-cloud-scope.md`.
- **Self-label:** "stability: experimental — not linked from README,
  AGENTS.md, or `docs/architecture.md`. Internal index reference only."
- **Consumer today:** undocumented. No public Worker URL surfaced in
  README; no host application named in this repo calls the Worker.
- **Carrying cost:** full Cloudflare deploy surface (Worker, R2 blob,
  manifest packer, parity smoke, registry lint) maintained alongside
  the local `scripts/mcp_server/` stdio kernel.
- **Risk if kept as-is:** parallel stack maintained on the assumption
  of a hosted consumer that has not surfaced. Documented-only is
  appropriate; **needs a sunset date or named consumer**.

### F-4 · `docs/contracts/tier-3-contrib-plugin.md`

- **Where:** `docs/contracts/tier-3-contrib-plugin.md` (130 lines).
- **Self-label:** Pattern documenting the non-implementation guarantee
  for Tier-3 community AIs. `agents/manifests/contrib/` is confirmed
  not to exist.
- **Consumer today:** the contract itself. It explicitly says "the
  pattern is documented, not scaffolded".
- **Carrying cost:** low — 130 lines, no code dependency.
- **Risk if kept as-is:** none. This is the canonical example of the
  right pattern (documentation prevents speculative scaffolding).

### F-5 · `build_discovery_manifest.py` — phantom marketing-site consumer

- **Where:** `scripts/build_discovery_manifest.py` (two comments
  naming "browser wizard and marketing site" as manifest consumers).
- **Self-label:** none — claimed as live consumer.
- **Consumer today:** the browser wizard exists (`packages/core/installer/`).
  No marketing site exists in this repo or, to current knowledge,
  externally.
- **Carrying cost:** trivial (two comments). But it leaks into reader
  expectations that a marketing site is part of the surface.
- **Risk if kept as-is:** misleading — readers infer a deployed
  marketing-site consumer that does not exist.

### F-6 · `scripts/ai_council/cli_hints.py` — forward-referenced error states

- **Where:** `scripts/ai_council/cli_hints.py` (comment naming
  `auth_expired`, `parse_failed` as "future" error reasons).
- **Self-label:** explicit "future:" comment.
- **Consumer today:** none — neither error reason is emitted by any
  code in this repo.
- **Carrying cost:** zero (comment-only).
- **Risk if kept as-is:** trivial.

### F-7 · `agents/roadmaps/skipped/multi-package-architecture.md`

- **Where:** already under `agents/roadmaps/skipped/`.
- **Self-label:** skipped, references the same split-distribution model
  as F-1.
- **Consumer today:** none.
- **Carrying cost:** zero (already skipped).
- **Risk if kept as-is:** trivial.

## Out-of-scope (verified load-bearing)

The following surfaces were flagged by feedback6 §12 framing
("speculative architecture") but verification shows real consumers:

- `.claude-plugin/marketplace.json` — consumed by
  `scripts/release.py`, `scripts/lint_marketplace.py`,
  `scripts/install.py`, `taskfiles/release.yml`, `taskfiles/ci-fast.yml`.
  Required for Claude Code 2.x plugin discovery.
- All `packages/pack-*/` — each contains real skills shipped in the
  current tarball; each pack has ≥ 1 named consumer.
- `packages/core/installer/` — primary install surface, daily-driver
  for `npx @event4u/agent-config`.
- Virtual-pack discovery scaffolding — load-bearing for the installer
  manifest and lockfile (`packages/core/installer/src/install-plan.ts`).
- Trust-level / signing scaffolding (ADR-018) — referenced by the
  installer at install/sync time, not speculative.

## Classification (Step 2)

Each finding maps to one of `keep` (load-bearing today), `park`
(sunset under flag, revisit on consumer ask), or `remove` (no
consumer, no near plan, carrying cost > zero).

| ID | Finding | Verdict | Rationale |
|---|---|---|---|
| F-1 | ADR-017 §4.6 split-distribution addendum | **remove** | 150 lines of unsynced spec, no consumer asked, no plan to ship. Removing the addendum does **not** revoke ADR-017's core decision (monorepo + bundled tarball stays). |
| F-2 | MCP discovery-phase stubs (11/20) | **park** | Discovery-First is sound. Council Round 2 (2026-05-24) demanded enforcement evidence before parking — verified that `scripts/mcp_telemetry_health.py` exists, exits non-zero on silence at `<consumer>/agents/runtime/mcp-telemetry/calls.jsonl`, and that `tests/test_mcp_server.py` covers `record_call` + `evaluate`. Park with the conditions block below. |
| F-3 | `workers/mcp/` Cloudflare Worker | **park** | Council Round 2 (2026-05-24) flagged as "YAGNI infrastructure" unless rationale found. Rationale verified across four active contracts: `docs/contracts/mcp-cloud-scope.md` (active), `docs/contracts/adr-mcp-runtime.md`, `docs/contracts/mcp-tool-stub-envelope.md`, `docs/contracts/mcp-beta-criteria.md` (Phase 3 owner). Park with consumer-criteria block below. |
| F-4 | `tier-3-contrib-plugin.md` contract | **keep** | The non-implementation guarantee is itself the contract. Active references from `tests/test_check_council_references.py` + archived roadmaps. |
| F-5 | `build_discovery_manifest.py` marketing-site reference | **remove** | Two comments only. Global search confirmed scope narrow (only this file + already-archived roadmaps + golden-baseline transcripts which are immutable). Reword to drop the phantom consumer; no behaviour change. |
| F-6 | `cli_hints.py` future error states comment | **keep** | Zero carrying cost. Forward-reference comment names internal error states (`auth_expired`, `parse_failed`), not phantom external features. |
| F-7 | `roadmaps/skipped/multi-package-architecture.md` | **keep** | Already skipped, zero cost. Removing skipped roadmaps loses the rationale trail. |

**Summary:** 2 remove · 2 park · 3 keep.

## Council Round 2 (2026-05-24) — park conditions

The council blocked parking F-2 and F-3 without enforcement mechanisms.
Both findings now carry conditions that the next drift audit will
evaluate. Source: `agents/runtime/council/responses/2026-05-24-drift-audit.json`.

### F-2 park conditions (MCP discovery-phase stubs)

- **review-by:** 2026-08-24 (90 days).
- **gate-metrics-source:** `scripts/mcp_telemetry_health.py` (asserts
  ≥ 1 record in the consumer JSONL sink within a configurable window;
  default 24 h). Phase 1 → 2 gate fires on the same sink: ≥ 500 logged
  attempts, ≥ 50 distinct `client_id_hash` values, ≥ 4 weeks healthy
  telemetry.
- **current-progress:** as of 2026-05-24, telemetry sink wired, no
  external consumer count published. Next audit must enumerate.
- **fallback-action:** if attempts < 50 by 2026-08-24, escalate from
  `park` to `remove`; the stubs would have no graduation path.

### F-3 park conditions (Cloudflare Worker bridge)

- **review-by:** 2026-08-24 (90 days).
- **consumer-criteria** — at least one of:
  - A named host application calling the Worker bridge (cite repo + path).
  - Public Worker URL serving production traffic (cite URL + first-call date).
  - External integration doc linking the Worker contract (cite doc URL).
- **fallback-action:** if zero consumers meet criteria by 2026-08-24,
  remove `workers/mcp/` and its supporting contracts in the next
  drift-audit PR. Sunset the four contracts that cite it (mark
  superseded with rationale).

## Next steps

- Steps 4–5 — this PR ships the `remove` set (F-1, F-5) and the
  park-condition metadata for F-2/F-3 in the inventory. Bulk deletion
  of the Worker bridge is deferred to the 2026-08-24 audit per
  `non-destructive-by-default`. `docs/architecture.md` is unchanged
  (neither F-1 nor F-5 surfaced there).
