---
stability: beta
keep-beta-until: 2026-11-17
---

# Turn-end detector demotion — the pre-registered standard

**Purpose.** `turn-end-gate` is the suite's only concern that can refuse a
turn-end, and it shipped before
[`concern-activation-policy`](concern-activation-policy.md) existed — so it
carries none of the removal conditions that policy makes mandatory from day one.
This file is that missing reverse trigger, registered **per detector**, and it is
registered **before** the data it will judge exists so a later reading cannot be
fitted to a conclusion.

**Scope.** Demotion of one detector from blocking to advisory. The gate as a
whole is not in question, and no clause here removes a detector.

## The rule

```
EACH DETECTOR CARRIES ITS OWN BAR. A BAR IS READ ONLY AFTER THAT DETECTOR'S
SAMPLE FLOOR IS MET. CROSSING A BAR AUTHORISES A STAGED-DEMOTION STUDY —
NEVER A DEMOTION. FRICTION ALONE NEVER DEMOTES A DETECTOR.
A BAR SET ON AN UNMEASURABLE QUANTITY IS INERT AND SAYS SO.
```

## The four detectors

Read off `DetectorId` in `src/scripts/hooks/turn_end_gate_hook.ts`, never off
prose — the roadmap that opened this question named three, and the tree has four.

| Id | Fires when | Protects |
|---|---|---|
| A `promissory` | the closing text promises work the turn did not do | the truthfulness of "done" |
| B `language` | the reply language differs from that turn's fresh pin | the user-facing contract |
| C `verification` | the turn changed a file and ran no verify-shaped command | engineering safety |
| D `completion` | a completion claim carries no fresh evidence | the truthfulness of "done" |

## The two quantities — and the one that cannot be measured

**Q1 — re-refusal share.** Of a detector's eligible initial refusals, the share
whose immediate retry is refused again *by the same detector*. It is the
satisfiability signal: a high share means the model could not satisfy the
detector.

```
Q1 IS ZERO BY CONSTRUCTION AND IS NOT MEASURABLE ON TODAY'S GATE.
```

Verified in `turn_end_gate_hook.ts main()`: two independent layers return
`EXIT_ALLOW` before any detector runs on a retry — layer 1 on the host's
`stop_hook_active`, layer 2 on `alreadyRefusedTurn(…, turnOrdinal)`, and a retry
carries no new user prompt so its ordinal is unchanged. A turn is therefore
refused **at most once**, by design: the wedge that guard prevents is a turn that
can never end.

This is not a gap in the instrumentation. It is pinned as intended behaviour by a
committed test — `turn_end_gate_hook.test.ts`, *"LAYER 2: the turn marker alone
stops a second refusal, even on a NEW reply"*, whose fixture is a retry that
**still promises** and is asserted to pass. A genuine re-refusal is proven
allowed.

So Q1's bars below are registered and **inert**. They become readable only when
the instrument named in *The two instruments* ships. Registering an inert bar
rather than deleting it is deliberate: the satisfiability question is the one
that decides whether a high-friction detector is broken or load-bearing, and
dropping it would leave the standard resting on friction alone — which the rule
above forbids.

**Q2 — median refusals per affected session.** The median taken across sessions
**in which that detector fired at least once**, never across all sessions. The
naming matters and the metric changes with it: over all sessions, any detector
affecting fewer than half of them has a permanent median of zero, which makes the
bar unfireable — the gate-that-cannot-fire shape this repository rejects
elsewhere. Q2 is measurable today from `RefusalRecord.counts`
(`src/scripts/_lib/turn_end_refusals.ts`).

### Attribution, registered now so it is not decided at reading time

- A retry firing several detectors counts once **for each** detector.
- Retry lineage survives an intervening detector: a refusal chain
  C → A → C contributes to C's Q1, not only to A's.
- Simultaneous firings are recorded separately, never collapsed to a first
  detector. (The writer already does this; before 2026-08-17 it stored
  `findings[0].detector` alone and a session refused nine times read as one.)
