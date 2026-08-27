---
complexity: lightweight
review_by: 2026-09-26
---

# Stub: 14 decided declarations the preamble ceiling will not admit

> **Stub — not active work.** A **drain-run transfer**, created 2026-08-27 when
> [`road-to-undeclared-obligation-disposition.md`](../archive/road-to-undeclared-obligation-disposition.md)
> decided 14 enforcement declarations and could not write them: `origin/main`
> measures the per-spawn preamble grace ceiling **exactly, to the token**, so a
> rule-metadata addition of any size is refused — even seven of the fourteen
> overshoot by 72.

## State

### blocker: preamble-transfer-debt-221

- **Status:** open
- **Owner:** maintainer
- **State:** `pending-headroom` (created 2026-08-27)
- **Severity:** **CI-blocking on every PR touching `src/rules/**`** — the
  `Standing Payload Delta` workflow runs `check_preamble_payload_budget` against
  the grace ceiling, and the tree is now above it.
- **Blocks:** any further rule-payload growth, and the ceiling's own ratchet-down.
- **What to do:** recover **≥ 221 tokens** from the project-scope rule payload by
  semantics-preserving compression, then apply the 14 declarations listed
  verbatim in
  `agents/evidence/analysis/undeclared-cohort-disposition-2026-08-27.md`
  § The 14, ready to apply. They are decided; applying them is mechanical.
- **Recommendation:** take it from duplicated boilerplate rather than from
  obligations. One candidate, unmeasured and named rather than assumed: the
  routing sentence *"Trigger-set above activates this routing on demand,
  independent of the discipline profile (ADR-110)."* recurs across many migrated
  pointer stubs at roughly 100 characters each. **Measure before cutting** — a
  rushed compression that makes an instruction worse is the failure one council
  seat named explicitly.
- **If you do nothing:** the 82-rule undeclared cohort stays undeclared, and so
  does every future one — **no rule may gain an `enforced_by` field at all**
  while main sits on the ceiling. The grace ceiling expires **2026-11-10**, at
  which point the design ceiling (107,646) applies to a tree measuring ~138,200
  and this 221 is the smallest part of a 30,000-token gap.
- **Resolved when:** `./scripts-run src/scripts/check_preamble_payload_budget`
  reports a project-scope total ≤ 138,212, and this stub is deleted.

## Why nothing was shipped, and why that is not a deferral

`road-to-undeclared-obligation-disposition` found **82 of 120 rules declaring no
enforcement at all** and wrote 14 dispositions — 7 naming a real carrier, 7
stating `instruction-only`. Measured effect: `undeclared 82 → 68`, with
`unwired 0` and `missing 0` holding, and **the headline coverage number
unchanged**, which is correct: nothing there made an obligation safer at runtime.

The cost is **structural**, not prose: 14 × (`enforced_by:` key + one declaration
line). Every reason was compressed to a clause and the full reasoning moved to
the evidence report, which is not in the preamble payload — that move **is** the
transfer the lock asks for, and it recovered 227 of the original 448 tokens.

It was not enough, and neither was halving the set. Measured:

| tree | tokens | vs ceiling |
|---|---|---|
| `origin/main` | **138,212** | exactly on it |
| + all 14 | 138,433 | +221 |
| + the 7 carrier declarations only | 138,284 | +72 |
| + none | 138,195 | −17 |

**Any rule-metadata addition is currently refused**, and the ceiling is enforced
by a **test** as well as by CI, so "ship it and record the debt" is not an
available option — the repo refuses the commit, not just the report.

## The council split, recorded because it did not converge

AI council 2026-08-27, under the maintainer's delegation of owner-reserved
decisions for this drain run. **2 seats, no convergence.**

| seat | verdict |
|---|---|
| `anthropic/claude-sonnet-4-5` | **Option 1** — ship, record the 221 as transfer debt with a numeric repayment target, no ceiling raise, expiry unchanged, no further growth until the diet recovers net headroom |
| `openai/codex-default` | **Option 5** — find ≥ 221 tokens of verified headroom in the **same change**, then ship all 14; "transfer debt" turns a hard invariant into a queue of promises |

Both agreed the change itself is worth making and that **all 14 declarations
should land** — the dissenting seat argued explicitly against dropping the seven
`instruction-only` ones, because they distinguish *consciously unbacked* rules
from rules nobody assessed.

**The split is moot, and in the dissenting seat's favour.** The question was
framed as though the ceiling were enforced only by a report-only workflow. It is
also enforced by `tests/scripts/check_preamble_payload_budget.test.ts`, so
Option 1 — ship with recorded debt — was never available. The framing was mine
and it was wrong; recorded rather than quietly dropped, because a council
answering a false premise is the failure mode this run already hit once.

What shipped instead is neither option: **nothing was written, and everything was
decided.** The 14 declarations sit in the evidence report with their exact
strings, so applying them later is mechanical.

The concurring seat's conditions still hold, and cost nothing now:

- **No ceiling raise.** `grace_ceiling` stays 138,212, expiry 2026-11-10.
- **A numeric target**, not a promise: ≤ 138,212 with the 14 applied.
- **Recorded where a maintainer reads it** — this stub is counted in the
  dashboard's owner-decision total and surfaced by `agent-config stubs:due`.

## Probe

1. `./scripts-run src/scripts/check_preamble_payload_budget` — a project-scope
   total with ≥ 221 tokens of headroom below 138,212 → apply the 14 and delete
   this stub.
2. If the grace ceiling has expired (after 2026-11-10) the design ceiling of
   107,646 applies and this 221 is the smallest part of a much larger gap — at
   which point this stub is superseded by the diet roadmap rather than repaid on
   its own.
