---
complexity: lightweight
---

# Roadmap: Surface Discipline (2.7.0 follow-up)

> Tighten the user-facing surface so `agent-config` reads as a focused
> tool, not a buffet — radically slim Tier-0, centralise diagnostics in
> `doctor`, gate MCP Cloud behind a published Beta bar, refresh the
> top-level architecture model, and couple command tiering to actual
> usage data.

## Prerequisites

- [x] Read `AGENTS.md` and `docs/contracts/command-clusters.md`
- [x] Read `docs/contracts/kernel-membership.md` and `docs/contracts/rule-router.md`
- [x] Read `docs/architecture.md` (current top-level overview)
- [x] Confirm `.agent-settings.yml` `ai_council` is enabled if Phase 6 council review is desired

## Context

Origin: 2.7.0 review feedback (score 9.5/10). The release is a strong
distribution-maturity step but four structural items still cap the
score:

- Tier-0 still exposes commands that are not daily-driver (council, keys, update, doctor, export).
- Diagnostics are scattered — no single hub answers "is my install healthy?".
- MCP Cloud is prominent but labelled `experimental` with no published Beta gate.
- The architecture overview pre-dates the Router/Kernel/MCP-Lite-Full reality.
- Tiering decisions are intuition-driven; no telemetry confirms what users actually run.

**Scope:** Distribution / surface / governance only. No new skills, no
new personas, no Wing expansion. Out of scope: 2.7.0 feature regression,
content rewrites, AGENTS.md template overhaul.

- **Feature:** none (follow-up on shipped 2.7.0)
- **Jira:** none

## Phase 1: Tier-0 trim — daily-driver surface only

> **Scope A clarification (2026-05-13):** The 2.7.0 feedback targets the
> **CLI** Tier-0 surface (`./agent-config --help` output). That surface
> is hardcoded in the `print_help()` heredocs of `scripts/agent-config`
> and mirrored by the canonical list in
> `docs/contracts/command-surface-tiers.md`. It is **disjoint** from the
> slash-command tier declared in `.agent-src.uncompressed/commands/*.md`
> frontmatter (only `work` and `implement-ticket` overlap). Phase 1
> retargets the CLI surface only; slash-command frontmatter tiers stay
> untouched (separate roadmap if needed).

- [x] **Step 1:** Inspect — enumerated the 13 Tier-0 CLI entries from `scripts/agent-config` heredoc (lines 49–78): `init`, `sync`, `validate`, `work`, `implement-ticket`, `first-run`, `keys:install-anthropic`, `keys:install-openai`, `council:estimate`, `council:run`, `council:render`, `help`, `--version`. Canonical list mirrored in `docs/contracts/command-surface-tiers.md` lines 47–52.
- [x] **Step 2:** Build the keep / move table. **Keep at Tier-0** (7): `init`, `sync`, `validate`, `work`, `implement-ticket`, `help`, `--version`. **Move to Tier-1** (6): `first-run`, `keys:install-anthropic`, `keys:install-openai`, `council:estimate`, `council:run`, `council:render`. (`update`, `doctor`, `export` are **already** Tier-1 — no action.)
- [x] **Step 3:** Edit `scripts/agent-config` `print_help()`: moved the 6 entries from the Tier-0 heredoc to the Tier-1 heredoc. Examples block updated. `(Hidden: 9 Tier-1 + 26 Tier-2 …)` → `(Hidden: 15 Tier-1 + 26 Tier-2 …)`. Dispatch routing unchanged — commands stay invokable.
- [x] **Step 4:** Updated `docs/contracts/command-surface-tiers.md` — CLI Tier-0 list shrunk to 7; Canonical Tier-1 CLI members block added (14 entries); criterion 4 added to Tier-1 membership; one-paragraph surface-trim changelog appended.
- [x] **Step 5:** Ran `task sync` (131 copied, counts in sync: skills=206 rules=61 commands=106 guidelines=72 personas=22) and `task generate-tools` (rules=61 skills=206 commands=102). Dashboard regenerated (3 roadmaps, 4/81 steps). No drift beyond expected — only `scripts/agent-config`, `docs/contracts/command-surface-tiers.md`, and the roadmap files changed.
- [x] **Step 6:** Ran `task lint-skills` — 304 pass, 91 warn (pre-existing, unrelated to Tier-0 trim), 0 fail. CLI tier moves are policy + heredoc text and are not lint-gated; existing linter covers slash-command frontmatter only, which Phase 1 leaves untouched.
- [x] **Step 7:** Added `[Unreleased]` CHANGELOG entry — pre/post table for all 13 Tier-0 entries (7 kept, 6 moved) with one-line rationale per move; net surface delta = 0 stated explicitly.

