---
complexity: structural
---

# Roadmap: Measurement & Governance Parity — Cost Tracking, Smoke Contracts, ADRs (P5)

> Match every measurable **governance pattern** sourced from ruflo's measurement playbook — session-jsonl cost tracker, 50/75/90/100 % budget ladder with hard stop, per-tier smoke contracts, per-area ADR directories, enforced namespace contract, topology hints for subagent orchestration, MCP-tool count with source-file citations, measured-vs-claimed disclaimer surface — and surface zero `[!]` rows in `docs/parity/measurement-governance.md`.

**Scope boundary (locked 2026-05-16):** This roadmap absorbs ruflo's **measurement and governance discipline only**. It does **not** build a multi-agent runtime, task-graph engine, agent messaging bus, distributed worker system, or any other runtime-orchestration primitive. AI Council remains the control plane; execution engines stay swappable. Decision evidence: GPT architecture review 2026-05-16 (Option C — Hybrid) + `external-findings.md § 2` (eight rows, all governance / measurement, zero runtime).

**Measured-vs-claimed disclaimer:** Every percentage and dollar figure cited from ruflo in this roadmap is **claimed upstream, not yet verified in this repo**. Validation against our session jsonl happens in Phase 1 — until then, we have no cost surface at all, and our numbers are absent, not equivalent.

## IMPORTANT

- [x] Don't call it ruflo. → Resolved 2026-05-16: title renamed "Measurement & Governance Parity"; ruflo cited as source, not product target. Internal identifiers `cost` / `budget`.

## Prerequisites

- [x] Read `AGENTS.md` and [`external-findings.md § 2`](../../audits/2026-05-14-north-star/external-findings.md) — every row is a checkbox in this roadmap
- [x] [`step-4-measurement-and-benchmark.md`](archive/step-4-measurement-and-benchmark.md) Phase 2 complete (session-jsonl reader exists) — closed 2026-05-16
- [x] `scripts/cost/budget.mjs` exists — verified 2026-05-16 (5-tier ladder OK/INFO/WARNING/CRITICAL/HARD_STOP)
- [x] `scripts/agent-config` dispatcher and `./agent-config explain` subcommand exist — verified 2026-05-16

## Context

Ruflo measures everything and tags every claim with provenance. We measure structure, not behaviour. The package preaches token economy but cannot say what a session cost; we ship `set-cost-profile` that picks a profile and produces no dollar attribution downstream.

This roadmap closes the parity table row by row, and lands the **mechanism** (cost tracker + budget ladder + smoke contracts + ADR directories + namespace enforcement + topology hints) without relitigating whether each row is wanted — the Domination Mandate already settled that.

- **Source:** [`external-findings.md § 2`](../../audits/2026-05-14-north-star/external-findings.md) (8 rows, all in scope)
- **Pillar:** P5 (Domination Mandate)
- **Block-on:** step-4 Phase 2 (session-jsonl reader is the cost-tracker substrate)

## Phase 1: Cost-tracker plugin

Read Claude Code session jsonl. Real model pricing. Per-1M Haiku / Sonnet / Opus, input / output / cache-read / cache-write split.

