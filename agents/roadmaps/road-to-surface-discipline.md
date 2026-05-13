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

- [ ] Read `AGENTS.md` and `docs/contracts/command-clusters.md`
- [ ] Read `docs/contracts/kernel-membership.md` and `docs/contracts/rule-router.md`
- [ ] Read `docs/architecture.md` (current top-level overview)
- [ ] Confirm `.agent-settings.yml` `ai_council` is enabled if Phase 6 council review is desired

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

- [ ] **Step 1:** Inspect — enumerate every command currently surfaced in `agent-config --help` top-level (Tier-0) and cite where the tier is declared (`.agent-src.uncompressed/commands/*.md` frontmatter `tier:` field, plus `docs/contracts/command-clusters.md`).
- [ ] **Step 2:** Build the keep / move table. Keep at Tier-0: `init`, `sync`, `validate`, `work`, `implement-ticket`, `help`, `--version`. Move to Tier-1: `council:*`, `keys:*`, `update`, `doctor`, `export`, plus anything else currently Tier-0 that is not on the keep list.
- [ ] **Step 3:** Update each affected command file's frontmatter (`tier: 0` → `tier: 1`) under `.agent-src.uncompressed/commands/`. Do NOT delete or rename; only retier.
- [ ] **Step 4:** Update `docs/contracts/command-clusters.md` so the Tier-0 row matches the keep list verbatim. Add a one-line rationale per moved command in the changelog section.
- [ ] **Step 5:** Re-run `task sync` and `task generate-tools`; verify `.agent-src/`, `.augment/`, `.claude/`, `.cursor/`, `.clinerules/`, `.windsurfrules` regenerate without diff drift beyond the tier change.
- [ ] **Step 6:** Run `task lint-skills` and any tier-aware linter (`task lint-tier` if present); fix warnings introduced by the move.
- [ ] **Step 7:** Emit a CHANGELOG / release-note entry listing the pre/post `agent-config --help` Tier-0 diff (commands moved + one-line rationale per move) so users discovering commands via `--help` are not silently surprised.

## Phase 2: `agent-config doctor` as the diagnostic hub

- [ ] **Step 1:** Identify the current `doctor` entry point — likely `scripts/agent_config/doctor.py` or similar — and inventory existing checks (cite file:function for each).
- [ ] **Step 2:** Specify the target check matrix (each must produce `✅` / `⚠️` / `❌` + one-line remedy):
  - scope (project root vs monorepo package detection)
  - manifest integrity (`agent-config.json` / `package.json` presence + version pin)
  - lockfile freshness (`agent-config.lock` vs installed version)
  - bridge drift (`.augment/` ↔ `.agent-src/` ↔ `.agent-src.uncompressed/`)
  - MCP mode (Lite vs Full, hosted vs local stdio, current binding)
  - offline readiness (verified-offline manifest present + reachable)
  - Python runtime (version, virtualenv detection, missing interpreter)
  - unsupported tool/scope combos (e.g. Cursor + monorepo + Full MCP)
- [ ] **Step 3:** Implement missing checks; reuse existing helpers where possible. Each check returns a structured record (`{id, status, message, remedy_url}`); avoid string-only output.
- [ ] **Step 4:** Add `--json` output mode for CI/tooling consumption; keep human-readable output as the default.
- [ ] **Step 5:** Wire `doctor` deeplinks into `init` failure paths and `validate` warnings — when those commands fail, the error footer prints the literal invocation `agent-config doctor --check <id>` (full command string, not just the word "doctor") so users can copy-paste even if `doctor` is Tier-1 and absent from `--help`.
- [ ] **Step 6:** Add unit tests covering each check's pass / warn / fail paths under `tests/scripts/test_doctor.py` (or matching test layout).

## Phase 3: MCP Beta gate — define and publish

- [ ] **Step 1:** Inspect the current MCP `experimental` claim — locate every README / doc / command-help string that calls MCP "experimental" or "beta" and inventory the wording.
- [ ] **Step 2:** Draft `docs/contracts/mcp-beta-criteria.md` listing the gate (all six must pass to flip `experimental` → `beta`):
  1. At least one external client (not the agent itself) runs against MCP Lite end-to-end.
  2. Bearer-auth tests cover happy path + 401 + expired + rotated token.
  3. Parity smoke suite proves Lite tool calls = Full tool calls for the published surface.
  4. Health-check endpoint (`/healthz` or equivalent) returns structured status under load.
  5. Abuse / rate-limit plan documented (per-token quotas, burst, backoff).
  6. Lite ↔ Full no-drift tests: same input → same output across both binding modes.
