---
complexity: lightweight
review_by: 2026-09-19
---

# Stub: road to the scale-history PRIMARY rubric rating

> **Stub — not active work.** Transferred out of
> [`road-to-scale-history-bench-run.md`](../road-to-scale-history-bench-run.md)
> Phase 1 on 2026-08-20 by the drain-run disposition framework
> [`agents/evidence/council/drain-blocker-dispositions-b.md`](../../evidence/council/drain-blocker-dispositions-b.md) <!-- ref-ignore -->
> (blocker `manual-rubric-rater`, disposition **B** — outcome `transferred`).
> Council rationale, verbatim: *"Viewing automated scores first would
> irreversibly violate the preregistered anti-anchor ordering."*
>
> Phase 1 was never started, and not on effort. The **instrument is finished
> and verified runnable** (§ What already works); what is missing is a human
> being who rates 96 artifacts blind. Nothing here is half-shipped and nothing
> was rejected on merit.

## Why an agent cannot close this, restated so nobody re-tries it

The pre-registration makes the manual rubric the **PRIMARY** defect count and
`lint_persistence` merely **SECONDARY**
(`internal/bench/corpora/scale-history-PREREG.md:63-69`), and the rubric's own
first lines make the ordering binding: *"The rater never sees
`lint_persistence` output before scoring (anti-anchor)"*
(`internal/bench/scale-history/rubric.md:3-4`).

An agent that produced the artifacts cannot be the blind rater of them — that
is the self-preference substitution `evaluator-independence` exists to forbid,
and the same refusal `road-to-council-blind-review` records for its own blind
readings. The result would not be weaker; it would be **uncitable**, and the
pre-registration would be broken irreversibly rather than merely unmet.

Two corollaries that are easy to get wrong:

1. **An AI rater is not a degraded rater, it is a void result.** Substituting
   one does not lower confidence, it removes the number's standing entirely.
2. **The ordering proof travels with the rating.** A proof about an ordering
   nobody produced is not a deliverable. There is no partial credit available
   here: with no rating, there is nothing for a timestamp to order.

## Transferred work — quoted as it stood

Phase 1, verbatim from `road-to-scale-history-bench-run.md` at the transfer
commit. Step 1's **scoring** half and Step 2 in full are moved; step 1's
*producing* half is not transferred and is discussed under § What already works.

- **Step 1** — "**Fire the paid run** once benchmark-spend-authorization
  clears: arms A/B/C per the prereg, artifacts written under
  `internal/bench/scale-history/artifacts/` (confinement root), manual rubric
  scored blind BEFORE `score.ts` output is viewed."
  *Verify:* "per-family results in `internal/bench/reports/`; thresholds
  evaluated exactly as registered (no post-hoc α)."
- **Step 2** — "**Publish verdict + claims-ledger entry**: lift claim only if
  the registered thresholds clear; otherwise honest null in the house format,
  packs stay default-off, follow-up re-scope recorded."
  *Verify:* "claims ledger entry matches the published report; R-A8
  over-application guardrail (>20% distractor queueing = pack design finding)
  reported either way."

## Resolved-when criterion, verbatim

From the `manual-rubric-rater` blocker as authored 2026-08-14:

> **Resolved when:** a human rubric score exists per artifact, recorded before
> the secondary `lint_persistence` pass for that artifact.

## Re-entry producer and detection probes

Promotion is **not** "when someone rates it". Three named preconditions, each
with a probe that returns a decidable answer, all three measured at the
transfer commit.

**A structural caveat on the probes, stated because it would otherwise rot:**
the artifact root is gitignored (`.gitignore:314` —
`/internal/bench/scale-history/artifacts/`), so P1 and P3 are **bench-machine
checks, not tree checks**. A reader of this repository cannot run them and get
a meaningful answer; only the operator of the machine that fired the sweep can.
P2 is the only one decidable from the tree.