- [x] **Step 1 — Pricing table:** [`bench/pricing.yaml`](../../bench/pricing.yaml) — canonical per-1M pricing for Haiku / Sonnet / Opus, split into `input`, `output`, `cache_read`, `cache_write`. Sourced from `https://www.anthropic.com/pricing` with `sourced_on` dates per row. Mirrored by `PRICING` table in `scripts/cost/track.mjs`. _Closed 2026-05-16 — landed via [`step-4` Phase 2 Step 2](archive/step-4-measurement-and-benchmark.md). Path differs from the roadmap draft (`bench/` not `docs/contracts/`); kept where it is because `bench/` is the active pricing surface used by `task bench` cost capture._
- [x] **Step 2 — Session-jsonl reader:** [`scripts/cost/track.mjs`](../../scripts/cost/track.mjs) — Node fork of `ruvnet/ruflo` `plugins/ruflo-cost-tracker/scripts/track.mjs`. Parses the active Claude Code session jsonl under `~/.claude/projects/<encoded-cwd>/` into `{model, input_tokens, output_tokens, cache_read_tokens, cache_write_tokens, ts}` records. Idempotent: re-running against the same session jsonl re-derives the same numbers (input is the jsonl, output is JSON; no in-place mutation). _Closed 2026-05-16 — landed via [`step-4` Phase 5 Step 1](archive/step-4-measurement-and-benchmark.md). Implementation language differs from the roadmap draft (`.mjs` not `.py`); kept Node because it ported from the upstream ruflo plugin verbatim and Python rewrite would diverge from the parity source._
- [x] **Step 3 — Cost attribution:** `scripts/cost/track.mjs` joins reader output × `bench/pricing.yaml` → per-session, per-model cost rows. Appends one record per run to [`agents/cost-tracking/sessions.jsonl`](../../agents/cost-tracking/) (rolling sum is derived by `budget.mjs` reading the jsonl, not a separate `aggregate.json` file). _Closed 2026-05-16 — landed via [`step-4` Phase 5 Step 1](archive/step-4-measurement-and-benchmark.md). Output shape differs from the roadmap draft (single append-only jsonl, not per-session `.json` + sibling aggregate); the jsonl form is simpler to consume and avoids the directory-fan-out._
- [x] **Step 4 — `task cost-track` entrypoint:** [`taskfiles/engine.yml`](../../taskfiles/engine.yml) ships `task cost` (track + check), `task cost:track` (capture only), `task cost:budget -- {set N|get|check}`. All silent, `--quiet`-aware via `BUDGET_QUIET=1` / `TRACK_QUIET=1`. Standard `rtk` wrapping handled by the `_lib/script_output` helpers. _Closed 2026-05-16 — landed via [`step-4` Phase 5 Step 4](archive/step-4-measurement-and-benchmark.md). Task name differs from the roadmap draft (`cost:track` not `cost-track`); colon-namespacing matches the rest of the Taskfile._
- [x] **Step 5 — `agent-status` integration:** [`.agent-src.uncondensed/commands/agent-status.md`](../../.agent-src.uncondensed/commands/agent-status.md) gained a `### 3a. Read session cost ledger` step + `💵 Session cost (measured)` dashboard panel. Reads from `agents/cost-tracking/sessions.jsonl`; gracefully renders `not initialised` when the ledger doesn't exist (no `task cost:track` ever run). Pricing source + reader implementation both cited inline. Skill body remains < 80 essentials lines (cut-point of [`step-5`](step-5-schema-rigor.md) Phase 2 not yet defined, but the addition is bounded — 20 lines). _Closed 2026-05-16._

**Exit:** `task cost-track` against a real session jsonl produces a per-session JSON with model-attributed cost rows; `agent-status` shows dollars. **Rollback:** disable the `agent-status` cost panel (revert the source command); the cost scripts are read-only. ✅ **Status:** all five steps closed 2026-05-16.

### Path-deviation summary (roadmap vs. as-built)

| Roadmap draft | As-built | Why |
|---|---|---|
| `docs/contracts/model-pricing.yaml` | `bench/pricing.yaml` | `bench/` is the active pricing surface (also consumed by `task bench`); single source beats two locations. |
| `scripts/cost/session_reader.py` | `scripts/cost/track.mjs` | Verbatim port of upstream ruflo plugin; Python rewrite would diverge from the parity source. |
| `scripts/cost/attribute.py` + `agents/runtime/metrics/cost/<sid>.json` + `aggregate.json` | One append-only `agents/cost-tracking/sessions.jsonl` | jsonl form is simpler; budget evaluator derives aggregates by scanning, no separate file to keep in sync. |
| `task cost-track` | `task cost:track` (alias of `task cost`) | Colon namespace matches the rest of the Taskfile. |
| `agent-status` skill | `agent-status` command (Tier 0) | The surface exists as `.agent-src.uncondensed/commands/agent-status.md`, not `skills/`; structurally a command per the cluster contract. |

## Phase 2: 50/75/90/100 % budget ladder with hard stop

The advisory dashboard from step-15 becomes the loader-side hard stop at 100 %.

