# Completion review — inbox harvest 2026-08-c

**Skipped:** no code surface for this completion — the branch adds one evidence page, four roadmaps and the regenerated dashboard, and the gate itself measures zero code paths of six changed files, scope fc9a7ca955502c00433152050717895f62dbcdd3d02e3a5795e6e578bda406fa, declared 2026-08-15

## Why a skip rather than a review

The diff is `agents/evidence/analysis/inbox-harvest-2026-08-c-triage.md`, four
new files under `agents/roadmaps/`, and the regenerated
`agents/roadmaps-progress.md`. No script, no hook, no schema, no test, no
projection. `check_completion_review` classifies it as zero code paths of six
changed files, which is exactly the condition this declaration covers.

## What replaces a code review here

The risk in a harvest is not a broken build, it is a plan built on a claim
nobody checked. Every load-bearing number in the five files was re-derived on
this branch rather than copied from the reviews that asserted it:

- **The release-head finding.** `derive_category_hits` matches `/secur/i` in the
  conventional scope or whole-word `security` in the subject
  (`src/scripts/_lib/release_highlights.ts:116`). Over `11.0.0..12.0.0`, 74
  commits: **0** matches, **13** `fix(...)`-scoped commits. `Honest nulls`
  matches a literal `honest[ -]null` (`:137`): **0** matches over a span whose
  subjects include a waived-soak record. Both shipped `_none_`
  (`CHANGELOG.md:367-368`).
- **The lock it does not touch.** `docs/contracts/CHANGELOG-conventions.md` was
  read directly, not recalled: the hard-block branch is rejected, the cadence is
  retro-curation, and the same section names the `_none_` contradiction as the
  sole blocking condition. That sentence is what makes the derivation gap a
  defect in the lock's own premise rather than an argument against the lock.
- **The workspace-identity numbers.** 8 `--show-toplevel` call sites across 6
  files; exactly one exported `repoRoot()`, in `src/scripts/migration_status.ts`;
  `src/scripts/_lib/git_common_dir.ts` exports three functions with 4 consumers;
  `git worktree list` reports 306.
- **The evidence-binding mechanism.** The manifest writes three segments
  (`dispatch_r2_reviewer.ts:417-419`), the currency check compares one
  (`:331`), and `REVIEW_SCOPE_EXCLUDES` holds exactly two entries
  (`:112-115`) — neither of them `agents/roadmaps`. The roadmap states this as a
  verified mechanism with an unmeasured incidence, and makes measuring it Phase 1.
- **The prompt-cluster gaps.** Both greps the outside proposal claimed were
  re-run and reproduce empty. Its fixture phase was dropped on a re-derived
  denominator: 247 of 289 skills carry no `evals.json`.

Three claims from the reviews were **rejected** on re-derivation and are
recorded in the triage page rather than planned: a bench-runner size figure that
matches no tracked file, a "704 authored skills" count that is a host's merged
catalogue view rather than this estate, and a blocker census (39 open, 6
solvable) that does not reproduce from the roadmap tree.

Gates green on this branch: `lint_plan_risk_register`, `lint_roadmap_blockers`,
`check_roadmap_trackable`, `lint_roadmap_ci_steps`, `lint_empty_roadmaps`,
`lint_roadmap_family_cap`, `lint_roadmap_complexity` (the four new files pass;
the one failure is pre-existing on `main`), `check_references`,
`check_no_roadmap_refs`, `check_no_external_sources`, `lint_output_slop`,
`lint_hidden_unicode`, and `check_md_language` on all five new markdown files.

## Standing caveat

A skip declaration is a statement about the diff's surface, not a claim that the
plans are right. The strongest objection to this branch is that a package whose
own reviews name roadmap-about-roadmap work as its dominant failure mode has
just gained four more roadmaps. The counter is the ratio: twenty recommendations
were rejected with a written reason and four were kept, each anchored on a
defect re-derived here rather than on a reviewer's assertion — and the register
exists precisely so the twenty do not come back for re-analysis next cycle.
Whether four was still one too many is a judgement the maintainer owns.
