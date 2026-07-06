---
complexity: lightweight
---

# Road to Blocker Visibility

> Every open blocker/gate in an active roadmap is machine-readable, counted in a `Blocker` column on the dashboard overview, and expanded in the per-roadmap breakdown with step-by-step user instructions — so the user never has to guess what is blocking a roadmap or what they must do.

## Goal

Add a structured blocker annotation to roadmap files and teach
`src/agent-src/scripts/update_roadmap_progress.ts` to (a) count open
blockers per roadmap in a new `Blocker` overview column whose cell links
to the roadmap's breakdown section, and (b) render each blocker there
with owner, what it blocks, full "what to do" instructions, and a
decidable resolved-when signal.

## Prerequisites

- [x] Confirm no parallel change to `update_roadmap_progress.ts` is in
  flight on another branch (`git log --all --oneline -5 -- src/agent-src/scripts/update_roadmap_progress.ts`).

## Context

Gates and blockers today live as free prose (`> Blocked until …` body
notes, "council-mandated gate" phase names, `[-] gated — …` markers).
The dashboard (`agents/roadmaps-progress.md`) shows only step counts, so
the user cannot see *that* a roadmap is blocked, *why*, or *what to do*.
Example: `road-to-py2ts-teardown-completion.md` is blocked on the kernel
augment-budget gate, `road-to-subagent-value-realization-followup.md` on
accumulated telemetry — neither is visible in the overview table.

## Phase 1 — Blocker annotation contract

Define the machine-readable shape once, in the canonical template, and
route authors to it.

- [x] Extend `src/agent-src/templates/roadmaps.md` with a `## Blockers`
  section contract. Proposed shape (one entry per blocker):

  ```markdown
  ## Blockers

  ### blocker: kernel-augment-budget
  - **Status:** open            <!-- open | resolved -->
  - **Owner:** user             <!-- user | maintainer | external -->
  - **Blocks:** Phase 3 — Consumer + merge readiness
  - **What to do:**
    1. Concrete, copy-pasteable steps the owner must execute.
    2. Include commands, file paths, and expected outcomes.
  - **Resolved when:** <decidable signal, e.g. "task X exits 0">
  ```

  Rules to encode: `### blocker: <kebab-id>` heading is the parse
  anchor; ids unique per roadmap; `Status`, `Owner`, `Blocks`,
  `What to do`, `Resolved when` are required fields; resolved blockers
  flip `Status: resolved` (kept for history) instead of being deleted.
- [x] Add the optional step-level cross-reference to the template:
  `- [ ] … <!-- blocked-by: <blocker-id> -->` marks a checkbox as gated
  by a named blocker.
- [x] Specify legacy fallback in the template: a body-level
  `> Blocked until <condition>` note (follow-up-roadmap convention) is
  parsed as one implicit open roadmap-level blocker (`Owner: user`,
  instructions = the note text) so existing roadmaps surface without
  retrofit.
- [x] Update `src/skills/roadmap-writing/SKILL.md` (§ exit/rollback area)
  and `src/skills/roadmap-management/SKILL.md` with a short pointer to
  the template's `## Blockers` contract — link, don't restate.

**Exit criteria:** template documents the full shape incl. legacy
fallback; both skills link it; `task sync` regenerates projections
cleanly.
**Rollback:** revert the template/skill edits; no runtime behavior
changed yet.

## Phase 2 — Generator: parse, count, render

- [x] Extend `parse_roadmap()` / `RoadmapStats` in
  `src/agent-src/scripts/update_roadmap_progress.ts` to collect blockers:
  `{id, status, owner, blocks, todo (verbatim lines), resolvedWhen}`
  from `## Blockers` entries plus the legacy `> Blocked until` fallback.
- [x] Overview table: add a `Blocker` column (between `Cancelled` and
  `Progress`) showing the count of **open** blockers; when > 0, render
  the cell as a link to that roadmap's breakdown section via an explicit
  anchor (`<a id="blockers-<slug>"></a>` emitted in the breakdown) so
  the link works on GitHub and in IDE previews; `0` stays plain text.
- [x] Per-roadmap breakdown: after the phase table, render a
  `**Blockers**` block listing each open blocker with title, owner,
  what it blocks, the full "What to do" instructions verbatim, the
  resolved-when signal, and a link back to the blocker's heading in the
  roadmap file. Resolved blockers are omitted (or rendered collapsed as
  a single "n resolved" line — implementer's choice, documented in the
  test).
- [x] Aggregate line: extend the dashboard header ("N open roadmaps")
  with "· M open blockers" when M > 0.