- [x] **Step 1 — Budget config:** `.agent-settings.yml § cost` accepts `budgets.{daily,weekly,monthly}` (USD ceilings) + `enforcement: advisory|hard-stop`. Template landed in [`config/agent-settings.template.yml`](../../config/agent-settings.template.yml) lines 33–55, mirrored into the agent's own [`.agent-settings.yml`](../../.agent-settings.yml). `budget.mjs` `loadSettingsCost()` reads the block via a minimal in-file YAML reader (no yaml dep) — settings win over `budget.json` when both carry values. Contract documented in [`docs/contracts/cost-enforcement.md`](../../docs/contracts/cost-enforcement.md). _Closed 2026-05-16._
- [x] **Step 2 — Ladder evaluator:** [`scripts/cost/budget.mjs`](../../scripts/cost/budget.mjs) `cmdCheck()` consumes [`agents/cost-tracking/sessions.jsonl`](../../agents/cost-tracking/) (append-only ledger, not `aggregate.json` — aggregation is derived in-memory by `loadSessions()` + `reduce()`, no separate file). Emits `{ period, budget_usd, spent_usd, remaining_usd, utilization_pct, level, threshold, recommended_action, sessionCount }`. Tier-naming is 5-stage (`OK / INFO / WARNING / CRITICAL / HARD_STOP`) instead of the roadmap-draft 4-stage (`under/50/75/90/100`); the 5-stage form preserves the `OK` ground-state which the 4-stage form folded into `under`. Mapping table for parity-doc Phase 6 Step 1: `OK ↔ under` · `INFO ↔ 50` · `WARNING ↔ 75` · `CRITICAL ↔ 90` · `HARD_STOP ↔ 100`. _Closed 2026-05-16 — landed via [`step-4` Phase 5 Step 1](archive/step-4-measurement-and-benchmark.md) (ruflo-fork verbatim port)._
- [x] **Step 3 — Hard-stop hook:** Process-entry preflight at [`scripts/cost/preflight.mjs`](../../scripts/cost/preflight.mjs) wired as `task cost:preflight` ([`taskfiles/engine.yml`](../../taskfiles/engine.yml) §`cost:preflight`). Exits non-zero only when `cost.enforcement: hard-stop` AND `level: HARD_STOP`; fail-open when no budget configured. Refusal block cites the three bypass paths (raise / reset / disable). Decision recorded in [`docs/adrs/cost/0001-hard-stop-hook.md`](../../docs/adrs/cost/0001-hard-stop-hook.md) — rejected the rule-loader hook (no live loader exists), `/onboard` block (chicken-and-egg), per-tool interceptor (out-of-scope runtime). Accepted opt-in-by-wrapper as the governance-layer-appropriate surface. _Closed 2026-05-16._
- [x] **Step 4 — Advisory tier surfaces:** `agent-status` cost section shows tier with emoji status. Implemented 2026-05-16 in [`.agent-src.uncondensed/commands/agent-status.md`](../../.agent-src.uncondensed/commands/agent-status.md) `### 3a. Read session cost ledger` + `💵 Session cost (measured)` panel. Tier-emoji mapping documented inline; reads `budget.tier` from `task cost:budget -- check`. Deviation from draft: emoji ladder uses `✅ / ⚠️ / ⚠️⚠️ / ❌` to disambiguate tier-75 (WARNING) from tier-90 (CRITICAL) at a glance — language-and-tone allows status markers; doubled `⚠️` is functional, not decorative. _Closed 2026-05-16._
- [x] **Step 5 — Fixture suite:** [`tests/fixtures/cost/budget/`](../../tests/fixtures/cost/budget/) — five fixtures (`under-50`, `mid-75`, `high-90`, `at-100`, `over-100`), each with `sessions.jsonl` + `settings.yml` + `expected.json` + `expected_exit`. Runner at [`tests/cost/budget-fixtures.mjs`](../../tests/cost/budget-fixtures.mjs); wired as `task test-cost-budget` ([`taskfiles/engine.yml`](../../taskfiles/engine.yml) §`test-cost-budget`). Asserts `budget.mjs` JSON output matches expected byte-for-byte and `preflight.mjs` exit code matches `expected_exit`. Run 2026-05-16: 5 passed · 0 failed (HARD_STOP fixtures exit 1, others exit 0). _Closed 2026-05-16._

**Exit:** ladder evaluator returns the right tier per fixture; hard-stop refusal triggers at 100 %; advisory mode surfaces all four tiers in `agent-status`. **Rollback:** flip `cost.enforcement` to `advisory` globally; hard-stop becomes inert. ✅ **Status:** all five steps closed 2026-05-16.

## Phase 3: Per-tier smoke contracts

Every tier of the system (kernel / router / schema / skills) gets a `scripts/smoke.sh` with a declared baseline. CI runs them on every PR touching the tier.

