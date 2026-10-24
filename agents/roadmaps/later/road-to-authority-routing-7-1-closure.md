---
complexity: structural
status: later
review_by: 2027-01-24
entry_condition:
  what: "a consumer needs the promoted 7.1 ledger rather than the provisional classes in src/config/live-tree-check-classes.json — Phase 8 activation of a live-tree check as a required gate, or a class change that the provisional file cannot carry; or the owner chooses to spend the renewal now"
  when: "no date is promised; reviewed by 2027-01-24"
  who: "the maintainer runs the renewal; review by risk (owner directive 2026-10-24): one reviewer, and the council only if the renewal is classified release- or security-relevant"
relates:
  - slug: road-to-authority-routing-mechanism
    relation: extends
    note: "Parent. Step 7.1 was moved here on 2026-10-24 by the owner's throughput directive; the parent keeps a short pointer, 7.2 proceeds on the provisional classes, and decisions D25–D49 stay in the parent's Decisions table."
estate_growth_exempt: "+1 later_roadmaps. This file is the parent's step 7.1 moved out of the active roadmap under the owner directive of 2026-10-24 (park 7.1, continue 7.2). It relocates open work rather than creating it — the parent's open count drops by the same step — but it is a new file rather than a whole roadmap moved into later/, which is the only case the automatic parking allowance covers."
---

# Road to closing step 7.1 — promote the live-tree check classification

> The classification ledger for the 16 live-tree checks exists, derives every
> aspect's class from structured fields, and implements the council's closed
> renewal bar (A1–A8). What it lacks is a promoted, attested pin set. Until it
> has one, 7.2 runs on a provisional copy of its classes.

## Why this is parked

Rounds 21–29 on 2026-10-24 tightened the ledger revision by revision, and the
council fixed a closed bar (D49). Three renewal attempts in a row each drew a new
set of requirements. The owner then directed throughput over ceremony: park 7.1,
let 7.2 proceed on a provisional default marked revisable, and use the council
only for irreversible, release- or security-relevant decisions.

## The one open step

- [ ] **7.1 Promote the classification ledger.**
  1. Renew the whole pin set in one candidate commit: blob pins, the ledger
     table, the helper closure and the attested-set line.
  2. Run `node agents/evidence/analysis/gate-renewal-suite.mjs --candidate HEAD`
     clean on that commit.
  3. Have the renewal reviewed at the level its risk warrants, then record the
     promotion line it prints.
  4. Regenerate `src/config/live-tree-check-classes.json` from the promoted
     ledger and drop its `provisional` flag.

  verify: `node agents/evidence/analysis/gate-ledger-reconcile.mjs --status` -> 0

## History — step 7.1 as it stood in the parent roadmap

