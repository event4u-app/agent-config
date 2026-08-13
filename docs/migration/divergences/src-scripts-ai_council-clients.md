# Divergence: ai_council/clients — DEFAULT_CLI_TIMEOUT_SECONDS

## Script

- Python: `src/scripts/ai_council/clients.py` (retired under ADR-200 / ADR-051)
- TypeScript: `src/scripts/ai_council/clients.ts`

## Symptom

`DEFAULT_CLI_TIMEOUT_SECONDS` mirrored the Python default of `120.0`. On the
subscription CLI transport a deep council run exceeds it, so members return no
answer at all.

- **Python value:** `120.0`
- **TS value (after this change):** `300.0`
- Affected channel(s): written response file + the run's quorum verdict.

Measured 2026-08-13, deep design prompt, two members:

```
council:quorum · after the run · 0/2 present, needed 1 — INCONCLUSIVE
```

with both member records carrying `"error": "timeout"`,
`"latency_ms": 122921`, `"timeout_seconds": 120`, `"transport": "cli"`.

## Root cause

The identical symptom was repaired on 2026-06-24 by raising the **API**
transport to `--connect-timeout 30 --max-time 290` plus a `300_000` spawn
timeout (`clients.ts:445,451`). That repair landed in `_curlJsonPost` only. The
CLI transport — the path taken when a member resolves to `cli · subscription`,
which is the shipped configuration here — kept the original `120.0`, so the
fix never covered the live path. The two transports were asymmetric by
oversight, not by design.

## Verdict

`intentional-improvement` — both values are defensible in isolation, and the
higher one is already the approved behaviour on the sibling transport. Raising
the CLI default to match makes the two paths agree rather than introducing a
new position.

Kept honest about the ceiling: a timeout still exists, so a genuinely hung
subprocess is still surfaced rather than freezing the run — the property the
original constant's comment names.

## Evidence

- `tests/scripts/ai_council/clients.test.ts` — the constants-parity block now
  asserts `300.0` and carries the reason inline, so the divergence is visible
  at the assertion rather than only here. 803 tests green across
  `tests/scripts/ai_council/`.
- Before/after on the same question and depth: `0/2 present — INCONCLUSIVE`
  → `1/2 present — concluded`, the answering member returning 9,276 characters.
  The second member failed with `exit_1`, a different fault that this
  divergence does not claim to fix.

## Why it matters beyond this run

`decision_resolution` classes a contract or architecture question as
`medium_impact → council`. A council that cannot finish a deep prompt routes
those questions to the user instead, which is the interruption the
classification exists to prevent. The timeout was therefore not a comfort
setting but a load-bearing dependency of the routing.

## Approval

- Reviewer: <pending — PR review>
- Date: <YYYY-MM-DD>