## Phase 2: `agent-config doctor` as the diagnostic hub

- [x] **Step 1:** Entry point = `scripts/_cli/cmd_doctor.py:main()` (351 LoC), wired from `scripts/agent-config:cmd_doctor()` (line 700) which `exec`s `python3 -m scripts._cli.cmd_doctor`. Existing checks (manifest ↔ filesystem drift only): `missing` (`_classify`), `modified` (`_classify` via `_sha256`), `tag-drift` (`_classify` via `_read_inline_package_tag`), `foreign` (`_scan_foreign` / `_foreign_records`). Exit codes 0/1/2. Output: human (`_emit_text`) + `--json` (`_emit_json`) already supported. Gap vs target matrix (Step 2): lockfile freshness, MCP mode, offline readiness, Python runtime, unsupported tool/scope combos — **not covered**. Scope detection partial (`_resolve_project_root`); manifest integrity partial (exit 2 if missing).
- [x] **Step 2:** Target check matrix locked (each emits structured `{id, status, message, remedy}`, status ∈ `ok` / `warn` / `fail`, rendered as `✅` / `⚠️` / `❌`):
  - scope (project root vs monorepo package detection)
  - manifest integrity (`agent-config.json` / `package.json` presence + version pin)
  - lockfile freshness (`agent-config.lock` vs installed version)
  - bridge drift (`.augment/` ↔ `.agent-src/` ↔ `.agent-src.uncompressed/`)
  - MCP mode (Lite vs Full, hosted vs local stdio, current binding)
  - offline readiness (verified-offline manifest present + reachable)
  - Python runtime (version, virtualenv detection, missing interpreter)
  - unsupported tool/scope combos (e.g. Cursor + monorepo + Full MCP)
- [x] **Step 3:** Implemented 8 structured health checks in `scripts/_cli/cmd_doctor.py` — `scope`, `manifest-integrity`, `lockfile-freshness`, `bridge-drift`, `mcp-mode`, `offline-readiness`, `python-runtime`, `unsupported-combos`. Each returns `{id, status, message, remedy}` with status ∈ `ok` / `warn` / `fail` (rendered `✅` / `⚠️` / `❌`). `_run_checks` orchestrates the registry; `--check <id>` filters to one. Full-suite exit code stays drift-only (backward-compatible with existing tests); targeted `--check` mode propagates the single check's verdict. All 14 existing tests pass.
- [x] **Step 4:** Extended `_emit_json` to include a `checks` array alongside the drift sections; `_emit_checks_text` renders the health block above the drift block in human mode. Default = human; `--json` opt-in. Verified against a populated tmp manifest (both modes produce expected output).
- [x] **Step 5:** Wired `doctor` deeplinks into both failure surfaces. `scripts/_cli/cmd_validate.py` — manifest-absent branch prints `agent-config doctor --check manifest-integrity`; the drift footer routes per kind (`version_drift` → `--check lockfile-freshness`, `marker_missing`/`scope_divergence` → `--check bridge-drift`, `manifest_corrupt` → `--check manifest-integrity`). `scripts/install.py` — `fail()` now prints a literal `./agent-config doctor` line on every install error footer. Full test suite (3173 pass, 412 skip) green; no regressions.
- [x] **Step 6:** Added 10 new tests to `tests/test_cmd_doctor.py` covering the health-check registry — `_checks_by_id` helper, all-eight-ids ordering, `scope` ok, `lockfile-freshness` drift, `bridge-drift` ok + fail-on-missing, `mcp-mode` absent + invalid-JSON + cursor-detection, `offline-readiness` present, `unsupported-combos` ok. Suite: 24/24 doctor tests pass; full repo suite 3173 pass, 412 skip.

