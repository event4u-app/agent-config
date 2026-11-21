<!-- evidence-type: analysis -->

<!-- The prompt given to the council on 2026-11-21 for step 2.1 of
     road-to-review-loops-that-converge, committed verbatim beside the record. -->

# Who decides these two review-loop questions: the council or the owner?

A repository that ships rules, skills and hooks for AI coding agents gates
changes to its own rules with a council ratification: two model seats review a
change round after round until both agree. Its decision-revisit rule routes a
proposed change to the council by default and reserves it to the owner when the
transition does any of the following:

| Reserved to the owner | Council-decidable |
|---|---|
| Changes the project's purpose or a declared non-negotiable outcome | Any mechanism serving that purpose |
| Lowers or removes a recorded security / privacy / safety / data-handling floor | Strengthening a floor, or an equivalent swap above it |
| Irreversible or materially destructive | Reversible within the envelope |
| Spend or liability above a delegated threshold | Budgeted, threshold-bounded spend |
| Creates / removes / weakens a legal, regulatory, contractual, licensing, compatibility or public commitment | Internal-only commitments |
| Governance self-amendment — reopening authority, quorum, escalation, this set | What the rules already permit |
| Cannot be bounded from available evidence | Bounded, with the evidence cited |

Its authority decision (ADR-268 § 4) says: the party gaining an authority is
never the party recording the ratification, and the ladder reaches the owner
"only on non-convergence", a term it never defines across rounds.

## Evidence

A replay of every historical loop of five or more rounds (61 loops; 26 carry
per-round severity) under an advisory convergence criterion — stop at the first
round whose trailing three rounds read `stalled` (no new high/critical finding
outside fix-introduced, but new findings do not fall) or `diverging` (new
findings strictly increase):

| Option | Loops stopped | Rounds that would not have run | High/critical findings raised after the stop | of them not fix-introduced |
|---|---:|---:|---:|---:|
| fixed cap at 3 rounds | 26 of 26 | 270 | 101 | 68 |
| fixed cap at 5 rounds | 23 of 26 | 218 | 73 | 48 |
| convergence criterion | 18 of 26 | 165 | 35 | 21 |
| no binding stop | 0 | 0 | 0 | 0 |

Today loops run to 30-56 rounds. A refused ratification leaves CI red; the only
owner path is a forge bypass plus a bypass record.

## The two questions

**Q1 — binding stop.** Should a ratification loop become *refused* past a stop
(cap at 3, cap at 5, the convergence criterion, or no binding stop), with every
open high/critical finding listed for the owner and none closed?

**Q2 — owner override in CI.** Should an owner-written record under
`agents/evidence/owner-directives/`, naming the subject digest, turn the
ratification gate green — (a) always, (b) only after a recorded `stalled` or
`diverging` verdict or a refused final round, or (c) never, keeping the forge
bypass?

## What to answer

For each question separately:

1. `DECIDE` (the council may settle it) or `ESCALATE` (it is owner-reserved),
   naming the table row(s) that decide the routing.
2. If `DECIDE`: the option and the reason. If `ESCALATE`: the option you would
   recommend to the owner, and the single fact that would most change it.
