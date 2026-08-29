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

> **Provenance:** promoted 2026-08-29 out of the `stubs/` directory, where this file
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

- [x] **1.1 Establish whether a host-emitted-event count is obtainable at all.**
      Enumerate, per bound platform, whether the host exposes any durable count
      of events it emitted — a log, a counter, a settings-visible tally — and
      record the answer per (platform, event) cell rather than as one verdict.
      A cell where the host emits but publishes no count is the finding, not a
      gap in the survey.
      verify: DONE — `agents/evidence/analysis/host-denominator-obtainability-2026-08-29.md`. The table covers all **80** `(platform, event)` cells with **no blank**: 6 `counted`, 34 `emits-but-uncounted`, 40 `not-bound` (43 bound = counted + emits-but-uncounted). Bindings were read from `src/scripts/hook_manifest.yaml` at execution rather than carried. The `counted` six are on `claude` and rest on a HOST artefact this package does not write — the per-session transcript at `~/.claude/projects/<slug>/<session-id>.jsonl`, which exists whether or not any hook is bound; 156 were present for this project and the newest was analysed record by record, yielding `session_start` (1/file), `user_prompt_submit` (3 real prompts, discriminated from 163 `user` records that are tool results), `pre_tool_use`/`post_tool_use` (164 `tool_use` blocks) and `subagent_start`/`subagent_stop` (0 Agent/Task calls — correct for that session). **`stop` was deliberately NOT classified `counted` although it looked reconstructable:** all 305 assistant records carry `stop_reason: tool_use` and none `end_turn`, so the field counts assistant MESSAGES while the hook fires once per TURN, and using it would have over-counted the denominator by about two orders of magnitude. The seven other platforms are `emits-but-uncounted` on an explicitly stated **absence of evidence within this package's reach** — no reader for a host-published emission count exists anywhere in the tree — never on a claim that those hosts publish nothing.

- [~] **1.2 If no host count exists, build the narrowest thing that counts.**
      A counter that increments per dispatched event and nothing else — no
      payload, no free-form field, per the parent's 1.1 schema discipline. It is
      an instrument, so it is built as one: no resident process, hook-invocation
      writes only, per ADR-124's Class-A bar.
      verify: NOT REQUIRED UNDER THE RESOLVED BLOCKER. The step is conditional — *"if no host count exists"* — and `host-denominator-obtainability` resolved to **(b)**, which measures only cells where a host count DOES exist. The 1.1 survey found six such cells, so the antecedent is false and no dispatch counter is owed.
      <!-- deferred-resolution: merged-into=road-to-supervised-telemetry-collector -->

      **Deferred and RESOLVED by merge, AI council 2026-08-29 (DEGRADED — 1 of 2
      seats present, quorum 1; the `openai` seat did not answer, see below).**
      Recorded in full because `roadmap-progress-sync` Iron Law 3 requires a
      `[~]` resolution to carry its criterion, its options, the verdict, the
      rationale, the dissent, the destination, and what closes it.

      - **Criterion, verbatim:** *"If no host count exists, build the narrowest
        thing that counts."*
      - **Blocker it hangs off:** `host-denominator-obtainability`, resolved to
        **(b)** — measure only the cells whose host publishes a count.
      - **Options put to the council:** (A) `[x]` vacuously discharged, since a
        conditional whose condition resolved false is satisfied rather than
        dropped · (B) `[~]` then carry item and blocker into a NEW named
        follow-up roadmap · (C) `[~]` then MERGE into existing active work,
        concretely `road-to-supervised-telemetry-collector`, whose Phase 4
        already owes a denominator writer for its own capture metric · (D) leave
        `[ ]`, do not archive, keep the roadmap active with one permanently open
        conditional step. Conversion to `[-]` cancelled was named as
        **owner-reserved** and was not put as an option the council could take.
      - **Verdict: (C).** Merge into `road-to-supervised-telemetry-collector`.
      - **Rationale, the seat's own:** *"Vacuous discharge (option A) is formally
        correct in propositional logic but practically illegitimate under Iron
        Law 3. The rule isn't governing logical propositions; it's preventing
        loss of planned work. A reader seeing `[x]` step 1.2 expects a counter
        was built. Using `[x]` because 'the conditional didn't fire' bypasses the
        owner-reserved `[-]` fence via formal-logic loophole."* Asked directly
        whether (A) was cancellation wearing a checkmark, the seat answered
        **yes**. (B) was refused as +1 active estate for an instrument nobody
        currently needs; (D) as a permanently open step.
      - **Dissent, recorded rather than resolved away:** the same seat noted that
        if host counts are permanent infrastructure that will never disappear,
        the merged item becomes deferred work that never activates — *"that's
        worse than documenting the false antecedent and moving on"* — and that
        (A) would then be defensible. It declined to assume permanence:
        *"platforms change, deprecation happens."* The activation path is
        preserved at near-zero cost against that uncertainty.
      - **Destination:** `road-to-supervised-telemetry-collector`, which is
        active (`status: ready`), is not being archived by this change, and now
        carries the reciprocal `relates: [{slug: road-to-journal-host-capture-measurement, relation: extends}]`
        link the archival sweep requires of a `merged-into` annotation.
      - **What closes it there:** that roadmap's Phase 4 builds the denominator
        writer its own 1.2 metric definition item 1 requires — *"the denominator
        must be produced by a writer that cannot fail in the same way the
        numerator does"* — which is the same instrument this step describes, for
        the same reason. Its Phase 4 heading now records the receipt.