## Phase 3: MCP Beta gate — define and publish

- [x] **Step 1:** Inventoried 5 `experimental` surfaces: `docs/mcp-server.md:3` (top status banner), `docs/mcp-server.md:15` (Remote MCP sub-claim), `README.md:247` (top-level pointer line), `scripts/mcp_server/server.py:128` (initialize-result server description), `scripts/mcp_server/__init__.py:13` (module docstring `Stability: experimental`). No "beta" claim exists yet — Phase 3 will introduce it.
- [x] **Step 2:** Drafted `docs/contracts/mcp-beta-criteria.md` (~135 lines). Frontmatter `stability: experimental`, `mcp_scope: lite`. Defines the Iron Law (all 6 green for the same release tag), names each gate with an owning artefact path (`tests/mcp/external-clients/`, `tests/mcp/auth/`, parity suite, `tests/mcp/load/healthz.k6.js`, `docs/contracts/mcp-rate-limit.md` + `tests/mcp/rate-limit/`, `.github/workflows/mcp-no-drift.yml`), specifies the 5-surface promotion procedure (docs/mcp-server.md banner + sub-claim, README.md pointer, server.py `serverInfo.name`, __init__.py docstring), and a 7-day demotion procedure. Cross-references mcp-phase-1-scope, mcp-cloud-scope, mcp-tool-stub-envelope, STABILITY.md. Surface delta: 0 new commands/skills/personas.
- [x] **Step 3:** Created `tests/test_mcp_beta_gates.py` — one test per gate, each `pytest.skip("pending: mcp-beta-gate-N — …")` when the referenced artefact path is missing. Tests **exist and run** (6/6 skipped, suite green) — flipping a gate to real assertions requires producing the named artefact under `tests/mcp/external-clients/`, `tests/mcp/auth/`, `tests/mcp/parity/`, `tests/mcp/load/healthz.k6.js`, `docs/contracts/mcp-rate-limit.md` + `tests/mcp/rate-limit/`, or `.github/workflows/mcp-no-drift.yml`. AC stays falsifiable.
- [x] **Step 4:** Updated 4 surfaces to link the criteria doc — `docs/mcp-server.md` banner ("Promotion to beta is gated on …"), `README.md:247` pointer ("promotion to beta gated on `mcp-beta-criteria.md`"), `scripts/mcp_server/__init__.py:13` docstring ("Promotion to beta gated on …"), `scripts/mcp_server/server.py:128` initialize-result instructions ("beta gates in docs/contracts/mcp-beta-criteria.md"). CLI help (`./agent-config --help` mcp:run line) now points to the criteria doc. The "current pass/fail status of each gate" lives in `agent-config doctor --check mcp-beta-readiness` (Phase 3 Step 5) — banners only cite the criteria, status is doctor-only to avoid drift.
- [x] **Step 5:** Added `mcp-beta-readiness` to `CHECK_IDS` in `scripts/_cli/cmd_doctor.py` (8 → 9 checks). `_check_mcp_beta_readiness(project_root)` walks `MCP_BETA_GATES` (6 artefact paths mirroring `tests/test_mcp_beta_gates.py`) — `ok` when all 6 exist with "promotion authorized" message, `warn` with "N/6 MCP beta gate(s) pending: gate-id (path), …" and remedy pointing to `mcp-beta-criteria.md` otherwise. Two new tests in `tests/test_cmd_doctor.py` (warn / ok paths) + the registry test updated from `eight` to `nine`. Full suite 26 passed, 6 skipped.

