---
status: template — awaiting sessions (no real data yet)
study: install-friction (B9)
recruits_target: 3
---

# Install-friction report (B9)

> **Template — not yet run.** This file carries the Gate-C read for the wedge
> install. It holds **no real data** until ≥ 3 external Laravel/TS developers
> have completed the study per
> [`agents/recruit-sessions/_install-friction-runbook.md`](../agents/recruit-sessions/_install-friction-runbook.md).
> Do not cite the placeholder numbers below as findings.

## What this measures

Can an external developer — not on the maintainer team, no prior exposure —
install the `production-validator` wedge and reach first value (a real verdict
on their own code) in **< 60 s**, unaided, without abandoning? That is the
Gate-C signal. Method: observed, timed, wedge-only (see the runbook).

## Per-recruit results

> One row per recruit. `TTFV` = time-to-first-value in seconds ("—" if
> abandoned). `outcome` ∈ completed · completed-with-rescue · abandoned.
> Real names never appear (R1/R2/R3); raw notes stay private with the recording.

| recruit | stack | TTFV (s) | outcome | abandonment point | top friction |
|---|---|---|---|---|---|
| R1 | _tbd_ | _tbd_ | _tbd_ | _tbd_ | _tbd_ |
| R2 | _tbd_ | _tbd_ | _tbd_ | _tbd_ | _tbd_ |
| R3 | _tbd_ | _tbd_ | _tbd_ | _tbd_ | _tbd_ |

## Aggregate

| metric | value | Gate-C threshold |
|---|---|---|
| Median TTFV | _tbd_ s | ≤ 60 s |
| Abandonment rate | _tbd_ % | ≤ 20 % |
| Clean completions (no rescue) | _tbd_ / _n_ | — |

## Top-3 friction points

> Ranked by how many recruits hit each. Each cites the redacted verbatim moment
> that named it (timestamp against the private recording).

1. _tbd_ — hit by _N_/_n_ recruits. Quote: _tbd_. Fix: _tbd_.
2. _tbd_
3. _tbd_

## Gate-C verdict

```
PASS  ⇔  median TTFV ≤ 60 s  AND  abandonment rate ≤ 20 %.
FAIL  →  iterate on the wedge install before finalizing C2. Do not ship a failed wedge.
```

- **Verdict:** _tbd (PASS / FAIL)_ — filled once the aggregate is real.
- On **FAIL**, the top-3 friction points above are the exact iteration targets;
  re-run the study after the fix. A failed gate is a finding, not a stopper.

## Provenance

- Protocol: [`agents/recruit-sessions/_install-friction-runbook.md`](../agents/recruit-sessions/_install-friction-runbook.md).
- Consent + redaction: [`agents/recruit-sessions/README.md`](../agents/recruit-sessions/README.md) § "Consent + redaction policy".
- Recordings + raw per-recruit notes: private (not in-repo), per the redaction policy.