- [x] **1.3 State the population the rate is over, before measuring it.**
      An opted-in install and a default install are different populations and
      yield different true answers; the parent's evidence page already refuses
      to conflate them. Write the choice down first so the number cannot be
      re-scoped after it lands.
      verify: FIRST CLAUSE DONE, SECOND CLAUSE IS A STANDING OBLIGATION ON 2.1. The evidence page's § *Population and install configuration — committed here, before any measurement* names both populations and both install configurations: opted-in (`hooks.runtime_journal.enabled: true`) and default (key absent, resolving to `false`), each scoped to the six `counted` cells rather than to all 43 bound ones. It is committed on the SURVEY page, before any measurement exists, which is the whole point of the step — a population written after the number can be chosen to suit it. The caption half cannot be satisfied before 2.1 produces a caption; the required four fields (numerator, denominator, population, install configuration) are specified there, together with the openai seat's refinement that a default-install 0 % is captioned as a product-adoption result and not a capture-quality one.

## Phase 2 — The measurement, published whichever way it lands

- [x] **2.1 Run the measurement and publish it.** A low host capture rate is the
      outcome this work is most likely to produce and is a complete result.
      Publish it as measured; do not re-scope the claim to fit the number.
      verify: DONE — `agents/evidence/analysis/journal-host-capture-2026-08-29.md`, typed with an `<!-- evidence-type: analysis -->` marker on line 1. Its first caption carries all four required fields: numerator **0** journal records, denominator **152,151** host-emitted events on the five journal-bound counted cells (**296,216** across all six), population **2,281 Claude Code sessions** on one machine over **2026-07-30..2026-08-29**, install configuration **shipped defaults** with `hooks.runtime_journal.enabled` absent from every settings layer present. **Rate: 0.00 %.** The number was published as measured and the claim was not re-scoped to fit it — the low outcome the step predicted is exactly what landed, and it replaces `undefined` with a zero over a KNOWN denominator, which is the difference between a result and a non-number. The instruments are `src/scripts/_lib/host_denominator.ts` (typed denominator record, rules pinned at v1), `src/scripts/measure_host_capture.ts` (re-runnable: `./scripts-run src/scripts/measure_host_capture --json`), and `tests/scripts/host_denominator.test.ts` (20 tests green, `npm run typecheck` clean).

      **The opted-in half is a MEASURED empty population, not a missing
      number.** 1 settings layer observable on the measuring machine, 0 with the
      key `true`, so there is no population for an opted-in rate to be over. The
      council of 2026-08-29 required that wording specifically over
      "unmeasurable": *"'population size = 0 in observable scope' (measured) …
      the former is honest; the latter invites misreading."*

      **Closure decision, AI council 2026-08-29 (DEGRADED — 1 of 2 seats;
      `openai` returned `os_error: ENOBUFS` and the free estimate probe then
      reported it `unavailable`, so it was not re-attempted. Quorum 1, met. This
      is not convergence).** Options: (A) publish the default rate as measured
      and the opted-in half as a documented empty population, closing 2.1 on the
      Goal's own *"or the reason it cannot exist is published in its place with
      the same rigour"* clause · (B) refuse to close on a null and produce the
      opted-in figure by replay · (C) leave 2.1 open and park the roadmap in
      `later/`. **Verdict (A), with three additions the seat made mandatory** —
      scope the default result explicitly to one machine / one platform / six
      cells; state the opted-in half as a measured empty population rather than
      as unmeasurable; caption the default 0 % as a product-adoption /
      configuration result rather than a capture-quality one. All three are
      implemented in the evidence page. (B) was refused because a replay
      re-derives the parent's known ~100 % dispatch figure over a bigger
      denominator and hands a reader a number they can mistake for a host rate —
      the substitution AC-4 forbids. (C) was refused as making completion hostage
      to an external condition with no timeline. **Counter-argument, recorded at
      the seat's insistence rather than resolved away:** the earlier unanimous
      (c) verdict required *two rates*, and a documented null is not literally a
      rate, so this closure rests on reading the Goal's alternative clause as
      overriding (c)'s numeric half for the opted-in population. That reading is
      written down so a later reader does not mistake the closure for a silent
      violation of a unanimous verdict. *Revisit-if:* any machine runs with
      `hooks.runtime_journal.enabled: true`, at which point the pair can be
      completed by re-running the same script there.

