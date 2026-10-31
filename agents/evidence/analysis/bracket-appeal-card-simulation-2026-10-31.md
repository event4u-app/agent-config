<!-- evidence-type: analysis -->

# Appeal card under a noisy judge — simulated rescue (C2a), 2026-10-31

> Measured by `./scripts-run src/scripts/bracket/simulate --runs 10000` on tree
> `14012757df` plus this change, for `road-to-a-loss-that-can-be-appealed` step 3.5.
> A **fixture reading**: the real engine (`src/scripts/bracket/engine.ts`) driven by
> stub verdicts, no model called, nothing spent. It says nothing about live yield
> (that is claim `appeal-card-live-yield`, unbacked).

## Model

- N lines with known true quality falling linearly from 90 (L001) to 50.
- Match judge: reads each side as quality + N(0, 3), swaps its reading with p = 0.15.
- Appeal signals as shipped (gap ≤ 5, pick ≠ points, loser more correct, FATAL
  rebutted, 10 % audit sample). The card seat takes an independent second look
  with the same 15 % flip; card 2 needs new evidence (p = 0.5 in the stub).
- Calls: N generation + 5 per judged match + 1 per paid second look.

## Result (10 000 runs per arm, seeds 1–10 000)

| N | arm | true best wins | mean calls | mean cards |
|---|---|---|---|---|
| 10 | no cards | 50.97 % | 55.0 | 0.00 |
| 10 | cards | **59.43 %** | 61.3 | 0.76 |
| 20 | no cards | 37.43 % | 115.0 | 0.00 |
| 20 | cards | **48.51 %** | 132.4 | 2.18 |
| 100 | no cards | 14.27 % | 595.0 | 0.00 |
| 100 | cards | **23.15 %** | 702.2 | 13.65 |

## Verdict

Pre-registered bar (roadmap C2a): ≥ +5 pp for the true best with cards. **Pass** at
every N: +8.5 pp at 10 for +11 % calls, +11.1 pp at 20 for +15 %, +8.9 pp at 100
for +18 %.

## What it also shows

Under a 15 %-flip judge a single-elimination bracket of 100 crowns the true best
only one time in seven — a larger bracket is more chances for one bad call to
remove it. That is the simulated reason N stays a ceiling and the default stays
10: more lines buy diversity, not a more reliable winner.
