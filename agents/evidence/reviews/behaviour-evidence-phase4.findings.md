# Completion review — the screenshot blocker, executed rather than trusted

**Skipped:** no code surface for this completion — one roadmap blocker entry amended with the result of executing its own `Resolved when` condition, a correction to a premise its cited source contradicts, and the record of an escalating council split; the validator reports 0 code path(s) of 1 changed file(s), scope 849622c21f6bbc21344429620ab1999084dc7a6d2a21f2acbc1a13ba9ee67fb6, declared 2026-09-19

## What this change is, and why R2 has nothing to bind to

The single changed file is a roadmap. No source file, no test, no generated
projection and no configuration moved. The three open checkboxes are still open
and still carry their original glyphs; `Status`, `Class` and `Resolved when` are
byte-unchanged on purpose, because amending any of them would decide the question
this change escalates.

An R2 reviewer over this diff would be reading one prose block inside
`## Blockers`. That is the shape § 2.4 names.

## What a reviewer WOULD have caught, recorded here rather than hidden

Three things, none of them visible in the diff.

**1. The claim that the bar was cleared is quoted in two places and was verified
in neither.** `docs/CLAIMS.md` asserts it in a resolution field and the fixture
README fixes the threshold, but a reader taking either at face value inherits a
second-hand reading. It was re-run instead:
`npx vitest run tests/scripts/ui_conformance_probe.test.ts`, 12 of 12 green,
including the live re-capture that matches the committed observations. The four
load-bearing assertions pass by name, and one of them is the sensitivity control
— the suite removes the declaration and asserts the suppressed finding returns,
so the zero is suppression rather than absence. Without that control a probe that
found nothing at all would have scored identically.

**2. The blocker's premise was false, and the blocker itself told the reader
where to check.** It instructed a reader to open
`agents/roadmaps/archive/road-to-visual-review-loop.md`. Opening it refutes the
sentence that cites it: that roadmap names two objective signals rather than one,
states in terms that a11y is the lever and not the screenshot, and scopes the
screenshot to presence plus sanity rather than pixel-perfect regression. A
completion that had trusted the entry's summary of its own source would have
reasoned from a premise the tree does not support, in either direction.

**3. A plausible second piece of work was proposed, tested, and turned out not to
exist.** The Phase 4 blockquote establishes that `scanOpenSteps` reads blockedness
from the inline marker alone, and AC-6 carries no marker — which suggests the
marker sweep missed it and the continuation concern would re-engage on it.
Measured rather than assumed, by importing the real function and running it over
the real file: `{ open: 0, blocked: 2, next: null }`. `phaseLines` already excludes
`## Acceptance Criteria`, so the second parser is not the one with the defect and
AC-6 needs no marker. The change that was not made is recorded because the
argument for making it was good and only the measurement refuted it.

## The gap this skip does not paper over

The routing question is unresolved and is meant to be. An AI council split 1 to 1
on it; under `decision-revisit-gate` a split escalates rather than deciding, so
the roadmap stays `blocked` on a maintainer ruling and Phase 4 is untouched. The
two readings and the three preservation questions any Phase 4 specification must
answer are written into the blocker so the ruling can be made against the tree
rather than against a summary of it.
