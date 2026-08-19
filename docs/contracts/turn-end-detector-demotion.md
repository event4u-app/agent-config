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

| Id | Fires when | Protects | Runs |
|---|---|---|---|
| A `promissory` | the closing text promises work the turn did not do | the truthfulness of "done" | only when no dispatch is open |
| B `language` | the reply language differs from that turn's fresh pin | the user-facing contract | every turn-end |
| C `verification` | the turn changed a file and ran no verify-shaped command | engineering safety | every turn-end |
| D `completion` | a completion claim carries no fresh evidence | the truthfulness of "done" | only when no dispatch is open |

**Two of the four are conditional, and the fourth column is load-bearing.**
`main()` runs A and D only when `dispatchOpen` is false — an open subagent
dispatch excuses a promissory closing and an unsettled completion claim, and
excuses nothing about B or C. So there are **three** allow paths, not two: the two
re-entrancy layers below, plus this one. It suppresses A and D for a whole turn,
and in a suite whose delegation policy dispatches by default that is not a rare
branch.

Every clause in this file that reads a zero, a denominator, or a dormancy has to
survive that fact, and each says below where it does not.

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
- **A turn that ran with a dispatch open is censored for A and D**, in both
  quantities. Those two detectors did not run, so the turn is not an observation
  of them not firing — counting it as one biases their Q2 denominators downward
  and would read a configuration fact as an exposure fact. B and C are unaffected
  and take that turn normally. A rollup that cannot tell a dispatch-suppressed
  turn from a clean one may not report Q2 for A or D at all.
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

Each row's reason has to produce that row, so they are given per detector rather
than in groups — an earlier draft said "C is highest" while D tied it exactly, and
grouped "A and D" across a 10-point split. A reader deriving the table from the
prose would have got a different table, which is not acceptable in a document that
calls its own numbers policy choices to be argued.

- **B lowest, 20 % / 2.** A language mismatch is mechanically repairable, so
  repeated friction there is evidence the detector is wrong rather than evidence
  the task is hard. It is the one detector where a high share is more likely a
  false positive than a hard problem.
- **A at 30 % / 3.** It protects the truthfulness of a completion claim, which is
  this suite's central promise, so demoting it silently restores unsupported
  "done". It sits below C because a promissory closing is a *reply-shape* finding
  the model can usually repair in one pass, unlike an actual missing verifier.
- **C at 40 % / 3, and it is the last one to demote.** It protects the practice
  most directly tied to a changed file, and it already carries the largest
  measured share of refusals — the detector doing the most work has the most to
  lose.
- **D at 40 % / 3, for a different reason than C's — absence of evidence, not
  weight of it.** D has never fired, so there is no measured cost to weigh
  against its benefit, and a bar set low would demote a detector on a
  distribution nobody has seen. It ties C by coincidence of caution, not because
  it does comparable work.

The supporting measurement behind A and D is the *general* one — advisory carriers
reached no measurable effect where blocking carriers reached zero violations — not
a per-obligation reading of either, and it is stated at that strength rather than
borrowed as if it had been measured on these two detectors specifically.

**The counter-argument, kept on the record rather than answered away:**
differentiated bars encode four unmeasured judgements about relative harm, and a
single shared bar would be methodologically cleaner on sparse data. It is
rejected because pretending the four protected harms are interchangeable would
hide those judgements rather than remove them.

***Revisit-if*, split so that the reachable half can actually fire.** Drafted as
one conjunctive clause over both quantities, it was unfalsifiable by
construction — it required Q1 shares, which this file declares unmeasurable until
an instrument that does not ship here lands, so the only escape from four bars
to one could never open.

- **On Q2 alone, and it stands today:** two or more detectors reach their floors
  and their Q2 medians sit within ±1 of each other → the architectural argument is
  refuted *for those detectors* and their bars merge. It does not need all four,
  and it does not need D, whose floor is currently unreachable.
- **On Q1, contingent:** once instrument 1 lands and Q1 becomes readable, all four
  shares within ±10 points collapses the bars to one.

Either half fires alone. Naming the contingency is the point: a revisit condition
that silently depends on unbuilt instrumentation is an aspiration wearing a
falsifier's clothes, which is the failure this whole file is written against.

## Sample floor — per detector, not per gate

A detector's bar may not be read until **all four** hold for that detector:

1. ≥ 100 eligible initial refusals;
2. ≥ 50 affected sessions;
3. ≥ 30 calendar days of observation;
4. no change inside the window to **anything that alters that detector's
   exposure or the recording of its refusals**. That is deliberately wider than
   "the detector's logic": it includes the three allow paths (`stop_hook_active`,
   `alreadyRefusedTurn`, and `dispatchOpen` together with `openRecordStats`' own
   TTL filter), the session-key and turn-ordinal derivation whose documented
   cross-session collision under-refuses, and `TRANSCRIPT_READ_MAX_BYTES` — every
   one of which can invalidate a window without touching a detector. Any such
   change **resets** qualification for that detector alone.
   **Carve-out, or condition 4 eats its own enabler:** a change that only ADDS a
   field or a counter, leaving every existing count and every allow path
   untouched, does not reset. Without this, shipping instrument 1 would reset all
   four windows — it writes `would_refuse_again` onto the session record, which is
   the refusal instrumentation — and no window accumulated before it lands would
   ever be readable. That would contradict this file's own claim that Q2 is
   measurable today.

At 100 observations a proportion near 30 % still carries roughly a ±9-point 95 %
interval, so this is a defensible minimum and not precision. Condition 4 replaces
the "spans two releases" formulation it was drafted as: release diversity mixes
implementations and confounds the distribution, while what the requirement was
actually reaching for is a stable window.

### Retention caps the floor, and for two detectors it caps it below 100

```
THE FLOOR IS NOT REACHABLE FROM SESSION RECORDS ALONE.
A CUMULATIVE PER-DETECTOR AGGREGATE THAT SURVIVES PRUNING IS PART OF INSTRUMENT 2,
NOT AN OPTIMISATION OF IT.
```

The refusal state carries a **90-day TTL** (`pruneAgedRefusalState`, run at
`session_start`), ageing each session record on its own `refused_at`. So the
corpus reachable by counting records is never more than 90 days deep, and
condition 1 asks for 100 eligible refusals **per detector**.

The arithmetic decides it, and it decides against two detectors. On this
branch's own published reading — promissory 5 refusals over a 5-day window, about
1/day — detector A needs roughly 100 days to reach 100 and is pruned at 90.
Dormant D needs unbounded time. Only C, at 22 over the same window, clears 100
inside the retention window at all.

Left there, this file would have reintroduced exactly the failure it rejects for
Q2's denominator: a bar that cannot fire, arrived at through retention instead of
through a metric definition. So the resolution is stated rather than left to be
discovered:

- **Instrument 2 must persist a cumulative per-detector count that pruning does
  not touch.** The record may be deleted; the count it contributed may not be.
  Counting live records is not an implementation of condition 1, it is a
  different and smaller question.
- **Until that aggregate exists, condition 1 is satisfiable only by a detector
  firing ≥ 100 times within 90 days** — which is C, and no other. A and D are not
  merely far from their floors; they cannot reach them. The file says so here
  rather than letting a future reader conclude the bars were simply never
  crossed.
- The aggregate is a count, never a copy of the pruned record: retention exists
  for a reason and this does not widen what is kept, only what is remembered
  about it.

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
the two quantities can tell apart **four** explanations:

1. a valuable detector waiting for a rare violation;
2. one subsumed by A or C;
3. unreachable dead code;
4. **a detector that was suppressed rather than unexposed** — D runs only when no
   dispatch is open, and this suite delegates by default, so a zero may be
   measuring the delegation rate rather than the violation rate.

The fourth is the one a reader would miss and the code supplies, and it changes
what a zero licenses: without separating it out, a *configuration* fact would be
published as an *exposure* fact. Any rollup reporting D's zero must report the
dispatch-suppressed turn count beside it, or the zero is uninterpretable. So:

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
   reading is a command's output rather than a hand count. It carries three
   further obligations from the sections above, none of them optional: the
   **cumulative count that survives pruning** (without it condition 1 is
   unreachable for A and D), the **dispatch-suppressed turn count** beside any D
   zero (without it that zero is uninterpretable), and A/D censoring for
   dispatch-suppressed turns.

### Who owns them — named, because the honest answer is nobody

```
NO ROADMAP OWNS THESE TWO INSTRUMENTS. THIS FILE'S OWN REVIEW DATE IS THE CARRIER.
```

The roadmap that commissioned this standard closed and archived in the same change
that registered it, which removes the last tracked surface that could have
scheduled either instrument. Two consequences are stated rather than left to be
noticed at re-read time:

- **The `keep-beta-until` marker in this file's frontmatter is the schedule.** It
  forces a re-read by that date under `check_beta_review_markers`, which is a real
  deterministic carrier — weaker than a roadmap step, and not nothing.
- **The same applies to the archived roadmap's AC-1** (a refusal rate on a second
  machine). Its AC-3 was delegated to a named open roadmap and has a real owner;
  AC-1 has none, and the archive publishes the file as `completed` without that
  qualification. The correction is recorded at the roadmap itself.

Until an instrument lands, the honest description of this standard is: **bars
registered, one quantity inert, one reachable for exactly one detector.** That is
worth more than an unregistered gate, and it is less than a working kill standard.
Both halves belong in any sentence that cites this file.

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
