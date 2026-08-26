# Completion review — inbox drain of `agents/tmp/{evolve,evolver}`

**Skipped:** no code surface for this completion — the diff is three draft roadmap proposals under `agents/roadmaps/`, one measurement under `agents/evidence/analysis/`, and this artefact, and the gate measures zero code paths of four changed files, scope 0dbb4fa9ec138d429351f24651c05a8dd7c3f4dba5eeef10eb0c6fd0e39ddb50, declared 2026-08-26

## Why a skip rather than a review

Nothing in this change executes. There is no function, no gate, no schema and no
generated tree in it — the four files are prose, and the three roadmaps ship
`status: draft`, which excludes them from the dashboard, from
`/roadmap:process-*`, and from the archival sweep until a maintainer flips the
status. A completion review over this diff would have nothing to exercise.

## What was verified instead, and how

The load-bearing risk in an inbox drain is not a code defect but a transcribed
claim. Every repository assertion carried from the source proposals into the
three roadmaps was re-checked against this tree before it was written down, and
each one appears in the roadmap with the `file:line` it was checked at. The
verification changed the plan in nine places, each marked
`corrected-from-reproduction` in the emitted roadmap:

- `bench_ab_clone.ts` already carries a `--variant` flag with three values, so
  the planned "axis extension" is a new enum member.
- `lean_projection_mode.ts:19` already defines
  `eager-all | thin | delivery`, so a planned per-task delivery build would have
  rebuilt a shipped mechanism.
- `rule_injection.ts` plus the `router_match` parity test already enforce one
  shared matcher, which a second one would have silently broken.
- Two outcome enums exist (`audit-log-v1:77`, `outcome_envelope.ts:24-30`) and
  one proposal planned to write a value into the stream that lacks it.
- `trigger_eval_grandfather.json` reads 205 entries against its own "frozen at
  221" note, so the ratchet has already walked down.
- The proxy gap documented at `description_route_check.ts:18-30` is
  proxy-versus-host, not description-versus-body — two unmeasured gaps, not one.
- `ADR-239:188` records merge authority as open, so "only humans promote" was an
  intention in every source proposal rather than a property.
- Two roadmap names cited as existing plans appear nowhere in the repository.
- `lint_roadmap_family_cap.ts:41` scopes the family cap to
  `road-to-skill-ecosystem-`, so the estate concern the sources raised could not
  have fired.

Reproduced steps were run as written rather than read: the three corpus counts
(94, 299, 175) each reproduce exactly, and `code-intelligence/evals/triggers.json`
exists with 10 queries, which is what makes the recommended first cut executable.

## Gates run on the final tree

`lint_roadmap_blockers` (12 clean, decidability 0 violations) ·
`lint_plan_risk_register` (12 scanned) · `lint_roadmap_complexity` (12 clean) ·
`lint_roadmap_family_cap` (0/2) · `check_roadmap_trackable` ·
`lint_roadmap_ci_steps` · `lint_empty_roadmaps` · `check_references` (1692
scanned, none broken) · `check_no_roadmap_refs` · `check_md_language` on all four
files · `lint_evidence_artifacts` (1 added, typed) · `check_estate_count`
(`+3 active / -0 disposed, 3 exempt` — both halves, re-run after the rebase onto
a base whose active count had moved to the floor).

## What this skip does not cover

The three roadmaps are proposals and carry open owner decisions, including two
blockers that must be answered before their later phases can start. Nothing here
asserts the plans are correct — only that the claims inside them were checked
and that the change ships no executable surface.