**7.1 as it stood when parked — Run the council to classify each live-tree measurement check.**
**Round run 2026-10-10 — 13 of 16 classified identically by both seats,
3 honest abstentions, and BOTH SEATS WITHHOLD GREENLIGHT on the step. It
therefore stays open.** The population was measured rather than recalled:
every `check_*`/`lint_*` run against a clean `origin/main` worktree, the
first sweep DISCARDED (macOS ships no `timeout(1)`, so exit 127 on all
~300 meant nothing had run), two controls used to prove the harness, then
the projections built — which moved three checks green and identified them
as worktree artefacts. Ten more were excluded as called-wrong (a usage
line) and eight as build-order reds. **16 are genuinely red on the trunk.**
Verdict: **1 governed snapshot** (`check_gate_completeness`, 237 against a
baseline of 214), **12 invariants**, **3 unclassified**
(`check_council_layout`, `check_knowledge_cards`, `check_composite_arming`),
**zero tolerances and zero observations** — a tolerance needs a stated
bound AND a named party accepting the risk, and none has either.
**Why it does not close:** both seats refuse to let a check's semantics be
derived from its observed failure, because that grants the classifier
discretion exactly when a red trunk creates pressure to weaken enforcement.
They want a stable per-check contract first. Two findings neither was asked
for: the step's own taxonomy contradicts the record (*"refresh clearly
observational data"* vs observations being the NON-refreshable class), and
classification is not gate membership — a decision this round did not take.
Record: `agents/evidence/council/live-tree-check-classification-20261010.md`
and its `.question.md`.
**Screened 2026-10-12 and deliberately NOT re-run.** What the seats asked
for is named in D14's own `revisit if`: a per-check contract registry from
which class, prerequisites, gate membership and refresh authority derive
mechanically. No such registry exists in the tree, so a second round would
put the same question to the same seats with no new substance behind it —
verdict shopping under `evaluator-independence`, not rigour. The registry
is the work this step is actually waiting on, it is larger than a step of
this phase, and it is named here rather than built so that the next run
sees a stated prerequisite instead of an open box that looks runnable.
**Re-screened 2026-10-13 against the tree, and the prerequisite is now
LOCATED rather than merely absent.** `src/config/gate-coverage.yml` is a
per-check registry that already exists and is already CI-enforced: 113
rows keyed by script stem, each carrying `argv`, `min_scanned`, `corpus`,
`status`, and optionally `ci_invocation` and `canary`. All four Phase 7
checks the round named — `check_gate_completeness` and the three
unclassified ones — resolve against it, and `check_gate_completeness`
carries a row (`min_scanned: 180`, corpus stated, `status: enforced`).
What it does NOT carry is the four fields D14's `revisit if` asks for:
class, prerequisites, gate membership and refresh authority. So the
prerequisite is not "build a registry from nothing" — it is **four fields
on an existing one**, plus the honest denominator problem that file
already states about itself: 113 of 354 gate scripts, 31.9 %, so a class
field added there would classify under a third of the population and the
round's own 16 would need the rest of the rows first. That is the shape of
the work, and naming it is what this screen adds over the previous one.
**Re-screened 2026-10-13 by running the greps rather than reading the
screen above, and two of its claims do not hold (D21).** *"All four Phase 7
checks the round named resolve against it"* is **one of four**:
`check_gate_completeness` has a row at line 820, and
`check_council_layout`, `check_knowledge_cards` and `check_composite_arming`
— the three abstentions D14's `revisit if` names first — have none. Across
all 16 checks the round classified, **2 have rows**, not 16. So the
prerequisite is four new fields **and fourteen new rows**, which is a
different size of job from the one the previous screen costed. **What the
re-screen adds beyond the correction** is a test of the phrase the
prerequisite actually turns on — `derive mechanically`. A registry in which
an author types `class: invariant` is 354 assertions with a schema around
them, and it reinstates the discretion both seats refused. One candidate
derivation was measured and **refuted**: *reads a committed baseline ->
snapshot* produced four counter-examples, and reading the hits rather than
counting them left exactly two checks that read a committed baseline — one
snapshot and one invariant. What survived is the repaired predicate: a
baseline that can move in the **permissive** direction is a governed
snapshot; no baseline, or a shrink-only one, is an invariant. It separates
16 of 16 here, it was repaired after seeing its counter-examples so that is
a fit rather than a prediction, and it derives ONE of D14's four fields.
Measurement: `agents/evidence/analysis/gate-class-derivation-20261013.md`.
**The predicate was then put to the council the same day, and BOTH SEATS
PLUS THE CHAIRMAN WITHHELD GREENLIGHT AGAIN — the step stays open (D22).**
The round defines a mechanism to satisfy D14's revisit condition; it does
not satisfy it. The predicate is **not** an acceptable derivation: it
reaches 2 of 4 classes, *"permissive"* is a semantic reading rather than a
fact, and it was fitted after seeing its own counter-examples. The seats
audited the asking agent's measurement before answering and found the
overclaim named above; it was corrected to 13/16 in the same change. The
four fields belong in a **separate `gate-classification.yml`**, because a
`min_scanned` bump must not travel the same approval surface as
`class: invariant -> snapshot`. The still-required list is in D22, and its
order is load-bearing — schema, baseline contracts, all 16 registered,
rollback criteria, and only then may a class change anything. Record:
`agents/evidence/council/gate-contract-registry-shape-20261013.md`.
**Re-measured 2026-10-17 on `6abb887d7`, still open (D23).** 9 of the 16
are green now and 7 stay red. That includes two of the three abstentions,
but a green says nothing about what a check means, so it resolves neither
abstention. No item on D22's still-required list has landed. No council
round was run, because the inputs D22 named have not changed.
Measurement: `agents/evidence/analysis/live-tree-check-remeasure-20261017.md`.
**Screened 2026-10-18 on `6194e2769`, still open, no round run.** AC-3
does not put Phase 7 behind the blocked Phases 2, 3 or 6. Its only
ordering clause is that Phase 7 must come before live-tree checks are
restored as required gates. So the step is not held by
`external-bootstrap-boundary-for-phases-2-3`. It is held by D22's ordered
list, and the first item on that list has not landed:
`git ls-files src/config | grep -c gate-classification` returns 0. That
first item, the schema, cannot be written yet. It needs the TWO-objects
taxonomy choice D22 left open (multi-valued class, aspect-level rows, or
splitting the check), and that is a design question. No active or stub
roadmap owns D22's list: `grep -rl gate-classification agents/roadmaps`
matches only this file. Re-running 7.1 without it would be the verdict
shopping the 2026-10-12 screen ruled out. 7.2 follows from 7.1, and its
demotions weaken gates, so it does not start either.
**Round run 2026-10-19 on the design question the 2026-10-18 screen
named, and the step stays open (D24).** This was not a second 7.1 round.
It put the two questions D22 left open to the seats directly: the
TWO-objects taxonomy shape, and what *derive mechanically* meant. Both
converge on **aspect-level rows** with one class per aspect and **no fifth
class**. Missing evidence is an evaluation state, and a freshness window
is an invariant with a time qualifier. Both also say the phrase *derive
mechanically* should be **retired** in favour of computed / governed
assertion / observed. And both answer **no** to writing the schema now.
The aggregation truth table and the rollback policy decide which fields
the schema needs, so they come before it, not after. That reverses D22's
order. So the first item owed is now the truth table, with its two
undecided cells (*snapshot below baseline*, *snapshot unavailable*). No
schema file lands. Record:
`agents/evidence/council/gate-classification-taxonomy-20261019.md` and
its `.question.md`.
**Drafted 2026-10-21 on `a2aa408ab`: D24's first owed item, the truth
table, plus its second item, rollback and activation boundaries. Put to
the council twice, and both rounds returned 0/2 present. The step stays
open.** The draft was written against behaviour the code already has,
read first. `checkRatchet` already has five states, and `improved`
passes today. A missing baseline throws against a target ref, but in the
working tree it falls back to an empty ratchet. And one finding reaches
past the table. **An exit code cannot carry an aspect result.**
`check_composite_arming` exits 1 both for a violation and for a missing
evidence store. `check_trigger_evals` exits 1 both for a stale stamp and
for an invalid set. So whatever evaluates the table needs structured
per-aspect output, and exit codes will not do. Each of the two undecided
cells carries a proposal and an alternative. Neither is a decision.
Round attempt 1: anthropic `exit_1`, openai timed out. Attempt 2: both
timed out. That is no verdict in either direction, and it was not tried
a third time against the same outage. The unchanged question file is
owed to the next round. Draft:
`agents/evidence/analysis/gate-aggregation-truth-table-20261021.md`.
No-quorum record and prompt:
`agents/evidence/council/gate-aggregation-truth-table-20261021.md` and
its `.question.md`.
**Round run 2026-10-24 on that unchanged question file, 2/2 present, and
BOTH SEATS SAY NO to fixtures and to a schema draft. The step stays open
(D25).** This is the first answered round on the 2026-10-21 question, not
a re-run of an answered one. The seats keep *any enforcing aspect blocks*
(openai) or leave it standing (anthropic), and they converge on Cell B:
block once authoritative, never fall back to invariant semantics. On
Cell A they agree an improvement does not block, and that a verified,
monotonic reduction may take a narrower path than a general governed
assertion. What they will not let pass is the layer under the table. The
validator still trusts check-authored output, `excepted` is a disposition
and not a result, report-only has no completeness status, and *previous
enforced class* is only safe from an authenticated snapshot. So the next
owed item is a **producer protocol and threat-model amendment**, with
eight named points, put to the council before any fixture or schema
file. They split on whether `error` blocks, on tolerance aggregation, on
how narrow the Cell A path is, and on whether report-only is a mode at
all. Those are recorded as undecided. Record:
`agents/evidence/council/gate-aggregation-truth-table-20261024.md`.
**Drafted the same day: D25's owed producer protocol, and put it to the
council, 2/2 present. Convergent, and the step stays open (D26).** Both
seats now permit adversarial fixtures and a schema named and versioned
as disposable `v0`, and neither permits `v1`, authority, or a claim that
the trust boundary is closed. They agree that only P4 (raw evaluation
versus disposition) is resolved. *Binding* overclaims and is context
metadata. A nonce correlates and does not authenticate. An entry-script
hash is not the evaluator's identity. Post-run hashing is telemetry, not
provenance. And merge base is not policy lineage. Both name the same
single item owed first: a **validator-owned invocation-envelope
specification** (execution identity, controlled and uncontrolled inputs,
channel lifecycle, resource limits, status precedence, report
persistence). The fixtures then attack it. Draft:
`agents/evidence/analysis/gate-producer-protocol-20261024.md`. Record:
`agents/evidence/council/gate-producer-protocol-20261024.md` and its
`.question.md`.
**Drafted the same day: D26's owed invocation envelope, put to the
council, 2/2 present. Convergent, and the step stays open (D27).** Both
seats let **adversarial fixtures proceed now**, marked exploratory and
never normative evidence. Neither lets a normative `v0` land yet. The
envelope covers all six areas structurally, but its regular-file channel
has no acceptance boundary, because an escaped descendant can still
write. E1 is a revision manifest and not execution identity. Inherited
`PATH` and `HOME` are recorded, not controlled. And E5 is not total.
Both name one owed item: **a complete observation-to-outcome table**,
with validator health as its own dimension, tied to a validator-owned,
bounded accepted-byte sequence. Draft:
`agents/evidence/analysis/gate-invocation-envelope-20261024.md`.
Record: `agents/evidence/council/gate-invocation-envelope-20261024.md`
and its `.question.md`.
**First exploratory fixture under D27, run the same day: the file channel
is refuted, and the pipe holds only because the validator stops reading.**
A `setsid` grandchild wrote a forged `pass` after the producer's group was
killed. A regular-file channel accepted it in 10 of 10 runs. A
validator-owned pipe that the validator stops collecting from accepted it
in 0 of 10. The same pipe collected until EOF accepted it in 10 of 10, and
that control is what shows the harness can see the forgery. So the
accepted-byte boundary is the validator's stop point, and it is a time
boundary. Darwin and one Node version only, so it is not normative.
Evidence: `agents/evidence/analysis/gate-channel-escape-20261024.md` and
its probe `gate-channel-escape-probe.mjs`.
**Drafted the same day: D27's owed outcome table, put to the council,
2/2 present. Convergent, and the step stays open (D28).** Both seats
permit an experimental slice (schema, collector, reference producer and
fixtures) and neither permits a normative `v0`. The draft has a real
defect: B3 closes the read end and then drains it, which cannot both
happen. The table is also not total. Framing is unspecified, P4 is
unreachable, expiry and a dirty tree are preflight state rather than
protocol outcomes, P12 has no domain, and the summary is a shared
failure domain. Both name one owed item: **an executable collector state
machine with corrected applicability rules**. Its boundary is that no
read starts after the terminal condition, and fd 3 is a bearer
capability, not producer provenance. Draft:
`agents/evidence/analysis/gate-outcome-table-20261024.md`. Record:
`agents/evidence/council/gate-outcome-table-20261024.md` and its
`.question.md`.
**The `degraded` split was put to the council as its own question the
same day, 2/2 present, and both seats converged (D29).** A `degraded`
report-only run gets a distinct non-zero operational exit, separate from
`failed`. It is never `complete` and never a pass. The mode contract is
executable: there is an explicit mode value, an unknown mode is refused,
and unknown states fail closed. Record:
`agents/evidence/council/gate-degraded-report-only-20261024.md` and its
`.question.md`.
**D28's owed item was built as the experimental slice the same day.**
`src/scripts/_lib/gate_collector_experimental.ts` holds four parts. The
first is the collector as a pure state machine (`collectorReduce`). At the
first terminal event it drains the pipe synchronously until it would
block, then stops, which repairs B3's close-then-drain contradiction.
Bytes after the stop are counted and never parsed. The second is LF
framing. The third is a total precedence list, in which a collection
cause comes first within each outcome. The fourth is preflight
(`expired-compat-row`, `dirty-tree`) and validator health as dimensions
separate from the protocol outcome. A reference producer and adversarial
fixtures are in `tests/fixtures/gate-collector/producer.mjs` and
`tests/scripts/gate_collector_experimental.test.ts`. Result: 43 of 43
green, after a red run. Each mechanism was neutralised, its test went
red, and it was then restored. The slice is versioned `experimental-1`
and is wired into no gate.
**The slice was put to the council the same day, 2/2 present (D30).**
Both seats keep the owed item open. They found a real defect, and it is
fixed in the same change, with tests that went red first: the line limit
let the next chunk through when the last permitted line feed ended a
chunk. Both limits are now capacities, health is validated, and the
module's claims are narrowed to what was exercised. Both name one next
deliverable: **a 16-check contract-and-classification ledger with
provisional verdicts**, before any wrapper or registration. Both say the
ledger needs no second principal. Promoting it into a governed registry
does need one. Record:
`agents/evidence/council/gate-collector-slice-20261024.md` and its
`.question.md`.
**The ledger was drafted the same day and put to the council, 2/2
present, and closure was rejected (D31).** Both seats agree on most rows
and require five corrections:
- row 1's adoption ratchet is a shrink-only invariant, not a snapshot;
- row 10 is split per check;
- row 11's warning property is named;
- row 16 separates missing, malformed and insufficient evidence;
- rows 9 and 12 record the canonical tracked-file scope, because
  scanning the disk is a measurement-scope defect.
