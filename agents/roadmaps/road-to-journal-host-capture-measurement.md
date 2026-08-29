---
complexity: lightweight
status: ready
execution:
  mode: phase-checkpoints
owner: maintainer
review_by: 2026-11-29
parent_roadmap: road-to-runtime-event-journal
relates:
  - roadmap: road-to-runtime-event-journal
    relation: extends
    note: carries the unmet delivery half of its step 1.4
estate_growth_exempt: "Charges +2 open_blockers (29 to 31), both on this file. They are not new work invented here: they are the two closers the parent roadmap's step 1.4 named as unmet, written out as decidable option sets so a reader can act on them instead of re-deriving them from a deferral note. The AI council (4 verdicts, 2026-08-29) held that leaving them in a `stubs/` file did not keep them in the estate at all, so the honest cost of the correction is exactly this: two blockers that were always real become two blockers that are counted. active_roadmaps stays +0 — this file replaces the archived `road-to-runtime-event-journal` one-for-one."
estate_offset_exempt: "Charges +1 active and is offset in this same change by the archival of `road-to-runtime-event-journal`, which this file is the promoted receiver for. Net estate delta of the change is 0 active. The promotion is not discretionary: the AI council (anthropic + openai, 4 seats across two independent runs, 2026-08-29) held unanimously that a file under `agents/roadmaps/stubs/` does NOT satisfy Iron Law 3's preservation test, and `archive_completed_roadmaps.ts:443-446` independently refuses a `stubs/` path as a carry destination — it resolves only `agents/roadmaps/<slug>.md` and `later/<slug>.md`. Leaving the item in a stub was therefore not a legal disposition, and this file is the minimum that makes one exist."
---
# Road to a HOST capture rate for the runtime event journal

> **Source:** promoted 2026-08-29 out of the `stubs/` directory, where this file
> was created by `road-to-runtime-event-journal` to carry its **`[~]` deferred
> and unmet** step 1.4. The stub path is deliberately not cited: it no longer
> exists, and a dead path in a Source line is exactly what `check_references`
> refuses. The promotion was decided by the AI council — see
> § Why this is an active roadmap and not a stub.

## Goal

The journal's **host** capture rate exists as a published number with a stated
denominator, or the reason it cannot exist is published in its place with the
same rigour. Finished means: a reader can say what fraction of host-emitted
events reached a journal record, over what population, on what install
configuration — or can read exactly which of the two named closers is still
missing and why that makes the fraction undefined rather than zero.

## Context

### What step 1.4 asked, and what was actually produced

> **1.4 First capture measurement, published whichever way it lands.** What
> fraction of host events reach a journal record, measured against the recorded
> 0.27 % baseline for the existing telemetry path.

**Produced and published:** dispatch-path capture — **100.00 %, denominator
1,000 envelopes** handed to the concern (100 × each of the ten
`EVENT_VOCABULARY` members), 0 skips, and a default-OFF control landing 10/10
`disabled`. That is a floor on the **writer**, and it is real. Evidence:
`agents/evidence/analysis/runtime-journal-capture-2026-08-28.md`.

**Not produced:** the **host** capture rate, which is what 1.4 asked for. It
remains **`undefined`** — numerator unobserved, denominator unknown. The council
pass of 2026-08-28 read that as honest and as **not discharging the step**:
*"zero numerator does not establish 0 % when the population itself was not
observed."*

**Comparing the dispatch figure to the 0.27 % delivery baseline is a category
error** and is refused here rather than left to a reader to avoid.

### What changed anyway, and why the deferral is not a null result

Before the parent roadmap the journal was bound in **no hook slot**, so
production capture was zero **by construction** and neither a numerator nor a
denominator could exist. It is now bound in 8 of 40 (platform, event) cells on
`claude`, exercisable, and measured on the path that exists. The path is the
part that was missing; the population is the part that still is.

### One finding carried forward, because it is about the DATA and not the plumbing

**1,000 of 1,000 records landed `boundary_status: session_fallback`.** The
Claude dispatcher envelope carries no `task_id` — only Cline's `taskId` is
readable — so the episode boundary runs at its documented fallback in production
rather than at the task boundary the council adopted. Marked in every record
rather than dropped, which is what the `session_fallback` value is for.

