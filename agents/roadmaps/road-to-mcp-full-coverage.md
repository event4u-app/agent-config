---
complexity: lightweight
---

# Road to MCP Full Coverage

> Reach a measured, demand-driven MCP tool surface — discovery first, port last — so the long-term endpoint (consumer agents reach every relevant agent-config capability through MCP) is achieved without burning weeks on a speculative 112-script TypeScript port.

**Status:** READY FOR EXECUTION — created 2026-05-11 after AI Council
3-round convergence on the Discovery-First strategy.
**Started:** 2026-05-11
**Trigger:** Inventory of `scripts/` showed ~112 Python scripts vs. 2
reachable MCP tools. User asked to "plan the complete transition and
expansion" toward full MCP coverage with a possible TS port.
**Mode:** Five phases. Phases 1–3 are the executable path. Phases 4–5
stay DEFERRED until Phase 2/3 data justifies waking them up — the
council was unanimous that committing to write tools or a TS port
without consumer-usage evidence is premature.
**Council convergence:** Anthropic `claude-sonnet-4-5` ·
`claude-opus-4-1` · OpenAI `gpt-4o`, 3 debate rounds, 2026-05-11,
$0.28 actual spend. Unanimous against mass-porting; converged on
Discovery-First (Opus operational shape) + latent-demand telemetry
(Sonnet reframe) + tracer-bullet sequencing (GPT-4o). The full
debate trace lives in the council-responses store; the
single-paragraph summary at the bottom of this section is
load-bearing for every later phase.

## Purpose

Today, only 2 of ~112 scripts are reachable as MCP tools (`prompts/*` +
`resources/*` are richer, but tools are the side-effect surface). The
Cloud Worker exposes two stub tools that return `deprecated` errors.
Consumer agents have no way to *discover* which capabilities exist
beyond those two, and the package has no telemetry to learn what they
*would* call.

The roadmap's outcome is **"every relevant agent-config capability
reachable through MCP, with each port decision backed by usage
evidence"** — not "every Python script ported to TypeScript". Those
are different goals. The council convergence rejected the second
framing as building a bridge to nowhere.

## Out of scope (this roadmap)

- Porting all 112 scripts to TypeScript. Dev-pipeline scripts
  (`check_*` · 27, `lint_*` · 15, `audit_*` · 5, `measure_*` · 6,
  `build_*` / `pack_*` / `release` · 7, one-shot
  `_p4*_` / `_phase2_` / `_backfill_` migrations · 7,
  `generate_*` / `compile_*` · misc — ~80 scripts total) stay
  Python CLI for contributors; consumer agents will never call
  them. The ~20 "consumer-relevant" cut is the explicit scope.
- The native SSE / HTTP-bridge transport — superseded by
  `road-to-cloudflare-mcp-hosting.md` (archived).
- Marketplace listing — handled by the archived Cloudflare-hosting
  roadmap's Phase 6.

## Phase ordering

- **Phase 1 (Discovery Stubs)** — ready. Pre-condition: none.
- **Phase 2 (Telemetry Window)** — gated on Phase 1 shipping. Pure
  observation; no code beyond Phase 1's instrumentation.
- **Phase 3 (Selective Implementation)** — gated on Phase 2's
  decision gate firing positive for at least one tool. If no tool
  crosses the demand threshold, this phase **does not start**; the
  roadmap closes with "no measured consumer need".
- **Phase 4 (Write-Tool Envelope, DEFERRED)** — gated on Phase 3
  shipping at least one read-only tool *and* a named consumer asking
  for write semantics. Requires fresh A0-contract amendment review.
- **Phase 5 (TS Port, DEFERRED)** — gated on Phase 3 surfacing
  latency or distribution requirements that the Python-subprocess
  pattern (locked in Phase 3) cannot meet.

The decision gates between phases are **hard gates**. Skipping ahead
defeats the entire premise the council converged on.

