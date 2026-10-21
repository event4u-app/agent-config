<!-- evidence-type: original-review -->

# Council — the retro's session-start probe, five rounds to a non-refusing verdict

> **Type:** council-record. Five rounds on 2026-10-21, seats anthropic and openai,
> `--prompt-mode pr --rounds 1`, subscription seats, nothing billed. Round 4 was
> DEGRADED (anthropic timed out) and is recorded as one seat, not as agreement.
> The final prompt is committed beside this file as
> `retro-session-start-probe-2026-10-21.question.md`.

## What was reviewed

Steps 3.3 and 3.4 of `road-to-a-retro-the-merge-runs`: calling the existing
`retroDailyProbe` from the `session_start` slot of the `session-register`
concern, plus the claim protocol that keeps the daily sweep to one writer. The
three council rounds of 2026-10-20 had refused the wiring 2/2 each time; round 3
of that series named four open points — a non-atomic takeover, a release that
could free a successor's claim, discovery before the claim, and a deadline that
could not interrupt a fact read in flight. Each round below reviewed the full
`git diff origin/main...<head> -- src tests docs` of the branch at that point.

## Rounds

| Round | Head | anthropic | openai | What openai found, and what changed after it |
|---|---|---|---|---|
| 1 | `13cd62044` | ship | refused | Ownership checks did not fence writes against a lease-only takeover of a suspended holder; the throttle was stamped after a superseded sweep. → takeover only from an exited holder, stamp only a completed sweep (`32a13c147`). |
| 2 | `32a13c147` | ship | ship-with-fixes | Per-day claim files were not exclusive across days. → one repository-wide sequence `claim.<generation>`, every transition an exclusive create (`3da8f5cb2`). |
| 3 | `3da8f5cb2` | ship | refused | A 24-hour age escape still let a suspended live holder be superseded. → the escape is removed; a stuck claim is named by `/retro status` (`d6e123f67`). |
| 4 | `d6e123f67` | — (timeout) | ship-with-fixes | A claimant that waited past an acquire, a release and a prune could recreate a pruned generation and run discovery. → verify the created generation is the newest before use (`6063f6bd4`). |
| 5 | `6063f6bd4` | ship-with-fixes | ship | — |

## Round 5, the standing verdicts

**openai — `ship`.** No correctness, concurrency, security or authority defect;
the post-create newest-generation check closes the reuse race; process work is
bounded by the remaining three seconds, with only local file work of the one
session in flight after it. Minor, not blocking: the hook integration test checks
sweep state and the throttle stamp, not the emitted queue context.

**anthropic — `ship-with-fixes`**, one condition: confirm that the claim token
actually carries the holder's pid (the token line reached the seat redacted). If
it does, "this may land as is". It does: the token is built in
`src/scripts/retro_queue.ts` as `` `${gen}:${process.pid}-<16 hex>@${day}` `` and
parsed by `holderPid` with `/^\d+:(\d+)-/`. The condition is also checked by a
test rather than only by reading: in `takeover-during-write`, a rival claimant
runs inside the sweep's triage loop at a month's age and is refused, and forcing
the liveness check false makes that rival succeed and the test fail — which could
not happen if the token named no pid, because an unparseable pid past the lease
is treated as unheld.

Neither seat refused. The step's closing condition — a session-start call whose
claim is taken before any discovery, re-reviewed to a non-refusing verdict — is
met on head `6063f6bd4`.

## What this does not establish

- The residual cost both seats accepted: local file reads of one session can run
  past the three-second deadline.
- A pid reused by an unrelated long-lived process blocks the daily sweep until it
  exits. That is the price of never superseding a live holder; `/retro status`
  names the claim.
- Seat verdicts above are transcribed from the council output, which is
  gitignored and pruned; the committed prompt is what a reader can check them
  against.