### Why this is an active roadmap and not a stub

The parent's step 1.4 was dispositioned as a **carry into a stub**. That
disposition was put to the AI council on 2026-08-29 with the full option set of
`roadmap-progress-sync` Iron Law 3. Both seats, across two independent runs
(4 verdicts, no dissent), answered the load-bearing sub-question **NO**: a file
under `agents/roadmaps/stubs/` — explicitly "not active work", gated on
promotion — does **not** keep a criterion active in the estate, so the carry
failed the preservation test.

The mechanism agrees independently.
`src/agent-src/scripts/archive_completed_roadmaps.ts:443-446` resolves a carry
destination against exactly two paths, `agents/roadmaps/<slug>.md` and
`agents/roadmaps/later/<slug>.md`; a `stubs/` path is not reachable and reports
*"names destination `<slug>`, which does not exist"*. The verdict and the code
were reached separately and say the same thing.

Both seats named the same remedy — *"promote the stub into named active work"* —
after which the parent's item is a **merge into existing active work**, which
that same table routes to the council. This file is that promotion.

## Phase 1 — The denominator, which is the part that does not exist

- [ ] **1.1 Establish whether a host-emitted-event count is obtainable at all.**
      Enumerate, per bound platform, whether the host exposes any durable count
      of events it emitted — a log, a counter, a settings-visible tally — and
      record the answer per (platform, event) cell rather than as one verdict.
      A cell where the host emits but publishes no count is the finding, not a
      gap in the survey.
      verify: a table in the evidence page covers every bound (platform, event) cell with one of `counted` / `emits-but-uncounted` / `not-bound`, and no cell is blank.

- [ ] **1.2 If no host count exists, build the narrowest thing that counts.**
      A counter that increments per dispatched event and nothing else — no
      payload, no free-form field, per the parent's 1.1 schema discipline. It is
      an instrument, so it is built as one: no resident process, hook-invocation
      writes only, per ADR-124's Class-A bar.
      verify: the counter's record type is asserted against a committed key set the same way the journal's is, and a fixture attempting a free-form write fails to type-check.

- [ ] **1.3 State the population the rate is over, before measuring it.**
      An opted-in install and a default install are different populations and
      yield different true answers; the parent's evidence page already refuses
      to conflate them. Write the choice down first so the number cannot be
      re-scoped after it lands.
      verify: the evidence page names the population and the install configuration in its first section, and the published rate carries both in its caption.

## Phase 2 — The measurement, published whichever way it lands

- [ ] **2.1 Run the measurement and publish it.** A low host capture rate is the
      outcome this work is most likely to produce and is a complete result.
      Publish it as measured; do not re-scope the claim to fit the number.
      verify: the evidence page carries numerator, denominator, population and configuration, and is typed with an `<!-- evidence-type: analysis -->` marker.

- [ ] **2.2 Close or restate the parent's 1.4 in this roadmap's own words.**
      Either the number 1.4 asked for now exists, or the reason it cannot is
      stated at the same rigour the deferral was.
      verify: this roadmap's acceptance criteria are decidable from the evidence page alone, without reading the parent.

## Blockers

### blocker: host-denominator-obtainability

- **Status:** open
- **Owner:** maintainer
- **Blocks:** Phase 1 step 1.2 and, through it, all of Phase 2. Step 1.1 is the
  survey that answers this blocker and is not itself blocked.
- **What to do:** pick exactly one — (a) build the minimal per-event dispatch
  counter described in 1.2 and accept that it measures *dispatch* emissions,
  not host emissions, stating that limit in the evidence page; or (b) restrict
  the measurement to platforms whose host publishes a count, and report the rate
  only for those cells, leaving the rest explicitly unmeasured; or (c) declare
  the host rate unobtainable with the survey of 1.1 as the evidence, and close
  this roadmap on that finding rather than on a number.
- **Recommendation:** (a) — it is the only option that produces a denominator
  under this repository's own control, and the limit it carries is nameable in
  one sentence. (b) is a strictly smaller version of (a) that depends on host
  behaviour nobody here controls; (c) is honest but forecloses a measurement
  that (a) shows is reachable.
