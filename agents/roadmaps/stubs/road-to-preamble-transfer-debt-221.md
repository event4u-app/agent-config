---
complexity: lightweight
review_by: 2026-09-26
---

# Stub: repay 221 tokens of preamble transfer debt

> **Stub — not active work.** A **drain-run transfer**, created 2026-08-27 when
> [`road-to-undeclared-obligation-disposition.md`](../archive/road-to-undeclared-obligation-disposition.md)
> landed 14 enforcement declarations that pushed the per-spawn preamble payload
> **221 tokens past a ceiling whose config says it may never move up**.

## State

### blocker: preamble-transfer-debt-221

- **Status:** open
- **Owner:** maintainer
- **State:** `pending-repayment` (created 2026-08-27)
- **Severity:** **CI-blocking on every PR touching `src/rules/**`** — the
  `Standing Payload Delta` workflow runs `check_preamble_payload_budget` against
  the grace ceiling, and the tree is now above it.
- **Blocks:** any further rule-payload growth, and the ceiling's own ratchet-down.
- **What to do:** recover **≥ 221 tokens** from the project-scope rule payload by
  semantics-preserving compression, so
  `check_preamble_payload_budget` reports **≤ 138,212**.
- **Recommendation:** take it from duplicated boilerplate rather than from
  obligations. One candidate, unmeasured and named rather than assumed: the
  routing sentence *"Trigger-set above activates this routing on demand,
  independent of the discipline profile (ADR-110)."* recurs across many migrated
  pointer stubs at roughly 100 characters each. **Measure before cutting** — a
  rushed compression that makes an instruction worse is the failure one council
  seat named explicitly.
- **If you do nothing:** the tree stays 221 tokens above a ceiling that "may
  never move UP", so the next legitimate rule addition inherits a debt it did not
  create, and the grace ceiling expires **2026-11-10** with the design ceiling
  (107,646) applying to a tree measuring ~138,400.
- **Resolved when:** `./scripts-run src/scripts/check_preamble_payload_budget`
  reports a project-scope total ≤ 138,212, and this stub is deleted.

## Why the debt exists, and why it is a debt rather than a raise

`road-to-undeclared-obligation-disposition` found **82 of 120 rules declaring no
enforcement at all** and wrote 14 dispositions — 7 naming a real carrier, 7
stating `instruction-only`. Measured effect: `undeclared 82 → 68`, with
`unwired 0` and `missing 0` holding, and **the headline coverage number
unchanged**, which is correct: nothing there made an obligation safer at runtime.

The cost is **structural**, not prose: 14 × (`enforced_by:` key + one declaration
line). Every reason was already compressed to a clause and the full reasoning
moved to `agents/evidence/analysis/undeclared-cohort-disposition-2026-08-27.md`,
which is not in the preamble payload — that move **is** the transfer the lock
asks for, and it recovered 227 of the original 448 tokens. The remaining 221 has
nothing left to move.

**`origin/main` measured exactly 138,212 — the ceiling to the token.** So the
constraint is not specific to this change: *any* rule-metadata addition is
currently blocked until the diet runs.

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

**What landed is Option 1, and the dissent is the reason this file exists.** The
offset was attempted and not found: every candidate was either drive-by editing
of prose the change does not otherwise touch, or editing the gate. The dissenting
seat's own warning applies to the alternative — requiring same-change savings
"may incentivize rushed compression that makes important instructions worse".

The binding conditions from the concurring seat are honoured in full:

- **No ceiling raise.** `grace_ceiling` stays 138,212 and expires 2026-11-10.
- **A numeric repayment target**, not a promise: ≤ 138,212.
- **The debt is recorded where a maintainer reads it** — this stub is counted in
  the dashboard's owner-decision total and surfaced by `agent-config stubs:due`,
  rather than inside an archived roadmap nobody opens.

## Probe

1. `./scripts-run src/scripts/check_preamble_payload_budget` — total ≤ 138,212 →
   the debt is repaid; delete this stub.
2. If the grace ceiling has expired (after 2026-11-10) the design ceiling of
   107,646 applies and this 221 is the smallest part of a much larger gap — at
   which point this stub is superseded by the diet roadmap rather than repaid on
   its own.
