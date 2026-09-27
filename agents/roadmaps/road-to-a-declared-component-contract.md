---
complexity: structural
status: ready
execution:
  mode: phase-checkpoints
owner: maintainer
relates:
  - slug: road-to-behaviour-evidence-over-pixels
    relation: disjoint
    note: >
      Same source set. That roadmap needs no declared contract and no lane; this
      one needs no runtime probe. Every phase here is gated on an owner decision
      that one does not need.
estate_growth_exempt: >-
  Receiver for the half of the source set that is gated on a recorded decision rather than on
  missing evidence, so it needs a home where the decision can be posed rather than being lost with
  the inbox round. Verified 2026-09-11: the component-architecture skill states in as many words
  that no ordering is prescribed among stories, component and page, and that a claimed order is a
  preference rather than its instruction; a five-level component taxonomy has exactly one mention
  across `src/` and `docs/` and that mention rejects it. Both are deliberate, and both are what
  this roadmap proposes to reverse. Also grows open_blockers by three.
estate_offset_exempt: >-
  The offset this would naturally take is `agents/roadmaps/stubs/road-to-frontend-power-default-flip.md`,
  which is itself held on an owner-reserved default flip and has been for 19 days — retiring it
  would dispose of the decision this roadmap needs answered. No active roadmap covers component
  contracts or the workshop lane, and the sibling frontend roadmap deliberately excludes both so
  that it can ship without this one.
---
# Road to a declared component contract

> **Source:** `agents/tmp.old/inbox-2026-09-y/t4-ui-contract-frontend/` — three plan revisions, a
> two-member revision set and the originating transcript, analysed 2026-09-11. This roadmap
> carries the half of that set whose every phase is gated on reversing a recorded decision. The
> sibling `road-to-behaviour-evidence-over-pixels` carries the half that is not. One step is
> tagged `corrected-from-reproduction`: the file the source proposes to extend for stack detection
> is a consumer template, not package engine code, and no revision in the set noticed.

> **Arrivals:** 2 — latest this roadmap (analysed 2026-09-11, ruled 2026-09-21); earlier
> `agents/roadmaps/archive/road-to-component-granularity-vocabulary.md`, which rejected the
> five-level taxonomy on a measurement and archived on 2026-08-26. Both arrivals were refused,
> and the second refusal is recorded on the archived file as well as here, because that file is
> where a reader looking for the reason lands. Counter lives here rather than only in the
> blocker so a third arrival meets a number instead of a fresh argument.

## Goal

A managed UI component carries a declared level and an executable contract that exists before a
consumer imports it — recorded as a deliberate reversal of three locks, with the guard that the
earlier decision promised and never shipped landing first.

The reversal is the whole subject. This tree rejected a five-level component taxonomy on a
measurement — that the level is not computable from props, depth, path or file length — and it
states, as a positive instruction rather than an omission, that no ordering is prescribed among
stories, component and page. Both rejections are correct on their own evidence. Adopting the
source's proposal means overturning them, and overturning them silently is what this roadmap
exists to prevent.

> **REFUSED 2026-09-21, and the goal above is therefore not the outcome.** The reversal was put
> to the AI council and came back **2/2 for option (b) — uphold both rejections**. The five-level
> taxonomy stays rejected and `No order is prescribed` stays as written, so the declared level,
> the contract rule and the workshop lane that every phase below hangs off are **not** going to
> be built on these terms. Phase 1 stands: the guard the earlier decision promised is landed and
> is the roadmap's real yield. Phases 2 through 6 do not proceed — read
> `### blocker: taxonomy-reversal-is-a-second-arrival` before treating any of them as workable.
> The second arrival is recorded on the archived granularity roadmap so a third meets a record
> rather than a blank.
>
> **CLOSED OUT 2026-09-27 on an explicit owner ruling, which is the one thing the paragraph
> above said this run could not do.** It read: *"Disposing of the refused steps' glyphs is
> owner-reserved and deliberately untaken here."* That was correct when written and is now
> spent: the owner ruled on the disposition directly, authorising `[-]` for the twelve refused
> steps and for AC-3, AC-6 and AC-7 — and for those items only. AC-5 and AC-8 were ruled the
> other way and carry `[x]`: they are negative criteria the refusal SATISFIES rather than
> cancels, and `[-]` on AC-8 would record in the archive that the claims gate was cancelled,
> which is false. Read § Outcome next; the roadmap is archived.

## Outcome — read this before the phases

**Phase 1 landed in full. Phases 2 through 6 are CANCELLED as REFUSED-ON-THEIR-PREMISE, by an AI
council verdict this roadmap's own blocker asked for.** Archived 2026-09-27.

| Phase | State | Why |
|---|---|---|
| **1** — land the guard the earlier decision promised | **satisfied** | The fixture the archived granularity roadmap specified, and never shipped, exists and was observed red against a planted five-level name and green without one. It landed in its own commit, ahead of any reversal. This is the roadmap's real yield. |
| **2** — record the reversal, or stop here | **cancelled, refused** | There is no reversal to record. The council upheld both rejections, so the decision record 2.1 would write has no decision in it, and the fixture 2.2 would amend has no record to be amended under. |
| **3** — declared level, never inferred | **cancelled with Phase 2** | The declared level is the five-level taxonomy under another name. It stays rejected, so there is no level for a lint to check a title, a metadata field and a directory against. |
| **4** — two axes on the stack detector | **4.2 satisfied, 4.1 and 4.3 cancelled** | The blast-radius assessment 4.2 asks for was executed and is in the evidence tree; that is a real closure and it stands. The axis change itself is refused with the lane it would have served — and the assessment argues against it independently, having found the detector has no production caller. |
| **5** — contract before consumption | **cancelled with Phase 2** | The rule is gated on a resolved workshop lane, which Phase 4 does not resolve and Phase 6 does not add. |
| **6** — exactly one lane beyond the reference | **cancelled with Phase 2** | Same gate. Zero lanes exist, which is why AC-7 is cancelled rather than met. |

### What the verdict actually decided, and what it deliberately did not

The council ran 2026-09-21, two seats (`anthropic/claude-sonnet-4-5` + `openai/codex-default`),
deep mode, three rounds, **2/2 convergent for option (b) — uphold both rejections**, reached
independently on the same three reasons. Those reasons are recorded verbatim at
`### blocker: taxonomy-reversal-is-a-second-arrival` § Resolution and are not restated here; the
shortest of them is the one to carry away: **a broken lock on a door is not evidence about what is
behind it.** This round repaired a carrier that had failed. It re-measured nothing, and the
measurement the vocabulary was rejected on — that the level is not computable from props, depth,
path or file length — is untouched on both sides.

Upholding is not reversing. **The owner may still reverse either rejection at any time**, and a
concrete, taxonomy-independent, reversible ordering proposal would be council-decidable on its own
merits. Option (c) *as written* is what was found not decision-ready — it never specified what the
replacement ordering would be. The strongest argument recorded against the verdict, which survives
it, is that upholding the ordering rejection may preserve historical inertia where a concrete
ordering rule could improve consistency. That is the shape a third arrival should take.

