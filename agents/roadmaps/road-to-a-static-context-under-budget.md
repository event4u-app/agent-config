---
complexity: lightweight
status: ready
tree_pin: 811cea61d6
estate_offset_exempt: "road-to-a-static-context-under-budget is added on the owner's order of 2026-11-21 to plan every measure of that day's session retro as its own roadmap. No active roadmap is finished, so none was archived to offset it, and folding it into a parked later/ roadmap would hold asked-for work behind that roadmap's entry condition. Owner record: agents/evidence/owner-directives/2026-11-21-session-retro-roadmaps.md."
execution:
  mode: autonomous
relates:
  - slug: road-to-a-session-start-under-the-host-limit
    relation: extends
    note: "Its Phases 1-3 bound the package-delivered user layer at 80,000 chars and gate it in CI; this file sums that layer with the project layer, catalogues, injections and the subagent variant, re-tests ADR-227 and arms the per-turn ceiling. Its open 4.1/4.2 and blocker stay its own."
  - slug: road-to-repo-knowledge-generated-not-written
    relation: disjoint
    note: "Owns path-triggered delivery of generated knowledge files and their static-cost test (4.2, AC-5). This file only counts unscoped files in its composite gate (5.3) and builds nothing for knowledge delivery."
  - slug: road-to-mcp-token-accounting
    relation: disjoint
    note: "Archived and done; its MCP schema surface in audit_initial_context is read by 1.2 as one composite row, nothing more."
---
# Road to a static context under budget

> **Source:** the owner's session retrospective of 2026-11-21 (about 380 Claude
> Code sessions; measure 17, priority P2: "slim the static context — scope rules
> by `paths:`, arm the token budget, deliver the generated contexts of measure 7
> path-triggered only") and the AI council round of the same day (members
> anthropic and openai, both answered, one round). Anthropic named a conflict:
> cutting static context fights the measures that add context (repo knowledge,
> traps sheets). This file resolves it by making the static baseline one gated
> number that a path-triggered file does not raise.

## Goal

The static instruction baseline a session and a subagent receive before the first
prompt is one measured, generated number per surface; CI fails when it exceeds a
council-set ceiling; the per-turn hook-injection ceiling is armed in CI; no budget
file under `src/config/` carries an overdue `review_by`; and `paths:` scoping is
applied to every rule that the re-tested ADR-227 lock permits, and to none it
forbids.

## Context

**What the retro measured (2026-11-21, maintainer machine, agent-config):**

| Surface | Size | ≈ tokens |
|---|---|---|
| `~/.claude/rules`, 101 unconditional files | 80.5 KB | ~20k |
| project `.claude/rules` (this repo, 15 files, none scoped) | 43.4 KB | ~11k |
| CLAUDE.md + MEMORY.md + RTK.md | ~5 KB | ~1.2k |
| skill catalogue (~350 entries) | not measured by the retro | 8–12k (guess) |
| **static baseline, again in every subagent** | | **~40k** |

Start context 210–245k tokens (62-session analysis); the host's instruction notice
reached 659k chars once, through a second copy of the rule layer under another
config directory (machine state outside this repo, not re-measured here).

**What already exists — this file builds on it, it does not redo it:**

- `road-to-a-session-start-under-the-host-limit` bounded the package-delivered user
  layer: `check_session_start_budget` fails above 80,000 chars
  (`src/scripts/check_session_start_budget.ts:4`), wired as
  `check-session-start-budget` (`taskfiles/ci-fast.yml:2191`). The 80.5 KB above is
  that layer at its budget. Its open work (4.1 host-notice observation, 4.2
  disposal) waits on its blocker `released-upgrade-observation`; this file does not
  touch it.
- The skill / command / MCP catalogues have token caps in
  `src/scripts/audit_initial_context.ts:94-99` (skill 12,500, command 5,800, MCP
  5,570), gated by `audit-tokens-budget` in `task ci` (`Taskfile.yml:360`).
- `road-to-repo-knowledge-generated-not-written` owns path-triggered delivery of the
  generated knowledge files and its own static-cost test (its 4.2 and AC-5). This
  file adds only the repo-wide backstop (5.3).

**The missing delta, verified in this tree:**

1. **No composite number.** Each surface has its own gate in its own unit; nothing
   sums user layer + project layer + memory index + catalogues + session-start
   injections, and nothing measures the subagent variant.