- A retry aborted for an unrelated reason is **censored**, not counted as a
  success.
- A refusal is *eligible* only if it was recorded under a version that stamps
  `agent_config_version`. The 36 legacy records are `(unrecorded)` and are
  excluded from both quantities.

## The bars

| Detector | Q1 re-refusal share (inert) | Q2 median per affected session |
|---|---:|---:|
| A `promissory` | ≥ 30 % | ≥ 3 |
| B `language` | ≥ 20 % | ≥ 2 |
| C `verification` | ≥ 40 % | ≥ 3 |
| D `completion` | ≥ 40 % | ≥ 3 |

**These are policy choices, not findings, and they differ on purpose.**

- **B is lowest.** A language mismatch is mechanically repairable, so repeated
  friction there is evidence the detector is wrong rather than evidence the task
  is hard.
- **C is highest.** It protects the practice most directly tied to a changed
  file, and it already carries the largest measured share of refusals — the
  detector doing the most work is the one to demote last.
- **A and D sit high.** Both protect the truthfulness of a completion claim,
  which is this suite's central promise, and demoting either silently restores
  unsupported "done". The supporting measurement is the *general* one — advisory
  carriers reached no measurable effect where blocking carriers reached zero
  violations — not a per-obligation reading of A or D, and it is stated at that
  strength rather than borrowed as if it had been measured on these two
  detectors specifically.

**The counter-argument, kept on the record rather than answered away:**
differentiated bars encode four unmeasured judgements about relative harm, and a
single shared bar would be methodologically cleaner on sparse data. It is
rejected because pretending the four protected harms are interchangeable would
hide those judgements rather than remove them. *Revisit-if:* the first qualifying
sample shows all four Q2 medians within ±1 and all four Q1 shares within ±10
points — then the data has refuted the architectural argument and the bars
collapse to one.

## Sample floor — per detector, not per gate

A detector's bar may not be read until **all four** hold for that detector:

1. ≥ 100 eligible initial refusals;
2. ≥ 50 affected sessions;
3. ≥ 30 calendar days of observation;
4. no change to that detector's logic, or to the refusal instrumentation, inside
   the window. Any such change **resets** qualification for that detector alone.

At 100 observations a proportion near 30 % still carries roughly a ±9-point 95 %
interval, so this is a defensible minimum and not precision. Condition 4 replaces
the "spans two releases" formulation it was drafted as: release diversity mixes
implementations and confounds the distribution, while what the requirement was
actually reaching for is a stable window.

## Crossing a bar authorises a study, not a demotion

```
NO DETECTOR IS DEMOTED ON Q1 OR Q2 ALONE.
```

Q1 and Q2 measure cost and satisfiability. Neither measures the violations that
return after a demotion, and the strongest evidence in this estate points the
other way: in a 30-session conformance audit the blocking carriers reached zero
violations while the advisory carriers reached none of the effect. A detector
with a high re-refusal share may be catching real problems the model struggles to
fix — which is a reason to keep it blocking, not to demote it.

So a crossed bar produces exactly three things:

1. the distribution, published with the sample it came from;
2. a **staged-demotion study** for that detector, pre-registered separately —
   the detector runs advisory for a declared arm and blocking for the other, and
   the study reads the violation delta, not the friction;
3. a demotion **only** if that study shows the violation rate does not materially
   rise. Re-promotion is part of the study's own pre-registration; it is not
   improvised at reading time.

This narrows the wording of the roadmap step that commissioned this file, which
read as though crossing the bar demoted the detector. The narrowing is the point:
both council seats reached it independently, from opposite directions, on the
measured asymmetry above.

## Detector D is dormant, not successful

D has fired **zero** times. That is a third state — unexposed — and neither of
the two quantities can tell apart a detector waiting for a rare violation, one
subsumed by A or C, and unreachable dead code. So:

- D's bars stand, and are unreadable until D reaches the same sample floor.
- D is **not** retired for never firing under this standard. A retirement
  decision needs an opportunity or shadow-fire metric this pre-registration
  deliberately excludes, and it cannot be smuggled in through a friction bar.
- The generic *no fires in 8 weeks → evaluate removal* trigger in
  [`concern-activation-policy`](concern-activation-policy.md) still applies to D
  and is the right place for that question. Evaluate is not remove.

## The non-termination escape is independent of all of this

Registered here because it is the safety valve the bars are not: after **three
consecutive refusals from the same detector on one turn**, allow the turn to end,
record a detector-fault record, and keep the other detectors armed. It does not
demote the detector and contributes nothing to Q1 or Q2.

On today's gate this valve is unreachable for the same reason Q1 is — the
re-entrancy layers cap a turn at one refusal — so it is registered against the
instrumented gate the next clause describes, and is stated as unreachable rather
than implied to be live.

## The two instruments this standard is waiting on

Neither ships here; both are named so the standard is falsifiable rather than
aspirational.

1. **A shadow read on the allow path.** On layers 1 and 2, run the detectors
   without acting on them and record which *would* have fired again, as
   `would_refuse_again` counts on the session record. The verdict stays
   `EXIT_ALLOW`, so it cannot wedge a turn — this is the `would_fire` shadow
   mechanism [`concern-activation-policy`](concern-activation-policy.md)
   § *Deriving a threshold* already prescribes, applied to a gate that shipped
   before it. Without this, Q1 stays inert.
2. **A per-detector rollup over eligible records**, reporting Q2 with its
   affected-session denominator and its sample-floor status per detector, so a
   reading is a command's output rather than a hand count.

## Was this pre-registration blind?

Yes, on both quantities, and the check is worth stating because a reader would
reasonably doubt it. One distribution was already published when these bars were
set — a per-detector count over the 36 legacy records
(verification 22 · language 9 · promissory 5 · completion 0). It contains
**neither** bar quantity: Q1 is unmeasurable there as everywhere, and every
legacy record carries exactly one refusal by construction, so the corpus holds no
per-session distribution at all. The bars were set on the architectural
harm-ordering argued above and on the measured blocking-vs-advisory asymmetry —
not on that reading.

## Honest enforcement — `enforced_by: none`

No gate reads this file. Whether a bar was read after its sample floor, whether a
study preceded a demotion, and whether an attribution rule was honoured are
authoring decisions visible only in review. Saying so is the point: this file
exists because a *blocking* concern carried no registered removal condition while
every advisory around it did, and replacing that gap with a document that
overstates its own force would repeat the defect at one remove.

## Provenance

Registered 2026-08-18. Option (a) — per-detector bars — was resolved by an AI
council pass (2 of 2 seats present, concluded); both seats chose (a) over a
shared bar and over "no demotion available", and both independently raised the
staged-study requirement now in *Crossing a bar authorises a study*. The numbers
above are the convergence of their two proposals, taking the demotion-resistant
side wherever they differed. Two findings are **own analysis**, reached from the
gate's code rather than from either seat: that Q1 is unmeasurable by
construction, and that the non-termination escape is unreachable for the same
reason.

## See also

- [`concern-activation-policy`](concern-activation-policy.md) — the ladder, the generic reverse triggers, and the `would_fire` shadow mechanism instrument 1 applies.
- [`hook-architecture-v1`](hook-architecture-v1.md) — the dispatcher contract, and which hosts carry a `stop` slot at all.
- `src/scripts/hooks/turn_end_gate_hook.ts` — the gate, its four detectors, and the two re-entrancy layers Q1 dies on.
- `src/scripts/_lib/turn_end_refusals.ts` — `DETECTOR_IDS`, `RefusalRecord`, and the counts Q2 is read from.
- [`condensation-default-kill-criterion`](condensation-default-kill-criterion.md) — the sibling shape: one feature's kill criterion, pre-registered with its decision table.