### Why 17 boxes closed in two different ways, on an explicit owner ruling

`[-]` cancelled is owner-reserved under `roadmap-progress-sync`'s preservation test, and this
file's own Resolution routed the disposition to the owner rather than taking it. The owner ruled on
2026-09-27, authorising `[-]` for **the twelve steps in Phases 2 through 6 and for AC-3, AC-6 and
AC-7 — and for no other item**. Those hang on phases that will not run.

**AC-5 and AC-8 were ruled the other way and carry `[x]`.** Both are *negative* criteria — "no new
configuration file carries a provider or workshop registry", "the claims file is unchanged by this
roadmap" — and the refusal **satisfies** them rather than cancelling them: they hold precisely
because nothing was built. Marking AC-8 `[-]` would record in the archive that the claims gate was
cancelled, which is false; the gate ran and passed. Each carries an executed verify proof rather
than an assertion — a `--diff-filter=A` sweep of this roadmap's ten commits for AC-5, a
per-commit `docs/CLAIMS.md` check plus a green `check_claims` run for AC-8.

### Arrivals, and what a third one meets

This was the subject's **second arrival**; the counter is under the title. A third now meets three
things the second did not: a test that goes red on a planted five-level name in either surface
independently, a recorded disposition with its reasoning, and — per
[`recurring-criticism`](../../src/rules/recurring-criticism.md) — the arrival recorded at
`archive/road-to-component-granularity-vocabulary.md` § Outcome, which is where a reader looking
for the reason lands. The rejection's structural uncitability, the second reachability failure this
round found, is repaired at
`agents/evidence/analysis/component-taxonomy-rejection-reachability-2026-09-19.md` — a surface a
stable artefact is permitted to cite.

## Phase 1 — Land the guard the earlier decision promised

- [x] **1.1 Write the fixture the archived granularity roadmap specified and never shipped.** Its
      own risk register predicted this exact re-arrival — that a three-tier vocabulary would be
      read as a first step and the next contributor would complete it — and its mitigation was a
      fixture that fails if a five-level name appears in the emitted vocabulary. The fixture does
      not exist.
      verify: the fixture is red against a planted five-level name and green without one, and both
      readings are recorded.

      **DONE, and the premise was verified before it was acted on.** The archived roadmap records
      its 0.3 first half as DONE, claiming *"no five-level name can enter the emitted vocabulary
      without turning that test red"*. Measured 2026-09-13 at `origin/main`: the claim is **false**.
      The test it rests on (`tests/cli/uiAudit_design_system.test.ts` § *the audit kind enum has ONE
      definition*) compares `AUDIT_KINDS` to the skill's `kind:` line and forbids exactly two dead
      values, `partial` and `layout`. Planting `organism` into **both** surfaces — which is what
      "completing" a taxonomy looks like — left all 36 tests **green**. So this roadmap's premise
      stands: the guard does not exist, and the archived DONE note over-claims what its test covers.

      Landed as a fourth `describe` block in the same file, asserting the archived step's own named
      set — `atom`, `molecule`, `organism`, `template` — against `AUDIT_KINDS` and against the
      skill's declared list **independently**, so a coordinated edit turns both red. `page` is
      deliberately excluded from the forbidden set: it is Frost's fifth level and a value this
      repository emits on its own Blade/Next evidence, predating the harvest.

      **Both readings, recorded:**
      - RED with `organism` planted in `src/cli/commands/uiAudit.ts` and
        `src/skills/existing-ui-audit/SKILL.md`: `2 failed | 37 passed (39)` — one failure per
        surface.
      - GREEN with the plant removed: `39 passed (39)`.
      - Control reading, same plant against the pre-existing tests only: `36 passed (36)`.
- [x] **1.2 Do this before the reversal, not after.** A guard written after the decision it guards
      has been reversed records nothing.
      verify: the fixture lands in its own commit, ahead of Phase 2.

      **MET.** The fixture lands in its own commit and Phase 2 has not run — it is held by
      `taxonomy-reversal-is-a-second-arrival`, which is owner-reserved. The ordering the step asks
      for is therefore satisfied by construction rather than by sequencing.

## Phase 2 — Record the reversal, or stop here

> **Every step in Phases 2 through 6 now carries the inline `blocked-by:` marker, and that is a
> fix rather than a formality.** `scanOpenSteps` in
> `src/scripts/hooks/run_continuation_hook.ts` reads blockedness from the marker and from nothing
> else — it never parses `## Blockers` — so a step declared blocked only in prose still counts as
> open work to the stop-slot concern, which re-engaged an autonomous run into these owner
> decisions on every fire. Measured on this file before the markers: `{ open: 13, blocked: 0 }`,
> with `next` pointing at 2.1; after: `{ open: 0, blocked: 13, next: null }`. At 13 steps this was
> the largest such exposure in the estate. No checkbox moved: the boxes stay `[ ]`, both blockers
> stay open, the acceptance criteria stay unmet and the roadmap stays unarchivable. Only the
> concern's read of them changes.
>
> **Phase 4 is gated twice and its marker names one blocker.** The grammar carries a single id, so
> 4.1 through 4.3 point at `the-detector-is-a-consumer-template`, the blocker whose § Blocks names
> exactly those steps. `taxonomy-reversal-is-a-second-arrival` gates them as well, per its own
> § Blocks — clearing the detector blocker alone does not release Phase 4, and a reader stripping
> one marker on that basis would re-open an owner decision that is still open.
>
> **Superseded 2026-09-21 in one respect only, and left standing so the transition is visible.**
> The decision is no longer open: the council ruled **(b) uphold**, so the twelve steps that
> still carry the marker are not blocked-pending-a-decision any more — they are **refused on
> their stated terms**. (Thirteen when the markers were written; 4.2 has closed since, and
> `scanOpenSteps` reads `{ open: 0, blocked: 12, next: null }` on this file today.) The
> markers stay exactly where they are, pointing at the now-resolved blocker, and that is
> deliberate rather than an oversight: `scanOpenSteps` in
> `src/scripts/hooks/run_continuation_hook.ts` reads blockedness from the marker's presence
> alone and never resolves the blocker's status, so stripping them would hand an autonomous run
> twelve steps whose premise the record has just refused. The checkboxes likewise stay `[ ]`:
> converting them to `[-]` cancelled is owner-reserved under `roadmap-progress-sync`'s
> preservation test, and `[~]` would assert a deferral to a receiver that does not exist.
> Neither disposition is this run's to take.
>
> **Both halves of that are now spent, 2026-09-27, and the markers are GONE rather than
> re-pointed.** The owner authorised `[-]`, so the boxes moved; and once a box reads `[-]` the
> marker it carried is not merely redundant, it is a false statement — `blocked-by:` asserts a
> step pending a decision, and these steps are refused. Removing it costs the concern nothing,
> which is a measurement rather than an expectation: `OPEN_BOX` at
> `src/scripts/hooks/run_continuation_hook.ts:411` is `/^[ \t]*[-*][ \t]+\[ \][ \t]+(.*)$/` and
> matches the literal `[ ]` only, so a `[-]` line is never reached by the marker test at all.
> Executed on the edited file: `scanOpenSteps` returns `{ open: 0, blocked: 0, next: null }` —
> the same `next: null` the markers were bought for, now held by the glyph instead.


