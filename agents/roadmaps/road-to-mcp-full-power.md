---
complexity: lightweight
---

# Roadmap: MCP Full Power — Glama leverage, coverage expansion, execution bridge

> Expose the full agent-config capability surface (including the TS background scripts / CLI subcommands) through MCP in safety tiers, and make the Glama + registry listings first-class distribution channels.

## Prerequisites

- [x] Read `AGENTS.md`, `docs/mcp-server.md`, `docs/contracts/mcp-phase-1-scope.md`, `agents/settings/contexts/mcp-coverage-strategy.md`
- [x] Node toolchain working (`node node_modules/.bin/tsx` boots); Docker available for the Glama smoke

## Context

The package ships three MCP surfaces today:

- **Kernel stdio server** (`src/scripts/mcp_server/`) — 377 prompts / 189 resources / 20 catalogued tools, of which **9 are implemented** (read-only + one path-guarded write: `chat_history_append`). Started via `agent-config mcp:run`; this is what Glama lists.
- **Turnkey stdio-lite server** (`agent-config mcp-server`, `src/cli/mcp/`) — read-only prompts/resources, **zero tools** by design (ADR-085).
- **Cloudflare Worker** (`internal/workers/mcp/`) — read-only content, stub tools, governed by `docs/contracts/mcp-cloud-scope.md`.

The CLI (`src/cli/registry.ts`) exposes ~60 subcommands (roadmap, telemetry, capabilities, memory, council, doctor/conformance, hooks, work engine, …) that are NOT reachable via MCP. Prior decisions deliberately deferred them:

- `mcp-coverage-strategy.md` — Discovery-First / RO-MVP: write-tools reopen only on **named consumer ask + RO telemetry window + accepted A0 amendment**; ≥3-tool batch ports require a **fresh council-gated roadmap (N0)**.
- `agents/decisions/mcp-coverage-cut-2026-05-12.md` — fs-write and shell-spawning tools parked as "Phase 4/5".
- ADR-085 — stdio-lite ships read-only; full-kernel bundling deferred "no demand".

**This roadmap is the named consumer ask (operator, 2026-07-07) and the fresh council-gated roadmap the N0 gate requires.** It does not bypass the locks — it executes their documented unlock path. Hard-Floor operations (push, merge, deploy, prod data) are permanently excluded from any MCP tool.

- **Feature:** none
- **Jira:** none

## Phase 1: Grounding & hygiene

- [x] **Step 1:** Fix `internal/glama/README.md` drift — it documents a Python/uv build and `smoke.py`; the actual `internal/glama/build` / `run` are Node/tsx and the smoke client is `smoke.ts`. Rewrite the README table to match the scripts (or make the scripts the single source and let the README point at them).
- [x] **Step 2:** Fix the stale header comment in `src/scripts/mcp_server/__main__.ts` ("glama still launches `python -m scripts.mcp_server`") — Glama launches the tsx entry via `internal/glama/run`.
- [x] **Step 3:** Remove the stale `__pycache__/*.pyc` leftovers in `src/scripts/mcp_server/` (pre-port Python artifacts; no `.py` source remains).
- [x] **Step 4:** Capture the MCP telemetry baseline — run `./agent-config telemetry:report` and the `mcp_telemetry_health` check (J6). If the pipeline is silent, fix it FIRST; the Phase 3 cut decision must be evidence-based per the coverage strategy. <!-- baseline: 71 calls/24h, memory_signal stub called 281x — see mcp-tool-tier-map.md -->
- [x] **Step 5:** Build the tier map — enumerate every subcommand in `src/cli/registry.ts` and classify it into: `read-only` / `fs-write-in-tree` / `shell-exec` / `network` / `hard-floor-never` (e.g. anything that pushes, deploys, or touches secrets). Save as `agents/settings/contexts/mcp-tool-tier-map.md`. This map is the input for the Phase 3 council and the Phase 5 allowlist.
- [x] **Step 6:** Extend `src/scripts/mcp_server/consumer_tool_catalog.json` with catalog stubs for every tier-mapped candidate that should be advertised (stub-by-default pillar: `tools/list` shows the intended surface; unimplemented names return the `not_implemented` envelope per `docs/contracts/mcp-tool-stub-envelope.md`).

