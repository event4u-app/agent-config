---
complexity: structural
---

# Road to Ruflo Adoption

**Status:** READY FOR EXECUTION — decisions synthesized 2026-05-06 from
AI Council (claude-sonnet-4-5 + gpt-4o, $0.0546 actual run).
**Started:** 2026-05-06
**Trigger:** User ask — "deep-scan `ruvnet/ruflo`, prioritize what
informs the MCP roadmap or fills a real gap, autonomy on, council to
break ties."
**Mode:** Conservative MCP-roadmap-aligned plate. Hard cap 5 per
6-week plate; this plate uses **3 of 5 slots** — the HTTP-bridge slot
is intentionally **deferred-with-trigger** (council Cluster 1
unanimous), not consumed.

## Purpose

Harvest only what is **portable** from Ruflo's marketplace — the
methodology of ADRs, the metering logic of the cost-tracker, and the
HMAC-signing primitive that any non-stdio MCP transport will need —
without inheriting Ruflo's `mcp__claude-flow__*` runtime coupling. Land
the load-bearing primitive (HMAC signing) **before** the speculative
HTTP-bridge, so when a real HTTP use case surfaces in
`road-to-mcp-server.md`, the security floor is already in place.

## Decisions (synthesized 2026-05-06 from council)

- **HTTP-bridge deferred-with-trigger.** Both council members vote (c).
  Sonnet's argument accepted: scoring something I=9 and proposing it's
  safe to delay is incoherent — either ship Phase 1 stdio first and
  prove the abstraction, or admit Phase 1 is wrong. Phase 1 stdio
  ships first; HTTP reopens only on a real consumer use case.
- **HMAC-auth lands NOW as a separate guideline.** Sonnet's net-new
  candidate (ICE 504, higher than the bridge itself). Signing is
  mandatory for any non-stdio transport; landing the primitive ahead
  of the transport keeps Phase 4 D4 unblocked.
- **`adr-create` ships methodology + INDEX regen.** Cluster 2 split
  (Sonnet b / GPT-4o a); Sonnet's "40% value loss without index"
  argument wins on weight. Search-by-grep dropped (over-scope).
- **SPARC cited inside `test-driven-development`, not standalone.**
  Cluster 3 unanimous (b). Standalone SPARC would be ignored;
  embedded escalation trigger increases adherence.
- **Cost-tracker port keeps scripts outside `.agent-src/`.** Both
  scripts (track.mjs + budget.mjs) live under `scripts/cost/`, write
  to a local JSONL file (no MCP `memory_store` dependency), surfaced
  through a new `/cost:report` command.

## Authoritative-Link Sunset path

For Ruflo runtime components we will not fork:

- `src/mcp-bridge/index.js` (Express HTTP bridge, ~600 LOC of
  cloud-function routing) → authoritative-link only, never inlined.
- `plugins/ruflo-{adr,cost-tracker,sparc}/marketplace.json` →
  reference-only; we do not adopt Ruflo's marketplace format.
- The full `mcp__claude-flow__*` tool surface → upstream-only.

## Horizon (6-week visible plate)

Phase 1 ships **3 adoptions + suite integration**. Phase 2 unlocks
only on documented trigger conditions. Phase 3 governance cross-cut
runs in parallel with Phase 1 + 2.

## Phase 1 — Ruflo-track Phase-1 plate (READY)

- [ ] **P1.1 — `adr-create` skill + `adr-index` regen script.**
  Author new skill at `.agent-src.uncompressed/skills/adr-create/`
  with sequential ADR-NNN numbering, the standard ADR template
  (Status / Context / Decision / Consequences / Links), and zero
  MCP-tool dependency. Add `scripts/adr/regenerate_index.py` (≤80
  lines) that scans `docs/adr/ADR-*.md` and emits
  `docs/adr/INDEX.md`. Cross-link from `agent-docs-writing` and
  `architecture` rule. Lines budget: ≤200 skill, ≤80 script.

- [ ] **P1.2 — `cost-track` + `cost-budget` scripts + `/cost:report`
  command.** Fork `track.mjs` + `budget.mjs` from
  `plugins/ruflo-cost-tracker/scripts/` into `scripts/cost/`, swap
  the `mcp__claude-flow__memory_store` call for a local JSONL
  append at `agents/cost-tracking/sessions.jsonl`. Add new command
  at `.agent-src.uncompressed/commands/cost-report.md` that runs
  the tracker, computes the 50/75/90/100% alert ladder, and surfaces
  cost-profile suggestions. Tie to existing `set-cost-profile`
  command via cross-reference. Lines budget: ≤300 scripts (combined),
  ≤120 command.

- [ ] **P1.3 — `mcp-hmac-auth` guideline.** Author new guideline at
  `docs/guidelines/agent-infra/mcp-request-signing.md` covering
  Ruflo's `CRYPTO_SEG` HMAC signing + verification pattern (~30 LOC
  reference, with attribution to `src/mcp-bridge/mcp-stdio-kernel.js`),
  the threat model (replay, MITM on non-stdio transport), and the
  citation hooks from `road-to-mcp-server.md` Phase 4 D4 (allowlist).
  Authoritative-link to upstream Ruflo SHA for the full bridge.
  Lines budget: ≤200.