## Council convergence (one paragraph)

All three reviewers independently rejected mass-porting. Opus 4.1
proposed the operational shape (Discovery-First: expose all
consumer-relevant tool definitions in the Cloud Worker manifest now,
return `{error: not_implemented, install: pip install agent-config[mcp]}`
on call, measure attempts). Sonnet 4.5 contributed the reframe
("MCP coverage is distribution, not a goal"), the latent-demand
telemetry pattern (log denied-tool-name calls, not just successes),
and the open architectural question about whether consumer agents
should write to agent-config paths at all. GPT-4o seconded the
tracer-bullet sequencing. Common rejection: any plan that ports first
and measures later.

## Phase 1: Discovery Stubs

**Goal:** Make every consumer-relevant tool *visible* to MCP clients
without committing to its implementation. Generates the manifest the
telemetry in Phase 2 can observe.

**Pre-conditions:** none — Phase 1 is the entry point.

**Scope:** the ~20 scripts classified as "consumer-relevant" in the
council-question inventory appendix. The exact list lands in Step 1.4
after a final read against the inventory; expected ≈ 18–22 entries
spanning `memory_lookup`, `memory_append`, `skill_trigger_eval`,
`suggest_skill_for_task`, `command_suggester/*`, `mine_session`,
`update_form_request_messages`, `sync_gitignore`,
`sync_agent_settings`, `run_tests`, the quality-gate wrappers, and a
handful of read-only retrieval helpers.

- [x] **J1** — Inventory cut: produce
      `scripts/mcp_server/consumer_tool_catalog.py` (or
      equivalent JSON/YAML data file) listing every tool name +
      description + JSON-Schema input + side-effect classification
      (`ro` / `fs-write` / `shell`). Source of truth referenced by
      both the stdio server and the Cloud Worker. ~20 entries.
- [x] **J2** — stdio server `tools/list` reads the catalog and
      exposes the full set. Calls to unimplemented tools return a
      structured error
      `{code: "not_implemented", install_hint: "...", alternative: "stdio"}` —
      never a silent 404. Schema for the error envelope lives in
      `docs/contracts/mcp-tool-stub-envelope.md` (new — single
      page, ≤ 80 lines).
- [x] **J3** — Cloud Worker `tools/list` reads the same catalog and
      exposes the full set with the same `not_implemented` error
      envelope. Worker code must not import Python-side
      implementation logic — manifest only.
- [x] **J4** — Denied-call + attempt telemetry: both surfaces log
      every `tools/call` (success, `not_implemented`, unknown name)
      with `{tool_name, client_id_hash, ts, transport, outcome}` to
      a structured log channel. Privacy: client_id is hashed at the
      server boundary; payload bodies are not logged. Sonnet's
      "latent demand" pattern requires that *unknown* tool names
      (clients trying to call something not in the catalog) are
      logged separately.
- [x] **J5** — Acceptance: against a fresh checkout, a generic MCP
      client (Claude Desktop, Zed) sees the full ~20-tool manifest
      on both transports; calling any tool returns the structured
      stub error; one log line lands per call; CI test asserts the
      manifest contains the catalog's full set and that an
      unknown-name call is logged as `latent_demand`.
- [x] **J6** — Telemetry healthcheck + consumer notification
      (Sonnet finding, 2026-05-11 review): (a) `scripts/mcp_telemetry_health.py`
      + `task mcp:health` exit non-zero when no log line is present in
      the configured window — consumers wire it into Sentry / GH Actions
      cron / mailer / `launchd` per their own infrastructure (no
      central log store yet in Phase 1); (b) consumer notification
      document `docs/contracts/mcp-discovery-phase-notice.md` (new —
      ≤ 60 lines) informs known consumers that `not_implemented` is
      expected during discovery, asking them to maintain call
      attempts so latent demand is captured.

## Phase 2: Telemetry Window + Decision Gate