- **If you do nothing:** Phase 2 cannot run, the rate stays `undefined`, and
  the parent's 1.4 stays unmet with no active receiver — the exact state the
  council refused on 2026-08-29.
- **Resolved when:** the choice is recorded here and 1.1's survey table exists
  to support it.

### blocker: measurement-population-default-off

- **Status:** open
- **Owner:** maintainer
- **Blocks:** step 1.3's population choice and 2.1's published caption.
- **What to do:** pick exactly one — (a) measure against a locally opted-in
  install (`hooks.runtime_journal.enabled: true`), reporting the rate for
  opted-in installs and saying so; or (b) measure against a default install and
  publish the resulting rate, which is expected to be 0 % with a *known*
  denominator — a real and publishable result, unlike today's `undefined`; or
  (c) measure both and publish two rates with two captions.
- **Recommendation:** (c) — the two numbers answer different questions, both are
  cheap once 1.2 exists, and publishing only one invites the substitution the
  parent's evidence page already had to refuse once.
- **If you do nothing:** 2.1 publishes a rate whose population a reader must
  infer, which is the failure mode that made the dispatch figure unusable as a
  host figure in the first place.
- **Resolved when:** the choice is recorded here and 1.3's verify names the same
  population.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-08-29 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | The dispatch figure is published as the host figure | product | The parent's evidence page already had to refuse this substitution once; a second measurement in the same area makes it easy to repeat, and the resulting number would look rigorous while answering a different question. | 1.3 fixes the population in writing before 2.1 measures, and 2.1's verify requires numerator, denominator, population and configuration in one caption. | Phase 1 — The denominator, which is the part that does not exist |
| 2 | The counter built in 1.2 becomes a resident process by increments | implementation | An aggregation or retention need is the usual reason a per-invocation writer acquires a long-lived helper, at which point ADR-124's Class-B bar has been crossed without its ADR — the parent roadmap's own top-ranked risk, inherited here because the same pressure applies. | 1.2 is specified as hook-invocation writes only and its verify checks the record type, not the behaviour; no step in this roadmap authorises a collector. | Phase 1 — The denominator, which is the part that does not exist |
| 3 | The survey in 1.1 is read as the measurement | product | A per-cell obtainability table looks like a result and could be published as though it answered 1.4, closing this roadmap on a finding about instruments rather than a rate. | 2.2 requires the acceptance criteria to be decidable from the evidence page alone, and the `host-denominator-obtainability` blocker's option (c) makes closing-on-the-survey an explicit, recorded choice rather than a drift. | Phase 2 — The measurement, published whichever way it lands |
| 4 | The measurement is never run because both closers look external | implementation | Both closers were described in the stub as "not autonomously reachable", which reads as "blocked on someone else" and invites parking; in fact 1.2 and the opt-in of 1.3 are both ordinary work in this repository. | This file is `status: ready` in the active estate rather than parked, and its Phase 1 opens with a survey that requires no decision to start. | Phase 1 — The denominator, which is the part that does not exist |

## Acceptance Criteria

- [ ] AC-1 — A per-(platform, event) obtainability table exists in the evidence
      page with no blank cell, so "we did not look" and "the host does not
      publish it" are distinguishable.
- [ ] AC-2 — A denominator exists and its record type is asserted against a
      committed key set, with a free-form write failing to type-check — the same
      privacy property the journal's own record carries.
- [ ] AC-3 — The published rate carries numerator, denominator, population and
      install configuration in one caption; a reader can tell which population
      it is over without reading any other file.
- [ ] AC-4 — The dispatch-path figure is not reported as the host figure
      anywhere in the evidence page, and the page says why the two are not
      comparable.
- [ ] AC-5 — Both blockers above carry a recorded choice, or this roadmap closes
      on the `host-denominator-obtainability` option (c) finding with the survey
      as its evidence.

## What this roadmap will NOT build

- **A resident process.** Same refusal as the parent, for the same reason: the
  counter of 1.2 is a hook-invocation writer or it is not built here.
- **A second event model.** The counter counts; it does not re-describe events
  the journal already records.
- **A default flip of `hooks.runtime_journal.enabled`.** Measuring a default
  install is 1.3 option (b); changing what the default *is* is a separate
  decision this roadmap does not take.
