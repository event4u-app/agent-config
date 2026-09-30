# UI port-losses fixture — three planted losses and one faithful arm

Phase 1 of `road-to-a-ui-coverage-ledger-that-can-fail`. Fixture id
`daf-port-losses` in [`../../eval-fixtures.md`](../../eval-fixtures.md).

Three gates inside `work_engine/directives/ui/apply.ts` accept the case they
exist to catch. This directory is the instrument that says so with a number
instead of an argument, and it exists **before** the fixes so the before-count
is a pre-registration rather than a retrofit.

The subject is narrow and worth stating plainly: a coverage ledger reports what
the porter *said* it did. Every one of the three defects is a place where the
gate reads the porter's own report and calls it evidence — a bucket entry that
merely contains the item's name, an empty gap list standing in for work done,
and a rendered map standing in for the files on disk. A ledger that reads only
the report cannot fail on a report that is wrong about itself.

## Layout

| File | What it is |
|---|---|
| `_artifact.json` | The declared inventory every arm is scored against — three interactions, one keyframe, one asset. |
| `S-a-substring-collision.json` | Planted loss: one declared item accounted for only by a substring collision. |
| `S-b-all-flagged.json` | Planted loss: every declared item handed back in `flagged`. |
| `S-c-placeholder-in-file.json` | Planted loss: a placeholder in a written file that `rendered` does not repeat. |
| `faithful.json` | **No planted loss.** The false-positive meter. |
| `written/` | The real files the S-c and faithful arms name in `ui_apply.files`. |
| `probe.ts` | Scores the arms and prints `caught N of 3`. |

Each planted loss names itself in a `_planted` field, and the S-c written file
carries an HTML comment at the planted line, so a later reader can tell a
planted defect from a bug in the fixture. Content is invented throughout — a
release-notes panel, no project or company material.

## The three planted losses

| id | Loss | The gate that should catch it | Why it does not today |
|---|---|---|---|
| S-a | The declared interaction `tab` is in no bucket. Its only match is inside the unrelated entry `table sort order — honoured`. | `coverage_gaps` (`apply.ts:190`) | Matching is substring containment, and `"table sort order".includes("tab")` is true. |
| S-b | All five declared items sit in `flagged`. The port carried nothing. | the `run` outcome (`apply.ts:129`) | `coverage_gaps` is empty, and emptiness is the whole of what the outcome reads. |
| S-c | A written file contains `Lorem ipsum`; `ui_apply.rendered` does not. | the placeholder scan (`apply.ts:268`) | The scan reads `envelope['rendered']` — the porter's report — not the files. |

And one arm that is **not** a loss:

| id | Arm | Expected |
|---|---|---|
| `faithful` | Every declared item named exactly once, clean report, clean file. | **Zero findings, before and after.** A run that reports this has failed the fixture exactly as badly as one that misses a planted loss. |

## Pre-registered catch count

> **Registered 2026-09-29, before any gate changed**, in the same commit that
> first adds this directory, so the first-add ancestry is checkable with
> `git log --diff-filter=A -- tests/design-artifacts/fixtures/ui-port-losses/`.
> If a later run disagrees with this number, the disagreement is the finding.

```
$ npx tsx tests/design-artifacts/fixtures/ui-port-losses/probe.ts
S-a  MISS   outcome=success
S-b  MISS   outcome=success
S-c  MISS   outcome=success
caught 0 of 3
faithful arm: 0 false red(s), outcome=success
```

**caught 0 of 3.** All three arms return `success` — not a weak signal, no
signal: the operator is told the port succeeded in every one of the three
cases the gates are described as covering.

**What this pre-registration does not license.** It is a measurement of *this
fixture*, whose three losses were chosen because three specific lines were
already known to be wrong. It is not an estimate of how often real ports lose
things, and no such rate is claimed anywhere from it. Risk 3 in the roadmap's
register is exactly this: a fixture built to demonstrate three known defects
will demonstrate them. What the number buys is that an unchanged count after
the fixes would be a finding rather than a silent pass.

## After the three fixes — measured against the pre-registered number

Same command, same arms, same catch predicates. The predicates were written in
Phase 1 to be satisfiable by either implementation precisely so these two
numbers are comparable rather than merely adjacent.

| Run | Command | Result | Faithful arm |
|---|---|---|---|
| Before, registered 2026-09-29 | `npx tsx tests/design-artifacts/fixtures/ui-port-losses/probe.ts` | `caught 0 of 3` | `0 false red(s), outcome=success` |
| After, measured 2026-09-30 | `npx tsx tests/design-artifacts/fixtures/ui-port-losses/probe.ts` | `caught 3 of 3` | `0 false red(s), outcome=success` |

```
$ npx tsx tests/design-artifacts/fixtures/ui-port-losses/probe.ts
S-a  CATCH  outcome=blocked
S-b  CATCH  outcome=success
S-c  CATCH  outcome=blocked
caught 3 of 3
faithful arm: 0 false red(s), outcome=success
```

**0 → 3 of 3, with zero false reds on the faithful arm.** Each planted loss now
reaches the operator: S-a and S-c as a `blocked` halt naming the item and the
file, S-b as the shadow line on an otherwise successful port.

**S-b's row is measured at the shadow state, and the number is invariant under
the pending flip.** Phase 3.2 — the flip from `SUCCESS` to a non-success
outcome — has not landed; it waits on a release carrying 3.1. That does not
make the after-number provisional, and the claim is measured rather than
argued: the flip was simulated locally (`_handed_back_line` non-null returning
`Outcome.PARTIAL` with a question) and the identical command was re-run. The
count and the false-red count are unchanged — `caught 3 of 3`,
`0 false red(s)` — and the only difference anywhere in the output is S-b's
outcome column reading `partial` instead of `success`. The probe asks whether
the loss reached the operator, not which value carried it, so the flip moves
the column and not the score. The simulation was reverted; `apply.ts` at this
commit is the shadow implementation.

## The faithful arm's verdict — a null would have been an outcome

Phase 5.2 of the roadmap holds the flip hostage to this arm: *if the faithful
arm raises a red that the before-run did not, that is the finding and Phase 3.2
does not flip.*

**Verdict: no null. The `faithful` arm raises zero findings after all three
changes** — `0 false red(s), outcome=success`, identical to the before-run's
`0 false red(s), outcome=success`, and identical again under the simulated
3.2 flip. No red appeared that the before-run did not have, on any of the three
measurements. The gates therefore tightened on the three planted losses without
tightening on the arm that has nothing planted in it, which is the whole of
what this arm was built to detect. Phase 3.2 is clear to flip on this criterion
and is held only by its release window.

Stated so it cannot be read as a stronger result than it is: this is one
faithful arm, not a false-positive rate. Risk 4 in the roadmap's register names
the residual — a placeholder scan over written files could still halt a correct
port at a scale this fixture does not reach.

## Corrected from reproduction

The roadmap specifies S-a as "`nav` covered by `canvas`". That does not
reproduce: `"canvas".includes("nav")` is **false** — `canvas` contains `can`,
`anv`, `nva`, `vas`, and no `nav`. Written as specified, S-a would have been a
genuine gap that today's containment matching already catches, and the arm
would have measured nothing. The collision used here is `tab` inside
`table sort order`, verified in the test rather than asserted in prose, so the
next reader does not have to take the substring relation on trust.