**Goal:** Observe ≥ 4 weeks of real consumer behaviour against the
Phase 1 surface, then derive the implementation cut from the data.

**Pre-conditions:** Phase 1 shipped and reachable in at least one
client; telemetry pipeline writing to a queryable store; at least
one call-source pointed at the new surface — real consumer install
OR a documented synthetic-load harness that exercises the catalog
realistically. Synthetic load is acceptable for *bootstrapping* the
telemetry window but K3's verdict must declare the source mix
(real vs. synthetic call counts) so cut decisions are not made on
synthetic load alone.

- [x] **K1** — Telemetry sink: route the Phase 1 logs into a
      queryable store (Loki, SQLite-on-Worker R2, or a tiny
      analytics endpoint — pick whatever is already deployed; do
      not provision new infra for this).
      *Shipped:* `scripts/mcp_telemetry_store.py` — idempotent
      SQLite ingestion of `agents/.mcp-telemetry/calls.jsonl`
      keyed by SHA-256 of each JSONL line. No new infra.
- [x] **K2** — Dashboard or CLI query that surfaces per-tool
      attempt counts, distinct-consumer counts, success-vs-denied
      ratio, and latent-demand names not in the catalog. Refresh
      cadence ≥ daily.
      *Shipped:* `scripts/mcp_telemetry_query.py` — CLI dashboard
      over the SQLite store. Stub vs. implemented vs. latent
      breakdown + per-tool top-N.
- [~] **K3** — Decision gate run after ≥ 4 calendar weeks of data
      (Sonnet's correction to Opus's 30-day suggestion — MCP
      adoption is slower than reviewers assumed) **AND** after
      total logged tool attempts ≥ 500 across all tools with ≥ 50
      distinct request-IDs (Sonnet floor, 2026-05-11 review —
      below that, any cut is applied to statistical noise; the
      telemetry window extends rather than producing a verdict).
      The gate emits a written verdict in
      `agents/decisions/mcp-coverage-cut-<date>.md` listing every
      tool ranked by `(distinct_consumers × attempts_per_week)`,
      the tools above the cut line, the **rejected-tool list with
      the margin by which each failed** (accountability against
      Phase 3 scope creep — Sonnet finding), the latent-demand
      names worth promoting into the catalog, and the go / no-go
      for Phase 3.
      *Waiver substitute (2026-05-12):* operator waived the
      4-week window; verdict derived via AI Council in
      `agents/decisions/mcp-coverage-cut-2026-05-12.md`. K3
      remains partially open — a real-telemetry refresh remains
      due once measured data accumulates.
- [-] **K4** — If the verdict is no-go (no tool reaches ≥ 3
      distinct consumers, or aggregate attempts < 100 / week), the
      roadmap archives with that finding. Phase 3 does not start.
      *Status:* N/A under the waiver — the council cut is go for
      the seven RO tools, so K4's archive branch did not fire.
- [-] **K5** — Telemetry pipeline health verified at gate time:
      no silent-failure windows ≥ 24 h in the 4-week observation
      period (J6 healthcheck output is the source of truth). If
      gaps detected, the gate is refused and the window restarts
      from the last continuously-healthy point.
      *Status:* deferred together with the K3 telemetry refresh
      — the J6 healthcheck remains the source of truth when real
      data arrives.

The cut threshold is *derived from the data distribution*, not
hardcoded. The council was explicit that an arbitrary "10 calls /
day" number confuses frequency with value. Step K3's verdict must
justify the chosen line.

## Phase 3: Selective Implementation (read-only first)

**Goal:** Implement the tools above Phase 2's cut line — read-only
only — using the Python-subprocess pattern, so the same Python source
of truth serves both stdio (direct) and Cloud Worker (subprocess
behind the Worker). No TypeScript port.

**Pre-conditions:** Phase 2's verdict (`K3`) lists ≥ 1 tool above
the cut, AND the chosen tools have no write side-effect (writes are
Phase 4). If the cut surfaces only write-tools, this phase still
does not start — go to Phase 4's wake-up trigger.