- [-] <!-- cancelled-by: taxonomy-reversal-is-a-second-arrival § Resolution 2026-09-21 — AI council 2/2 for option (b), uphold --> **2.1 Write one decision record** superseding three things at once: the no-prescribed-order
      statement, the five-level-name prohibition the Phase 1 fixture now enforces, and a
      lane-scoped amendment to the abstraction thresholds so a single-use component inside a
      declared lane is not a threshold violation.
      verify: the decision index is regenerated, and the abstraction-threshold gate stays green on
      non-lane fixtures while not firing on a one-use component inside a lane fixture.
- [-] <!-- cancelled-by: taxonomy-reversal-is-a-second-arrival § Resolution 2026-09-21 — AI council 2/2 for option (b), uphold --> **2.2 Amend the Phase 1 fixture under the new record** so the reversal is visible in the
      guard rather than in the guard's absence.
      verify: the fixture is red against an undeclared five-level name and green against a declared
      one, and the amendment cites the record.
- [-] <!-- cancelled-by: taxonomy-reversal-is-a-second-arrival § Resolution 2026-09-21 — AI council 2/2 for option (b), uphold --> **2.3 Make no quality claim.** This is a convention, not a measured improvement.
      verify: `docs/CLAIMS.md` is unchanged by this roadmap and the claims gate is green.

## Phase 3 — Declared level, never inferred

- [-] <!-- cancelled-by: taxonomy-reversal-is-a-second-arrival § Resolution 2026-09-21 — AI council 2/2 for option (b), uphold --> **3.1 Carry the level as a title prefix and a metadata field**, from a taxonomy the project
      configures, and add a level column to the owned-component list.
      verify: a lint checks that title, metadata and directory agree, and it never derives a level
      from props, depth, path or file length — the measurement that the level is not computable is
      cited in the lint's own docstring rather than re-argued.
- [-] <!-- cancelled-by: taxonomy-reversal-is-a-second-arrival § Resolution 2026-09-21 — AI council 2/2 for option (b), uphold --> **3.2 An undeclared component has no level.** Absent is absent, never guessed.
      verify: the lint reports an undeclared component as undeclared and does not assign it a tier.

## Phase 4 — Two axes on the stack detector, in the right file

- [-] <!-- cancelled-by: taxonomy-reversal-is-a-second-arrival § Resolution 2026-09-21 — AI council 2/2 for option (b), uphold --> **4.1 Add a workshop axis and a verification axis** to the stack-detection axis table and to
      the documented stack seam, filling the workshop capabilities as booleans.
      verify: the library fixture resolves a workshop value; a project with no marker resolves none
      and its fallback path runs without error.
- [x] **4.2 Treat this as a consumer-template change, not an engine change.**
      `corrected-from-reproduction` — every revision in the source set cites the detector as
      `work_engine/stack/detect.ts`. The real path is under
      `src/agent-src/templates/scripts/work_engine/`, a template shipped into every consumer
      project, so adding an axis changes a file installed in other people's repositories. No
      revision noticed.
      verify: the blast radius across installed consumers is stated in the evidence tree, and the
      migration path for a project already carrying the template is named.

      **DONE — and the step's own framing is the thing the measurement refuted.** Both halves of
      the verify are met by
      `agents/evidence/analysis/stack-detector-axis-blast-radius-2026-09-19.md`: the radius is
      stated in the evidence tree, and the migration path is named as **none required**, because a
      consumer's copy of the template is overwritten without prompting on every deploy and is
      never executed — `cmd_work` and `cmd_implement_ticket` pin `engine_root` to the package tree,
      and no work_engine file is resolved through the consumer-override path.

      Closing this step does not release 4.1 or 4.3 and reverses nothing. It records an assessment
      whose absence was the blocker; the axis change itself stays held by
      `taxonomy-reversal-is-a-second-arrival`, and both remaining markers were re-pointed at it in
      the same change so that neither cites a resolved blocker.

      **Three corrections to the earlier measurement, recorded rather than carried forward.**
      `_AMBIGUOUS_AXES` is `['reactivity']`, not `['view', 'reactivity']` — the latter is a
      separate inline array at `detect.ts:589`; the `detect.ts:521-524` citation under-scopes the
      `tailwind-v3` row, whose payload runs to line 531; and the `detect_stack` grep returns eight
      locations rather than five, having missed
      `src/agent-src/contexts/execution/toolchain-resolver.md:35`. The findings stand; the
      attributions did not.
- [-] <!-- cancelled-by: taxonomy-reversal-is-a-second-arrival § Resolution 2026-09-21 — AI council 2/2 for option (b), uphold --> **4.3 No provider registry file.** The axes carry what the lane needs; a registry is a second
      source of truth for twelve adapters that do not exist.
      verify: no new configuration file is added by this phase.

## Phase 5 — Contract before consumption, lane-gated and shadow-only

- [-] <!-- cancelled-by: taxonomy-reversal-is-a-second-arrival § Resolution 2026-09-21 — AI council 2/2 for option (b), uphold --> **5.1 Add one rule**, gated on a resolved workshop lane, enforced in shadow.
      verify: the framework-neutrality gate is green — the rule names no framework, or carries a
      declared exemption.
- [-] <!-- cancelled-by: taxonomy-reversal-is-a-second-arrival § Resolution 2026-09-21 — AI council 2/2 for option (b), uphold --> **5.2 Keep the local-inline escape.** A component used once, in one place, under the stated
      conditions, stays legal.
      verify: the rule names the conditions verbatim, and a fixture exercising each one passes.
- [-] <!-- cancelled-by: taxonomy-reversal-is-a-second-arrival § Resolution 2026-09-21 — AI council 2/2 for option (b), uphold --> **5.3 It is a dependency rule, not a commit-order rule.** The contract must exist before the
      import resolves, not in an earlier commit.
      verify: a fixture landing both in one commit passes.

## Phase 6 — Exactly one lane beyond the reference

- [-] <!-- cancelled-by: taxonomy-reversal-is-a-second-arrival § Resolution 2026-09-21 — AI council 2/2 for option (b), uphold --> **6.1 Add one non-reference workshop lane**, chosen by what a real consumer project actually
      uses, with a minimal fixture.
      verify: the lane emits a conformance artefact whose unavailable dimensions carry
      not-applicable rows with reasons.
- [-] <!-- cancelled-by: taxonomy-reversal-is-a-second-arrival § Resolution 2026-09-21 — AI council 2/2 for option (b), uphold --> **6.2 One, not twelve.** The documented stack seam already says to defer a stack until more
      than one consumer asks.
      verify: exactly one lane is added, and the reason it was the one chosen is recorded.