- [x] **Step 1 — Smoke contract spec:** [`docs/contracts/smoke-contracts.md`](../../docs/contracts/smoke-contracts.md) — every smoke script declares (a) 30-second runtime ceiling, (b) measured pass baseline (locked 2026-05-16, not aspirational), (c) PR path-trigger globs. _Closed 2026-05-16._
- [x] **Step 2 — [`scripts/smoke/kernel.sh`](../../scripts/smoke/kernel.sh):** 9 kernel rules from `router.json`; all 9 rule files exist; 8 carry Iron-Law fences (`agent-authority` is the dispatch index, exempt); kernel-budget breaches locked at ≤ 2 via `scripts/measure_rule_budget.py`. Baseline: `9 rules · 8 Iron-Law fences · 1 dispatch index · 2 budget breach(es)`. _Closed 2026-05-16._
- [x] **Step 3 — [`scripts/smoke/router.sh`](../../scripts/smoke/router.sh):** 75 router ids (9 kernel + 24 tier_1 + 42 tier_2); 0 broken rule pointers; 35 `routes_to` refs resolved through 4 prefixes (`skill:`, `command:`, `guideline:`, `contract:`); missing-contract count locked at ≤ 2 (`artifact-engagement-flow`, `command-suggestion-flow`). Baseline: `75 router ids · 0 broken rule pointers · 35 routes_to refs · 2 missing contracts`. _Closed 2026-05-16._
- [x] **Step 4 — [`scripts/smoke/schema.sh`](../../scripts/smoke/schema.sh):** Runs `scripts/skill_linter.py --all --quiet`; hard-asserts `0 FAILs`; locks warns at ≤ 92 and total at ≥ 438 (regression lock). v2 schema fields (`model_tier`, `schema_version`) deferred until [`step-5-schema-rigor.md`](step-5-schema-rigor.md) Phase 1 closes. Baseline: `438 lintable artefacts · 0 schema FAIL(s) · 92 warn(s)`. _Closed 2026-05-16._
- [x] **Step 5 — [`scripts/smoke/skills.sh`](../../scripts/smoke/skills.sh):** Picks 5 random skills (deterministic seed = epoch day) from `.agent-src.uncondensed/skills/*/SKILL.md`; validates frontmatter against `scripts/schemas/skill.schema.json`; asserts `name:` matches parent directory. `./agent-config explain skill` not invoked — `explain` CLI only supports `{config,rule,route}` today; filesystem resolution is the contract. Baseline: `210 skills · 5/5 random sample passes (seed=epoch-day)`. _Closed 2026-05-16._
- [x] **Step 6 — CI wiring:** [`.github/workflows/smoke.yml`](../../.github/workflows/smoke.yml) dispatches all four smokes on PRs touching `.agent-src.uncondensed/{rules,skills}/**`, `router.json`, `scripts/smoke/**`, `scripts/{measure_rule_budget,skill_linter,validate_frontmatter}.py`, `scripts/schemas/**`, `docs/contracts/**`, `docs/guidelines/**`. Local aggregator: `task smoke` (sub-tasks `task smoke:{kernel,router,schema,skills}`) wired in [`taskfiles/engine.yml`](../../taskfiles/engine.yml). _Closed 2026-05-16._

**Exit:** four smoke scripts exist; each emits its declared baseline; CI dispatches on path change. **Rollback:** drop the workflow; scripts remain as opt-in local checks. ✅ **Status:** all six steps closed 2026-05-16.

## Phase 4: Per-area ADR directories

Every plugin / sub-area gets `docs/adrs/<area>/0001-*.md`, `0002-*.md`. Architecture decisions co-located with the code they justify.