## Phase 2: Glama & registry leverage

- [x] **Step 1:** Enrich `glama.json` beyond `maintainers` — fill every field the `glama.ai/mcp/schemas/server.json` schema supports (description, capabilities, environment variables) so the listing card is complete instead of auto-inferred. <!-- finding: schema fetched live — `maintainers` is the ONLY field the schema defines; already present. Description/capabilities are glama-side introspection (README + live MCP handshake), not manifest fields. Nothing to add. -->
- [x] **Step 2:** Re-run `task mcp:glama-test` and confirm the container boots with current counts; update the boot-count line in `internal/glama/README.md` from the fresh run. <!-- carve-out: new-gate-verification -->
- [x] **Step 3:** Add a drift guard — a small lint that fails when `internal/glama/build` / `run` and the README table disagree (the exact drift Phase 1 fixed must not recur silently). <!-- shipped: src/scripts/lint_glama_drift.ts + task lint-glama-drift, wired into task ci / ci-fast -->
- [x] **Step 4:** Record an ADR: which server is the canonical Glama listing — kernel `mcp:run` (tools, needs repo checkout) vs turnkey `agent-config mcp-server` (zero-setup, no tools). Include the option of listing BOTH as separate entries with distinct audiences (contributors vs end users). <!-- shipped: docs/decisions/ADR-111-canonical-glama-listing.md — kernel-only, revisit triggers named -->
- [~] **Step 5:** Submit the package to the official MCP registry (`registry.modelcontextprotocol.io`) using the existing manifest tooling (`src/scripts/build_mcp_registry_manifest.ts`, output under `dist/mcp/`) and the submission-PR template from the strategic-visibility work. <!-- deferred: manifest tooling re-run + green (build_discovery_manifest, build_mcp_registry_manifest, lint_mcp_registry_manifest all pass); the actual submission opens a PR against an external third-party repo / web form under the maintainer's own GitHub identity per docs/distribution/mcp-submission-checklist.md + registry-submissions.md "Maintainer-side checklist" — not autonomous. -->
- [x] **Step 6:** Refresh `docs/mcp-registries.md`, `docs/setup/mcp-client-config.md`, and the per-IDE snippets so both entry points (turnkey + kernel) are advertised with copy-pasteable config blocks. <!-- refreshed docs/mcp-server.md (stale "no tools" status, dead roadmap link, corrupted sentence, stale counts → live-verified boot line); mcp-client-config.md, getting-started-local-stdio.md, mcp.md, mcp-registries.md audited — already accurate for the turnkey/worker scope, no false claims found -->

## Phase 3: Unlock gates — A0 amendment + council-gated cut

- [x] **Step 1:** Draft the A0 amendment to `docs/contracts/mcp-phase-1-scope.md`: record the named consumer ask (operator, 2026-07-07), define the safety-tier model from the Phase 1 tier map, the deny-by-default allowlist setting (`mcp.tools.allow` in `.agent-settings.yml`), and the permanent Hard-Floor exclusion list. <!-- blocked-by: a0-amendment-signoff -->
- [x] **Step 2:** Verify the RO-telemetry window (≥2 weeks of read-only telemetry per the coverage strategy) or record an explicit operator waiver in the decision file — precedent: the 2026-05-12 cut waived the 4-week window by operator decision. <!-- waived: operator confirmed 2026-07-07 ("jetzt freigeben"); ~24h dataset used, recorded in agents/decisions/mcp-write-exec-cut-2026-07-07.md -->
- [x] **Step 3:** Run the AI council on two questions: (a) the concrete write/exec tool cut list from the tier map, and (b) generic `agent_config_cli` bridge tool vs per-command tools (see Phase 5 Step 3). `npx tsx src/scripts/council_cli.ts debate <question.md> --output agents/runtime/council/responses/mcp-full-power.json --confirm --auto-continue`. <!-- ran: 2 rounds, anthropic+openai, actual cost $0.1202 -->
- [x] **Step 4:** Record the verdict as `agents/decisions/mcp-write-exec-cut-<date>.md` (cut list, rejections, envelope requirements) and update `agents/settings/contexts/mcp-coverage-strategy.md` so the pillars reflect the amended state instead of silently drifting. <!-- shipped: agents/decisions/mcp-write-exec-cut-2026-07-07.md; mcp-coverage-strategy.md pillar 3 updated; mcp-phase-1-scope.md amendment flipped from draft to accepted -->