## Blockers

### blocker: taxonomy-reversal-is-a-second-arrival
- **Status:** resolved
- **Owner:** maintainer
- **Class:** 3 — human-only
- **Blocks:** Phases 2 through 6. Phase 1 proceeds without it — the guard is owed regardless of
  which way the decision goes.
- **What to do:** decide whether to reverse the five-level-taxonomy rejection. This is its second
  arrival: the archived granularity roadmap rejected it deliberately, on a measurement that levels
  are not computable, and its own risk register predicted this re-arrival and specified the guard
  Phase 1 now lands. Read
  `agents/roadmaps/archive/road-to-component-granularity-vocabulary.md` — its rejection paragraph
  and its risk row 1 — plus
  `grep -n 'no order is prescribed' src/skills/ui-component-architect/SKILL.md`. Three options:
  (a) reverse both the ordering statement and the vocabulary; (b) uphold both and record the
  second arrival on the archived file; (c) reverse only the ordering statement, which is a process
  preference costing nothing, and leave the vocabulary rejected on evidence that has not moved.
- **Recommendation:** reverse only the ordering statement. The vocabulary was rejected on a
  measurement, and nothing in this round re-measures it; the ordering was rejected as a preference,
  and a preference is what the source is asking to change.
- **If you do nothing:** Phase 1 lands the missing guard and the roadmap stops there, which closes
  the gap the earlier decision left open and is a complete outcome on its own.
- **Resolved when:** the decision record exists with one of the three readings, or this roadmap
  records the refusal and the archived roadmap carries the arrival.
- **STILL OPEN, and deliberately.** Reversing a recorded rejection on its second arrival is
  owner-reserved under [`decision-revisit-gate`](../../src/rules/decision-revisit-gate.md)
  § owner-reserved set; an agent manufacturing that decision is the failure this blocker exists
  to prevent. Phase 1 landed without it, as the blocker's own § Blocks permits.
- **New evidence for whoever decides, gathered 2026-09-13 while landing Phase 1.** It changes
  the reading of the record, not the decision:
  - **The archived roadmap's guard claim was an over-claim.** Its step 0.3 records the
    first half as DONE and states that *"no five-level name can enter the emitted vocabulary
    without turning that test red"*. Measured: planting `organism` into **both**
    `AUDIT_KINDS` and the skill's `kind:` line left all 36 tests green. The identity test it
    rested on compares the two surfaces **to each other** and forbids exactly two dead values,
    `partial` and `layout` — neither of which is a five-level name. A contributor "completing"
    the taxonomy updates both surfaces and passes.
  - **So this is the third outcome in [`recurring-criticism`](../../src/rules/recurring-criticism.md),
    not the first.** The disposition was right, it was recorded, and the carrier that was
    supposed to make it reachable did not carry it. That is a system failure and not evidence
    that the rejection was wrong — the measurement it rests on (the level is not computable from
    props, depth, path or file length) has not been re-measured by this round or the last one.
  - **The guard now exists**, so the next arrival meets a failing test rather than a sentence,
    which is the state the archived risk register wanted before the question was reopened. The
    decision is therefore no longer urgent: option (c), reversing only the ordering statement,
    costs nothing and is unaffected by any of this.
- **Screened again 2026-09-19 by executing this blocker's own § What to do, and the packet had two
  defects. Both are corrected; the decision is untouched and stays owner-reserved.** The full
  record, with every store searched and the gate source quoted, is
  `agents/evidence/analysis/component-taxonomy-rejection-reachability-2026-09-19.md` — a surface a
  stable artefact may cite, which is the operative point below.
  - **The grep in § What to do returns nothing.** `grep -n 'no order is prescribed'` is
    case-sensitive and the sentence opens a bolded line: the text is `No order is prescribed`, at
    `src/skills/ui-component-architect/SKILL.md:88`. An owner following the instruction as written
    would conclude the statement does not exist. The original line is left standing above so the
    correction is visible rather than hidden.
  - **The rejection is structurally uncitable, which is a SECOND reachability failure and not the
    one already recorded here.** Its only record is the archived granularity roadmap, and
    `check_no_roadmap_refs` forbids every stable artefact from citing any `*.md` under
    `agents/roadmaps/` at any depth, `archive/` included — verified against `ROADMAP_FILE_RE` and
    `STABLE_TREES` in the gate's own source. So no rule, skill, command, context, guideline or
    contract is permitted to point a later reader at the reason. Repairing the guard did not touch
    this; the evidence artefact above is the repair, per the promote-and-cite Iron Law of
    [`no-roadmap-references`](../../src/rules/no-roadmap-references.md).
  - **Option (c) is not the zero-cost edit the Recommendation calls it.** The ordering statement is
    not recorded as a taste: the skill states that no primary source requires an order, that
    measured evidence comparing build orders is *absent, not merely weak*, and that a claimed order
    is therefore a preference someone holds. Reversing it means prescribing an order the tree has
    recorded as evidentially unsupported. That may still be the right call — it is a different call
    from the one the Recommendation describes.
  - **Classification verified, not inherited.** Choosing among three conventions with no measurable
    discriminator is `product-owned` under ADR-268 § 10 — two valid user-visible semantics with no
    source of truth — and that class is owner-locked. `critical-technical` would route to a council;
    this does not. A council may advise here and may not rule.