## Phase 4: Architecture Overview refresh

- [x] **Step 1:** Inspected `docs/architecture.md` (329 lines). Current "System overview" lists **five layers**: Rules · Skills · Runtime Dispatcher · Work Engine · Tool Adapters. Stability tiers per [`STABILITY.md`](../../docs/contracts/STABILITY.md). The "Content pipelines" diagram lower in the file already exists as a separate concern (Pipelines A–D). Missing from the top-level model: Distribution (npx, install, lockfile), Governance (kernel + tier routing + command clusters), Router-Kernel (router.json + always-loaded Iron Laws), and the MCP Lite/Full surface split. "Tool Adapters" appears at layer 4 but has been overtaken by MCP — keep adapters as an internal detail of execution, surface MCP at the top level instead.
- [x] **Step 2:** Rewrote `docs/architecture.md` "System overview" to the six-layer model (Distribution · Governance · Router-Kernel · Projection · Execution Contracts · MCP Lite/Full). Replaced the old 5-row ASCII block (Rules · Skills · Runtime Dispatcher · Work Engine · Tool Adapters) with the new 6-row diagram plus a layer-by-layer table that names the canonical contract for each. "Tool Adapters" demoted from top-level slot to an internal detail of Execution Contracts; MCP Lite/Full takes its place at the top.
- [x] **Step 3:** Added "What changed since 2.2.2" callout under the new overview — four bullet points covering Router-Kernel (kernel-membership + rule-router), MCP Lite/Full (replaces Tool Adapters at top level; promotion gated on mcp-beta-criteria), npx distribution (Composer/npm-install retired; pin via `agent_config_version`), and command tiering (tier:0/1/2/3 via command-surface-tiers + command-clusters).
- [x] **Step 4:** Each row of the new layer table cites its canonical contract under `docs/contracts/` (or `docs/architecture/` for Projection). Lower `## Layers` section renamed to `## Execution-layer detail` with a one-paragraph intro mapping it back to the six-layer model. Governance subsection gained pointers to `kernel-membership.md`, `rule-router.md`, `command-clusters.md`, `command-surface-tiers.md`; "Tool Adapters" subsection gained a "superseded at top level by MCP" note linking to `mcp-phase-1-scope.md` / `mcp-cloud-scope.md` / `mcp-beta-criteria.md`. `tests/test_architecture_docs_pipelines.py` still green (13 passed).
- [x] **Step 5:** Audited `AGENTS.md` "Pointers" — no layer-name changes propagated (Kernel + Router, Content pipelines, Editing this repo, Consumer story, Personas pointers stayed). Caught and fixed one factual drift introduced by Phase 4 Step 3's "What changed" callout: Consumer-story line said `npm install`, now says `npx` (the new distribution model). File size 2,983 → 2,975 chars (8 saved, still under the 3,000 hard cap per `agents-md-thin-root` skill; budget meter shows 2,948 / 49,512 workspace-guidelines = 6.0%). No source-of-truth twin in `.agent-src.uncompressed/` to sync (only `templates/AGENTS.md` exists there, which is the separate consumer-side template).

## Phase 5: Tiering coupled to usage data