## Phase 4: Write-tier tools (fs-write in-tree)

Cut list per `agents/decisions/mcp-write-exec-cut-2026-07-07.md` — supersedes
the original open list in Step 1 below.

- [ ] **Step 1:** Implement the council-confirmed tools in `src/scripts/mcp_server/tools.ts`, each path-guarded via the `_validateInTreePath` pattern (`tools.ts:149`): `memory_signal`, `roadmap_archive`, `capabilities_index` (fs-write, path-guarded) plus `doctor_report`, `conformance_check`, `telemetry_report`, `council_estimate` (read-only, no path-guard needed — reclassified from the council's initial "fs-write" framing, see the decision file's correction). `mine_session`, `sync_agent_settings`, `sync_gitignore`, `update_form_request_messages` were NOT in the council's cut list — leave stubbed pending a future round.
- [ ] **Step 2:** Add a `roadmap_progress` tool wrapping the dashboard regen (`./agent-config roadmap:progress`) — highest-frequency background script in real sessions. <!-- confirmed unanimous ship in agents/decisions/mcp-write-exec-cut-2026-07-07.md; catalog stub already shipped Phase 1 Step 6; TS handler implementation still open -->
- [ ] **Step 3:** Flip `implemented_on` in `consumer_tool_catalog.json` for each shipped tool (stdio only — never the Worker, per the 2026-05-12 decision) and wire per-tool telemetry via the existing `telemetry.ts` recorder.
- [ ] **Step 4:** Add per-tool smoke tests to the `task mcp:test` suite covering: happy path, out-of-tree path rejection, and the stub envelope for still-unimplemented names. <!-- carve-out: new-gate-verification -->

## Phase 5: Exec-tier tools & the full-power bridge

- [ ] **Step 1:** Safety review per exec tool (lethal-trifecta pass): shell-spawning tools must not combine private-data access + untrusted input + egress on one autonomous path. Exec tools get: fixed argv (no shell interpolation of caller strings), timeout, output truncation, and no network. Document in the A0 amendment.
- [ ] **Step 2:** Implement the parked shell-spawning tools: `run_quality_checks`, `run_tests`, `compile_router` — with the Step 1 envelope.
- [ ] **Step 3:** Implement the council-decided bridge shape: build-time codegen, NOT a generic `agent_config_cli` tool (rejected — see `agents/decisions/mcp-write-exec-cut-2026-07-07.md` Decision 2). A build step generates one MCP tool per approved tier-map entry from `src/cli/registry.ts` metadata; `hard-floor-never` entries are never generated, making them structurally absent from `tools/list` rather than runtime-rejected. Gives MCP clients the CLI surface — roadmap, capabilities:index, doctor, conformance, memory, telemetry, council:estimate — without hand-writing 60 tools individually.
- [ ] **Step 4:** Long-running command envelope — commands exceeding the MCP call budget (council runs, full doctor) get an async pattern: submit → job id → poll tool, or documented synchronous truncation. Pick one, implement once, reuse for all exec tools.
- [ ] **Step 5:** Expose the read-mostly high-value commands through the bridge and verify each against the tier map: `capabilities:index`, `doctor`, `conformance`, `telemetry:report`, `council:estimate`.

## Phase 6: Parity, distribution & guardrails