- [x] **2.2 Close or restate the parent's 1.4 in this roadmap's own words.**
      Either the number 1.4 asked for now exists, or the reason it cannot is
      stated at the same rigour the deferral was.
      verify: DONE. **The number 1.4 asked for now exists** for the default population: a host capture rate of 0.00 % over 152,151 host-emitted events, replacing the `undefined` the parent's revision 2 published. The acceptance criteria below are decidable from `journal-host-capture-2026-08-29.md` alone, without reading the parent — the 80-cell obtainability table is restated on that page rather than pointed at (AC-1), the record contract and its observed sensitivity probes are on it (AC-2), the four-field caption is its opening paragraph (AC-3), the non-comparability of the dispatch figure has its own section (AC-4), and both blocker choices are restated there (AC-5). What 1.4 asked for and did NOT get is an opted-in rate, and that half is stated at the rigour the deferral was: a measured population of zero, with the install census that measured it and the `Revisit-if` that would complete it.

## Blockers

### blocker: host-denominator-obtainability

- **Status:** resolved
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
- **Decision (AI council 2026-08-29, SPLIT — resolved by measurement, not by
  tie-break): (b).** Restrict the measurement to the cells whose host publishes
  a durable count; report the rate for those and leave the rest explicitly
  unmeasured.

  Both seats (2/2 present, anthropic `claude-sonnet-4-5` + openai
  `codex-default`) **rejected (a)** — and (a) was this blocker's own written
  recommendation. Their reason is the one that matters: a per-event *dispatch*
  counter begins counting after dispatch, so it measures a different population
  than the host emits, and reporting it as a host rate is exactly the category
  substitution the parent's evidence page already had to refuse once. openai put
  it plainly: *"incomplete valid evidence is preferable to complete evidence for
  the wrong metric."* Recording that here because a future reader will find the
  recommendation above and should know it was examined and overruled.

  The seats then split, anthropic for (c) and openai for (b), and the split was
  **not** resolved by preference, by seniority, or by re-asking. anthropic's
  case for (c) rested on an explicitly stated prediction — *"if most platforms
  don't publish host counts, (b) yields near-zero measurable cells and
  functionally collapses to (c)"* — which is a testable claim, and 1.1 is the
  test. **It came back false.** The survey found **6 `counted` cells** of 43
  bound, on Claude, whose host writes a durable per-session transcript from
  which `session_start`, `user_prompt_submit`, `pre_tool_use`, `post_tool_use`,
  `subagent_start` and `subagent_stop` are reconstructable. (b) therefore does
  not collapse into (c), and the condition anthropic itself attached to its own
  choice is unmet. Evidence:
  `agents/evidence/analysis/host-denominator-obtainability-2026-08-29.md`.

  Both seats also proposed the same absent option **(d)** — publish the dispatch
  metric under a distinct name while host capture stays undefined where no host
  denominator exists. It is not adopted here because (b) subsumes its honest
  half: the dispatch figure already exists and is already published under its own
  name by the parent roadmap, and nothing in this file renames it.

  *Revisit-if:* a host outside the six cells is found to publish an emission
  count this package can read — which would widen the measurement rather than
  overturn it; or the Claude transcript format stops carrying the four
  reconstruction rules the survey depends on.