- [x] **Step 1 — ADR layout spec:** [`docs/contracts/adr-layout.md`](../../docs/contracts/adr-layout.md) — dual-surface contract: flat (`docs/decisions/ADR-NNN-<slug>.md`, 3-digit, package-wide governance) + per-area (`docs/adrs/<area>/NNNN-<slug>.md`, 4-digit, sub-area). Cites the existing `adr-create` skill — does not duplicate the template. _Closed 2026-05-16._
- [x] **Step 2 — Area inventory:** [`scripts/audit_adr_coverage.py`](../../scripts/audit_adr_coverage.py) — canonical `AREAS` dict (cost · telegraph · schema · router · smoke · memory), `--report` / `--check` / `--regen-area-readme` modes. Coverage report emits one row per area with contract presence, ADR count, README presence, status. _Closed 2026-05-16._
- [x] **Step 3 — Bootstrap pass:** Five retrospective ADRs landed under `docs/adrs/{telegraph,schema,router,smoke,memory}/0001-*.md`; `docs/adrs/cost/0001-hard-stop-hook.md` pre-existed. Each cites the existing implementation file:line and area contract. _Closed 2026-05-16._
- [x] **Step 4 — `adr-create` skill update:** [`.agent-src.uncondensed/skills/adr-create/SKILL.md`](../../.agent-src.uncondensed/skills/adr-create/SKILL.md) — added surface-picker step (flat vs per-area), per-area template (quote-style header, no YAML frontmatter), 4-digit numbering rules, area-inventory gate, dual regenerator paths (`regenerate_index.py` flat · `audit_adr_coverage.py --regen-area-readme` per-area). _Closed 2026-05-16._
- [x] **Step 5 — Coverage gate:** `task lint-adr-coverage` wraps `python3 scripts/audit_adr_coverage.py --check`; wired into `Taskfile.yml` `ci` + `ci-strict` between `lint-skills` and `lint-archived-skills`. Hard fails on number gaps / missing README / malformed filenames; warns on missing bootstrap ADRs without failing CI. _Closed 2026-05-16._

**Exit:** every high-traffic area has \u2265 1 ADR; lint warns on uncovered new contracts. **Rollback:** demote lint to advisory; ADRs are pure documentation.

## Phase 5: Namespace contract + topology hints + MCP-tool count

Three smaller rows from the parity table, batched.

- [x] **Step 1 — Namespace contract:** [`docs/contracts/namespace.md`](../../docs/contracts/namespace.md) — `<stem>-<intent>` kebab-case; reserved-names list (`pattern`, `claude-memories`, `default`, `index`, `router`). [`scripts/lint_namespace.py`](../../scripts/lint_namespace.py) enforces: regex shape, length floor (skills 3+ · others 2+ for intentional acronyms `pr` / `ci` / `qa` / `me`), reserved-name check (top-level only — sub-verbs like `council/default` exempt), skill-dir-matches-frontmatter-name. Wired as `task lint-namespace` in `taskfiles/ci-fast.yml`; called from `Taskfile.yml` `ci` + `ci-strict`. Baseline: 430 names · 0 issues. _Closed 2026-05-16._
- [x] **Step 2 — Topology hints in `subagent-orchestration`:** [`.agent-src.uncondensed/skills/subagent-orchestration/SKILL.md`](../../.agent-src.uncondensed/skills/subagent-orchestration/SKILL.md) gained a `Topology hints — per-mode communication shape` subsection: 7-row table mapping each mode to one of `hierarchical` / `mesh` / `hierarchical-mesh` / `ring` / `star` / `adaptive` with the Ruflo anti-drift default (`hierarchical, 6–8 agents, raft consensus`) + glossary. Cites [`external-findings.md § 2`](../../audits/2026-05-14-north-star/external-findings.md) row 7. Descriptive, not enforced. _Closed 2026-05-16._
- [x] **Step 3 — MCP-tool count audit:** [`scripts/audit_mcp_tools.py`](../../scripts/audit_mcp_tools.py) reads the source-of-truth catalog [`consumer_tool_catalog.json`](../../scripts/mcp_server/consumer_tool_catalog.json) + handler registry [`tools.py`](../../scripts/mcp_server/tools.py) and emits [`docs/contracts/mcp-tool-inventory.md`](../../docs/contracts/mcp-tool-inventory.md) — 20 tools, each with `<file>:<line>` citation for both catalog entry and handler (or `_stub-only_`). Drift gate `lint-mcp-inventory` (`--check`) wired into `Taskfile.yml` `ci` + `ci-strict` via `taskfiles/ci-fast.yml`. Baseline: 9 stdio-implemented · 11 discovery-only stubs. _Closed 2026-05-16._
- [x] **Step 4 — Measured-vs-claimed pass:** All 9 active roadmaps in `agents/roadmaps/` now carry a `**Measured-vs-claimed disclaimer:**` one-liner in their header. Verified existing on step-10 / step-11 / step-5-schema-rigor (Phase 2 of step-99 drafts); backfilled on step-2 / step-5-test-cleanup / step-13 / step-14 / step-15 / step-99. Each disclaimer cites where validation happens (child roadmap, downstream phase, or `[!]` until human-confirmed for non-dev validation). _Closed 2026-05-16._

