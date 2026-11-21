<!-- evidence-type: analysis -->

# Arming the done-claim reasons — measurement of 2026-11-21

> Measured for `road-to-done-claims-with-read-exit-codes` step 5.1, on the
> maintainer machine, with the classifier and detector G as they stand on the
> branch `feat/done-claims-with-read-exit-codes`. The measurement script was a
> one-off read of the two local stores and is not part of the tree; it called
> `classifyRun` and `exitMasking` on every witness record, and
> `detectCoverageGap` on the closing reply of every scored transcript turn,
> rebuilding turns the way `measure_turn_end_gate` does (a genuine user prompt
> ends the turn; sidechain entries are skipped).

## Stores and windows

| Store | What was read | Window |
|---|---|---|
| Witness records (`agents/state/verify-before-complete/`, main checkout) | 7 session files, 42 records, one host (`claude`) | 2026-11-19 to 2026-11-21, about 2 days |
| Transcripts (every project of the local Claude Code store, files modified in the last 30 days, under 60 MB each) | 1,011 session files, 1,504 scored turns | 2026-10-28 to 2026-11-21, about 24 days |

## Per reason

| Reason | Fires | Fires on a `pipefail` command | Fires on a reply that lists what it did not verify | Denominator |
|---|---:|---:|---:|---|
| `exit_masked` | 3 | 0 | n/a (classifier, no reply) | 42 records |
| `partial_ratio` | 0 | n/a | 0 | 5 closings that match the completion trigger, of 1,504 turns |
| `unlisted_surface` | 1 | n/a | 0 | the same 5 closings |

Supporting counts:

- `exitMasking` matched 5 command lines by shape (3 `trailing`, 2 `pipe`). 3
  classify `exit_masked`; the other 2 classify otherwise, because an echoed exit
  code or a printed failure summary decides them first. None of the 5 carried
  `pipefail` on the line, so the reason's known false-positive source (a
  `pipefail` from an rc file) could not show up in this sample either way.
- The completion trigger detector G shares with detector D is narrow on
  purpose; it matched 5 of 1,504 closings, so both G reasons had 5
  opportunities to fire.

## What the measurement cannot decide

- Every reason sits far below the contract's sample floor (≥ 100 findings,
  ≥ 50 affected sessions, ≥ 30 days); the witness window is two days.
- `unlisted_surface` derived each session's surface map from its working
  directory as it is TODAY, not as it was at the turn, so the single fire may
  not reproduce on the historical tree.
- No fire was labelled by hand, so none of the counts is a precision figure.

These numbers went to the council for step 5.2; the verdicts are the
`D5`–`D7` rows of the roadmap's Decisions table.