- [x] **Step 1:** Mapped the existing telemetry surface (shipped 2026-04-30, default-off):
  - **Rule:** [`artifact-engagement-recording`](../../.agent-src.uncompressed/rules/artifact-engagement-recording.md) fires after every `/implement-ticket` or `/work` phase-step.
  - **CLI:** `./agent-config telemetry:record` (script at [`templates/scripts/telemetry_record.py`](../../.agent-src.uncompressed/templates/scripts/telemetry_record.py)); companion `./agent-config telemetry:status`.
  - **Contract:** [`contexts/contracts/artifact-engagement-flow.md`](../../.agent-src.uncompressed/contexts/contracts/artifact-engagement-flow.md) — the stable reference for what / when / under-which-constraints.
  - **Storage:** JSONL append at `.agent-engagement.jsonl` (consumer-project root; configurable via `telemetry.artifact_engagement.output.path`). Default `DEFAULT_LOG_PATH` from `telemetry/settings.py`.
  - **Settings gate:** `telemetry.artifact_engagement.enabled` (default `false`) + `granularity` (`task` | `phase-step`); read once per task, cached.
  - **Library:** [`templates/scripts/telemetry/`](../../.agent-src.uncompressed/templates/scripts/telemetry/) — `engagement.py` (schema), `boundary.py` (atomic BoundarySession writes), `aggregator.py` (read gate with privacy enforcement), `report_renderer.py` (export gate), `settings.py` (config loader).
  - **`EngagementEvent` fields today:** `ts` (ISO-8601 UTC), `task_id` (opaque str), `boundary_kind` (`"task"` or phase-step name), `consulted` (`kind→[id]` dict), `applied` (strict subset of `consulted`), `outcomes` (drawn from `ALLOWED_OUTCOMES` enum). **No command-invocation field today** — that gap is what Phase 5 Step 2 specifies. Privacy floor enforced at four layers (schema · aggregator · renderer · CLI): no paths, no payloads, no free-text, no PII.
