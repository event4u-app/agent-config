# Parity verdict — Ruflo

> Per-row verdict against the eight Ruflo measurement-governance patterns
> catalogued in
> [`external-findings.md § 2`](../../agents/audit-2026-05-14-north-star/external-findings.md).
> Owner roadmap: [`step-11-ruflo-parity.md`](../../agents/roadmaps/step-11-ruflo-parity.md)
> (Phase 6 Step 1). Cross-index lives at
> [`step-99-north-star-restructure.md`](../../agents/roadmaps/step-99-north-star-restructure.md)
> Phase 5 Step 2.
>
> **Verdict legend:** `[x] covered by <file:line>` · `[~] superseded by <approach>` · `[!] gap`.
> **Acceptance:** zero `[!]` rows. Closure flips the corresponding cell in the
> [composite scorecard](../../agents/audit-2026-05-14-north-star/external-findings.md#5-composite-scorecard--agent-config-vs-the-field)
> `vs Ruflo` column from `–` to `=` or `+`.

**Measured-vs-claimed disclaimer:** Each row cites the **mechanism** that
covers Ruflo's pattern. Numbers attached to those mechanisms (cost figures,
smoke baselines, ADR count) are claimed until the 25-prompt bench corpus
soak in [`bench.json`](bench.json) flips from `warmup` to `baseline_ready`
(min 60 days, ≥ 30 reports — earliest 2026-07-15).

## Verdict table

| # | Ruflo pattern | Verdict | Evidence |
|---|---|---|---|
| 1 | **Cost-tracker plugin** — real model pricing, per-1M, separated input/output/cache | `[x] covered by` | [`scripts/cost/track.mjs`](../../scripts/cost/track.mjs) + [`bench/pricing.yaml`](../../bench/pricing.yaml) (Haiku/Sonnet/Opus per-1M, input/output/cache-read/cache-write split). Step-11 Phase 1. |
| 2 | **Auto-capture from session jsonl** — reads Claude Code log, no manual tracking | `[x] covered by` | [`scripts/cost/track.mjs`](../../scripts/cost/track.mjs) reads `~/.claude/projects/*/sessions/*.jsonl` automatically. Step-11 Phase 1 Step 1. |
| 3 | **50/75/90/100 % budget ladder with hard stop** | `[x] covered by` | [`scripts/cost/budget.mjs`](../../scripts/cost/budget.mjs) — exit codes 0/1/2/3 per tier; opt-in fail-closed via `cost.enforcement` setting. Fixtures: `tests/fixtures/cost/budget/{under-50,at-100,over-100}/`. Step-11 Phase 2. |
| 4 | **Measured-vs-claimed disclaimer** — every percentage tagged "claimed upstream" | `[x] covered by` | One-line `**Measured-vs-claimed disclaimer:**` header block on all 9 active roadmaps in `agents/roadmaps/`. Verified 2026-05-16. Step-11 Phase 5 Step 4. |
| 5 | **Smoke test as contract** — `bash scripts/smoke.sh` with declared baseline | `[x] covered by` | Four per-tier smoke scripts: [`scripts/smoke/kernel.sh`](../../scripts/smoke/kernel.sh), [`router.sh`](../../scripts/smoke/router.sh), [`schema.sh`](../../scripts/smoke/schema.sh), [`skills.sh`](../../scripts/smoke/skills.sh). Declared baselines in [`docs/contracts/smoke-contracts.md`](../contracts/smoke-contracts.md). CI gate: [`.github/workflows/smoke.yml`](../../.github/workflows/smoke.yml). Step-11 Phase 3. |
| 6 | **Per-plugin ADR directory** — `docs/adrs/0001-*.md` co-located with subsystem | `[x] covered by` | Six bootstrap ADRs under [`docs/adrs/{cost,memory,router,schema,smoke,caveman}/`](../adrs/). Coverage gate: [`scripts/audit_adr_coverage.py`](../../scripts/audit_adr_coverage.py) (`task lint-adr-coverage`). Contract: [`docs/contracts/adr-layout.md`](../contracts/adr-layout.md). Step-11 Phase 4. |
| 7 | **Namespace contract** — `<stem>-<intent>` kebab-case, reserved-names list | `[x] covered by` | [`scripts/lint_namespace.py`](../../scripts/lint_namespace.py) enforces shape + length floors + reserved-names + skill-dir-matches-name across 430 names · 0 issues. Contract: [`docs/contracts/namespace.md`](../contracts/namespace.md). CI gate: `task lint-namespace`. Step-11 Phase 5 Step 1. |
| 8 | **Topology choices in swarm** — `hierarchical / mesh / star / adaptive` with anti-drift defaults | `[x] covered by` | [`.agent-src.uncompressed/skills/subagent-orchestration/SKILL.md`](../../.agent-src.uncompressed/skills/subagent-orchestration/SKILL.md) `Topology hints` subsection — 7-row table mapping each mode to topology + Ruflo anti-drift default (`hierarchical, 6–8 agents, raft consensus`). Step-11 Phase 5 Step 2. |
| 9 | **MCP-tool count + source-line refs** — every tool with `<file>:<line>` citation | `[x] covered by` | [`docs/contracts/mcp-tool-inventory.md`](../contracts/mcp-tool-inventory.md) — 20 tools (9 stdio-implemented · 11 discovery stubs) each with catalog `<file>:<line>` + handler `<file>:<line>`. Generator: [`scripts/audit_mcp_tools.py`](../../scripts/audit_mcp_tools.py). CI drift gate: `task lint-mcp-inventory`. Step-11 Phase 5 Step 3. |

## Open `[!]` rows

**Zero.** Every Ruflo pattern is mechanism-covered. Numbers behind those
mechanisms remain claimed until [`bench.json`](bench.json) soak completes
(see disclaimer above).

## Cross-references

- Composite scorecard refresh: owned by [`step-99-north-star-restructure.md`](../../agents/roadmaps/step-99-north-star-restructure.md) Phase 5 Step 4 (replaces [`external-findings.md § 5`](../../agents/audit-2026-05-14-north-star/external-findings.md)).
- Bench-ruflo redundancy verdict: [`bench-ruflo.json`](bench-ruflo.json) (step-11 Phase 6 Step 2).
- G5 redundancy gate cite: step-99 Acceptance Criteria row "G5 — external redundancy (Domination Mandate)".
