<!-- evidence-type: analysis -->

# The owned-roadmap digest: where it lives, what a row holds, and its budget

AI council, 2026-10-19. anthropic/claude-sonnet-4-5 + openai/codex-default,
2/2 present, 2 rounds, `$0.00` (both seats subscription-authed), prompt mode
`design`. The prompt is committed verbatim beside this file as
`intake-owned-digest-2026-10-19.question.md`. Raw response:
`agents/runtime/council/responses/intake-owned-digest-2026-10-19.md` (local,
gitignored). For `road-to-an-intake-the-queue-can-carry` steps 4.1 and 4.2, and
the reopen of its decision D6.

## Converged, 2/2

- **Location: outside the active-roadmap glob** (`agents/roadmaps-owned.md`,
  beside the dashboard). Both seats: one missed exclusion list among ~60
  readers silently turns the digest into an active roadmap.
- **Tracked, with only fields that change rarely, and no paths.** Both picked
  option iii. anthropic: "most-cited paths optimizes for the wrong signal";
  openai: "citation frequency is not evidence of path ownership". Tracked
  because the readers include another clone, a reviewer and a web reader, who
  cannot run a generator.
- **Parked roadmaps are owners.** Both rejected active-only: a deferred roadmap
  can still be the canonical place a defect is recorded.
- **Over budget fails, never truncates.** openai: a dropped tail row "would bias
  ownership lookup by sort order". Count with the real tokenizer.
- **The digest is a shortlist, confirmed against the source roadmap**, and the
  intake keeps working when the digest is absent or stale.
- **D6's premise has failed** and the budget is reopened.

## Split, and how each split was settled

| Point | anthropic | openai | Settled by | How |
|---|---|---|---|---|
| Budget | ~5,000 (option C) | 6,000, measured | agent, on measurement | Both figures assumed stubs excluded. With stubs in (next row), the measured digest is 8,418 tokens (`cl100k_base`); the budget is 10,000, fail-closed. |
| Stubs | "decide explicitly" | "declare non-owning" | agent, on evidence | Stubs are rows. Of the 11 arrivals in the three replayed rounds, 6 landed on stubs (`agents/evidence/analysis/intake-replay-2026-10-16.md`); declaring them non-owning would hide the owners the intake already uses most. |
| Churn | iii "10-20% of roadmap commits" | measure by historical replay | agent, measured below | |
| Before wiring the intake | observe two weeks first | labelled accuracy evaluation first | agent | The intake reads the digest **in addition to** its full search, never instead of it, and confirms every candidate in the source roadmap. A wrong row can then add a candidate that is rejected on reading; it cannot remove one. That is openai's own stated condition — "mandatory source-roadmap confirmation before mutation; demonstrated fallback" — and anthropic's "route-then-confirm". The accuracy evaluation stays owed: Phase 6.2 reads it. |

Both seats opened with "do not greenlight as written". What landed is not the
step as written: it moved the file, dropped the paths, included the stubs,
raised the budget and made the reading additive — each a point a seat raised.

## The churn replay (openai's condition)

Rendered each row before and after every first-parent commit on `origin/main`
that touched `agents/roadmaps/`, with the landed generator (scratch reader, not
committed; it imports `entryOf` from the generator):

| Window | Commits touching roadmaps | Would change the digest | Rows: added / removed / status / goal |
|---|---:|---:|---|
| 30 days | 354 | 124 (35%) | 148 / 102 / 1 / 1 |
| 60 days | 838 | 429 (51%) | 500 / 329 / 56 / 3 |

anthropic's 10-20% estimate does not hold: landing, parking and archiving move
rows far more often than goals change. Two mitigations follow from it, both in
the generator: the header carries **no row count** (every landing would rewrite
that one line, so two branches would always conflict on it, where independent
row edits rarely touch adjacent lines), and a conflict on the file is resolved
by regeneration (`sync_pr_branch` lists it as generated). The dashboard this is
compared with changed on every one of those commits.

## What would reopen it

- openai's kill criteria: the digest is absent from a run that needed it, it is
  over budget, or measured false routing exceeds what Phase 6.2 records.
- Conflicts on `agents/roadmaps-owned.md` show up in `pr_conflict_census`
  often enough to cost more than a tree-only reader gains — then option ii
  (untracked, like the dashboard) is the fallback both seats named.
