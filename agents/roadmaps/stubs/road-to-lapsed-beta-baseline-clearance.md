---
complexity: bounded
review_by: 2026-11-23
---

# Stub: the lapsed-beta baseline has a clearance date and nothing owns it

> **Stub — not active work.** It exists so that **2026-11-23**, the frozen
> baseline's own `clear_by`, is reachable by grep from a non-archived roadmap
> and attached to a plan rather than to a checker message. Created by
> `road-to-a-beta-window-that-is-not-a-surprise` step 2.1.

## The obligation

`src/config/lapsed-beta-baseline.json` carries `"clear_by": "2026-11-23"` and,
beside it, its own statement of what that date means:

> *"Not a soft target. If the list is not empty by this date the 90-day review
> cadence itself is reassessed, on measured workload from the first complete
> post-migration cycle — the migration is not silently extended."*

Before this stub the date lived in that JSON field, in the string the checker
prints on every run, and in nothing that anybody plans against. A date that
appears only in the output of the gate it governs is discovered on the day it
fires.

## The measured state, at 2026-09-06

`./scripts-run src/scripts/check_beta_review_markers` reports:

- **84 violations across 84 distinct contracts** — one finding per contract.
- **85 baseline entries**, of which **84** are still reported as lapsed. The
  remaining one, `docs/contracts/no-runtime-boundary.md`, has left the lapsed
  set and is inert; the baseline is an allowlist, so an entry that stops
  matching simply stops being consulted.
- Exit **0**, because all 84 are inherited warnings. A single *fresh* lapse
  flips that to exit 1 for the whole repository.

So the set has moved by one contract in the twelve days since it was frozen at
2026-08-25. At that rate the list is not empty on 2026-11-23, and the clause
above fires.

## What this stub does NOT decide

Whether the cadence is reassessed, whether the date moves, and whether the
remaining 84 are worked down or dispositioned in bulk. All three are the
owner's, and the baseline's own comment reserves the first explicitly. Moving
the date is the cheap action and the one the parent roadmap's risk register
names as the failure mode — a one-time amnesty converted into a standing one —
so it is recorded here as the thing to be deliberate about rather than
foreclosed.

## What to do, and by when

**By 2026-11-23**, one of:

1. The list is empty. The same change deletes
   `src/config/lapsed-beta-baseline.json` and sets `LAPSED_SEVERITY_IN_BASELINE`
   to `'error'` in `src/scripts/check_beta_review_markers.ts` — the success
   state the loader already documents (an absent file means no inherited debt,
   not everything inherited).
2. The list is not empty and the 90-day cadence is reassessed on measured
   workload, per the baseline's own clause, with the outcome recorded in
   `docs/decisions/`.

**Do not** resolve this by editing `clear_by` alone. The date is the forcing
function; moving it without the reassessment is the silent extension the
baseline's own comment forbids.

## Verification

```bash
grep -n '"clear_by"' src/config/lapsed-beta-baseline.json
./scripts-run src/scripts/check_beta_review_markers | tail -3
```

The second command prints both counts and the baseline's inert remainder, which
is the number this stub exists to make readable before its date arrives.