- [-] **L1** — Python-subprocess wrapper module
      (`scripts/mcp_server/subprocess_runner.py`) — invoked by the
      Cloud Worker via a thin Python-runtime endpoint (Worker calls
      out to a small Python service or container; exact deploy
      shape is decided in L1 based on what's already running). One
      execution path = same Python code on both transports.
      Behaviour parity is enforced by the contract test, not
      eyeballed.
      *Waiver scope (2026-05-12):* the council cut explicitly
      ships **stdio-only** for the seven RO tools (`implemented_on
      = ["stdio"]`); the Worker remains stub-only. The
      Python-runtime endpoint is therefore not required this
      iteration — it becomes Phase 5's forcing function (`N0`).
- [x] **L2** — Per-tool implementations for the cut list. Each
      tool: JSON-Schema input, JSON output, no FS writes, no shell
      escape beyond the wrapped script's own subprocess discipline.
      One PR per tool — keeps blast radius per merge minimal and
      lets reviewers focus.
      *Shipped:* 7 RO handlers in `scripts/mcp_server/tools.py` —
      `chat_history_read`, `memory_lookup`, `memory_status`,
      `list_skills`, `list_commands`, `list_rules`,
      `read_resource_body`. One-PR-per-tool relaxed by the waiver
      verdict (Q5); commits split per logical chunk so a per-tool
      revert stays a single `git revert <sha>`.
- [x] **L3** — Contract test per tool: same input → same output
      via stdio and via Worker. Asserted in CI on every change to
      the tool or wrapper. This is the single mechanism that
      prevents the "version skew" failure mode. Minimum coverage
      (Sonnet finding, 2026-05-11 review):
      (a) **hermetic fixtures** — explicit seeding for any source
      of non-determinism (UUIDs, timestamps, random sampling);
      tests fail loudly on uncontrolled non-determinism rather than
      producing flaky parity diffs;
      (b) **post-call FS-diff assertion** — both execution paths
      must leave the host filesystem in the same state (temp
      files, log files, state mutations); `/tmp` and any
      tool-relevant directories are snapshotted before and after;
      (c) **env control** — both paths run under the same env
      vars, cwd, and permissions; the subprocess wrapper must
      explicitly pass through (or strip) the env, never inherit
      ambiently.
      *Shipped:* 10 hermetic shape tests in
      `tests/test_mcp_server.py` — envelope keys, type filters,
      input rejection, unknown-URI failure mode. Worker parity is
      reduced to `implemented_on=["stdio"]` round-trip via
      `test_worker_content_implemented_on_matches_catalog`; the
      full cross-transport diff returns under Phase 5 when a
      Worker-side Python runtime exists.
- [x] **L4** — Update `tools/list` on both surfaces: implemented
      tools drop the `not_implemented` envelope and return real
      results; still-unimplemented tools keep the stub.
      *Shipped:* `scripts/mcp_server/consumer_tool_catalog.json`
      sets `implemented_on=["stdio"]` for the seven RO tools; the
      packed Worker bundle (`workers/mcp/content.json`) carries
      the same metadata. Worker dispatch keeps the
      `not_implemented` envelope for those tools until Phase 5.
- [~] **L5** — Telemetry continues. Phase 2's dashboard now
      separates implemented-attempts from stub-attempts so we can
      see whether usage *grows* once a tool becomes real (vs. just
      a one-time discovery spike).
      *In place:* `scripts/mcp_telemetry_query.py` reads the
      `outcome` field (`implemented` / `stub` / `latent_demand`)
      and surfaces it per tool. Real measurement waits on the
      K3 telemetry refresh.

If by L1 it is clear the subprocess pattern cannot meet a tool's
latency budget (hot-path tools like `skill_trigger_eval` that fire
on every file save), that fact is recorded as the wake-up trigger
for Phase 5 — but Phase 3 still completes for the latency-tolerant
tools first.

## Phase 4: Write-Tool Envelope (DEFERRED)

**Goal:** Decide *whether* and *how* MCP write tools (anything with
`fs-write` side-effect in the catalog) reach consumers. Two designs
are on the table; the council surfaced both but did not pick.

**Wake-up trigger — required before any code:**

1. Phase 3 shipped ≥ 2 read-only tools that have been in
   production use for ≥ 2 weeks with measured non-trivial usage
   (≥ 3 distinct consumers each) — proving the Phase 3
   operational pattern is understood, not just demoed (Sonnet
   finding, 2026-05-11 review), AND
2. A named consumer (internal or external) requests a specific
   write-tool by name with a concrete workflow, AND
3. The named consumer accepts the contract review burden of an
   A0-amendment ([`docs/contracts/mcp-phase-1-scope.md`](../../docs/contracts/mcp-phase-1-scope.md) § A0).

Without all three, this phase stays dormant. Speculative write-tool
infrastructure pulls A0-amendment review time it has not earned.

- [ ] **M1** — Design call (council, 1 round, $0.10 budget):
      decide between
      (a) **direct writes with path-allowlist** (server enforces
      `${CONSUMER_ROOT}/agents/**` boundary; transport client UI
      handles consent) or
      (b) **inversion-of-control** (Sonnet's proposal: MCP tools
      return *proposed changes* as structured data; the consumer
      agent's pre-commit hook applies them locally; MCP server
      stays read-only forever).
- [ ] **M2** — A0 amendment in `docs/contracts/mcp-phase-1-scope.md`
      reflecting the chosen design. Reviewed before any code lands.
- [ ] **M3** — Implementation of the first write tool under the
      chosen envelope.
- [ ] **M4** — Contract test: write-tool side effect is bounded by
      the allowlist (design (a)) OR returns a proposal payload with
      no FS access (design (b)).

The reason this is its own phase is the council's hard line: the
read-only / write asymmetry is structural. Mixing them into Phase 3
re-opens the design tradeoff every time.

## Phase 5: TypeScript Port (DEFERRED)

**Goal:** Port specific tools' implementation to TypeScript so they
can execute natively in the Cloud Worker without a Python-subprocess
hop — but *only* the tools whose measured usage justifies the
maintenance burden of two implementations.

**Wake-up trigger — required before any code:**

1. Phase 3 surfaced ≥ 1 tool whose Cloud-Worker latency (Python
   subprocess + cold-start) repeatedly fails the consumer-facing
   budget (Opus's hot-path category — `skill_trigger_eval`,
   `memory_lookup` are the candidates), OR
2. A distribution requirement appears that the Python-subprocess
   pattern cannot meet (e.g., a hosted endpoint that must serve
   < 50 ms p95 with zero cold-start).

- [ ] **N0** — Forcing function (mandatory first step): if
      a TS-native implementation is proposed for ≥ 3 tools in the
      same iteration (PR, design doc, decision file), STOP. Open
      `agents/roadmaps/road-to-mcp-native-ts-port.md` instead and
      require a fresh council call before any code lands. Single-
      tool ports may proceed through N1; multi-tool batches re-
      enter via the new-roadmap door. This is the loophole-closer
      against "Phase 5 expanded into mass-port by accumulation"
      (Sonnet finding, 2026-05-11 review).
- [ ] **N1** — Per-tool port: TypeScript implementation alongside
      the Python implementation, with the contract test (`L3`) now
      asserting parity across *three* paths (stdio-Python,
      Worker-Python-subprocess, Worker-TS-native).
- [ ] **N2** — Decision in `agents/decisions/`: which path becomes
      the primary, which becomes deprecated, and the deprecation
      window.
- [ ] **N3** — Sunset the deprecated path once telemetry shows zero
      traffic on it for ≥ 4 weeks.

Mass-port (all 112 scripts → TS) is rejected by this roadmap and
will not become a phase here. If the future demands it, that is a
*new roadmap* (`road-to-mcp-native-ts-port.md`), not a phase
extension. The N0 forcing function ensures incremental
accumulation cannot route around this prohibition.

## Acceptance Criteria (whole roadmap)

- [ ] At least one of Phase 1 / Phase 2 / Phase 3 executes; Phases
      4 and 5 remain DEFERRED unless their wake-up triggers fire.
- [ ] If Phase 3 ships any tool, the contract test (`L3`) protects
      it against version skew (hermetic fixtures + FS-diff + env
      control).
- [ ] If Phase 2 closes no-go, the roadmap archives with that
      verdict and a written rationale linking the dashboard query.
- [ ] At no point does the MCP server's A0 contract weaken without
      a fresh amendment + council design call (Phase 4 / M1).
- [ ] Discovery-First strategy is retired only via an explicit
      verdict in `agents/decisions/mcp-strategy-retirement-<date>.md`
      with a fresh council call; until then, every phase decision
      defers to the original convergence.

## Risk register

| Risk | Mitigation |
|---|---|
| Phase 1 stubs cause client errors that look like outages | `not_implemented` envelope is documented; structured error code, `install_hint` field, never a 500 |
| Stub fatigue — clients see 20 tools but only 2 work | The stub error explicitly names the alternative; telemetry quantifies the rate to keep us honest |
| Telemetry collects bodies / leaks PII | J4 contract: hash client_id at server boundary, log only `{tool_name, ts, outcome}` — no inputs, no outputs |
| Telemetry silent failure leaves Phase 2 with empty dataset (Sonnet finding, 2026-05-11 review) | J6 healthcheck cron + Phase 2 K1 acceptance asserts ≥ 1 log line / 24h; K3 verdict refused if pipeline gaps detected; consumer notification that `not_implemented` is expected during discovery, requesting they keep call attempts |
| Phase 2 cut threshold cherry-picked to justify a port | K3's verdict file must show the ranked-tool distribution; cut justified against it, not against a preferred port list; rejected-tool list published with margins |
| K3 cut applied to statistical noise (small sample) | K3 only fires when total logged attempts ≥ 500 AND distinct request-IDs ≥ 50 — below that, telemetry window extends rather than producing a verdict |
| Version skew once a tool is implemented in two places | L3 contract test is the single mechanism preventing it; no implementation lands without parity test (hermetic fixtures, FS-diff assertion, env control) |
| MCP spec breaking change (pre-1.0) invalidates schemas mid-port | Catalog is data, not code; schema migration applies to one file, not 20 implementations |
| "Komplette Umstellung" interpreted as full TS port and re-opened later | Phase 5 explicitly forbids mass-port; N0 forcing function (≥ 3 simultaneous TS-port proposals → STOP, new roadmap required); strategy retirement requires explicit decision file |

## Reference

- Council inputs (durable): linked in the Status block above.
- MCP scope contract: [`docs/contracts/mcp-phase-1-scope.md`](../../docs/contracts/mcp-phase-1-scope.md).
- MCP cloud-tool scope: [`docs/contracts/mcp-cloud-scope.md`](../../docs/contracts/mcp-cloud-scope.md).
- Predecessor MCP roadmaps (archived):
  [`road-to-mcp-server.md`](archive/road-to-mcp-server.md) ·
  [`road-to-mcp-distribution.md`](archive/road-to-mcp-distribution.md) ·
  [`road-to-cloudflare-mcp-hosting.md`](archive/road-to-cloudflare-mcp-hosting.md).

## Next step

Start Phase 1 (`J1` — inventory cut). The catalog data file is the
single artefact every later phase depends on; getting it right early
is cheap. Do not start Phase 1 work until the user explicitly opens
the phase — this roadmap is READY, not running.