| # | Precondition | Producer — who makes it true | Detection probe | Measured 2026-08-20 |
|---|---|---|---|---|
| P1 | The 96 artifacts exist, non-errored, at the registered shape | The bench-machine operator firing `run.ts --live --all --resume` (grant already given, see § Spend) | `internal/bench/scale-history/artifacts/manifest.json` lists 96 cells (2 families × 3 arms × N=16) with `errored: false` | **FAIL** — the artifact root does not exist in this tree at all; `--dry` produces it, no live sweep is recorded |
| P2 | A **named** independent human rater is assigned | The maintainer writing a name into the Rater field below — not "a human", which names nobody | This stub's `Rater:` line names a person and a date they accepted | **FAIL** — `Rater: (unassigned)` |
| P3 | Every rubric score predates the `score.ts` output for the same artifact | The named rater from P2, in ONE sitting, before `run.ts --score` is ever invoked | Immutable timestamps: every rated row in `artifacts/rating-workbook.md` carries a completion time earlier than the `mtime` of that artifact's `score.ts` output; `run.ts --score` itself refuses to run before the workbook exists (`run.ts:907-913`) | **FAIL** — 0 rated rows, 0 score outputs; vacuous, not passing |

`Rater:` (unassigned)

P1 is machine work the operator can start today. P2 and P3 need a person, and
P3 additionally needs P2 to have happened first. **Promoting on P1 alone is the
failure this stub exists to prevent**: 96 artifacts nobody rates is the
"spending the grant on a run nobody reads" outcome the parent roadmap's own
spend blocker warns about.

## What already works — verified, not assumed

The half that is finished is the instrument, and it is worth recording exactly
so a future session does not rebuild it. Verified in this tree at the transfer
commit, by running it:

- `internal/bench/scale-history/run.ts --dry --all --n 1` completes all six
  cells and writes `artifacts/manifest.json` plus
  `artifacts/rating-workbook.md`.
- The workbook is a genuine blind instrument: artifacts are listed under opaque
  `art-NNN` ids in a seeded shuffle, the paths are label-free blind copies, the
  rubric is reproduced inline so the rater never opens another file, and the
  arm/family mapping is written to a separate `rating-key.md` headed *"do NOT
  open before rating is complete"*.
- The anti-anchor ordering is enforced by the tooling, not just documented:
  with the workbook removed, `run.ts --score` prints *"refused: no
  rating-workbook.md — the manual rubric is PRIMARY and runs first"*.
- `run.ts --estimate --n 16` renders the registered shape — 96 cells, 224 max
  invocations — and deliberately prints **no** USD projection without a
  recorded live run, on the stated ground that a list-price multiplication in a
  cost sheet is worse than an absent number.

Full record: [`agents/evidence/analysis/scale-history-harness-runnability.md`](../../evidence/analysis/scale-history-harness-runnability.md).

## Spend — already granted, not a gate

The `benchmark-spend-authorization` blocker in the parent roadmap is
**resolved**: the run budget was granted in-session on 2026-08-14 at the
pre-registered shape, and the parent records the measured cost sheet as
**$22–50 and ~4.6 h** for the full 224 invocations, anchored on real runs
rather than list price. `codex-family-auth` is likewise resolved — both
required families are proven live end-to-end.

So this stub is **not** spend-blocked and **not** auth-blocked. It is rater-
blocked, which is the misreading the parent's own Surfaced note was written to
prevent. Do not re-ask the spend question.

One thing the grant does not lift: firing the sweep is a paid, externally
visible action, so under `non-destructive-by-default` it still needs its own
this-turn approval at the moment a session fires it. A standing roadmap grant
is not that approval — exactly as it would not be inside the parent roadmap.

## Seed content on promotion

- P1 first: `run.ts --live --all --resume` on the bench machine, with the
  cost sheet re-rendered from `--estimate` after the first live cell.
- Then the named rater from P2 rates the whole workbook in **one sitting**. A
  sitting split across days is the likeliest way to void the result without
  noticing, because the anti-anchor ordering is per-artifact and irreversible.
- Only then `run.ts --score`, and only then the Step-2 verdict: lift claim if
  and only if the registered thresholds clear at α = 0.01, otherwise the honest
  null in the house format with the packs staying default-off.
- Either way, both registered guardrails get reported: the cross-family
  regression guard and the >20% over-application finding against R-A8.

## What does NOT apply to this stub

The **Promotion criteria (shared)** in `README.md` — recruited customer, funded
security audit, maintainer ADR lifting a Hard-Floor item — govern the six
org-mode stubs. They do not govern this one: it is a drain-run transfer of an
internal measurement that introduces no product surface and needs no customer.
Its gates are P1-P3 above and nothing else.
