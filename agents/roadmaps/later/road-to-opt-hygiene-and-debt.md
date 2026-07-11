---
status: later
complexity: lightweight
---

# Road to opt hygiene and debt — pay the package's own policy breaches first

> **Parked in `later/` by maintainer decision (2026-07-12).**
> Blocked until: the pre-existing active roadmap portfolio (the
> roadmaps that were active before the 2026-07-11 `road-to-opt-*`
> cluster landed) is worked down, OR the maintainer explicitly and
> exclusively requests execution of this roadmap. Do NOT pick this
> file up as part of another task or an autonomous sweep.

> Part of the `road-to-opt-*` cluster (2026-07-11 sweep). The package audit
> found the corpus healthy (9-rule sha-guarded kernel, low skill overlap,
> real budget gates) but with concrete debts that violate the package's
> OWN policies — an allowlist 5× over its cap, an eager rule load 5.7× the
> thin path, and a graveyard of stale point-in-time reports.
>
> **Number correction (review, 2026-07-11):** the sweep's first draft
> claimed `agents/reference/` was "19 MB tracked" — that figure came from
> a local `du` including gitignored content. Actually tracked: 37 files,
> ~0.1 MB (branch HEAD `9688082a6`). The tracking-policy decision below
> survives at low priority; the urgency claim does not.

## Goal

Bring the package back inside its own policy lines: framework-leakage
allowlist under the 20-entry cap, the five heaviest auto-rules migrated to
thin stubs, and a retention convention (including a low-priority tracking
decision for `agents/reference/`) that stops report/scratch accumulation.

## Prerequisites

- Audit numbers (re-verified at branch HEAD `9688082a6`, 2026-07-11):
  allowlist 104 entries; 78/104 dist rules ≥1500 B full-body; token
  baseline `eager_rule_load` 78,513 vs `thin_rule_load` 13,881;
  `agents/reference/` 37 tracked files / ~0.1 MB (the on-disk directory is
  larger only through gitignored content); `agents/tmp.old/` 3.4 MB /
  173 files (gitignored); 91 TODO/FIXME lines across 62 files in
  `src/scripts` + `src/rules`.

## Phase 1 — framework-leakage allowlist: 104 → under 20

`lint_framework_leakage_allowlist.json` breaches the package's explicit
rule that an allowlist past 20 entries means the linter (or the content) is
wrong. Per `autonomous-execution` § antipattern, the fix is content
neutralization or linter-shape change — never more entries.

- [ ] Classify all 104 entries into: (a) genuine cross-stack documentation
      the linter's ±2-line heuristic misses, (b) real leakage in generic
      artifacts that should be neutralized, (c) content that belongs in a
      framework carve-out file.
- [ ] For (b): neutralize the leaking sentences in
      `.agent-src.uncondensed/skills/*` per the
      `framework-neutrality-in-generic-skills` fix table (generalize or
      add ecosystem peers), batch by skill.
- [ ] For (c): move the content into the matching carve-out artifact
      (`laravel-*`, `pest-*`, `nextjs-*`, …) with a pointer left behind.
- [ ] For (a): tighten the linter's cross-stack auto-detect so those hits
      stop needing entries (heuristic change, documented in the linter).
- [ ] Land the shrunken allowlist (< 20 entries, each with a `reason`) and
      run `scripts/lint_framework_leakage.ts` to verify exit 0.

**Exit criteria:** allowlist < 20 entries; linter green without new
suppressions; condensation re-run for every touched source file.

## Phase 2 — thin-stub the five heaviest auto-rules

78/104 rules still load full bodies; the eager path costs 78,513 tokens vs
13,881 thin. The five largest `type: auto` bodies are the highest-leverage
migrations (pattern already proven by 26 existing thin stubs).

- [ ] `legal-safety-floor.md` (12.1 K) — body → the legal-pack skill
      surface; rule keeps Iron-Law fences + routing trigger. Honor
      `preservation-guard` (every Iron-Law passage survives at the target).
- [ ] `roadmap-progress-sync.md` (10.6 K) — mechanics already partially in
      a guideline; finish the migration, keep the three Iron Laws + the
      pre-send self-check as the rule surface.
