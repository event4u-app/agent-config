# Council disposition — negative controls and `docs/CONCEPTS.md` readership

<!-- evidence-type: analysis -->

**Date:** 2026-08-22 · **Members:** 2/2 (anthropic, openai) · **Mode:** `design`,
depth `deep`, blind peer review · **Cost:** $0.1209.

Both blockers of `road-to-governance-vocabulary-and-negative-controls`. Run
under the standing autonomous drain mandate, in which a council decision
substitutes for maintainer sign-off on a descope.

## The measurement that decided Decision 1

The blocker `negative-control-invokability` set its own threshold: *"if more
than roughly 30 % of the gate entries turn out to need real tree state to be
invoked faithfully, stop and record that finding instead of forcing the shape."*

Measured two ways over the 44 enforced entries in `src/config/gate-coverage.yml`,
deliberately, so the conclusion does not rest on one heuristic:

| Detector | Injectable | Needs real tree state |
|---|---|---|
| **Narrow** — explicit `--dir`/`--root` flag, mutable root constant, or exported test seam | 13 of 44 (30 %) | **70 %** |
| **Wide** — the above plus a positional path argument and a root-bearing env var | 20 of 44 (45 %) | **55 %** |

The wide number is the fair one: it caught `lint_handoffs` (positional
skills-dir override) and `check_iron_law_prominence` (positional paths) that the
narrow one missed. **Both cross the threshold, the lower by 25 points.**

## Decision 1 — (b) plus report-only. Both seats, Option 1.

**Do not build the in-memory negative-control mode.** Steps 2.1 and 2.4 close
`[-]` with the measurement recorded. Steps 2.2 and 2.3 ship **strictly as
inventory and gap reporting**.

Seat B, on why not the narrower version: *"running only the injectable minority
under a general 'negative controls' label would overstate assurance."* Seat A
reached the same verdict independently.

**The condition both seats attached, and it is load-bearing:** reporting is
observability, not behavioural proof, and *"must not unblock anything requiring
behavioral validation"*. The implemented report says so in its own output —
`declared, not run` — rather than leaving it to a reader.

**Populations must not be conflated.** Whether a gate can be invoked over an
injected path and whether it carries a `canary:` recipe are different facts. An
earlier draft of the question conflated them; the shipped report keys on recipe
presence only, and the injectability measurement lives here.

### Cadence for the mutating `--canary` path

Change-triggered (on a gate's own change) **plus before release**. A scheduled
run is added only if measurement shows the change-trigger misses relevant
dependencies. Seat B: *"better than 'when someone remembers' because the
triggers are machine-detectable, required by policy, and attributable to an
owner."* Seat A pushed back that change-triggers catch declared changes and not
emergent drift — recorded as the open counter-argument, not resolved.

**A disposable checkout is necessary and insufficient**, and both seats said so
against the roadmap's own framing: a `finally`-revert is cleanup machinery, not
a trust boundary. Canary recipes execute repository-controlled behaviour, so the
boundary includes subprocesses, credentials, network, and symlink/path escape.
Any mutating runner needs a sandbox with minimal credentials and network
disabled by default, plus a kill switch that trips on: a write outside declared
paths, any git or filesystem residue, an unprovable restoration after
interruption, non-determinism across repeated runs at one revision, repeated
timeouts, or undeclared network/credential/host access. **One unexplained dirty
checkout trips it** — restoration is an invariant, not a reliability percentage
(seat B, correcting seat A's proposed 10-run residue rate).

### Dated follow-ups

- **2026-08-29** — publish the full 44-entry cross-tabulation: injectability,
  recipe presence, git dependency, mutation paths, owner.
- **2026-09-05** — record the cadence decision, its trigger calculation, the
  accountable owner, and the downstream milestones report-only explicitly does
  **not** unblock.
- **2026-09-15** — design the isolated real-tree runner and its kill switch. Its
  implementation is a separate decision, never an implied continuation.

## Decision 2 — (b): keep standalone, under a dated two-audit experiment

Seat B: *"folding immediately would discard the requested evidence, but an
undated audit condition can preserve an unused document indefinitely."*

- **2026-08-29** — define a qualifying citation and the audit denominator.
- **2026-09-15** — Audit 1. **2026-10-15** — Audit 2. **2026-10-16** — record the
  disposition. **2026-10-23** — fold, if both audits report zero genuine
  citations *despite relevant citation opportunities*.

**A qualifying citation** is an explicit link or path reference from an
independently authored, user- or agent-facing artefact. Tests, fixtures,
self-references, owner links originating inside `CONCEPTS.md`, and links
inserted solely to satisfy the audit do **not** count.

**The denominator matters as much as the count.** Each audit records how many
documents or changes could reasonably have consulted the vocabulary. *"Zero
citations during zero vocabulary-related work is not evidence of
non-readership."*

**A failing cross-reference test is not a fold trigger.** A moved owner or a
stale line number is a maintenance failure; repair the reference and record the
incident. Fold only when the value no longer justifies the maintenance.

### The flagged ambiguities do NOT inherit this disposition

Both seats: the four terms read two ways ("enforced", "the gate passed",
"delivered", "later vs deferred") are **design debt**, not a documentation
feature. By **2026-10-15** each needs either one canonical meaning propagated to
its owning artefacts, or an explicit rationale for why multiple meanings are
necessary. That is a separate obligation from whether the file is read.

## Two things this record does not claim

- **Why the architecture failed is unexamined.** Seat A asked what the 24 (now
  28) recipe-less gates have in common and whether the injectable minority is
  high-value or merely easy. The cross-tabulation due 2026-08-29 is where that
  gets answered; nothing here answers it.
- **Report-only has a perverse-incentive risk**, named by seat A and not
  mitigated here: a dashboard reading "28 gates unverified" can be fixed,
  descoped, or ignored, and nothing in this change forces the first two.