2. **The project layer of this repo is loaded unconditionally in source form.** The
   maintainer checkout's `.claude/rules/` holds 15 symlinks into
   `dist/agent-src/rules/` (dated 2026-07-05; gitignored, `.gitignore:180`). Those
   files carry agent-config frontmatter (`triggers:`), which this host does not
   read, so all 15 (43,416 bytes, `wc -c` over the 15 `dist/agent-src/rules/`
   files) load at every session start. Whether `task generate-tools` replaces them
   with host form today is **unverified** (3.1 measures it).
3. **Mixed-trigger rules stay unconditional.** On Claude Code `paths:` is exclusive
   (`src/install/claudeRuleRewrite.ts:22-24`), so a rule with path and keyword
   triggers drops its paths and loads always (`:188-192`). Census of `src/rules/`
   (122 files): 3 path-only, 18 mixed, 78 keyword/command-only, 23 trigger-less.
4. **ADR-227 is a lock on the retro's own lever.** `ADR-227` (accepted 2026-08-13)
   rejects `paths:` scoping as a corpus lever: keyword rules have no file surface,
   and path-scoped rules are not re-injected after `/compact`
   (`docs/decisions/ADR-227-paths-scoping-is-saturated-not-a-corpus-lever.md:50-87`;
   `agents/evidence/analysis/claude-code-rules-dir-contract.md:67-68`). Its review
   trigger reopens it on (a) truthful-path rules without a compaction need past
   ~10 % of the corpus, or (b) a host change to `/compact` semantics. Four project
   rules are unconditional by an AI council of 2026-08-20 for the same reason
   (`docs/guidelines/agent-infra/source-confidentiality-mechanics.md:79-93`). Phase 2
   re-tests both triggers before any rule is scoped; mechanism-match is exact, so
   the lock binds until then.
5. **The per-turn injection ceiling is not gated, and its budgets are overdue.**
   `src/config/hook-token-budget.json:81` has `gate_on_ceiling: false`; `review_by`
   2026-11-10 at `:6`, `:61`, `:93`. The same date is overdue in
   `src/config/cost-parity-budget.json:6` and
   `src/config/dispatch-economy-metrics.json:6`. `lint_budget_ownership` only warns
   on an overdue date (`src/scripts/lint_budget_ownership.ts:10-11`). The rationale
   for leaving the ceiling unarmed is a non-deterministic reading from
   `end-review-nudge` under replay (`hook-token-budget.json:82`,
   `internal/bench/core/bench_hook_injection.ts:22`).

**Owner constraint (2026-11-21):** no hand-maintained or owner-written context file.
Every number this file introduces is written by a command from the tree, an install
into a scratch HOME, or host telemetry.

## Decisions

| ID | ownership | resolved by | decision | evidence | revisit if |
|---|---|---|---|---|---|
| D1 | reversible-technical | agent | Scope is the delta over `road-to-a-session-start-under-the-host-limit`; its 80,000-char user-layer gate is an input, never re-derived here | its Phases 1–3 are done and gated (Context § What already exists) | that roadmap reopens its budget |
| D2 | reversible-technical | agent | No rule is path-scoped before ADR-227's review trigger is re-tested and a council verdict recorded (Phase 2) | ADR-227 accepted; mechanism matches exactly | 2.3 records a verdict |
| D3 | reversible-technical | agent | The knowledge roadmap's path-triggered delivery is its own; this file only counts unscoped files in the composite | its 4.2 and AC-5 own the guarantee | that roadmap drops path triggering |

## Phase 1 — One generated number for the static baseline

- [ ] **1.1 Failing test for a composite static-baseline report.** Write
      `tests/scripts/static_baseline_report.test.ts`: on a fixture project with a
      scratch HOME it expects one JSON row per surface (user rules, project rules,
      CLAUDE.md + imports, memory index, skill / command / MCP catalogue,
      `session_start` injections) and a `subagent` total, chars and tokens, with
      `paths:`-scoped files excluded and symlinks followed.
      verify: `npx vitest run tests/scripts/static_baseline_report.test.ts` -> 1 (red, the script does not exist yet).
      uses: test-driven-development
- [ ] **1.2 Implement `src/scripts/report_static_baseline.ts`.** Reuse
      `check_session_start_budget`'s scratch-HOME install, `audit_initial_context`'s
      catalogue measures and `bench_hook_injection`'s `session_start` slot; add no
      second measurement of the same surface. `--write` writes
      `internal/bench/reports/static-baseline.json`.
      verify: `npx vitest run tests/scripts/static_baseline_report.test.ts` -> 0 and `./scripts-run src/scripts/report_static_baseline --json` prints a `total` and a `subagent` field.