- [x] Extend `tests/scripts/update_roadmap_progress.test.ts`: fixture
  roadmap with two blockers (one open, one resolved) + one legacy
  `> Blocked until` roadmap; assert column count, anchor link, breakdown
  rendering, and zero-blocker roadmaps unchanged. Verify:
  `npx vitest run tests/scripts/update_roadmap_progress.test.ts` green.
  <!-- carve-out: new-gate-verification -->
- [x] Check whether `roadmap_progress_hook.ts` or
  `archive_completed_roadmaps.py`-successor consume the table shape
  (column-index assumptions) and adjust their tests if so
  (`tests/scripts/roadmap_progress_hook.test.ts`,
  `tests/scripts/archive_completed_roadmaps.test.ts`).

**Exit criteria:** `./agent-config roadmap:progress` regenerates the
dashboard with the new column + blocker sections; all three named test
files green; roadmaps without blockers render identically except for the
new `0` column.
**Rollback:** revert the generator commit; regenerate the dashboard —
the old shape is restored deterministically.

## Phase 3 — Retrofit active roadmaps

Annotate the known gates so the feature ships with real content, not an
empty column.

- [x] `road-to-py2ts-teardown-completion.md` — add `## Blockers` with
  the kernel augment-budget gate (owner: maintainer; instructions: own
  kernel PR + ≥ 24 h soak per `scope-control § kernel-rule-edits` when
  the always-rules bucket is touched). Verified live via
  `./scripts-run src/scripts/measure_augment_budget --check` (2026-07-06:
  over cap by 1,974 chars, not the stale "-4,450" figure from memory —
  memory is a point-in-time snapshot, re-verified against the real gate).
- [x] `road-to-subagent-value-realization-followup.md` — converted the
  `> Blocked until` telemetry note into a structured blocker (owner:
  user; instructions: run with `subagents.enabled: true`, check
  `agents/runtime/state/audit/YYYY-MM.jsonl` line count ≥ 20). Removed
  the old body-level note so it isn't double-counted by the legacy
  fallback.
- [x] `road-to-product-bets.md` — structured blocker for the Phase 1
  N=2 demand-evidence gate (owner: user; what counts as a credible
  signal). Phases 2–4 keep their existing "Council: DEFER /
  DECIDE-THEN-BUILD" prose gates as-is — softer scoping decisions, not
  a crisp single blocker. Note: this roadmap is `status: draft` and
  stays hidden from the dashboard until promoted.
- [x] Swept the remaining active roadmaps: `road-to-token-saving.md`
  (52 steps across 7 phases; gates are phase-internal `[~]` deferred /
  operator-cost-gated live-validation items already tracked by Iron
  Law 3 — no single clean roadmap-level blocker to extract) and
  `road-to-typescript-only-scripts.md` (Phase 1's "blocking" gate is
  fully `[x]` cleared; the 7 remaining open items are ordinary
  engineering work, not an external gate) — both explicitly reviewed,
  no blocker added. `road-to-prompt-pattern-adoption.md` is untracked
  on the main checkout and does not exist in this isolated worktree —
  out of scope for this run; left for a follow-up pass.
- [x] Regenerate the dashboard and eyeball-verify each blocker renders
  with complete instructions and working links.

**Exit criteria:** every known gate in the active set appears in the
dashboard's `Blocker` column with actionable instructions.
**Rollback:** blocker sections are additive prose — remove them and
regenerate.

## Phase 4 — Guardrails

- [ ] Add a check (extend `check_roadmap_trackable.ts` or the generator's
  `--check` mode) that every `<!-- blocked-by: id -->` reference resolves
  to a `### blocker: id` entry in the same roadmap, and that required
  blocker fields are present — fail with file/line on violation. Verify
  once against a deliberately broken fixture.
  <!-- carve-out: new-gate-verification -->
- [ ] Wire the check into the existing roadmap-lint task cadence
  (alongside `lint-roadmap-ci-steps` / `lint-roadmap-complexity` in
  `Taskfile.yml`).
- [ ] Note the blocker contract in
  `src/rules/roadmap-progress-sync.md` (one line: resolving a blocker =
  flip `Status: resolved` + regen, same reply — same Iron-Law-1 cadence
  as checkbox flips), then re-condense via `/condense`.

**Exit criteria:** broken blocker references fail the lint with a
file/line message; rule mentions the resolve-flip cadence.
**Rollback:** remove the lint wiring; annotations remain valid prose.

## Acceptance criteria

- [ ] Overview table has the `Blocker` column; counts link to the
  per-roadmap breakdown section.
- [ ] Breakdown sections list each open blocker with owner, blocked
  scope, verbatim instructions, and resolved-when signal.
- [ ] Legacy `> Blocked until` notes surface without retrofit.
- [ ] Generator + hook + archive tests green; dangling `blocked-by`
  references are lint failures.
