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
   A row is also refused — whatever its status — when an evidence id it
   cites is not among the evidence ids the run recorded, or its
   `verifier_authority` is outside the enum above; and a `verified` row is
   refused when its `verifier` is blank. The recorded ids are a required
   input of the check, so an id that dangles — one the run's recorded
   evidence list does not contain — cannot close a row. That list is read from
   the same file the run writes, so the check proves internal consistency
   only: it does not prove the evidence exists anywhere outside that file.
2. A ledger **closes** only when no row is `open` or `visible-only`.
3. An **empty ledger reads `unknown`** — no rows is no claim, never "done".
4. **Parity** = verified rows / (all rows − waived rows). `visible-only`,
   `open` and `waived` add nothing to the numerator.

## The check

`./scripts-run src/scripts/reconstruction_ledger --check <file>` reads
`{ "evidence_ids": [...], "obligations": [...] }` and exits 0 on `closed`, 1 on
`open` or `unknown`, 2 on `invalid`, a malformed row (no `evidence` object, no
`required_cases` list, …) or a file it cannot read. A file without
`evidence_ids` is refused rather than read as "no evidence needed".

## Observation providers

A consumer may name runtime, browser, binary or device observation tools it has
configured as MCP servers in `reconstruction.observation_providers` (class C,
default empty). The reference door calls one only through the host's MCP tools
and only while the slot names it; nothing is installed for it.

- **The provider is the verifier, never the authority.** A row it checks
  carries `verifier: provider:<server>` and an authority from the enum above:
  `controlled-replay` when the provider drove the destination with recorded
  inputs, `external-claim` when it only reported what it saw. A provider name
  written as `verifier_authority` is refused like any other value outside the
  enum.
- **Tiers it may verify:** `ux`, `behavior` and `protocol`. A `verified` row
  whose verifier is a provider and whose tier is `byte` or `inspired-by` is
  refused: byte equality needs a byte comparison, not an observation, and
  `inspired-by` promises no behavior to observe.
- **It never lifts `visible-only` on its own.** A screen or screenshot a
  provider captured is still `visible-only`; the row becomes `verified` only
  when every required case carries an observation of the behavior behind it.
- **Absence is a result.** With the slot empty, or a named provider that does
  not answer, the run records `coverage: unknown` for the runtime half and says
  so in one line. That is never read as "observed, nothing found".

## Non-goals

- No proprietary code, assets, keys or data are copied into the destination.
  The [`code-provenance`](../../src/rules/code-provenance.md) rule already
  binds: read, close the source, re-derive, record the borrow.
- No circumvention of access control, licensing checks, DRM or terms that
  forbid reverse engineering.
- A byte-tier claim is not a license to reproduce a protected work.
