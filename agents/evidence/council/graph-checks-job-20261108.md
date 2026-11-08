<!-- evidence-type: analysis -->

# Council review of the shipped `graph-checks` job: rounds 7–10, 2026-11-08

Roadmap: `road-to-a-graph-that-wins` AC-8 (owner-narrowed on 2026-11-06 to "a separate, non-required job beside the gate"). Round 6 accepted the placement and refused the implementation as it stood then. These rounds reviewed the version shipped on `main` (`17d530c409`) and the fixes made after each round. Each round's prompt is committed beside this file as `graph-checks-job-r7..r10-20261108.question.md`.

## Final round (10)

| Seat | Model | Stance |
|---|---|---|
| anthropic | claude-sonnet-4-5 | `confirmed-non-expanding` · high · dealbreaker **no** |
| openai | codex-default | `confirmed-non-expanding` · med · dealbreaker **no** |

Both seats cleared the change. Both named one further hardening as the highest-leverage step before merge: remove a previous summary before a run, so a stale one in a reused `--out` cannot mark completion. That hardening is implemented and tested after round 10 (`5c1360c68f`; the test was red first). It is the only change made after the final round.

## What the rounds found and what changed

| Round | Finding (seat) | Change |
|---|---|---|
| 7 | Flagged count stated every item while the cap kept only `untested` (both; dealbreaker) | `flaggedItems` feeds cap and count; test asserts 150, not 180, and was red first |
| 7 | Provenance, requiredness and time budget claimed more than the job shows (both) | Comments and summary state PR-controlled execution, the external ruleset, and the real time budget |
| 7 | Separate workflow file (anthropic) | Not done: openai disputed that it isolates anything, and a new workflow is a new CI surface |
| 8 | Fallback JSON had an undeclared status and missing fields (anthropic; dealbreaker) | Complete `no-analysis` shape written with `node -e`; a test runs the snippet and compares keys, red first |
| 8 | "No check flagged anything" also shown when checks did not run (openai) | Reworded |
| 9 | The job summary step's shell branch was untested (both; anthropic dealbreaker) | The step's `run:` block runs under bash over three output states; sensitivity shown by breaking its condition |
| 9 | File existence ≠ completion (openai) | Summary written last and renamed into place |
| 10 | A stale summary in a reused `--out` (both; non-blocking) | Removed before the run |

**What this record does not establish:** that the council sessions it summarises are authentic. The session files are local runtime output and are not committed. The stances above are copied from those files. The prompts are committed.