- [ ] **P1.4 — Suite integration.** Add the new skill, the new
  guideline, the new command, and the cost scripts to manifests.
  Run `task sync` → `.agent-src/` regenerated. Run
  `task generate-tools` → `.claude/`, `.cursor/`, `.clinerules/`,
  `.windsurfrules` regenerated. Verify `task ci` exits 0:
  `lint-skills`, `check-portability`, `check-refs`, `lint-readme`,
  `check-roadmap-trackable`, `lint-roadmap-complexity`, `test`. Add
  cross-reference into `road-to-mcp-server.md` § "Reference" pointing
  at `mcp-request-signing` guideline.

## Phase 2 — Out-of-horizon (deferred-with-trigger)

- [ ] **P2.1 — MCP HTTP-bridge pattern as Phase-5 of
  `road-to-mcp-server.md`.** Reopen only when **both** triggers fire:
  (a) Phase 1 of `road-to-mcp-server` ships a working stdio prompt
  fetch in at least one confirmed client, AND (b) ≥1 consumer surfaces
  a concrete HTTP-MCP use case (browser client, remote agent, CI
  agent calling a centralized MCP server). Adoption shape: extract
  `mcp-stdio-kernel.js` pattern (~250 LOC) as a reference appendix to
  the existing `mcp-request-signing` guideline; the full Express
  bridge stays authoritative-link only. Citation hooks land in the
  existing `road-to-mcp-server.md` Phase 5 (new), NOT a new roadmap.

- [ ] **P2.2 — SPARC escalation citation in `test-driven-development`.**
  Reopen after P1.1 (`adr-create`) ships AND at least one feature in
  any consumer project has surfaced documented AC count >5 OR
  cross-cutting impact across ≥3 modules. Adoption shape: ≤30-line
  inline citation block inside `test-driven-development` describing
  when to escalate to a SPARC-style gated 5-phase workflow (Spec →
  Pseudocode → Architecture → Refine → Complete) instead of plain
  TDD. Citation must include a decision tree (AC count > N OR
  contract-modifying change). NO standalone SPARC guideline.

## Phase 3 — Governance cross-cut (out-of-horizon, council-recommended)

- [ ] **P3.1 — Codify "Defer-with-trigger" ICE tier.** Add a
  "Defer-with-trigger" section to a new `agents/contexts/harvest-policy.md`
  (or extend existing harvest context if one exists) covering: the
  third bucket between "adopt now" and "drop"; required trigger format
  (specific, observable, falsifiable); review cadence (each plate);
  owner; link from future harvest analysis docs. Closes the meta-process
  gap Sonnet flagged in this very review. Lines budget: ≤150.

- [ ] **P3.2 — Sunset audit on Ruflo-derived artifacts.** After
  Phase 1 has been live one full cycle: verify `adr-create` ≤200,
  `mcp-request-signing.md` ≤200, `cost-report` ≤120; verify all
  authoritative links resolve in CI; verify cost-tracking JSONL
  schema hasn't drifted from the Ruflo source pricing constants
  (or document the divergence). Re-run `task ci`.

## Risk register

- **MCP-runtime drift:** if the Ruflo `aidefence` / `agentdb` MCP
  tools become a real standard later, our refusal to adopt them now
  may look conservative. Mitigated: Phase 3 governance audits each
  cycle and can reverse the call.
- **HMAC pattern obsolescence:** if MCP spec adds first-class auth,
  our guideline becomes redundant. Mitigated: guideline cites the
  spec-version it shadows; obsolescence triggers a clean Sunset.
- **Cost-tracker pricing constants:** Anthropic pricing changes.
  Mitigated: P3.2 audits the constants; out-of-band updates land as
  patches without re-opening the roadmap.
- **HTTP-bridge premature adoption:** if the trigger is never met,
  P2.1 sits dormant indefinitely. That is the **intended** outcome —
  speculative architecture is the cost we are explicitly avoiding.

## Provenance

- Analysis: `agents/analysis/compare-ruflo-harvest.md`
- Upstream source: `ruvnet/ruflo` (SHA captured during harvest in
  `/tmp/ruflo-harvest/ruflo.sha`; not committed — re-captured per audit)
- Specific Ruflo files referenced:
  - `src/mcp-bridge/mcp-stdio-kernel.js` (HMAC pattern source)
  - `plugins/ruflo-adr/skills/adr-create/SKILL.md` (ADR methodology source)
  - `plugins/ruflo-cost-tracker/scripts/{track,budget}.mjs` (cost script port source)
  - `plugins/ruflo-sparc/skills/{sparc-spec,sparc-implement}/SKILL.md` (citation source for P2.2 only)