- **Resolution (2026-09-21) — DECIDED: option (b), UPHOLD BOTH REJECTIONS. `Status: resolved`
  here means this roadmap's dependency is closed by a REFUSAL, not that the reversal was
  authorised.** The five-level component taxonomy stays rejected, and the `No order is prescribed`
  statement at `src/skills/ui-component-architect/SKILL.md:88` stays as written. Nothing in `src/`
  or `docs/` changes as a result of this ruling — that is what upholding means. The roadmap's own
  premise is therefore refused, and Phases 2 through 6 do not proceed on their stated terms.

  **Composition:** AI council 2026-09-21, 2 seats — `anthropic/claude-sonnet-4-5` +
  `openai/codex-default` — deep mode, 3 rounds. **Verdict 2/2 convergent for (b)**, both seats
  reaching it independently on the same three reasons.

  1. **Reachability is not counter-evidence, and this round came close to mistaking one for the
     other.** The archived roadmap's guard claim WAS an over-claim — planting `organism` into both
     `AUDIT_KINDS` and the skill's `kind:` line left all 36 tests green, because the identity test
     compares the two surfaces **to each other** rather than either of them to an independent
     policy authority. That is a carrier and trust-boundary defect, and it is a reason to repair
     the carrier, which Phase 1 did. It is not a reason to revisit the **vocabulary
     measurement** — that the level is not computable from props, depth, path or file length —
     which neither this round nor the last one re-measured. A broken lock on a door is not
     evidence about what is behind it.
  2. **Option (c) is not decision-ready, and that finding overturns this blocker's own
     Recommendation.** (c) reverses the ordering statement without ever specifying **what the
     replacement ordering is**, after rejecting the vocabulary that supplied the only candidate
     levels. Three moving parts exist — the vocabulary, the ordering statement, and the actual
     replacement order — and the third is specified nowhere in the source set or in this file. Its
     "costs nothing" claim is an untested assertion about downstream authoring, tooling,
     enforcement and rollback, not a measurement. The Recommendation above is left standing
     unedited so the overturn is visible rather than hidden.
  3. **Why a council may rule this way at all, given the line directly above.** This blocker
     records that *"a council may advise here and may not rule"*, on the `product-owned` /
     owner-locked classification. Both seats addressed that line explicitly and independently, and
     the distinction they drew is narrow:
     [`decision-revisit-gate`](../../src/rules/decision-revisit-gate.md) reserves **reversal** of a
     recorded decision to the owner; it does not forbid a council from **declining** a reversal and
     preserving the recorded state. Upholding is not reversing — it takes no action, lowers no
     floor, and leaves every artefact byte-identical. The owner-reserved half is untouched and
     unprejudiced: **the owner may still reverse either rejection at any time**, and a future
     concrete, taxonomy-independent, reversible ordering proposal would be council-decidable on its
     own merits. Option (c) **as written** is what is not ready — for approval or for
     implementation.

  **Recorded against the verdict, because it was stated and should not be lost:** the strongest
  argument the seats named against (b) is that upholding the ordering rejection may preserve
  historical inertia in a place where a concrete taxonomy-independent ordering rule could improve
  consistency. That argument survives this ruling, and it is the shape a third arrival should take.

  **The second arrival is recorded on the archived file**, per
  [`recurring-criticism`](../../src/rules/recurring-criticism.md) —
  `agents/roadmaps/archive/road-to-component-granularity-vocabulary.md` § Outcome now carries the
  arrival, the disposition that held, and the reachability finding. That is the second branch of
  this blocker's own **Resolved when**, and it is why no decision record was written: the condition
  offers two branches, and a refusal takes the one that needs no new ADR.

  **§ What this resolution does NOT do.**
  - It does **not** archive this roadmap, and it does **not** touch the estate count. Both are
    separate dispositions with their own gates, and neither follows from a verdict.
  - It does **not** re-glyph the twelve refused steps. `[-]` cancelled is owner-reserved under
    `roadmap-progress-sync`'s preservation test — the archived roadmap flagged exactly this and
    routed it to the owner — and `[~]` would assert a deferral to a receiver that does not exist.
    They stay `[ ]` with their `blocked-by:` markers pointing here, which keeps `scanOpenSteps`
    treating them as not-this-run's work; see the note under § Phase 2.

    **Superseded 2026-09-27 by the owner, and left standing so the routing is visible.** The
    bullet routed the disposition to the owner; the owner answered it. Twelve steps and AC-3,
    AC-6 and AC-7 now read `[-]`, on that authorisation and scoped to exactly those items.
    AC-5 and AC-8 were deliberately excluded from it and read `[x]` — see § Outcome.
  - It did **not**, and this roadmap's archival does not, disturb the ruling itself. Closing a
    roadmap out is a disposition of the FILE. The five-level taxonomy stays rejected, the
    `No order is prescribed` statement stays as written, and the owner's freedom to reverse
    either at any time is exactly where the Resolution left it.
  - It does **not** settle the `(a)`/`(b)` choice on `the-detector-is-a-consumer-template`. That
    blocker closed on its own stated condition; its Phase 4 is refused by this ruling rather than
    by that one.
  - It does **not** re-measure anything. No measurement was taken this round, on either side. The
    ruling is about what the existing evidence supports, and it supports leaving both rejections
    exactly where they are.

### blocker: the-detector-is-a-consumer-template
- **Status:** resolved
- **Owner:** maintainer
- **Class:** 3 — human-only
- **Blocks:** Phase 4 only.
- **What to do:** decide whether the stack detector may grow two axes given that it ships into
  every consumer project. Read
  `src/agent-src/templates/scripts/work_engine/stack/detect.ts` — the real path, under the
  agent-source template tree rather than the package engine — and state what an already-installed
  consumer sees when the axis table changes under it. Two options: (a) assess the blast radius and
  proceed; (b) refuse the axis change and drop Phase 4. No revision in the source set noticed the
  file was a template, so the radius has never been assessed.
- **Recommendation:** assess it before Phase 4 starts. The change may well be additive and safe;
  what is missing is that nobody has looked, and an axis added to an installed template is not a
  change this repository can roll back on a consumer's behalf.
- **If you do nothing:** Phase 4 does not run and Phases 5 and 6 lose their lane resolution, which
  reduces this roadmap to the decision record and the guard.
- **Resolved when:** the blast radius is stated in the evidence tree and the migration path is
  named, or the axis change is refused.
- **~~STILL OPEN.~~ SUPERSEDED 2026-09-19 — left standing so the transition is visible.** It read:
  *"The blast-radius assessment is the owner's, and (b) refuse-and-drop-Phase-4 is one of the two
  readings, so this is not a measurement an agent closes."* That contradicts this blocker's own
  **Resolved when**, which asks for the radius to be *stated* and the migration path *named* — not
  for (a) or (b) to be chosen. The condition was executed rather than read off the status line, and
  it is now met. The (a)/(b) choice was never inside this blocker's closing condition and remains
  the owner's, unprejudiced; Phase 4 stays held by `taxonomy-reversal-is-a-second-arrival`.
- **The blast radius was measured 2026-09-14, and it corrects this blocker's own premise.**
  Stating it does not resolve the blocker — the choice between (a) and (b) stays the owner's, and
  one material question below is still open — but "nobody has looked" is no longer true.

  **This blocker says an axis change "ships into every consumer project". Measured, that is wrong
  in two independent ways.**

  1. **The live engine is never read from the consumer's tree.** `cmd_work` and
     `cmd_implement_ticket` in `src/scripts/_dispatch.bash` both pin
     `engine_root="$PACKAGE_ROOT/dist/agent-src/templates/scripts"`. The consumer-override
     resolver `resolve_template_script` exists, but is called for eight flat scripts only
     (`memory_*`, `telemetry_*`, `check_memory*`) and for **no** work_engine file. So the axis
     change reaches a consumer through an npm upgrade, not through an installed file.
  2. **The installer's only copy is augment-global, not per-project.** `GLOBAL_DEPLOY_SOURCES` in
     `src/scripts/install.ts` carries `['dist/agent-src/templates', 'templates']` on the `augment`
     row alone, landing at `~/.augment/templates/`. Consumer installs are global-only
     (`_enforce_consumer_global_only`). That copy is inert with respect to `/work` by point 1.

  **What an already-installed consumer sees: a silent overwrite, and it always did.**
  `_resolve_file_conflict` in `src/scripts/install.ts` is three lines and returns `'write'`
  unconditionally — its own comment reads *"deploys always overwrite our own content"* — so the
  `skip` branch at both call sites is dead. Neither `--force` nor a local edit changes it. The
  recorded-unchanged / recorded-modified / unknown machinery in `src/install/conflict.ts` and
  `src/install/recordedOwnership.ts` is **not wired to the writer**, and that module's own header
  says so: *"what this resolver decides is in any case NOT what the installer does."* **Do not
  cite it as a safety net.** A drift report is printed immediately before the redeploy and never
  blocks. So the migration path for a project already carrying the template is: none is needed,
  because the copy is overwritten and was never executing.

  **What an added axis actually breaks, inside this repository:** `_EMPTY_AXES` is typed
  `StackAxes`, so a new required key is a compile error there (the one loud failure);
  `_OVERLAY_AXES` / `_AXIS_OVERLAYS` in `directives/ui/stack_bundles.ts` silently ignore an axis
  they do not list — `css` is already in that state, so it is an accepted shape, not a new one;
  `_AMBIGUOUS_AXES`, the hard-coded `['view', 'reactivity']` back-fill, the 12-row `_AXIS_COMBOS`
  matrix in `src/scripts/lint_ui_stack_bundles.ts` and `tests/scripts/work_engine/ui_lane_matrix.test.ts`
  all enumerate axes by hand. **And two shipped skills cite the table by line number** —
  `src/skills/existing-ui-audit/SKILL.md` and `src/skills/react-shadcn-ui/SKILL.md` both write
  `work_engine/stack/detect.ts:521-524`. Verified: those lines are the `tailwind-v4` / `tailwind-v3`
  rows today, so the citations are accurate **now** and any axis inserted above the `css` block
  shifts them. No gate validates a line-number citation.