Revision 2 applies all five: 32 aspect rows over 16 checks, 26
invariant, 5 observation, 0 snapshot, 0 tolerance, and 1 evaluation
state. Ledger:
`agents/evidence/analysis/gate-classification-ledger-20261024.md`.
Record: `agents/evidence/council/gate-classification-ledger-20261024.md`
and its `.question.md`.
**Revision 2 was put to the council the same day, 2/2 present (D32).**
Both seats find exactly one closure blocker: *store absent* in row 16
carried a value outside the four classes. Neither seat says the
blocker needs the second principal. Revision 3 classifies it as an
observation, with `not-evaluated: evidence-missing` as runtime metadata
only. It also applies the five refinements both seats asked for. The
stale snapshot reference is gone. Row 5 states its property as
computed. Row 11 enumerates its error rules. Rows 9 and 12 separate
today's disk scope from the target index scope, with an operational
definition. Row 16 keeps today's behaviour apart from a future
transition. Result: 37 aspect rows, every one in one of the four
classes, 31 invariant and 6 observation. Record:
`agents/evidence/council/gate-classification-ledger-r2-20261024.md` and
its `.question.md`.
**Four more ledger rounds ran the same day, each 2/2 present (D33–D36),
and the step stays open.**
- **D33.** openai would close revision 3 narrowly. anthropic set a
  condition: say whether the ledger describes current behaviour or the
  intended contract. Revision 4 adds the governing definition: one
  currently implemented assertion under one named mode, semantic, with
  current enforcement recorded separately and target rows excluded.