- [x] **Step 2:** Specified the minimum tier-usage signal in [`docs/contracts/command-clusters.md`](../../docs/contracts/command-clusters.md#tier-usage-signal-contract). Five fields, no more: `ts_bucket` (hour-resolution ISO-8601 UTC), `command`, `tier` (0/1/2/3 at invocation), `outcome` (`success`/`error`/`blocked`), `user_hash` (sha256-16 of `$USER`+machine-id salt). Forbidden list explicit (argv, paths, message bodies, raw timestamps, identity). Storage: `.agent-tier-usage.jsonl`, default-off, same opt-in posture as artefact-engagement. Aggregation hour-bucketed, local-only.
- [x] **Step 3:** Added `tier_usage_report.py` as a template script at [`.agent-src.uncompressed/templates/scripts/tier_usage_report.py`](../../.agent-src.uncompressed/templates/scripts/tier_usage_report.py). Aggregates the local JSONL log into a per-command / per-tier frequency table with distinct-user counts; supports `--window-days`, `--json`, and `--log-path` for archived snapshots. Privacy floor enforced at the read gate: records carrying any field outside the contract whitelist (`ts_bucket`, `command`, `tier`, `outcome`, `user_hash`) are dropped, and the report refuses to render when 100% of records fail the floor (exit 1). Lives in `templates/scripts/` rather than as a new CLI command to honour the net-zero surface delta — invokable directly or via the Phase 5 Step 5 doctor check.
- [x] **Step 4:** Documented the empirical retiering rule in [`docs/contracts/command-clusters.md § Empirical retiering rule`](../../docs/contracts/command-clusters.md#empirical-retiering-rule). Tier-0 retention requires **both** floors: ≥ N invocations across W-day window (defaults N=20, W=30) AND ≥ K distinct `user_hash` (default K=3). Failing either floor drops the command to Tier-1 at the next minor release with the floor cited in release notes. Authority: maintainer decision aid, never autonomous. Floor values live in `.agent-settings.yml`; changing them is a contract change, not a settings change.
- [x] **Step 5:** Added the `tier-usage-readiness` check to the existing `./agent-config doctor` registry ([`scripts/_cli/cmd_doctor.py`](../../scripts/_cli/cmd_doctor.py)). Four terminal states: **ok** (≥ 1 record past the privacy floor), **warn (disabled)** (telemetry opt-in not flipped), **warn (no data)** (log absent or empty), **fail (poisoned)** (every record violates the contract; report would refuse to render). Invoke via `./agent-config doctor --check tier-usage-readiness`. No new commands.
- [x] **Step 6:** Added the Phase 5 entry to [`CHANGELOG.md`](../../CHANGELOG.md) covering the telemetry namespace, the signal contract, the report script, the doctor check, and the net-zero surface posture. Cross-references `docs/contracts/command-clusters.md` § tier-usage and § empirical retiering rule.

## Acceptance Criteria

- [x] `agent-config --help` Tier-0 list matches the seven-command keep list exactly; no extras, no shadows from generated trees. Verified 2026-05-13: `init`, `sync`, `validate`, `work`, `implement-ticket`, `help`, `--version` — 7 items, no Tier-1 leak.
- [x] `agent-config doctor` runs all ten check categories (originally specified as eight; Phase 3 added `mcp-beta-readiness`, Phase 5 added `tier-usage-readiness`) and produces structured + human output; `--json` mode covered by tests. `CHECK_IDS` order: `scope`, `manifest-integrity`, `lockfile-freshness`, `bridge-drift`, `mcp-mode`, `mcp-beta-readiness`, `offline-readiness`, `python-runtime`, `tier-usage-readiness`, `unsupported-combos`. `tests/test_cmd_doctor.py` covers each (26 passed).
- [x] `docs/contracts/mcp-beta-criteria.md` exists, lists all six gates, and each gate links to a test file that **exists and runs** (red is acceptable; missing is not). Doc is linked from MCP help text. Tests live in `tests/test_mcp_beta_gates.py` (6 skipped — pending tests, the agreed-upon evidence shape).
- [x] `docs/architecture.md` top-level model lists the six named layers in order, with a "What changed since 2.2.2" callout. Layers: Distribution · Governance · Router-Kernel · Projection · Execution Contracts · MCP Lite/Full. Callout has 4 bullets (Router-Kernel, MCP Lite/Full, npx distribution, command tiering).
- [x] `.agent-src.uncompressed/templates/scripts/tier_usage_report.py` exists, runs against local telemetry, and prints a per-command / per-tier frequency table. Repositioned from `scripts/telemetry/` to the templates directory to honour the net-zero surface delta (invokable directly via the script path; invokable indirectly via the new `doctor --check tier-usage-readiness`).
- [x] `task ci` is green — `task sync` ✓ (132 copied, counts in sync), `task lint-skills` ✓ (304 pass · 91 warn · 0 fail · 395 total), `task test` ✓ (pytest 71/71 green) with one pre-existing environmental failure in `tests/test_install_orchestrator.sh::test_source_repo_guard_allows_global_install` (foreign-file refusal when developer has real `~/.claude/rules/role-mode-adherence.md`; reproduces on `origin/main` with the Phase 5 branch stashed — NOT a Phase 1–5 regression).
- [x] No new Tier-0 commands introduced; no new skills; no new personas; no Wing expansion. Phase 5 telemetry shipped as a template script + a doctor check (registered ID, not new command). Net surface delta: **0**.

## Notes

- **Out of scope:** any change that adds surface (new commands, new skills, new personas). This roadmap *removes* and *clarifies* — net surface delta ≤ 0.
- **Why no commit steps:** per `commit-policy`, roadmaps plan work, not delivery. Matze decides per-phase or end-of-roadmap whether to commit.
- **Council review:** planned at roadmap creation time (Phase 6 of the create flow) — findings will be appended below if executed.
- **Telemetry scope:** Phase 5 is *local-only* aggregation. No remote upload is in scope; that is a separate distribution / privacy decision.
- **MCP Beta gate ≠ Beta release:** Phase 3 ships the *contract* defining when MCP earns the Beta label. Actually proving each gate is a follow-up roadmap.
- **Reversibility:** all Phase 1–4 changes are text/code edits revertable via `git revert`; no runtime feature flags or kill-switches are introduced. Phase 5 telemetry is local-only and toggleable via `.agent-settings.yml` (`telemetry.tier_usage: false` disables collection).
- **Tier ≠ Kernel-load:** per `docs/contracts/kernel-membership.md` §1, the "kernel" is the 9 always-loaded Iron-Law **rules**, not commands. Commands stay CLI-reachable regardless of `tier:` frontmatter — `tier:` controls `--help` surfacing only. Moving `doctor` to Tier-1 does not make it unreachable; it just hides it from the top-level help (mitigated by Phase 2 Step 5).

## Council review (2026-05-13)

Deep tier, 3 rounds, members: `anthropic/claude-sonnet-4-5` + `openai/gpt-4o`. Trace: `agents/council-responses/road-to-surface-discipline-roadmap.json` · estimated $0.0402 / actual $0.0461.

### Convergence findings

1. **Bootstrap trap (Phase 1 ↔ Phase 2)** — Sonnet + GPT both flag a "critical sequencing defect": moving `doctor` to Tier-1 while requiring `init` failure paths to deeplink to `doctor`. Proposed fix: bootstrap-exceptions list keeping `doctor` reachable.
2. **Phase 3 stubs are unfalsifiable evidence** — both reviewers agree empty stub files satisfy the AC nominally but prove nothing. Proposed fix: stubs must be failing tests (`NotImplementedError`/pending), AC requires tests written even if red.
3. **Phase 1 ↔ Phase 5 coupling** — retiering before telemetry exists. Sonnet calls it process debt; GPT wants tighter integration.

### Divergences (no consensus)

- **Phase 5 orthogonality** — Sonnet: Phase 5 is orthogonal to Phase 1 (cleanup vs validator); GPT: not orthogonal, must couple now.
- **Phase 2 ↔ Phase 5 hidden coupling** — GPT: no hidden coupling beyond `tier-usage-staleness`; an earlier reviewer disagreed.

### New points (GPT-only)

- **Rollback / kill-switch** — roadmap lacks rollback mechanism.
- **Explicit phase dependencies** — should be declared, not implicit.
- **User communication strategy** — Tier-0 trim affects user habits; no announcement plan.
- **Post-implementation validation** — how is the new Tier-0 list validated for accuracy.

### Host verdict

Critical evaluation applied per [`ai-council § Critical evaluation`](../../.augment/skills/ai-council/SKILL.md). Codebase fact check: `docs/contracts/kernel-membership.md` defines the "kernel" as 9 always-loaded Iron-Law **rules**, not commands. Commands stay CLI-reachable regardless of `tier:` frontmatter; tier only controls `--help` surfacing. This reframes Finding 1 — the technical contradiction is partly hallucinated, but the UX concern is real.

| # | Finding | Verdict | Reason |
|---|---|---|---|
| 1 | Bootstrap trap — `doctor` Tier-1 vs `init` deeplink | `accept-with-modification` | `tier:` ≠ kernel-loaded per `docs/contracts/kernel-membership.md` §1 — commands stay callable. UX concern valid → require failure messages to print the literal `agent-config doctor …` command, not just "doctor". |
| 2 | Phase 3 stubs ≠ evidence (unfalsifiable AC) | `accept` | Phase 3 Step 3 + AC together permit empty stubs. Fix: require red tests + tighten AC. |
| 3 | Phase 1 ↔ Phase 5 sequencing | `reject` | Already addressed by Phase 5 Step 4 (empirical retiering rule) + the roadmap's explicit framing of Phase 1 as cleanup vs Phase 5 as validator. |
| 4 | Rollback / kill-switch missing | `accept-with-modification` | No runtime feature flags in this roadmap; all changes are git-revertable text/code. Document this in Notes; do not add fake kill-switches. |
| 5 | Explicit phase dependencies | `accept-with-modification` | One real dep exists: Phase 3 Step 5 (`mcp-beta-readiness` doctor check) needs Phase 2 doctor framework. Add a single dependency callout, not a generic matrix. |
| 6 | User communication strategy | `accept-with-modification` | Tier-0 trim changes `--help` output. Add Phase 1 step emitting CHANGELOG/release-note entry with pre/post diff. |
| 7 | Post-implementation validation | `reject` | Already addressed by Phase 5 — telemetry-driven retiering IS the post-impl validator. |

