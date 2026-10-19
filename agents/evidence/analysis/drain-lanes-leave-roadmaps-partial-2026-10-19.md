<!-- evidence-type: analysis -->
# Drain lanes leave roadmaps partial — 50-session reading, 2026-10-19

Input to `road-to-roadmaps-finished-before-new-ones-start`. Measured on
2026-10-19 against `origin/main @ aa4185a1f`, over the 50 most recent main-checkout
session transcripts of this repository (2026-10-01..10-19) and their subagent
transcripts. The transcripts are machine-local; the figures below are the
record, the per-lane extracts are not tracked.

## Corpus

- 50 sessions; 18 invoked `/roadmap:process-full`, 14 of them with `--all` and
  subagent lanes. The owner's invocation in 6 of the 14 asks to work as many
  roadmaps as possible (German original in the transcripts).
- 510 subagent transcripts in those 14 sessions; 285 are lanes, 207 are
  full-drain lanes (told to run `process-full` on one roadmap).
- Live estate at reading time: 24 `ready` + 5 `draft` active roadmaps, every one
  with at least one `[x]`, none at `count_open == 0`.

## Finding 1 — 17 of 207 drain lanes (8 %) ended with their roadmap complete

Primary stop reason, one per lane:

| Stop reason | Lanes |
|---|---:|
| Owner decision or owner-reserved surface | 55 |
| Killed by spend/usage limit, no report | 30 |
| Council refused, split, or out of quota | 25 |
| Host auto-mode classifier refused an action | 24 |
| One partial PR delivered, no hard blocker named | 18 |
| **Complete** | **17** |
| Time window not yet open | 11 |
| Step on the prompt's off-limits list | 8 |
| CI or gate red | 8 |
| Turn ended while waiting for CI, no report | 6 |
| PR merged mid-lane, commits stranded | 4 |

Context exhaustion was the primary reason in **0** lanes; several lanes ran past
1,000 turns.

## Finding 2 — the lane brief is improvised per session and sets a partial finish line

There is no canonical lane brief: `roadmap-process-loop` § 3d records parallel
lanes as "staged, not shipped" (gate: ten clean serial set runs), so every
orchestrator wrote its own. Over 285 lane prompts:

| Instruction | Prompts |
|---|---:|
| Deliver an OPEN, green PR | 244 |
| "you never merge, the orchestrator merges" | 227 |
| A partial-progress PR explicitly sanctioned | 77 |
| "Do not ask the owner" | 79 |
| Off-limits surface list | 89 |
| "If it needs a ratification record, remove that part of the diff" | 14 |
| "Close EVERY open step" | 63 |

Finished work was reverted out of PRs to fit the brief (one-detector 2.2,
placeholders 5.1/5.2/6.1, cold-start 3.6/4.3). One orchestrator (session
`dbc2e8b1`) told its lanes, in German, that a PR closing one of two boxes is a
good PR.

## Finding 3 — gated residue has no route to a decision inside the run

Owner-reserved, council and time-gated steps were left `[ ]` with a line in the
lane report. The decision was not put to the owner during the run, so the next
drain re-dispatched a fresh lane onto the same blocker: 198 slug-identified lanes
over 93 roadmaps; `road-to-an-installed-layer-that-is-thinned` received 9 lanes
in 8 sessions and still stands at 11/20 behind the same blocker. 20 of the 29
active roadmaps carry an open `### blocker:`.

## Finding 4 — work goes to new roadmaps, not to started ones

From `origin/main` first-parent history since 2026-09-20:

- 167 progress commits on the 29 active roadmaps (≈5.8 each); only 81 (48 %)
  raised the done share.
- 98 of 196 roadmap touches (50 %) came from a commit that also touched another
  roadmap.
- Roadmaps under 25 % received 86 touches; roadmaps at 75 % or more received 12.
  Twelve roadmaps created 2026-10-14..16 progressed at once while the 70–77 %
  ones received nothing.
- A roadmap stays partial 9.5 days on average (median 7);
  `road-to-decision-closure` has stood at 77 % since 2026-09-30.
- Of the 257 open steps: ≈61 % implementable now, ≈21 % waiting on a time
  window / soak / measurement, ≈17 % waiting on the owner or an external party
  (classification by reading each step line, not computed).
- For contrast, the 94 roadmaps archived since 2026-09-20 needed 3.6 commits on
  average and a median of one day — they were small. The active set is 40–50-step
  roadmaps whose tails are gated.

## Finding 5 — fan-out and closing actions

- One session ran 14 lanes at once against the recorded two-lane cap; Actions
  queued 45–52 runs and every lane died on the spend limit together.
- 24 lanes were stopped by the host classifier on the *closing* actions
  themselves: flipping the lane's own checkboxes ("Self-Approval"), writing a
  finding disposition ("self-adjudication"), `node_modules` copies
  ("Self-Modification"). Lanes are told not to route around refusals, so the
  bookkeeping that would close a roadmap is the step most often refused.
- 4 lanes had their PR merged under them, stranding later commits.

## Limits

Stop reasons were classified by regex plus a manual read of about 120 reports;
the remaining labels are regex-only. The step classification in Finding 4 is a
reading, not a computation. Figures that depend on the local transcript store
cannot be re-derived from a clean clone.