- **D34.** The prompt left out the rows, which made the round
  unanswerable; that was the asking agent's error. Revision 5 adds the
  aggregation rule, under which every binding aspect needs a class, and
  a mechanical reconciler that was seen red.
- **D35.** The reconciliation was circular, because the ledger defined
  its own population. Revision 6 scans every `--flag` in each check's
  source, adds the eight rows that scan surfaced, corrects the
  *store malformed* row against the code, and executes check 16 against
  four stores.
- **D36.** A flag scan is not a branch inventory. Both seats require an
  inventory of assertion-producing branches and their predicates,
  produced independently of the ledger author, and they say it needs no
  second principal.
Records: `agents/evidence/council/gate-classification-ledger-r3-20261024.md`,
`…-r4-…`, `…-r5-…` and `…-r6-20261024.md`, each with its `.question.md`.
Ledger, now at revision 6:
`agents/evidence/analysis/gate-classification-ledger-20261024.md`.
Reconciler: `agents/evidence/analysis/gate-ledger-reconcile.mjs`.
Invocation inventory, 7.2's first item:
`agents/evidence/analysis/gate-invocation-inventory-20261024.md`.
currently pinned red on the trunk: invariant (must always hold),
snapshot (a point-in-time reading, refreshable), tolerance (a bounded
range with an accepted-risk waiver, per `ratification-artifact.md`'s
own `strict_required_status_checks` precedent), or observation
(informational, never blocking). Record the verdict per check.