- [ ] **1.3 Live cross-check against the host.** Add `--arrivals` reading the host's
      `InstructionsLoaded` records under `~/.event4u/agent-config/runtime/arrivals/`
      and report the `session_start` file count and chars beside the computed total,
      flagging any file the composite did not predict (a second rule copy, as in the
      659k reading).
      verify: a test with a planted extra arrival record reports it as unpredicted; without it the report has no unpredicted row.

## Phase 2 — Re-test the ADR-227 lock before scoping anything

- [ ] **2.1 Probe the `/compact` semantics on the current host.** Re-run the probe
      recorded in `agents/evidence/analysis/claude-code-rules-dir-contract.md`
      (a `paths:`-scoped canary rule, a matching file read, `/compact`, a question
      only the canary answers) in a headless host session; record host version and
      outcome as a dated evidence note.
      verify: the note exists under `agents/evidence/analysis/` with host version and a re-injected yes/no line.
- [ ] **2.2 Census of truthful path candidates.** Script the count over `src/rules/`
      of rules that have a file surface and whose obligation need not survive
      `/compact` (no `consequence_class`, not kernel, not `tier: safety-floor`, not
      one of the four council-pinned project rules); report the share of the
      projected corpus against ADR-227's ~10 % trigger.
      verify: `./scripts-run src/scripts/report_static_baseline --path-candidates --json` -> /(?=[\s\S]*"candidates")(?=[\s\S]*"share")[\s\S]*"trigger_met"/
- [ ] **2.3 Council on reopening ADR-227.** First action `agent-config council:status`,
      then one round with 2.1, 2.2 and 1.2's reading: reopen (which rules, which form:
      path-scoped body plus keyword pointer stub, or path-only) or keep. Record the
      verdict as a `## Decisions` row; on reopen, amend ADR-227 via `adr-create`.
      verify: `grep -cE '^\| D4 ' agents/roadmaps/road-to-a-static-context-under-budget.md` -> /^1$/
      uses: ai-council, adr-create
- [ ] **2.4 Apply the D4 verdict, test-first.** On reopen: a failing case in
      `tests/install/claude_rule_rewrite.test.ts` that the named rules install with
      `paths:`, then change `claudeRuleRewrite.ts` and `condense.ts`'s emitter together
      (the parity test binds them). On keep: no code; the Done note names D4.
      verify: `npx vitest run tests/install/claude_rule_rewrite.test.ts` -> 0 and `./scripts-run src/scripts/report_static_baseline --json` shows the user-layer row lower by the scoped files' chars (reopen) or unchanged (keep).

## Phase 3 — The project layer in host form

- [ ] **3.1 Failing test: `generate-tools` replaces source-form symlinks.** In a
      scratch copy with `.claude/rules/*.md` planted as symlinks into
      `dist/agent-src/rules/`, run `./scripts-run src/scripts/condense --generate-tools`
      and assert every file under `.claude/rules/` is a regular file in host form (no
      `triggers:` key; `paths:` only where the emitter derives it).
      verify: `npx vitest run tests/scripts/generate_tools_project_rules.test.ts` -> 1 before 3.2 if the symlinks survive, else 3.2's Done note records "already host form".
- [ ] **3.2 Fix the writer and keep the locked rules unconditional.** Make the
      `--generate-tools` path replace a symlink instead of writing through it; keep
      `source-of-truth` (ADR-226) and the four council-pinned rules unconditional.
      verify: 3.1's test exits 0; `report_static_baseline --json` on the scratch copy shows a project-layer row below 43,416 chars.
- [ ] **3.3 Report a stale project layer when tools are generated.** Add one line
      to the existing `report_layer_overlap` output (run by `task generate-tools`) when `.claude/rules/` holds source-form
      files, naming `task generate-tools` as the fix — no new hook concern.
      verify: a test with a planted source-form file prints the line; a host-form tree prints nothing.

## Phase 4 — Arm the per-turn ceiling and clear overdue budgets

- [ ] **4.1 Failing test: the per-turn aggregate is deterministic.** Two
      `bench_hook_injection` runs on fixture branches with different mutation volumes
      must report the same per-turn aggregate.
      verify: `npx vitest run tests/scripts/bench_hook_injection_aggregate.test.ts` -> 1 on the new case.