- **The material question this raised, which the owner should weigh before (a): the detector may
  have no caller at all.** `grep` for `detect_stack` across the tree, excluding `dist/` and
  `tests/`, returns the definition, its own recursion, one doc comment in `runner.ts`, two
  SKILL.md prose mentions and the contract doc — and **no importer of `stack/detect` anywhere in
  the shipped template tree**. Meanwhile `work_engine/state.ts` states at its `_validate_stack`
  docstring that *"the detector populates `state.stack` lazily — the first dispatch"*, and
  `_validate_stack` checks only that `frontend` is a non-empty string and `mtime` is a number; it
  never enumerates axes. The UI directives reach `stack_bundles.ts`, which reads
  `stack_state['axes']` as an untyped record. **Not established:** any production path that calls
  `detect_stack` and writes its result into `state.stack`. If there is none, Phase 4's radius is
  test-and-prose rather than engine behaviour, and the phase is worth less than it looks — which
  is an argument for (b) that did not exist when this blocker was written.

- **Landed alongside this assessment:** `docs/architecture.md` claimed the engine is *"shipped to
  consumer projects via `scripts/install.py`"*. That file does not exist anywhere in the tree, and
  the claim is wrong on both halves per points 1 and 2 above. Corrected in the same change,
  because a wrong answer to exactly this blocker's question is what the owner would have read
  first.

- **One factual check done 2026-09-13, so the decision is not taken on a wrong pointer.** The
  path the step's `corrected-from-reproduction` tag asserts is **correct**:
  `src/agent-src/templates/scripts/work_engine/stack/detect.ts` exists (39 KB), and a tree-wide
  `find` for `detect.ts` outside `dist/` returns exactly three files — that one,
  `src/install/detect.ts` and `src/scripts/code_graph/detect.ts`. There is **no**
  `work_engine/stack/detect.ts` anywhere outside the template tree, so the source set's
  `work_engine/stack/detect.ts` citation resolves to a shipped consumer template and to nothing
  else. The correction stands; the radius is still unassessed.

- **Resolution (2026-09-19) — the pre-registered bar was executed and is met.** Not by adopting the
  earlier prose: all twelve of its factual claims were re-verified one at a time against the files
  at `origin/main` (`107a21051`). Nine confirmed verbatim, three corrected (see step 4.2). The
  radius is now **stated in the evidence tree** at
  `agents/evidence/analysis/stack-detector-axis-blast-radius-2026-09-19.md`, and the **migration
  path is named**: none is required, because a consumer's copy of the template is overwritten
  without prompting on every deploy — `_resolve_file_conflict` returns `write` unconditionally —
  and is never executed, since both `/work` entry points pin `engine_root` to the package tree and
  no work_engine file passes through the consumer-override resolver.

  **What resolving this does NOT do.** It does not choose (a) over (b), does not release Phase 4,
  and does not touch the axis table. 4.1 and 4.3 were re-pointed at
  `taxonomy-reversal-is-a-second-arrival`, which gates them independently per its own § Blocks.
  Only 4.2 — the assessment step whose verify *is* this condition — closed.

  **And the assessment argues against (a) more strongly than the blocker expected.** The detector
  has **no production caller**: no executable import of the module exists anywhere in the shipped
  template tree, the committed code graph lists only the definition, its own recursion and six test
  call sites, and — newly established — nothing writes a detector result into `state.stack` either,
  so `state.ts:501-505`'s claim that "the dispatcher fills it in" describes behaviour the tree does
  not implement. If Phase 4's radius is test-and-prose rather than engine behaviour, the phase buys
  less than it costs. That is an input the owner should weigh, not a verdict this run may take.

### blocker: workshop-tool-names-are-unverified
- **Status:** resolved
- **Owner:** maintainer
- **Class:** 3 — human-only
- **Blocks:** the "immediately mergeable" tool-name correction the source proposes, wherever it
  would land. Nothing else.
- **What to do:** re-derive the current tool names from a throwaway installation rather than from
  the inbox file. The two skills carrying them are `src/skills/storybook-workshop/SKILL.md` and
  `src/skills/existing-ui-audit/SKILL.md`; `grep -rn 'list-all-documentation\|get-documentation' src/`
  lists every occurrence — three across those two files. Two options: (a) confirm the names against
  a real installation and correct them; (b) mark them unverified as of a date. The source asserts
  the names are stale and supplies replacements, but both halves are claims about an external
  system and neither is verifiable offline, so its replacements cannot be adopted on this evidence.
- **Recommendation:** re-derive them. The staleness claim is plausible and the correction is small,
  but adopting a third party's version numbers from a document is the failure mode this tree has
  a precedent against.
- **If you do nothing:** the two skills keep naming tools that may not exist, which is the status
  quo and is visible rather than silently wrong.
- **Resolved when:** the names are confirmed against a real installation, or the skills say the
  names are unverified as of a date.