- [ ] `git-history-discipline.md` (9.2 K) — protocol/recovery bodies →
      `skill:git-workflow` (which already owns the procedures); rule keeps
      the three Iron Laws + the allowed/forbidden lists.
- [ ] `broken-access-control.md` (8.8 K) — depth → `skill:authz-review` /
      `skill:ai-code-blindspots` (both already own overlapping content);
      rule keeps Iron Law + the three negative tests + when-it-fires.
- [ ] `autonomous-execution.md` (8.6 K) — mechanics already split into
      `contexts/execution/autonomy-*`; migrate the remaining long sections
      (validation-loop budget details, probe efficiency) and keep the
      floors + N=3 cap literal in the rule.
- [ ] Re-run the token baseline after migration and record the new
      `eager_rule_load` number against `internal/bench/reports/token-baseline.json`
      (token-regression gate must not fire in the wrong direction).

**Exit criteria:** all five rules < 4 K each; `check_condensation` +
preservation checks green; measured `eager_rule_load` reduction recorded.

## Phase 3 — tracked-weight decisions

- [ ] `agents/reference/` (37 tracked files, ~0.1 MB — low priority):
      decide per subdirectory — gitignore (like `agents/runtime/`), move
      durable material to `docs/`, or keep-tracked with a written
      justification. The point is deliberateness, not weight; the
      gitignored bulk in the same directory stays local either way.
- [ ] Stale `agents/reports/` snapshots: untrack the 6.0.0-era one-shots
      (`command-surface.json` 127 K, `command-classification-6.0.0-d.md`
      40 K, `step-16-19b-execution-plan.md`, other `6.0.0-*`) after a
      link-sweep through docs/roadmaps; keep fresh recurring reports.
- [ ] Refresh or retire `agents/reports/human-owner-todo.md` (June 13
      snapshot referencing merged PR #389 and a stale dashboard count).
- [ ] Write the retention convention into `agents/reports/README.md`:
      point-in-time snapshots are either regenerated-in-place artifacts or
      they carry an expiry; nothing accumulates untouched past its use.

**Exit criteria:** tracking decision recorded + executed for
`agents/reference/`; stale snapshots gone from tracking; convention file
landed.

## Phase 4 — script + scratch cleanup

- [ ] Orphan-script sweep: for each of the ~30 unreferenced top-level
      `src/scripts/*` candidates (no Taskfile target, no import, no docs
      mention — e.g. `bench_ab_diff`, `measure_density`,
      `skill_collision_clusters`, `export_replay_corpus`,
      `second_brain_run`), verify with a repo-wide grep, then delete or
      wire-and-document. **Exclusion:** every `*_hook.ts` is hook-wired
      via `hook_manifest.yaml`, NOT orphaned — do not touch.
- [ ] `second_brain_retrieval.ts` is handled by the retrieval roadmap
      (`road-to-opt-retrieval-and-memory.md`) — do not delete it here.
- [ ] Local scratch: remove `agents/tmp.old/` (3.4 MB, gitignored,
      superseded working notes — the opt-cluster roadmaps have absorbed
      its live items) plus root `tmp/` and `.tmp/` after confirming no
      running task references them. Local-only deletion; nothing leaves
      git history because none of it is tracked.
- [ ] TODO/FIXME burn-down: triage the 91 lines in `src/scripts` +
      `src/rules` into fix-now (< 10 lines each), ticket-worthy, and
      delete-the-comment; land the fix-now batch.

**Exit criteria:** orphan list resolved (deleted or wired, each with a
one-line rationale in the change description); scratch dirs removed;
TODO count reduced with the remainder triaged.

## Acceptance criteria

- No policy breach remains that the package's own rules name: allowlist
  under cap, hook scripts untouched, preservation-guard honored on every
  rule migration.
- Token baseline re-measured after Phase 2 — the eager-load reduction is a
  recorded number, not an estimate.
- Every deletion (scripts, reports) cites the verification (grep sweep /
  link sweep) that proved it safe.