- [ ] **4.2 Pin `end-review-nudge`'s mutation volume under replay.** Read the volume
      from the replay fixture when `AGENT_CONFIG_REPLAY=1`, not from the live branch.
      verify: 4.1's test exits 0.
- [ ] **4.3 Set `gate_on_ceiling: true`.** Edit `src/config/hook-token-budget.json:81`
      and its rationale to cite 4.1–4.2; add a fixture whose aggregate exceeds
      59,392 B.
      verify: `task bench-hook-injection` -> 0 on the tree, and non-zero with the over-ceiling fixture.
- [ ] **4.4 Renew overdue `review_by` from a measurement, not by hand.** Add
      `--renew` to `lint_budget_ownership`: for each overdue file it runs that file's
      bench, writes the reading and date into the file's measurement field and moves
      `review_by` +90 days only when every row is within its cap; a row over its cap
      is printed and left overdue.
      verify: `set -o pipefail; task lint-budget-ownership 2>&1 | grep -c overdue` -> /^0$/ after `./scripts-run src/scripts/lint_budget_ownership --renew`.

## Phase 5 — One ceiling on the composite, in CI

- [ ] **5.1 Council on the ceiling.** First action `agent-config council:status`, then
      one round: per-session and per-subagent ceilings for 1.2's composite, from the
      2.4 and 3.2 readings and the retro's "well under 40k". Record as row D5.
      verify: `grep -cE '^\| D5 ' agents/roadmaps/road-to-a-static-context-under-budget.md` -> /^1$/
      uses: ai-council
- [ ] **5.2 Gate the composite.** Add `--fail-if-over-budget` reading D5's numbers from
      a `static_baseline` block in `src/config/hook-token-budget.json` (owner,
      `review_by`, source), and a `check-static-baseline` task in
      `taskfiles/ci-fast.yml` called from `task ci`.
      verify: `task check-static-baseline` -> 0 and, with a planted 20 KB unscoped project rule it exits non-zero.
- [ ] **5.3 Backstop for generated knowledge files.** A test plants an unscoped and a
      `paths:`-scoped file under `.claude/rules/` in the fixture: the unscoped one
      raises the composite, the scoped one does not.
      verify: `npx vitest run tests/scripts/static_baseline_report.test.ts` -> 0 with both cases.

resequenced: no intermediate state is broken — every phase adds a report or a gate
that is green on the tree it lands on, and 2.4 changes delivery only after D4.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-11-21 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | An obligation lost after `/compact` | implementation | A rule scoped by `paths:` is not re-injected after compaction and the agent acts where it would have stopped. | No scoping before the 2.1 probe and the D4 council verdict; candidates exclude consequence-class, safety-floor, kernel and council-pinned rules. | Phase 2 — Re-test the ADR-227 lock before scoping anything |
| 2 | A ceiling that adds ceremony | product | A new gate becomes another byte budget with a few bytes of headroom, the friction the retro names. | The composite reuses existing measures; the ceiling comes from a council over a measured reading, not from the current size plus a margin. | Phase 5 — One ceiling on the composite, in CI |
| 3 | The composite misses what the host loads | implementation | A second rule copy or an unknown file loads outside the computed surfaces. | 1.3 compares against the host's own `InstructionsLoaded` records and lists every unpredicted file. | Phase 1 — One generated number for the static baseline |
| 4 | `--renew` hides a real overrun | implementation | Dates move while a row is over its cap. | Renewal only when every row is within its cap; an over-cap row stays overdue and is printed. | Phase 4 — Arm the per-turn ceiling and clear overdue budgets |

## Acceptance Criteria

- [ ] AC-1 — `report_static_baseline --json` prints the per-session and per-subagent static baseline per surface, generated from a scratch install and the tree.
- [ ] AC-2 — ADR-227's review trigger is re-tested on the current host and the verdict is recorded as D4; every rule it permits installs with `paths:`, none it forbids does.
- [ ] AC-3 — This repo's project rule layer is written in host form by `task generate-tools`, below 43,416 chars, with the locked rules unconditional.
- [ ] AC-4 — `gate_on_ceiling` is `true` and an over-ceiling fixture reds `task bench-hook-injection`.
- [ ] AC-5 — `task lint-budget-ownership` reports no overdue `review_by`.
- [ ] AC-6 — `task ci` fails when the composite exceeds the D5 ceiling, and an unscoped generated file raises it while a scoped one does not.