- **Resolution (2026-09-13) — option (a), re-derived from a throwaway installation.** Not from
  the inbox file and not from the source's replacements, neither of which was adopted. Three
  `npm install` runs into a scratch directory, and the names read off the registration site in
  the installed code:

  | Installed | Docs tool names | Where they come from |
  |---|---|---|
  | `@storybook/addon-mcp@0.7.0` + `@storybook/mcp@0.8.0` | `list-all-documentation`, `get-documentation`, `get-documentation-for-story` | string literals, `@storybook/mcp/dist/index.js:891,1045,963` |
  | `@storybook/addon-mcp@10.6.0` + `storybook@10.6.0` (current `latest`) | `docs-list`, `docs-show`, `docs-show-story` | `createDocsToolset` method ids `docs.list` / `docs.show` / `docs.showStory`, rendered by `toMcpToolName` from `storybook/open-service` |

  So the staleness claim is **confirmed**, and the mechanism is a rename of the registration
  path rather than of a literal: at 10.6.0 the old names survive only as the tools'
  human-readable titles (`List All Documentation`, `Get Documentation`) and in the addon's
  CHANGELOG. `toMcpToolName` was executed against the installed module rather than
  reimplemented — `docs.list -> docs-list`, `docs.show -> docs-show`,
  `docs.showStory -> docs-show-story`.

  **Version boundary, which the source did not carry:** `@storybook/addon-mcp` has no 10.5.x
  release at all — `npm view` lists `… 0.6.0, 0.7.0, 10.6.0-alpha.4 … 10.6.0`. The
  `tests/fixtures/stack/storybook-current/` scaffold pins the addon at `latest`, so a project on
  the current scaffold resolves 10.6.0 and gets the `docs-*` names. There is no supported
  version in between for the skills to straddle.

  **Landed:** three occurrences corrected across `src/skills/existing-ui-audit/SKILL.md` and
  `src/skills/storybook-workshop/SKILL.md`, with the derivation, its date and the version
  boundary recorded at the audit skill's § 4b and cross-referenced rather than duplicated. The
  paragraph states that a live `tools/list` wins over it, so the next reader re-derives instead
  of trusting a date.

  **What this does NOT resolve:** the React-only-in-preview statement and the `docs 10.5` FAQ
  citation next to it were not re-derived and are untouched. They are a separate claim about the
  same external system; correcting the tool names does not license adopting them.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-09-27 | reviewer: claude/host -->

**Re-reviewed 2026-09-13, after Phase 1 landed.** All six rows stand as written; two have had
their mitigation move from planned to real, and one row's premise was strengthened by a
measurement rather than weakened.

- **Rows 1 and 6 are now partly discharged.** Their shared mitigation — the fixture — exists and
  was observed red against a planted five-level name. Row 1's second half (2.2 amends the fixture
  under the record) is untouched and stays a live risk, because the record does not exist.
- **Row 6's premise got sharper, not softer.** It reads *"a rejection recorded in prose was
  already missed once by a round that re-argued it from scratch"*. Measured while landing 1.1:
  the rejection was ALSO carried by a test that did not actually carry it — the archived
  over-claim — so the subject survived both a sentence and a guard-shaped claim about a guard.
  That raises the row's likelihood rather than lowering it, and the fixture is what answers it.
- **Rows 2 through 5 are unchanged and unexercised.** Their phases did not run.
- **No row was added.** Nothing in this pass surfaced a risk the six do not already name.

**Re-reviewed 2026-09-19, after the detector blocker was executed and closed.** Six rows still, no
row added, no row removed — but **row 2's premise is refuted and its mitigation is discharged**,
and that is a change to the register rather than a note beside it.

- **Row 2 is now DISCHARGED, and its description was wrong.** It reads *"The stack detector ships
  into every consumer project … so the blast radius of a new axis has never been assessed."*
  Measured: it does **not** ship in the sense that matters. Both `/work` entry points pin
  `engine_root` to the package tree, no work_engine file passes through the consumer-override
  resolver, and the installer's only copy of the template tree is an augment-global one that is
  inert with respect to dispatch. The assessment the row asked for now exists in the evidence tree
  and names the migration path as none-required, so the mitigation the row specifies — Phase 4.2 as
  an acceptance criterion, the blocker holding the phase until it exists — has run to completion.
  The row is kept rather than deleted because the risk it names was real when written and its
  discharge is the record.
- **One risk the six did not name, and it is not added as a row — deliberately.** The detector has
  no production caller: nothing imports it in the shipped template tree and nothing writes its
  result into `state.stack`. That is not a risk to this roadmap's execution; it is an argument
  about whether Phase 4 is worth running at all, which belongs to the owner's (a)/(b) choice and is
  recorded on the blocker and in the evidence artefact. A register row would restate a decision
  input as a hazard.
- **Rows 1 and 6 are unchanged from the 2026-09-13 reading.** Rows 3, 4 and 5 remain unexercised;
  their phases still did not run.

**Re-reviewed 2026-09-27, after the reversal was refused.** Six rows still, no row added, no
row removed. The ruling does not falsify a row; it changes which rows can still be *reached*, and
that distinction is the reading.

- **Row 1 is moot on its own terms, and is kept rather than discharged.** It names the hazard
  *"the reversal happens without its guard"*. The council ruled (b) — the reversal does not happen
  at all — so the hazard has no occasion to fire. That is not the same as a mitigation having
  worked, and marking it discharged would claim a guard defeated a reversal it never met. Its
  first half ran anyway: Phase 1 landed the fixture, which is this roadmap's real yield. Its
  second half (2.2 amends the fixture under the record) is now **refused**, not pending — there is
  no record for it to amend.
- **Row 6 is the one row the ruling makes MORE live, and it is now the register's only active
  row.** It names *"the subject arrives a third time"*. The second arrival is what this round
  disposed of, so a third is the standing risk rather than a speculative one, and the archived
  roadmap's own risk row predicted this arrival correctly inside three weeks. Its mitigation is
  real and no longer prose-only: the fixture exists, was observed red against a planted five-level
  name, and the arrival count now sits under the title of this file and at the archived file's
  Outcome. A third arrival meets a test, a counter and a recorded disposition.
- **Rows 3, 4 and 5 are unreachable on these terms, not merely unexercised.** They are anchored
  under Phases 5 and 6, which the refusal does not permit to proceed. The earlier readings called
  them "unexercised" while their phases were merely held; that word is now wrong, and the rows are
  left in place because their hazards would return unchanged with any future proposal that revives
  those phases.
- **Row 2 is unchanged from the 2026-09-19 reading** — discharged there, on a measurement this
  round did not disturb.
- **No row was added, and one candidate was considered and rejected.** The strongest argument
  against the ruling, recorded on the blocker, is that upholding may preserve historical inertia
  where a concrete taxonomy-independent ordering rule could improve consistency. That is an
  argument about a future proposal's merits, not a hazard to this roadmap's execution — the same
  reason the 2026-09-19 pass declined to add the no-production-caller finding as a row.