- [ ] **Step 1:** Decide the stdio-lite fate — ADR-085's revisit trigger ("no demand") has fired via this roadmap. Record a follow-up ADR: keep `agent-config mcp-server` read-only and route power users to the kernel server, or bundle the kernel tool surface into the npm package (A1). The turnkey story must stay zero-setup either way.
- [ ] **Step 2:** Worker stays read-only per `docs/contracts/mcp-cloud-scope.md` — document explicitly in `docs/mcp-cloud-endpoints.md` that `implemented_on` stays `["stdio"]` for every execution tool and why (no kernel runtime endpoint in the Worker).
- [ ] **Step 3:** Update the doc set (`docs/mcp-server.md`, `docs/mcp.md`, `docs/getting-started-local-stdio.md`, per-IDE snippets) and the registry manifests (`dist/mcp/`) to advertise the new tool surface; re-run the Glama smoke so the listing reflects reality. <!-- carve-out: new-gate-verification -->
- [ ] **Step 4:** Token-cost audit — re-run the initial-context audit (`src/scripts/audit_initial_context.ts`) over the grown `tools/list` schemas; trim tool descriptions if the per-server cost table flags over-subscription.
- [ ] **Step 5:** Run `task mcp:parity-stdio` and the full `task mcp:test` suite; every catalog name must either return real results or the stub envelope — silent 404/500 remains forbidden. <!-- carve-out: new-gate-verification -->

## Acceptance Criteria

- [ ] Every council-confirmed write/exec tool returns real results via `agent-config mcp:run`; every unimplemented catalog name still returns the structured `not_implemented` envelope
- [ ] The CLI long tail is reachable through the bridge shape chosen in Phase 5 Step 3, gated by the deny-by-default allowlist; no `hard-floor-never` command is callable via MCP by construction
- [ ] Glama listing is drift-free (README = scripts = boot counts), `task mcp:glama-test` green, official MCP-registry submission filed
- [ ] `docs/contracts/mcp-phase-1-scope.md` amendment and the new decision file exist; `mcp-coverage-strategy.md` reflects the amended pillars
- [ ] MCP smoke + parity checks green (`task mcp:test`, `task mcp:parity-stdio`); remaining quality gates delegated to remote CI

## Blockers

### blocker: a0-amendment-signoff
- **Status:** resolved
- **Owner:** user
- **Blocks:** Phase 3 — Unlock gates
- **What to do:**
  1. Review the drafted A0 amendment to `docs/contracts/mcp-phase-1-scope.md` (safety tiers, allowlist, Hard-Floor exclusions).
  2. Approve or adjust the telemetry-window waiver (Phase 3 Step 2) and authorize the billable council run (Phase 3 Step 3).
- **Resolved when:** the amendment is accepted in-tree and the council verdict file exists under `agents/decisions/`. <!-- resolved 2026-07-07: user picked "jetzt freigeben und weiterlaufen lassen"; amendment accepted, council ran, verdict in agents/decisions/mcp-write-exec-cut-2026-07-07.md -->

Note on the amendment's own `mcp.tools.allow` proposal: the council verdict
**rejected** the runtime-allowlist idea in favor of build-time codegen —
`docs/contracts/mcp-phase-1-scope.md` has been updated accordingly, so no
such setting ships.

## Notes

- **Locks honored, not bypassed:** the coverage strategy's three pillars (stub-by-default, telemetry-driven cut, RO-MVP with gated write-tools) stay intact — Phase 3 is the documented unlock path, and this roadmap satisfies the N0 "fresh council-gated roadmap" requirement for ≥3-tool batch ports.
- **What "full power" means here:** the kernel stdio server becomes the execution surface for the TS script/CLI long tail in safety tiers; the turnkey stdio-lite and the Cloudflare Worker remain read-only distribution surfaces unless the Phase 6 ADR decides otherwise.
- **Permanently out of scope:** git push/merge/tag, deploys, secrets rotation, prod data — the Hard Floor (`non-destructive-by-default`) applies to MCP callers exactly as to chat; these are structurally excluded from catalog and bridge.
- **SSE/HTTP transport for the kernel server** stays out of scope (prior decision: the Worker IS the bridge); reopen only via the wake-up trigger recorded in the coverage strategy.
