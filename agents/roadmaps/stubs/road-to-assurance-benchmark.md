---
complexity: lightweight
review_by: 2026-09-25
---

# Road to an assurance benchmark — stub

> **Class:** drain-run transfer. Created 2026-08-23 by the closure run of
> [`road-to-agentic-engineering-assurance`](../archive/road-to-agentic-engineering-assurance.md),
> whose Phase 8 this file carries in full. **Capability-gated, not demand-gated:**
> the scope decision is already taken and the work is wanted; what is missing is
> an input no repository automation supplies. The shared promotion criteria in
> [`README.md`](README.md) — recruited customer, funded security audit, ADR
> sign-off — do **not** govern it. It is promoted by its own probe below returning
> true, and nothing else.

> **Naming.** The parent's own § Suggested child-roadmap boundaries names this
> child `road-to-assurance-benchmark`, and the stub directory's files are all
> `road-to-*.md`; the council's suggested filename
> (`assurance-evaluation-successor.md`) is not followed, and the deviation is
> recorded here rather than taken silently.

## What transferred, verbatim from the parent

Parent Phase 8, all five steps. Each was `[-]` in the parent against the verdict
`transferred`, with this file named as the destination.

- **8.1 Build a frozen benchmark corpus across risk classes.** Include known
  bugs, weak tests, architectural violations, security mistakes, legacy debt and
  false-positive traps.
  *verify:* corpus and scoring criteria are committed before policy tuning.
- **8.2 Measure false confidence, not only catch rate.** Track cases where the
  system said `verified` and a seeded defect survived.
  *verify:* false-verified rate is a first-class metric.
- **8.3 Measure cost and latency by assurance capability.**
  *verify:* report deterministic-tool runtime, model-call count and incremental
  wall-clock contribution separately.
- **8.4 Run ablations.** Compare baseline against: risk policy only · risk +
  bootstrap · risk + independent review · risk + mutation sensitivity · full
  assurance composition.
  *verify:* no expensive mechanism becomes default unless it shows incremental
  signal over the cheaper stack on the frozen corpus.
- **8.5 Tighten only supported policies.** An attractive mechanism with null
  incremental signal is parked, not institutionalized.
  *verify:* every blocking policy cites a benchmark/evidence artifact that
  predates enforcement.

## Why it could not run in the closure drain

Three of 8.4's five ablation arms **do not exist to be ablated**, which is the
sharpest reason and the one that makes waiting correct rather than merely
convenient:

| Arm | State at transfer |
|---|---|
| risk policy only | no policy resolver — the parent's 2.3 is `already-cancelled-measured`; `src/config/assurance-policy.json` <!-- ref-ignore --> does not exist |
| risk + bootstrap | no bootstrap — transferred to [`road-to-target-project-bootstrap-enforce.md`](road-to-target-project-bootstrap-enforce.md) |
| risk + mutation sensitivity | no mutation run — the parent's 3.5 transferred the adapter; the grader detects config presence and never executes a pass |
| risk + independent review | exists, `degraded` (single-member) |
| full assurance composition | not composable while three arms are absent |

And 8.1's corpus needs seeded defects across risk classes in real target
repositories plus a labeller independent of the harness. The neighbouring
requirement is already on record as unobtainable by an agent: the archived
`road-to-target-project-assurance-readiness`'s `blocker: b-human-risk-corpus`
asks for ">= 60 independently human-labelled R0-R3 changes, the labeller blind
to the classifier" and a named external target repository.

## Promotion probe — the only thing that promotes this file

```
PROMOTE WHEN, AND ONLY WHEN, ALL THREE ARE TRUE:
  1. A named external target repository is available as corpus material.
  2. At least TWO of 8.4's five ablation arms exist and are runnable.
  3. An independent labeller is available for the false-positive arm, OR 8.5's
     first blocking policy asserts a hard safety property and is therefore
     exempt from `defect_catch_uplift` per the pre-registration.
```

Condition 2 is deliberately two arms rather than all five: an ablation with one
arm is a measurement of nothing, and waiting for five would make this file
unpromotable until every transferred sibling has landed.

Promote **per item**, not per file — delete a bullet when its work lands
elsewhere, and delete this file when the last one is gone.

## What already shipped so this transfer is not a silent drop

`src/config/assurance-threshold-budget.json` — the pre-registration. All four
dimensions declared with `threshold: null`, `measurement: null`, a `set_when`
clause naming the specific run that will produce each number, and
`blocks_enforcement: true`. So the honest part of Phase 8.5 holds **today**,
before any of the above exists: a policy proposed after the registration cutoff
is governed by these thresholds even while they are null, and cannot adopt
blocking enforcement until the applicable ones are set. Its
`dimension_applicability` section keys governance to observable policy
characteristics rather than author claims, so the four nulls cannot congeal into
a universal minimum — the vanity constant the parent's AC-8 forbids.

**First step on promotion**, named so it is not rediscovered: implement the
enforcement gate the pre-registration promises but deliberately does not ship.
It was deferred because committing untested CI automation with no policy proposal
to test it against is how a defect is found on the critical path — and because in
this repository a new gate script trips three ratchets and a gate that scans an
empty corpus exits green, which would make it worse than absent.

## Not in scope

Building any of the mechanisms being ablated — each has its own owner. A second
grader or any aggregate readiness score: refused by both council seats at the
parent's closure, and forbidden by the parent's AC-2 and AC-8.