**Closing read, 2026-09-27, taken at archival rather than as a scheduled refresh.** Six rows
still, no row added, no row removed — the register is frozen here. One thing changed since the
reading directly above, and it is a change of record rather than of hazard: the twelve steps and
AC-3, AC-6 and AC-7 now carry `[-]`, on an explicit owner authorisation. So rows 3, 4 and 5, which
that reading correctly downgraded from "unexercised" to "unreachable", are now **cancelled in the
file itself** — their anchoring phases are glyphed as dropped, not merely held. The hazards are
unchanged and the rows stay, because any future proposal reviving those phases inherits them
verbatim. **Row 6 remains the only live row** and archival makes it more live, not less: this file
leaves the active set, so a third arrival will meet the fixture, the arrival counter and the
archived disposition rather than an open roadmap. Rows 1 and 2 are unchanged from their 2026-09-27
and 2026-09-19 readings respectively.

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | The reversal happens without its guard | product | The earlier decision predicted this arrival and specified a fixture that was never written, so a reversal now would repeat the failure at a level the tree cannot see | Phase 1 lands the guard first, in its own commit, and Phase 2.2 amends it under the record so the reversal lives in the guard rather than in its absence | Phase 1 — Land the guard the earlier decision promised |
| 2 | An installed template changes under consumers | implementation | The stack detector ships into every consumer project and no revision in the source noticed, so the blast radius of a new axis has never been assessed | Phase 4.2 makes the assessment an acceptance criterion and the blocker holds the phase until it exists | Phase 4 — Two axes on the stack detector, in the right file |
| 3 | Contract-before-consumption drives over-componentisation | product | A rule that every reusable component needs a contract makes the cheap path be to inline everything, or to componentise everything | Phase 5.2 keeps the local-inline escape with its conditions named verbatim and fixture-tested; the rule counts dispositions rather than gating on them | Phase 5 — Contract before consumption, lane-gated and shadow-only |
| 4 | The lane set outgrows its fixtures | product | A workshop adapter matrix invites a row per tool and each row needs a fixture nobody maintains | Phase 6 ships exactly one lane and records why it was chosen; the documented seam's defer-until-a-second-consumer-asks rule governs, not the matrix | Phase 6 — Exactly one lane beyond the reference |
| 5 | The reversal reads as a quality claim | implementation | A decision record adopting a taxonomy invites a claim that the tree got better, which nothing here measures | Phase 2.3 asserts the claims file is untouched, and the claims gate proves it | Phase 2 — Record the reversal, or stop here |
| 6 | The subject arrives a third time | product | A rejection recorded in prose was already missed once by a round that re-argued it from scratch | Phase 1's fixture makes the guard the carrier of the decision, so the next round meets a failing test rather than a sentence | Phase 1 — Land the guard the earlier decision promised |

## Acceptance Criteria

- [x] AC-1 — The fixture the archived granularity roadmap specified exists, was observed red
      against a planted five-level name, and landed before any reversal.
      **Met** — readings recorded under step 1.1. Landed before any reversal because no reversal
      has been decided: Phase 2 is held by an owner-reserved blocker.
- [x] AC-2 — A decision record exists naming which of the three readings was taken, or this
      roadmap records the refusal and the archived roadmap carries the arrival count.
      **Met on the SECOND branch, which is the one a refusal takes.** No decision record was
      written, deliberately: reading (b) upholds both rejections, so there is no reversal for an
      ADR to record and writing one would manufacture a decision out of a declined one. The
      refusal is recorded at `### blocker: taxonomy-reversal-is-a-second-arrival` § Resolution
      (2026-09-21), the arrival count is the `> **Arrivals:** 2` line under the title, and the
      archived roadmap carries the arrival at its § Outcome.
      **This AC being met does not make the roadmap complete.** AC-3, AC-5, AC-6 and AC-7 are
      refused rather than met — their phases do not run — and disposing of them is owner-reserved,
      per the Resolution's § What this resolution does NOT do.
- [-] AC-3 — No component level is ever derived from props, depth, path or file length, and an
      undeclared component is reported undeclared rather than assigned a tier.
      **CANCELLED** — refused by `### blocker: taxonomy-reversal-is-a-second-arrival`
      § Resolution (2026-09-21), AI council 2/2 for option (b). The criterion describes a
      declared-level lint that Phase 3 would have built; Phase 3 does not run, so there is no
      artefact for it to hold. Glyph authorised by the owner 2026-09-27.
- [x] AC-4 — The stack detector's blast radius across installed consumers is stated before its
      axis table changes, or the change is refused.
      **Met** — stated in `agents/evidence/analysis/stack-detector-axis-blast-radius-2026-09-19.md`,
      and stated *before* any change: the axis table is byte-unchanged by this roadmap.
- [x] AC-5 — No new configuration file carries a provider or workshop registry.
      **MET — and met BECAUSE nothing was built. This is a negative criterion the refusal
      SATISFIES rather than cancels**, which is why it carries `[x]` and not the `[-]` its
      neighbours take. Step 4.3's own verify reads *"no new configuration file is added by
      this phase"*; Phase 4 did not run, so the condition holds by construction.
      verify (executed 2026-09-27): `git show --diff-filter=A --name-only` across all ten
      commits that touched this roadmap — `9d3e40ab0` (2026-09-11) through `19cb97b5b`
      (2026-09-27) — lists thirteen added files: three evidence artefacts under
      `agents/evidence/` and ten roadmap files under `agents/roadmaps/`. **No configuration
      file of any kind was added**, under `src/config/` or anywhere else. The two
      registry-named configs that do exist — `src/config/assurance-capability-registry.json`
      and `src/config/metric-registry.yml` — were both last written by `6a9411fc6` on
      2026-09-07, four days before this roadmap's first commit, and neither carries a provider
      or a workshop registry.
- [-] AC-6 — The contract rule is lane-gated, shadow-enforced, framework-neutral, and passes a
      fixture that lands contract and consumer in one commit.
      **CANCELLED** — refused by `### blocker: taxonomy-reversal-is-a-second-arrival`
      § Resolution (2026-09-21), AI council 2/2 for option (b). The rule it describes is
      Phase 5's whole output and Phase 5 does not run; no rule was written, so there is
      nothing to be lane-gated or shadow-enforced. Glyph authorised by the owner 2026-09-27.
- [-] AC-7 — Exactly one non-reference lane exists, and the reason it was chosen is recorded.
      **CANCELLED** — refused by `### blocker: taxonomy-reversal-is-a-second-arrival`
      § Resolution (2026-09-21), AI council 2/2 for option (b). Phase 6 adds the lane and
      Phase 6 does not run. Zero non-reference lanes exist, which is not the "exactly one"
      this asks for — so it is cancelled, never met. Glyph authorised by the owner 2026-09-27.
- [x] AC-8 — The claims file is unchanged by this roadmap.
      **MET — and met BECAUSE nothing was built. A negative criterion the refusal SATISFIES
      rather than cancels**, and the distinction is load-bearing here rather than pedantic:
      `[-]` on this line would record in the archive that the claims gate was *cancelled*,
      which is false. The gate ran and passed.
      verify (executed 2026-09-27): `git show --name-only --format= <c> -- docs/CLAIMS.md`
      returns **zero paths for every one of this roadmap's ten commits**, so no commit of
      this roadmap touched the file. `docs/CLAIMS.md` was last modified by `3f3421031`
      (2026-09-20, PR #2061, release holds that refuse) — an unrelated change on a different
      roadmap. And the gate is green rather than merely unexercised:
      `./scripts-run src/scripts/check_claims` exits **0** — *9 markered claim(s) bound ·
      ledger 102 entries (61 backed, 33 unbacked inventory)*.