- **Resolved when:** the choice is recorded here and 1.1's survey table exists
  to support it.
- **Both clauses met.** The choice is recorded above, and the survey table
  exists with all 80 cells filled and no blank — 6 `counted`, 34
  `emits-but-uncounted`, 40 `not-bound`. This blocker is closed on evidence
  produced in the same change, not on a decision taken ahead of one.

### blocker: measurement-population-default-off

- **Status:** resolved
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
- **Decision (AI council 2026-08-29, UNANIMOUS — 2/2 seats): (c).** Measure both
  populations and publish two rates with two captions. Neither may be presented
  as "the" capture rate.

  Both seats reached (c) independently: the two populations answer different
  questions, and publishing only one invites the substitution the parent's
  evidence page already had to refuse once. A default-install rate says what the
  installed base records today; an opted-in rate says whether the mechanism
  works for a user who asked for it. Publishing the second alone would flatter
  the mechanism; publishing the first alone would indict a mechanism that is
  behaving exactly as designed.

  **This blocker was very nearly moot and is not.** It is downstream of
  `host-denominator-obtainability`, and had that resolved to (c) — declare the
  rate unobtainable — there would have been no measurement to split across
  populations. The 1.1 survey resolved it to (b) instead, so two real rates are
  owed.

  One refinement from the openai seat is adopted rather than summarised away: a
  default-install 0 % must be captioned as a **product-adoption / configuration**
  result, not a capture-*quality* one. A reader who meets 0 % without that label
  reads a working mechanism as a broken one, and the caption is the only place
  that distinction survives.

  *Revisit-if:* the journal ships default-ON, either configuration stops being
  supported, or the measured population stops matching real installations.
- **Resolved when:** the choice is recorded here and 1.3's verify names the same
  population.
- **Both clauses met.** The choice is recorded above, and 1.3's population
  statement — committed in the evidence page's own first section, before any
  measurement exists — names the same two populations with the same install
  configurations, scoped to the same six `counted` cells.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-08-29 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | The dispatch figure is published as the host figure | product | The parent's evidence page already had to refuse this substitution once; a second measurement in the same area makes it easy to repeat, and the resulting number would look rigorous while answering a different question. | 1.3 fixes the population in writing before 2.1 measures, and 2.1's verify requires numerator, denominator, population and configuration in one caption. | Phase 1 — The denominator, which is the part that does not exist |
| 2 | The counter built in 1.2 becomes a resident process by increments | implementation | An aggregation or retention need is the usual reason a per-invocation writer acquires a long-lived helper, at which point ADR-124's Class-B bar has been crossed without its ADR — the parent roadmap's own top-ranked risk, inherited here because the same pressure applies. | 1.2 is specified as hook-invocation writes only and its verify checks the record type, not the behaviour; no step in this roadmap authorises a collector. | Phase 1 — The denominator, which is the part that does not exist |
| 3 | The survey in 1.1 is read as the measurement | product | A per-cell obtainability table looks like a result and could be published as though it answered 1.4, closing this roadmap on a finding about instruments rather than a rate. | 2.2 requires the acceptance criteria to be decidable from the evidence page alone, and the `host-denominator-obtainability` blocker's option (c) makes closing-on-the-survey an explicit, recorded choice rather than a drift. | Phase 2 — The measurement, published whichever way it lands |
| 4 | The measurement is never run because both closers look external | implementation | Both closers were described in the stub as "not autonomously reachable", which reads as "blocked on someone else" and invites parking; in fact 1.2 and the opt-in of 1.3 are both ordinary work in this repository. | This file is `status: ready` in the active estate rather than parked, and its Phase 1 opens with a survey that requires no decision to start. | Phase 1 — The denominator, which is the part that does not exist |