- [ ] **Step 3:** Map each criterion to the test file / doc / script that will provide evidence. Where the artefact is missing, create a **failing test** (not an empty stub) — `pytest.skip("pending: <criterion>", allow_module_level=True)` or `raise NotImplementedError("mcp-beta-gate-N pending")`. The gate is red until someone ships the proof; this keeps the AC falsifiable.
- [ ] **Step 4:** Update MCP-facing READMEs and `agent-config mcp --help` to reference the criteria doc and the current pass/fail status of each gate.
- [ ] **Step 5:** Add a `doctor` check (`mcp-beta-readiness`) that reports the current gate status — green when all 6 pass, yellow with the list of failing gates otherwise. *Depends on Phase 2 (doctor framework + structured check records); land Phase 2 first.*

## Phase 4: Architecture Overview refresh

- [ ] **Step 1:** Inspect `docs/architecture.md` and any top-level overview diagrams; capture the current top-level layer list.
- [ ] **Step 2:** Rewrite the top-level model so the six layers are explicit and ordered: **Distribution** (npx, install scripts, lockfile) → **Governance** (kernel rules, tier-1/2 routing, command clusters) → **Router-Kernel** (router.json, always-loaded Iron Laws) → **Projection** (compression, augment-projection, multi-tool projection, claude-bundle pipelines) → **Execution Contracts** (skills, commands, work-engine, roadmap engine) → **MCP Lite/Full Surfaces** (hosted read-only vs local stdio).
- [ ] **Step 3:** Add a one-paragraph "What changed since 2.2.2" callout naming the four shipped items: Router-Kernel, MCP Lite/Full, npx distribution, command tiering.
- [ ] **Step 4:** Ensure every layer references its canonical contract under `docs/contracts/` so the overview stays a router, not a re-statement.
- [ ] **Step 5:** Update `AGENTS.md` "Pointers" if any layer name changed; do NOT bloat AGENTS.md (Thin-Root contract still applies).

## Phase 5: Tiering coupled to usage data

- [ ] **Step 1:** Identify the existing telemetry surface — `telemetry:record` calls already exist per the artifact-engagement-recording rule. Cite where records land and what fields are captured today.
- [ ] **Step 2:** Specify the minimum signal needed to validate tiering empirically: command name, tier-at-invocation, invocation count, distinct users (hashed), invocation timestamp bucket. No content, no arguments, no PII.
- [ ] **Step 3:** Add a `tier-usage` report script (`scripts/telemetry/tier_usage_report.py`) that aggregates local telemetry and emits a per-command frequency table, grouped by tier. Run-local-only; no upload.
- [ ] **Step 4:** Document the empirical retiering rule in `docs/contracts/command-clusters.md`: a command stays at Tier-0 only if it clears a usage-frequency floor measured across N days; otherwise it drops to Tier-1 at the next minor release.
- [ ] **Step 5:** Add a `doctor` check (`tier-usage-staleness`) that warns if no telemetry has been recorded in the last 30 days (so the empirical floor can be honoured).

## Acceptance Criteria

- [ ] `agent-config --help` Tier-0 list matches the seven-command keep list exactly; no extras, no shadows from generated trees.
- [ ] `agent-config doctor` runs all eight check categories and produces structured + human output; `--json` mode covered by tests.
- [ ] `docs/contracts/mcp-beta-criteria.md` exists, lists all six gates, and each gate links to a test file that **exists and runs** (red is acceptable; missing is not). Doc is linked from MCP help text.
- [ ] `docs/architecture.md` top-level model lists the six named layers in order, with a "What changed since 2.2.2" callout.
- [ ] `scripts/telemetry/tier_usage_report.py` exists, runs against local telemetry, and prints a per-command / per-tier frequency table.
- [ ] `task ci` is green — `task sync`, `task generate-tools`, `task lint-skills`, `task test` all pass.
- [ ] No new Tier-0 commands introduced; no new skills; no new personas; no Wing expansion.

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

