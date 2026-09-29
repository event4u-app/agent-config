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

## Corrected from reproduction

The roadmap specifies S-a as "`nav` covered by `canvas`". That does not
reproduce: `"canvas".includes("nav")` is **false** — `canvas` contains `can`,
`anv`, `nva`, `vas`, and no `nav`. Written as specified, S-a would have been a
genuine gap that today's containment matching already catches, and the arm
would have measured nothing. The collision used here is `tab` inside
`table sort order`, verified in the test rather than asserted in prose, so the
next reader does not have to take the substring relation on trust.