## Acceptance Criteria

- [x] AC-1 — A per-(platform, event) obtainability table exists in the evidence
      page with no blank cell, so "we did not look" and "the host does not
      publish it" are distinguishable.
      MET: all 80 cells in `journal-host-capture-2026-08-29.md` § AC-1 (6 `counted`, 34 `emits-but-uncounted`, 40 `not-bound`), plus the derivation record in `host-denominator-obtainability-2026-08-29.md`. The `stop` row was re-opened on new evidence during 2.1 — a host-authored `hookInfos` record naming `--event stop` — and still resolves to `emits-but-uncounted` because that artefact is written selectively and under-counts; the three refused candidates read 305 / 95 / 7 on one session and are recorded in code as `STOP_CANDIDATES`.
- [x] AC-2 — A denominator exists and its record type is asserted against a
      committed key set, with a free-form write failing to type-check — the same
      privacy property the journal's own record carries.
      MET: `HostDenominator` in `src/scripts/_lib/host_denominator.ts`. `DENOMINATOR_RECORD_KEYS` is bound to the type in both directions; `_RecordCarriesNoFreeFormField` applies the journal's own exported `NoFreeForm` guard — imported, not re-implemented, so the two halves of the ratio cannot drift. **Observed, not argued:** admitting `payload` to the record reds `npm run typecheck` with `host_denominator.ts(220,5): error TS2344: Type 'false' does not satisfy the constraint 'true'` and reds 10 of 20 tests; a second, independent probe binding `journal-record` to `claude` `pre_tool_use` reds exactly 1 of 20 — the manifest-binding assertion — with the other 19 green, so each probe is targeted rather than a blanket break. Both reverted from explicit backups and re-verified: 20/20 green, typecheck clean, eslint clean.
- [x] AC-3 — The published rate carries numerator, denominator, population and
      install configuration in one caption; a reader can tell which population
      it is over without reading any other file.
      MET: the first block-quote of the evidence page carries all four in one caption, and the second does the same for the opted-in population. Both are labelled, and the page states in its own words that neither is "the" capture rate.
- [x] AC-4 — The dispatch-path figure is not reported as the host figure
      anywhere in the evidence page, and the page says why the two are not
      comparable.
      MET: § AC-4 of the evidence page. The 100.00 % / 1,000-envelope figure appears only inside that section, named as a floor on the writer, with the reason the two are incomparable stated as a difference of kind — the dispatch denominator is authored by the test, this one by the host — rather than of size. The same section records that a replay was considered as a closure option and refused for the same reason.
- [x] AC-5 — Both blockers above carry a recorded choice, or this roadmap closes
      on the `host-denominator-obtainability` option (c) finding with the survey
      as its evidence.
      MET on the first branch: `host-denominator-obtainability` → **(b)**, resolved by a measurement that falsified the prediction attached to the competing option; `measurement-population-default-off` → **(c)**, unanimous 2/2. Both `Status: resolved` with the option named and both `Resolved when` clauses met.

## What this roadmap will NOT build

- **A resident process.** Same refusal as the parent, for the same reason: the
  counter of 1.2 is a hook-invocation writer or it is not built here.
- **A second event model.** The counter counts; it does not re-describe events
  the journal already records.
- **A default flip of `hooks.runtime_journal.enabled`.** Measuring a default
  install is 1.3 option (b); changing what the default *is* is a separate
  decision this roadmap does not take.