**Exit:** namespace lint green; topology table in subagent-orchestration; MCP-tool inventory generated; every active roadmap carries the disclaimer. **Rollback:** demote namespace lint to warn; topology hints harmless metadata.

## Phase 6: Verification + parity sign-off

- [x] **Step 1 — Parity doc:** [`docs/parity/ruflo.md`](../../docs/parity/ruflo.md) — 9 rows mapping each [`external-findings.md § 2`](../../audits/2026-05-14-north-star/external-findings.md) pattern to its covering mechanism (`scripts/cost/*.mjs`, `scripts/smoke/*.sh`, `docs/adrs/*/`, `scripts/lint_namespace.py`, `subagent-orchestration` Topology subsection, `docs/contracts/mcp-tool-inventory.md`, disclaimer pass). **Zero `[!]` rows.** _Closed 2026-05-16._
- [x] **Step 2 — Bench redundancy check:** [`docs/parity/bench-ruflo.json`](../../docs/parity/bench-ruflo.json) committed as `parity-bench-ruflo-v1` methodology contract — references `scripts/cost/track.mjs` + `bench/pricing.yaml`, lists the 8 dollar-cost fields populated by the first 25-prompt corpus run, inherits the [`bench.json`](../../docs/parity/bench.json) soak window (≥ 30 reports · ≥ 60 days · earliest flip 2026-07-15). Numbers stay claimed until the soak arbiter (`task bench:baseline-ready`) flips. _Closed 2026-05-16 (infrastructure-ready; numeric verdict deferred to soak completion)._
- [x] **Step 3 — Cross-reference [`step-99`](step-99-north-star-restructure.md) Phase 5 Step 2:** step-99 Phase 5 Step 2 already targets `docs/parity/ruflo.md`; G5 acceptance row already cites it. No edit needed — verified 2026-05-16. _Closed._
- [x] **Step 4 — Composite scorecard refresh:** [`external-findings.md § 5`](../../audits/2026-05-14-north-star/external-findings.md) updated 2026-05-16 — Cost attribution / Per-tier smoke contract / ADR co-location flipped `–` → `=` vs Ruflo; four new rows added (Namespace contract · Topology hints · MCP-tool inventory · Measured-vs-claimed disclaimer) all `=` across the field. Hot-read paragraph rewritten to reflect the post-step-11 surface. _Closed 2026-05-16._

**Exit:** parity doc zero `[!]` rows; bench-ruflo.json present; scorecard updated. **Rollback:** N/A — verification phase.

## Acceptance Criteria

- [x] `docs/parity/ruflo.md` has zero `[!]` rows
- [x] `task cost-track` produces per-session, per-model cost JSON from session jsonl
- [x] 50/75/90/100 % budget ladder evaluates per fixture; hard-stop refuses loader at tier 100
- [x] Four smoke scripts (kernel / router / schema / skills) with declared baselines exist and run in CI
- [x] Every high-traffic area carries ≥ 1 ADR under `docs/adrs/<area>/`; lint warns on uncovered new contracts
- [x] Namespace lint enforces `<stem>-<intent>` kebab-case + reserved-names list
- [x] `subagent-orchestration` declares per-mode topology with anti-drift defaults
- [x] `docs/contracts/mcp-tool-inventory.md` generated with `<file>:<line>` citations
- [x] Every active roadmap header carries a measured-vs-claimed disclaimer
- [x] `docs/parity/bench-ruflo.json` exists (methodology + 8 numeric fields awaiting first corpus run per the shared soak window)

## Notes

- The hard-stop hook is **opt-in** per `cost.enforcement` setting. Advisory is the default; consumers who want fail-closed behaviour flip the flag. This matches the hybrid decision parked in [`step-15-product-refinement.md`](step-15-product-refinement.md) Prerequisites.
- Bootstrap ADRs are **retrospective** — they document decisions already made. New ADRs going forward are prospective per the existing `adr-create` skill. The contract is the same; the trigger differs.
- The topology hints in `subagent-orchestration` are **descriptive**, not enforced. Ruflo's anti-drift defaults are sane starting points; consumers free to override per orchestration.
- MCP-tool inventory is a static audit, regenerated when MCP server source changes. No live-introspection.
- Measured-vs-claimed disclaimer is a one-line block per roadmap header — Phase 5 Step 4 verifies; never restate the disclaimer in body prose.
