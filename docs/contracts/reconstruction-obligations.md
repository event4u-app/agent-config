---
stability: experimental
---

# Reconstruction obligations

**Purpose.** Define when an `adapt` or `rebuild` transfer of the reference door
is done. A transfer closes against an **obligation ledger**, not against a
feeling that the result "looks like" the source. The validator is
[`src/scripts/_lib/reconstruction_ledger.ts`](../../src/scripts/_lib/reconstruction_ledger.ts).

**Scope.** Any destination project the run's local scope names — not only this
package. Governs what an obligation is, which statuses it may hold, and when a
ledger closes. Does not govern how evidence is gathered; that is the analysis
loop's evidence vocabulary (tier, authority, coverage).

**Provenance.** The authority/coverage split, the obligation ledger and
measured parity are adapted from two external references (an external
reverse-engineering toolkit and an external clean-room app family); the shape
below is own analysis. <!-- harvest:evidence-authority-coverage-and-obligation-ledger -->

## An obligation

One row per behavior the destination must reproduce.

| Field | Means |
|---|---|
| `id` | stable identifier of the row |
| `behavior` | the behavior, stated observably — input, action, expected outcome |
| `tier` | the equivalence tier this row claims (below) |
| `required_cases` | the cases that must each be shown — happy path, boundary, error |
| `evidence` | per case, the evidence ids that show it in the destination |
| `verifier` | who or what checked it — a test, a replay, a reviewer |
| `verifier_authority` | the authority of that check: `upstream-artifact`, `controlled-replay`, `own-tree`, `external-claim`, `analyst-inference` |
| `status` | `open`, `visible-only`, `verified`, `waived` |
| `waiver_reason` | required when `status` is `waived` |

## Equivalence tiers

From loosest to strictest. A row names the tier it claims; a ledger never
claims a stricter tier than its rows prove.

1. **inspired-by** — the idea, re-derived; no behavior is promised.
2. **ux** — a user meets the same flow and outcomes.
3. **behavior** — the same inputs produce the same observable outputs.
4. **protocol** — the same wire, file or API shape, interoperable with the source.
5. **byte** — identical output bytes for the same input.

## Statuses

- `open` — not yet shown.
- `visible-only` — seen in a UI or a screenshot, not checked. **Never counts
  as verified and never counts toward parity.** Something on screen proves the
  screen, not the behavior behind it.
- `verified` — every required case has evidence and the verifier's authority
  is not `analyst-inference`.
- `waived` — deliberately not reproduced, with a reason. Excluded from parity,
  never counted as verified.

## Closing rules

1. A row is `verified` only when every required case carries at least one
   evidence id and `verifier_authority` is not `analyst-inference`. A row that
   claims `verified` without both is refused, and the ledger reads `invalid`
   until it is corrected.
2. A ledger **closes** only when no row is `open` or `visible-only`.
3. An **empty ledger reads `unknown`** — no rows is no claim, never "done".
4. **Parity** = verified rows / (all rows − waived rows). `visible-only`,
   `open` and `waived` add nothing to the numerator.

## Non-goals

- No proprietary code, assets, keys or data are copied into the destination.
  The [`code-provenance`](../../src/rules/code-provenance.md) rule already
  binds: read, close the source, re-derive, record the borrow.
- No circumvention of access control, licensing checks, DRM or terms that
  forbid reverse engineering.
- A byte-tier claim is not a license to reproduce a protected work.
