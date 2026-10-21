<!-- evidence-type: analysis -->

# Decision — what "a self-review that actually completed" covers for the 17.0.0 cut

The owner holds 17.0.0 until "a fresh self-review actually completed" and every
finding is dispositioned. The self-review (`self_review_gate`) sends the release
span's diff to a model in chunks of at most ~432,000 characters and stops at a
hard per-run ceiling of 6 requests; the remainder is reported UNREVIEWED. The
first run on this span reviewed 6 of ~71 requests and produced 51 findings, 6 of
them blocking. Re-runs of earlier cuts produced a different set each time.

The span 16.5.0...HEAD, measured on the cut:

| Part | Files | Diff bytes | ~Requests |
|---|---|---|---|
| everything | 2,976 | 26.2 MB | ~71 |
| shipped executable code — `src/scripts`, `src/install`, `src/shared`, `src/cli`, `src/server`, `.github`, `hooks`, `bin`, `scripts` | 508 | 3.35 MB | ~8 |
| skills, rules, commands, packs (`src/skills`, `src/rules`, `src/agent-src`, `src/domains`) | 313 | 1.21 MB | ~3 |
| the rest — `agents/evidence` (628), `tests/fixtures` (396), `dist/agent-src` (320, generated from `src/`), `tests/scripts` (305), `agents/roadmaps` (125), `docs`, `dist/install` (generated), … | ~2,150 | ~21.6 MB | ~60 |

## Options

1. **Everything.** ~71 requests over ~12 runs of the ceiling; at the first run's
   rate roughly 600 findings to disposition. Subscription transport, so no API
   bill, but hours of review and a disposition load that dwarfs the change.
2. **Every byte that ships behaviour or instructions.** The two middle rows,
   ~11 requests in two runs, reviewed to completion. The rest is recorded in the
   ledger as out of scope by class, with the reason per class: generated
   projections are reviewed through their `src/` source, evidence and roadmaps
   are records, fixtures and tests are reviewed as part of the code they test
   only where a gate already binds them.
3. **Shipped executable code only** (~8 requests, one-and-a-half runs), with
   skills and rules recorded as out of scope.

Which should define "completed" for this cut: **1**, **2** or **3**? Give the
choice, the reason, and the condition under which you would require more.
