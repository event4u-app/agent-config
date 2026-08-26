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

- `bench_ab_clone.ts` already carries a `--variant` flag with three real variants
  (its choice list is five, the other two being the aggregates `both` and `all`),
  so the planned "axis extension" is a new enum member.
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
files · `lint_evidence_artifacts` (2 added on the branch, both typed) · `check_estate_count`
(`+3 active / -0 disposed, 3 exempt` — both halves, re-run after the rebase onto
a base whose active count had moved to the floor).

## What this skip does not cover

The three roadmaps are proposals and carry open owner decisions, including four
blockers that must be answered before their later phases can start —
`merge-authority`, `runtime-consumption-of-experience`,
`experience-retention-policy` and `lineage-check-enforcement-surface`. Nothing here
asserts the plans are correct — only that the claims inside them were checked
and that the change ships no executable surface.

## Neutral review of this change, and what it corrected

A cross-model reviewer was run over the whole branch delta with a neutral prompt
(no expected outcome stated, scope the full diff rather than a subset chosen by
the author). It returned 26 findings, four of which it judged blocking. All four
reproduced on independent check and all four are fixed on this branch:

- **The staleness window was stale.** Both roadmaps claimed `1899f92b9` was "HEAD
  minus one commit, so the staleness window is empty". True when the verification
  started, false after the branch was rebased — `git rev-list --count` reads 7,
  three of them upstream. The sentence was never re-measured.
- **The estate figure was inverted, and it carried a decision.** Both roadmaps
  read "`active_roadmaps 3` against a floor of 7 — four slots of headroom". The
  gate reports 7 against a floor of 7: zero headroom. #1676, inside the unclosed
  window above, is where the four came from. This reverses the force of the
  estate-placement decision in both files.
- **A `verify:` line was refuted by its own evidence.** The lineage roadmap's 2.3
  expected the two-artefacts-one-parent-set finding in one folder; it occurs in
  three, including both folders this drain analysed.
- **The census contradicted the roadmap derived from it** on whether the master
  adopted or omitted the mutation-arity rule. The roadmap was right.

Twelve further findings were smaller and are also fixed: a misattributed
`from-skipped-parent` marker, two `grep`-based "zero hits" claims that now
self-hit, a negative verification scoped to a directory holding no commands, four
legacy declaration shapes that are five, two off-by-one counts, an item-count pair now recorded as a
judgement rather than a measurement, a `verify:` line asking a markdown contract to import a
module, and two external statistics doing load-bearing work in kill entries while
the closing section claimed nothing external was load-bearing.

The reviewer also checked roughly 45 citations and reproduced them, including
every verbatim quotation and all four corpus counts. Recording both halves
because a review reported only by its findings understates what was checked, and
one reported only by its pass rate hides what it caught.
