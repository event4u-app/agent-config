---
complexity: structural
status: ready
parent_roadmap: road-to-continuity-retirement-sequencing
execution:
  mode: phase-checkpoints
estate_growth_exempt: "Receiver for five items carried out of road-to-continuity-retirement-sequencing, which is archived by the same change — the estate is flat, not larger. It cannot be folded into any active roadmap: the carried items are the automatic writer and the retirements that depend on it, and the only other file that ever owned them is the one being archived. Its predecessor road-to-one-continuity-record is archived too. The alternative to this file is dropping five items an owner authorised and two councils sequenced, which is the outcome both councils named as the failure mode."
estate_offset_exempt: "Offset in the same change by archiving agents/roadmaps/archive/road-to-continuity-retirement-sequencing.md, which reaches 100% with this file as its declared carry destination. Recorded rather than omitted because the archival and the addition are one commit and a reader should not have to reconstruct that they pay for each other."
---
# Road to continuity writer activation

> **Source:** the five items carried out of
> `road-to-continuity-retirement-sequencing` when it closed on 2026-09-08, each
> under a recorded ruling. Two AI councils sequenced this work — 2026-09-07
> (transcribed in `agents/roadmaps/stubs/road-to-continuity-retirement-sequencing.md`)
> and 2026-09-08 (transcribed verbatim in
> `agents/evidence/analysis/council-2026-09-08-continuity-retirement-scope.md`).
> Nothing here is a new proposal; every item arrives with its ruling attached.

> **`status: ready`, deliberately, and the alternative was measured.** With
> `status: draft` this file is invisible to `check_estate_count`: the estate
> reads 8 active roadmaps and 38 open blockers, and the five blockers below
> count for nothing. With `ready` it reads 9 and 43, the growth is attributed
> to this file's `estate_growth_exempt` claim, and the gate passes on the
> claim rather than on the invisibility. Both readings were taken. Shipping the
> first would be using a status word to dodge a count — the same
> gameable-by-naming failure the 2026-09-08 council flagged on the continuity
> axis, applied to the estate axis instead. The work is real, so it is counted.

## Goal

After this roadmap the tree writes its continuity record automatically at the
moments context ends, the surfaces that record replaces are gone with their
readers, and the five end-state numbers that
`check_continuity_surface` already derives read `0 / 0 / 1 / 1 / 0`.

They read `1 / 2 / 5 / 1 / 1` today. That is not an estimate — it is the gate's
output on the tree this file lands in, and the same command will say whether
this roadmap achieved anything.

## What is already done, so nobody rebuilds it

The predecessor shipped the parts that had to come first, and the sequence both
councils required puts them there on purpose:

- **The measurement.** `src/scripts/check_continuity_surface.ts` plus
  `src/config/continuity-surface.json` derive the five numbers from a
  behaviourally-discovered inventory and ratchet them against the base ref. AC-8
  of the predecessor is closed by it.
- **The schema variant.** `continuity_record`
  (`src/scripts/_lib/subagent_capsule.ts`) exists, its forbidden and required
  key sets are declared, and the validator dispatches on `variant` before
  anything else. Tolerant readers therefore exist BEFORE any writer, which is
  the ordering the 2026-09-07 council made a precondition.
- **The reader.** `handoff_context_hook` consumes the new shape through the
  same guards as the old one, and behaves by `session_start` `source`.

## Phase 1 — the writer, behind its own switch

- [x] **1.1 Settle the authoritative record slot before anything writes to it.**
      The producer, the single consume-by-rename record and the
      validating-and-destructive consumer form a one-slot queue with no
      documented conflict ownership. Automatic production changes contention
      from rare to routine, so the policy stops being theoretical. Pick one of
      safe-skip, quarantine, or a bounded multi-record queue, and write the
      state machine down: absent, published, consuming, consumed, quarantined,
      conflicting.
      verify: a contract document names the chosen policy and every state; a
      storage-adapter test interrupts before and after the atomic rename and
      shows no partial authoritative record in either case; a retry over an
      occupied slot neither overwrites nor destroys the unconsumed record.
      landed: policy `supersede-own · refuse-foreign · quarantine-unusable ·
      never-go-backwards`, written in `docs/contracts/continuity-record-slot.md`
      and implemented by `src/scripts/_lib/continuity_slot.ts`. Both rejected
      alternatives are rejected on tree evidence: create-if-absent IS Risk 2 of
      this roadmap, and a bounded multi-record queue needs the recency
      resolution `src/scripts/_lib/recycle_envelope_paths.ts:61-66` locks out
      and `resolveContinuityRecord` refuses. `consuming` is a transition and not
      a disk state, because both publication
      (`src/scripts/hooks/state_io.ts:495-499`) and consumption
      (`src/scripts/handoff_context_hook.ts:199`) are one `renameSync` inside
      one directory. 15 fixtures in
      `tests/scripts/_lib_continuity_slot.test.ts`, all green; sensitivity shown
      by neutralising the foreign-refusal, the monotonic guard and
      quarantine-not-delete in turn and watching the matching fixture go red.
- [x] **1.2 A deterministic writer that runs without model spend, default-off.**
      It emits the `continuity_record` variant, computes every field from
      on-disk state, and is gated by its own settings switch defaulting to
      `false`. Default-off is not caution for its own sake: until 1.1 is
      settled and 1.3 is measured, enabling it by default would put an
      unverified producer on the normal path.
      verify: a session ending at a bound slot leaves a record without model
      spend; a session that did nothing substantive leaves none; the count comes
      from the concern's own state, never from file presence; with the switch at
      its default the tree behaves exactly as it does today.
      landed: `src/scripts/_lib/continuity_writer.ts` builds the record from
      on-disk state only, and `writeContinuityRecord` in
      `src/scripts/hooks/session_eol_hook.ts` publishes it through step 1.1's
      slot. The handler sits INSIDE the existing `session-eol` concern, so
      `concern_count` stays at its floor of 58 — the manifest split is step 2.1
      and stays blocked. Armed by `continuity.auto_record`, which ships `off`
      (`src/config/agent-settings.template.yml`, class C in
      `docs/contracts/settings-classes.md`). It fires from the raw recycle
      threshold rather than the once-per-session advisory stamp, so a later Stop
      supersedes rather than freezing the record at the moment the session
      crossed. Two bounds are stated rather than hidden: a session with no
      claimed roadmap leaves NO record, because the only deterministic source of
      an `acceptance_criteria` entry in this tree is the claimed roadmap and a
      placeholder would assert a definition of done nobody set; and the anchor
      fields `session:recycle` collects with `git status` are omitted, trading
      one drift line for a Stop path that spawns nothing. 17 fixtures in
      `tests/scripts/continuity_writer.test.ts`, all green; sensitivity shown by
      forcing the switch hard-on (3 red), hard-off (3 red), and by neutralising
      the substantive gate (2 red) and the claim gate (1 red) in turn.
- [x] **1.3 Parity, in the two halves the 2026-09-08 council separated.**
      Transformation parity is a fixture suite — recorded transcripts and
      roadmap states in, field-by-field comparison out, written to a scratch
      directory that is neither the authoritative filename nor the authoritative
      directory. Runtime parity is activation, consumption, publication and
      failure isolation exercised against the real dispatcher and storage
      adapter with controlled failures. A wall-clock soak is explicitly NOT
      required — both seats agreed a soak adds nothing a controlled-failure
      integration test cannot show.
      verify: the fixture suite covers valid, malformed, stale,
      foreign-workspace, missing-trace, directive-bearing, interrupted and
      existing-target cases and cannot touch an authoritative record; the
      integration tests show at-most-one authoritative publication, no
      overwrite, no partial file, retry-safe convergence, correct source
      routing, and one handler's failure not suppressing another's.
      landed: transformation parity in
      `tests/scripts/continuity_parity_fixtures.test.ts` — 12 fixtures over all
      eight named cases, each carried through the REAL consumer
      (`consume_recycle_envelope`) rather than only through the writer, because
      a writer whose own consumer refuses its shape has parity with nothing.
      Every built record is parked in `<scratch>/parity-out/`, and a closing
      fixture walks the whole scratch tree to prove the suite created no
      authoritative record anywhere. Runtime parity in
      `tests/hooks/continuity_writer_dispatch.test.ts` — 8 fixtures driving the
      real `dispatch_hook` over the real manifest with a real `stop` and
      `session_start` envelope: at-most-one publication, no overwrite of a peer
      session's record, no temp litter, retry-safe convergence across repeated
      Stops, `source=resume` not consuming while `source=startup` does, and both
      directions of failure isolation. No wall-clock soak, per the 2026-09-08
      council. One fixture was CORRECTED before landing: planting a directory at
      the record name does not refuse a publish — the slot policy quarantines it
      by rename and then succeeds — so the test asserted isolation without ever
      failing; it now blocks the quarantine DESTINATION, which is the one branch
      that returns a refusal before any write. Sensitivity: removing the handler
      call from the hook reds 4 of the 8 runtime fixtures, and neutralising the
      foreign-refusal reds the no-overwrite fixture.
- [x] **1.4 Independent kill switches, and a rollback note that distinguishes
      the two kinds of undo.** The continuity writer, `run_checkpoint`
      production and the session-index restore each get their own switch, and
      disabling one restores pre-change behaviour for that handler only.
      Rollback documentation must separate disabling new behaviour from
      reverting a deletion — a switch cannot bring back a removed command.
      verify: a test disables each switch in turn and shows the other two still
      fire; the rollback note names the residual behaviour of each switch and
      the trip criteria that should cause an operator to throw one.
      landed: `continuity.auto_record` (new, ships `off`),
      `continuity.run_checkpoints` (new, ships `on` — that is the behavior the
      tree already had) and `memory.session_index` (pre-existing, ships `off`).
      The two new readers have deliberately OPPOSITE failure polarity, and both
      directions are pinned by fixtures: `auto_record_enabled` fails closed so an
      unreadable cascade leaves the new producer disarmed, while
      `run_checkpoints_enabled` fails open so the same cascade never silently
      removes a recovery aid the tree already had. Rollback note in
      `docs/contracts/continuity-rollback.md`, which leads with the distinction
      the step asked for — disabling new behavior is a switch, reverting a
      deletion is a commit — and names, per switch, the residual behavior and
      the trip criteria, plus a closing section on what no switch can undo
      (a retired command, concern, advisory, or an already-written record).
      6 fixtures in `tests/hooks/continuity_switches.test.ts` over the real
      dispatcher on both slots: an all-armed baseline, then one case per switch
      asserting all THREE outcomes, so an entanglement fails rather than
      passing. Sensitivity: forcing `auto_record` on reds 2, forcing
      `run_checkpoints` on reds 1, inverting the checkpoint guard reds 5.
      One claim was NARROWED on measurement rather than asserted: with
      `memory.session_index` armed the fixture emits no `memory-index` block,
      because a scratch workspace carries no curated corpus to index — measured
      `false`, so the case now claims only what it observes (the stop handlers
      are identical either way, and OFF injects nothing) and points at
      `tests/scripts/session_memory_index.test.ts` for the injection half.

## Phase 2 — the split the concern ratchet currently forbids

- [ ] **2.1 Three concern ids with three kill switches, paid for by a retirement.** <!-- blocked-by: three-concern-split-is-unpaid-under-the-concern-ratchet | asked: yes -->
      `hook_manifest.yaml` declares the continuity-record writer,
      the run-checkpoint writer and the session-index restorer separately, with
      a fault-injection test over every handler combination showing no
      cross-suppression. **This step cannot be attempted before a concern is
      retired.** `check_estate_count` ratchets `concern_count` with allowance 0,
      splitting one concern into three is +2, and both seats of the 2026-09-08
      council refused a temporary allowance. The order is therefore fixed:
      Phase 3 first, then this.
      verify: `concern_count` at HEAD is at or below the base ref's while three
      separate ids exist; the fault-injection test exercises every combination
      and shows no handler's failure suppressing another's.

## Phase 3 — the retirements, each with its own gate

- [ ] **3.1 `hot-context` — retire the concern, relocate the restore.** The
      2026-09-07 council (D3) authorised retiring the concern and required
      evidence of equivalence plus an explicit trust contract before the
      `memory.session_index` restore moves anywhere: repository and worktree
      identity, path canonicalization, freshness, ordering, duplicate invocation
      and size limits, because *"restored memory is untrusted context"*. A
      global kill switch is inadequate — an operator must be able to disable
      restoration while continuity writing and run verification stay active.
      verify: the relocated restore produces byte-identical output to today's
      for the same inputs; the trust contract is written and each of its six
      properties has a test; `check_continuity_surface` shows the artefact axis
      one lower.
      measured 2026-09-08, so the next lane re-decides rather than re-derives.
      **Five of the six trust properties do not exist yet**, which makes this
      step feature work on a trust boundary and not a relocation:
      `src/scripts/session_memory_index.ts` (94 lines) implements SIZE LIMITS
      only (`SESSION_INDEX_ROW_CAP` at `:28`, double-capped at `:57-65`), and
      carries no repository/worktree identity check, no path canonicalization,
      no freshness bound, no declared ordering and no duplicate-invocation
      latch — grepped for each at HEAD, all zero hits. D3 requires a test per
      property, so five have to be BUILT first.
      The rest of the surface, enumerated: the concern id appears **17 times**
      in platform slot lists across 7 hosts plus its definition and 5 comments
      (`src/scripts/hook_manifest.yaml:49`, `:55-59`, `:64`, `:609`, `:692`,
      `:1263`, `:1265`, `:1270`, `:1272`, `:1284`, `:1292`, `:1314`, `:1326`,
      `:1349`, `:1351`, `:1364`, `:1366`, `:1383`, `:1384`, `:1400`, `:1402`);
      `src/scripts/hooks/concern_registry.ts:28` and `:91` (keyed by SCRIPT
      path, not concern id — the surface most often missed);
      `src/config/hook-token-budget.json:11-12` and `:66`;
      `src/config/continuity-surface.json:207-213`, whose `locus` is a
      file:line pointer the gate resolves; `src/scripts/lint_knowledge_scale.ts`
      `:21`, `:42`, `:209-228`; prose in `src/scripts/routing_doctor.ts:28`,
      `src/scripts/_lib/obligation_frequency.ts:245`,
      `src/config/agent-settings.template.yml:1128` and
      `src/server/schemas/settings.ts:452`; and 5 test files.
      Two constraints that shape it: the MODULE must survive the concern's
      retirement, because `src/scripts/_cli/handoff_generate.ts:12`, `:17` reuse
      `build_hot_context` and `src/scripts/_lib/loss_class.ts:7` plus
      `src/scripts/check_loss_class_declared.ts:29` name `hot_context_hook` as
      the ONE module qualifying `ephemeral-lossy`; and the byte-identity proof
      needs a non-empty curated memory corpus, which no fixture in the tree has
      — measured during step 1.4, an armed `memory.session_index` emits no
      `memory-index` block in a scratch workspace, so a byte-identity fixture
      built today would compare two empty strings.
      NOT attempted in the 2026-09-08 writer lane, and the reason is the same
      falsifier openai named for Phase 1: five new trust properties, 17
      bindings across 7 hosts and a corpus fixture do not fit one atomic review
      unit. What would falsify the descope: a lane that can carry the five
      properties with their tests, the corpus fixture, and the 17 bindings in
      one reviewable change.
- [ ] **3.2 `session:recycle` — retire the manual writer once the automatic one
      is proven.** It is the only writer today, so this step is gated on Phase 1
      in full, not merely started. The advisory that instructs a human to run it
      before `/clear` goes with it — that advisory IS the counted normal-path
      manual action.
      verify: `check_continuity_surface` shows `public_continuity_commands` and
      `normal_path_manual_actions` both one lower; no reader of the retired verb
      remains in the tree.
      **A gate this step did not state, found 2026-09-08 when Phase 1 closed.**
      Phase 1 is now complete in full, so this step's own precondition is met —
      and it still cannot land, because 1.2's `verify:` REQUIRES the automatic
      writer to ship `off` (`continuity.auto_record`, and the tree must "behave
      exactly as it does today" at that default). Retiring the manual writer
      while the automatic one is disarmed would leave the normal path with NO
      writer at all, which is a continuity hole rather than a retirement. The
      missing intermediate is a default flip from `off` to `on`, which this
      roadmap does not carry as a step and which no agent may take: the key is
      class C (`docs/contracts/settings-classes.md`), so `settings:set` refuses
      it by construction, and 1.2 records the reason the default is off — the
      parity evidence exists (step 1.3) but the decision to put a second
      producer on the normal path is a maintainer's. So this step is gated on
      "Phase 1 in full AND the default flipped", and only the first half is
      done.
- [ ] **3.3 `context-fill.json` — retire it, or record that its parked consumer keeps it.** <!-- blocked-by: context-fill-retirement-has-a-parked-consumer | asked: yes -->
      Authorised by the 2026-09-08 council on producer/no-consumer
      evidence that turned out incomplete: there is no consumer in code, but
      `agents/roadmaps/later/road-to-cost-parity-2-state-aware-dispatch.md` has
      open steps 1.1 and 1.4c that read it as a planned input, and 1.4c is
      specifically about bounding its staleness. That roadmap's owner decides,
      not this one.
      verify: either the file and its producer are gone and that roadmap's steps
      are re-anchored in the same change, or its inventory row records the
      owner's decision to keep it.
- [ ] **3.4 `/chat-history` and `/chat-history import` — retire the two commands.** <!-- blocked-by: chat-history-command-retirement-authorization | asked: yes -->
      Named in the owner's 2026-09-06 authorisation and blocked in
      the predecessor only because the 2026-09-08 council required a non-use
      audit and the audit found dependencies rather than none: the surviving
      `/agent-handoff` command points users at `/chat-history import` as a
      crash-recovery path (`src/domains/meta/agent-handoff/command.md:254`,
      `:259`, `:267`), and `docs/command-flows.md`, `docs/catalog.md`,
      `src/packs/memory/README.md` and
      `src/agent-src/contexts/communication/rules-auto/slash-command-routing-policy-mechanics.md:18`
      all carry references. These are downstream changes rather than
      impossibilities — but they are removals of a documented affordance, so
      they land deliberately and together.
      verify: the two command documents are gone; every reference above is
      updated in the same change; `check_continuity_surface` shows
      `session_resume_pickers` one lower; the generated command projections are
      regenerated rather than hand-edited.

## Disposition, 2026-09-08 — the record changed, the progress did not

A drain lane took this roadmap, verified every blocker against the tree rather
than against its own prose, and put the disposition to a full-strength AI
council (`anthropic/claude-sonnet-4-5` + `openai/codex-default`, 2/2 present,
2 rounds, depth deep, peer review on, quorum 2/2, $0 — subscription transport,
**no degradation: 4 calls made, 4 scorable**). Transcribed verbatim in
[`council-2026-09-08-continuity-writer-disposition`](../evidence/analysis/council-2026-09-08-continuity-writer-disposition.md).

**What the verification found, and it corrected the lane's own brief.** The lane
was told to expect the roadmap to be mostly or entirely blocked. It is not:
Phase 1 is real, available work that no blocker gates. Both seats then corrected
the lane's evidence for that in the other direction, and the correction is
recorded because it went against the reading the lane brought them — openai:
*"'No step carries a `blocked-by` annotation' is evidence of deficient
dependency modelling, not independently proof that nothing is blocked. Prose
constraints can still be normative."* Both readings are now true at once: the
blockers below gate what they say they gate, and the steps say so.

**Both seats chose option C**, in four ordered parts. Three of the four are done
in this change; the fourth is not, and the reason is stated rather than implied:

1. **Discharge the telemetry blocker durably** — done, and as a file-level
   banner rather than the one-line header the entry offered, because the
   collector's source is **absent** and a regeneration could otherwise recreate
   the defect.
2. **Repair the dependency model** — done. Every blocker that gates a step now
   carries a `blocked-by` annotation on that step's own checkbox line, so the
   roadmap's checkboxes enforce what its prose asserted. anthropic named the
   free-floating list *"a deliverable flaw"*.
3. **Split authorization from execution on the command retirement** — done. The
   governance record was read rather than assumed: the 2026-09-08 council made
   the retirements *conditional on a proven non-use audit*, that condition
   explicitly names documentation, and the audit found documentation. The
   condition is unmet, so the maintainer's decision is genuinely outstanding.
4. **A bounded, default-off Phase 1 vertical slice** — **NOT attempted.** This is
   a descope, not an oversight. **Superseded 2026-09-08 by the second lane
   below, which carried Phase 1 in full** — the falsifier openai named for this
   descope fired. Left standing rather than deleted: the reasoning is what the
   next descope has to clear, and a record that only shows the outcome cannot
   be argued with.

### Why Phase 1 was not attempted, and what would falsify that

openai named the falsifier for reverting to a disposition-only deliverable:
*"conflict handling, failure tests, and safe rollback cannot fit into one atomic
review unit."* Applied honestly to this lane, it fires. Both seats also agree
Phase 1 is one architectural unit — openai: *"'Execute Phase 1 — or as much as
one lane can carry' permits unsafe partial completion. The state machine,
persistence protocol, controlled-failure tests, and rollback behavior form one
architectural unit."*

The measured surface, so the next lane can re-decide rather than re-derive:
1.1 needs a contract document plus storage-adapter tests that interrupt on both
sides of an atomic rename; 1.2 a new writer concern in `hook_manifest.yaml`, a
settings switch, and field computation against
`src/scripts/_lib/subagent_capsule.ts` (1,014 lines, and the
`continuity_record` variant plus its required-key set already exist at `:147`
and `:195`); 1.3 an eight-case fixture suite **and** runtime integration against
the real dispatcher and storage adapter with controlled failures; 1.4 three
switches, a rollback note, and a test per switch. It must land without growing
`concern_count`, whose allowance is `0`.

**What would falsify this descope:** a lane that can carry the state machine,
the writer, the failure tests and the rollback in one reviewable change. That is
a capacity question about the lane, not a property of the work — anthropic's
bounded-slice alternative (conflict policy plus state machine, the writer with
input validation, a minimal fixture-plus-one integration test, **one** kill
switch, and the remainder documented) is the shape to try first, and it is
recorded here rather than discarded because the two seats did not agree on it.

**What this change does NOT do.** It closes no step, moves no axis, and writes no
code on the continuity path. `check_continuity_surface` reads `1 / 2 / 5 / 1 / 1`
before and after — verified, not assumed. The one behavioural artefact it
touches is a metrics report that was never evidence.

## Disposition, 2026-09-08 (second lane) — Phase 1 closed, no axis moved

The descope the section above recorded has been **falsified in the direction it
named**. openai's falsifier was *"a lane that can carry the state machine, the
writer, the failure tests and the rollback in one reviewable change"*, and
anthropic's bounded-slice shape was *"the shape to try first"*. Phase 1 landed
in full — 1.1, 1.2, 1.3 and 1.4 — in four chunked commits, so item 4 of that
section ("NOT attempted") is superseded rather than contradicted.

**What did NOT happen, and it is the more important half.** No axis moved.
`check_continuity_surface` reads `1 / 2 / 5 / 1 / 1` before and after — measured
at the start of the lane and again after the last commit. Risk 1 of this roadmap
is *"the writer lands and the retirements never do… that would look like
completion"*, and this change is exactly that shape. It is reported rather than
narrated past, which is what the risk's own mitigation asks of the gate's output.

Three findings correct the record rather than adding work:

1. **The concern-split payment does not add up.** The blocker below instructed
   "land Phase 3 first, retiring `hot-context` is the payment". Measured:
   `concern_count` is 58 at HEAD against a floor of 58, the retirement takes it
   to 57, and a three-way split lands at 59 (+2) or 60 (+3). The reorder is
   necessary and no longer sufficient; the entry now carries the arithmetic.
2. **Step 3.1 is feature work, not a relocation.** Five of the six trust
   properties D3 requires a test for do not exist in
   `src/scripts/session_memory_index.ts` — only size limits do. Step 3.1 now
   carries the full measured surface so the next lane re-decides instead of
   re-deriving.
3. **Step 3.2 has a gate it never stated.** Its precondition ("Phase 1 in full")
   is now met and it still cannot land: 1.2 requires the automatic writer to
   ship `off`, so retiring the only manual writer would leave the normal path
   with none. The missing intermediate is a default flip, which is a class-C key
   no agent may write.

Phase 1 was carried WITHOUT the council: both configured seats read
`50/50 · exhausted` on `council_cli quota` at the start of the lane, and
`council_cli status` additionally reported anthropic `unavailable`. Nothing was
put to a council and no verdict is claimed. Every decision this lane took inside
Phase 1 was bounded by a recorded prior ruling (the 2026-09-07 D2 on independent
switching, the 2026-09-08 refusal of a temporary allowance, the 2026-09-08
separation of the two parity halves and its rejection of a soak); the three
maintainer-owned blockers were not touched.

## Blockers

### blocker: capture-endpoint-rename-is-owner-reserved

- **Status:** open
- **Owner:** maintainer
- **Asked:** 2026-09-08, by the AI council convened during the predecessor's drain run (2 seats, anthropic + openai, subscription transport, 0.0000 USD, quorum 2/2). Recorded verbatim in `agents/evidence/analysis/council-2026-09-08-continuity-retirement-scope.md`.
- **Blocks:** the retirement of the `chat-history:checkpoint` NAME. It blocks nothing else in this roadmap — chat-history capture itself is out of scope by decision and keeps working untouched.
- **Recommendation:** none. Both seats declined to choose the name, and the reason is the substance: openai ruled *"Net zero describes a count, not authorization. A new endpoint name is a new callable contract. A deprecation alias also means the old name remains operational and therefore has not yet been retired."* The owner's 2026-09-06 authorisation names what is retired, not what is added.
- **If you do nothing:** the verb keeps a name that collides with the run-checkpoint concept, which is a vocabulary defect and not a functional one. Capture is unaffected. This is the cheapest of the open items to leave alone.
- **What to do:** decide five things and record them here — the surviving endpoint name; the compatibility period; the migration mechanism for hooks already installed in downstream checkouts (`src/scripts/install-hooks.sh:459-484` generates four of them, and `post-merge` and `post-checkout` carry a second appended auto-sync segment, so ownership detection must match two generated contents per hook); how a migrated installation is detected and counted; and the objective threshold at which the alias is removed. A locally modified hook is **reported, never rewritten** — that half is already settled and is not part of this decision.
- **Resolved when:** the five decisions above are written into this entry and `Status:` reads `resolved`.

### blocker: context-fill-retirement-has-a-parked-consumer

- **Status:** open
- **Owner:** maintainer
- **Asked:** 2026-09-08. The 2026-09-08 council authorised this retirement on producer/no-consumer evidence supplied from this session; the reference sweep that followed found the evidence incomplete, so the authorisation is not acted on.
- **Blocks:** one artifact of step 4.1. It blocks nothing else, and the other five candidates in that step are blocked for unrelated reasons.
- **Recommendation:** do not retire it here, and route the decision to the owner of `agents/roadmaps/later/road-to-cost-parity-2-state-aware-dispatch.md`. There is no consumer in code, but that roadmap has open steps 1.1 and 1.4c which read `agents/runtime/state/context-fill.json` as a planned input, and 1.4c exists specifically to bound its staleness. Retiring the file makes a parked roadmap's step unbuildable as written, which is a decision for that roadmap rather than a side effect of this one. The same council seat had already named this failure shape: *"no consumer in the tree" proves no in-repository consumer, not that no packaged or external consumer exists* — and a planned consumer INSIDE the tree is the stronger case, because it is checkable.
- **If you do nothing:** the artefact axis stays at 5 instead of 4 and a producer with no code consumer keeps writing a file on every Stop. The cost is one small write per session and one row in the inventory; nothing breaks, and the row states the reason so the next reader does not re-derive it.
- **What to do:** either (1) the owner of that parked roadmap re-anchors steps 1.1 and 1.4c onto another source, after which this file and `writeContextFill` in `src/scripts/hooks/session_eol_hook.ts:269` are deleted in one change; or (2) the owner decides the parked roadmap keeps it, and the inventory row at `src/config/continuity-surface.json` records that decision and stays `counted`. Step 3.3 of `road-to-continuity-writer-activation` carries whichever is chosen.
- **Resolved when:** one of the two options above is taken and recorded, either by the file being gone or by its inventory row naming the owner's keep decision.
### blocker: chat-history-command-retirement-authorization

- **Status:** open
- **Owner:** maintainer
- **Asked:** 2026-09-08. The AI council made these two retirements conditional — anthropic: *"Do they appear in any shipped examples, docs, or error messages? … Retiring them requires proving non-use, not just proving they're marked internal. If that proof doesn't exist, they're not 'reachable in this session.'"* A full tracked-source audit ran on 2026-09-08 against `drain/continuity-retirement`. It answers every other class in the negative and this one in the affirmative.
- **Blocks:** the AUTHORIZATION half only — whether the removal may proceed at all. The enumerated edits are split out into `chat-history-command-retirement-execution` below, on a 2/2 AI-council ruling of 2026-09-08 that this entry conflated a governance question with a work item. openai: *"A completed checklist resolves the discovery work. It does not itself resolve governance precedence or prove that the accepted evidentiary standard was met."*
- **Why it is still open, checked against the governance record rather than assumed.** The 2026-09-08 council did not supersede the owner's 2026-09-06 authorisation; it made the two retirements *conditional on a proven non-use audit* (`agents/evidence/analysis/council-2026-09-08-continuity-retirement-scope.md:41`). That condition **explicitly names documentation**: *"Do they appear in any shipped examples, docs, or error messages?"* (`:357-362`). The audit answered that question in the affirmative. So the condition is **unmet**, not satisfied-pending-execution — and whether updating the documentation satisfies it, or whether removing a recovery affordance that the PRESERVED command advertises needs the owner's word again, is the maintainer's call and nobody else's. Recorded this way rather than reassigned to the implementer because openai warned against the opposite error too: *"If the governance record clearly establishes continuing authorization, remove the first item entirely. Do not retain a fictional maintainer blocker merely for historical attribution."* It is retained because the record does NOT clearly establish it.
- **Blocks (residual):** the only movement available on the `session_resume_pickers` axis. `check_continuity_surface` reads `1 / 2 / 5 / 1 / 1`; this retirement alone takes position 2 to `1`.
- **Recommendation:** retire them, in a change whose subject is the removal. The audit clears every mechanical class — no CLI verb, no dispatcher case, no MCP tool, no hook, no runtime loader, no error path, and no test that reads the real tree (the one test naming the slug writes a synthetic fixture into a `mkdtemp` sandbox). What it does NOT clear is the documentation class the council named, and the two instances that matter are not incidental: `docs/getting-started.md:177` advertises `/chat-history import` in the user-facing quick-start table, and `src/domains/meta/agent-handoff/command.md:254`, `:259`, `:267` — the command the owner's authorisation explicitly PRESERVES — instructs its use after a crash or a fresh-chat reopen and links to the file. Removing a recovery affordance that the surviving command advertises is a deliberate act.
- **If you do nothing:** two internal commands stay listed, `session_resume_pickers` stays at 2, and `/agent-handoff` keeps pointing at a path that still works. Nothing degrades and nothing rots — the cost is that the surface stays one wider than the owner asked for on 2026-09-06, indefinitely.
- **What to do:** the audit enumerated the whole change, so this is a checklist rather than an investigation. **Delete** `src/domains/meta/chat-history/command.md` and `src/domains/meta/chat-history/import/command.md`. **Hand-edit the four surfaces no generator owns**, each of which reddens a named gate: `src/config/continuity-surface.json` — delete the rows `command:chat-history` and `picker:chat-history-import` (gate `check_continuity_surface`, dead-locus); `src/flows/surface-map.yaml:168-169` (gate `lint_command_flow_coverage`, phantom ref); `docs/contracts/command-clusters.md:34` plus the worked example at `:92` (gate `check_cluster_patterns`, dispatcher-missing); `docs/getting-started.md:177` (no gate — it is the user-facing row). **Fix the links no gate catches**, because `check_references` does not match parenthesised markdown targets: `src/domains/meta/agent-handoff/command.md:254`, `:259`, `:267` and `src/skills/learning-to-rule-or-skill/SKILL.md:383-384` both go dangling. **Then regenerate rather than hand-edit** — `task sync`, `task generate-tools`, `update_counts`, `generate_index`, `generate_command_flows`, `generate_capabilities_index`, `generate_pack_manifests`, `build_proof` — which moves the command count 204 → 202 across `README.md:7`, `docs/CLAIMS.md:393`, `docs/architecture.md:158`, `docs/command-flows.md:10`, `docs/featured-skills.md:96`, `docs/getting-started-by-role.md:5`, `docs/proof.md:55`, `CAPABILITIES.yaml:15`, and the memory pack's `artefact_count` and token passport. **Verify** with `check_continuity_surface` (expect `session_resume_pickers` 2 → 1), `lint_command_flow_coverage`, `check_cluster_patterns` (expect 25 dispatchers, down from 26), `check_command_count_messaging`, `check_artefact_count_messaging`, `check_public_catalog_links` and the four `--check` generators.
- **Resolved when:** the two command documents are gone, every surface above is updated or regenerated in the same change, and `check_continuity_surface` reports `session_resume_pickers` at 1.

### blocker: chat-history-command-retirement-execution

- **Status:** open
- **Owner:** implementer
- **Blocks:** step 3.4 only, and only once its sibling authorization blocker resolves. Split out of `chat-history-command-retirement-authorization` on the 2026-09-08 AI-council ruling that authorization and execution are different obligations with different owners, and that filing them as one hides a ready work item behind a pending decision.
- **Recommendation:** hold until the authorization resolves, then execute the enumerated checklist in the sibling entry without re-investigating. The audit already ran and cleared every mechanical class; nothing in this entry is discovery work. Executing it early is the failure the split exists to prevent — the edits are irreversible in the sense that matters (a removed documented affordance), and the decision that licenses them is not this owner's.
- **If you do nothing:** nothing degrades. This entry holds no work that is currently permitted; it exists so that when the maintainer's decision arrives, the next reader sees a ready checklist with a named owner rather than re-deriving it from a blocker that reads as a governance question.
- **What to do:** on resolution of the authorization half, run its `What to do` checklist verbatim — the two command documents, the four hand-edited surfaces, the two link classes `check_references` cannot see, then regenerate rather than hand-edit, then verify with the seven named gates.
- **Resolved when:** the authorization half reads `resolved`, its checklist has been executed, and `check_continuity_surface` reports `session_resume_pickers` at 1.

### blocker: the-command-usage-telemetry-cannot-prove-non-use

- **Status:** resolved 2026-09-08. `agents/evidence/metrics/skill-usage-report.md` now opens with a NON-EVIDENTIARY banner naming the absent source, the `Active: 0`-over-337 header, and the `agent-handoff` discriminator — a preserved command reading `dead / 0 / 0` identically to every retirement candidate, which is what proves the instrument distinguishes nothing. Taken as the durable form of the two options this entry offered, on a 2/2 AI-council ruling of 2026-09-08 that the one-line header edit was insufficient: with the source **absent** rather than empty, the provenance of the existing table is unknown and a regeneration could recreate the defect, so the label belongs on the file and states its own removal condition.
- **Correction to this entry's own text, recorded rather than silently fixed:** it said the source `is empty`. It is **absent from the tree** — verified 2026-09-08. The distinction is the reason the fix is a file-level banner and not a header line.
- **Owner:** implementer
- **Blocks:** nothing directly. It is recorded here because it nearly caused a wrong disposition on the blocker above, and the next reader will reach for the same file.
- **Recommendation:** do not cite `agents/evidence/metrics/skill-usage-report.md` as evidence that any command is unused. It reports `chat-history` and `chat-history-import` as `dead` with `0` exposures and `0` mentions in every window, which reads as exactly the proof the council asked for — and it is not. Its own header says **`Active: 0`** across all 337 tracked artefacts, and `agent-handoff`, the command the owner's authorisation explicitly preserves, is `dead / 0 / 0` on the same page. The collector recorded nothing for anything, so the report distinguishes nothing. An all-zero instrument produces a number for every question and an answer to none.
- **If you do nothing:** the next audit of any retirement candidate finds a table that appears to prove non-use, quotes it, and retires something on an instrument that never ran. The failure is silent and the artefact looks like evidence, which is the worst combination.
- **What to do:** either make the collector emit — `agents/runtime/metrics/skill-usage.jsonl` is its source and it is empty — or mark the report `baseline, instrument not yet emitting` in its own header so a reader cannot mistake a zero for a measurement. The second is a one-line change and closes the trap; the first is the real fix and is not this roadmap's subject.
- **Resolved when:** the report either carries real non-zero data or states in its header that its zeros are an unrun instrument rather than a measurement.


### blocker: three-concern-split-is-unpaid-under-the-concern-ratchet

- **Status:** open
- **Owner:** implementer
- **Blocks:** step 2.1 only. Phase 1 is unaffected — a writer whose handlers are independently switchable inside existing concerns satisfies everything the 2026-09-07 council's D2 asked for in substance.
- **Recommendation:** reorder rather than negotiate the ratchet — do Phase 3 first — but note first that the arithmetic below shows the reorder alone does not pay, so this recommendation is now necessary-but-insufficient rather than a route to green. Step 3.1's retirement of the `hot-context` concern pays one of the two or three the split costs. It is the only one of the three resolutions the 2026-09-08 council left standing (anthropic listed changing the countable unit, introducing an allowance, and deferring the split; openai struck the first two with *"No temporary allowance"*), and it is also the cheapest: the retirement is authorised work this roadmap already carries, so the payment costs nothing that was not already planned.
- **If you do nothing:** step 2.1 stays unreachable and the three handlers stay inside existing concerns. That is a smaller loss than it sounds, and as of 2026-09-08 it is measured rather than argued: Phase 1 shipped the three handlers with three independent switches and a fault-injection fixture per switch (`tests/hooks/continuity_switches.test.ts`), which is the substance the 2026-09-07 D2 required, delivered with `concern_count` unchanged at 58. What is actually lost is per-concern observability and the ability to drop one handler from one host's slot list, and a later reader who does not know that will read the open box as a gap in safety rather than in ergonomics.
- **What to do:** the instruction this entry carried — *"land Phase 3 first, retiring `hot-context` is the payment"* — is **arithmetically insufficient, measured 2026-09-08**, and that is now the first thing to know. `concern_count` reads **58** at HEAD against a floor of **58** (`countConcerns` over the `concerns:` block of `src/scripts/hook_manifest.yaml`, `src/scripts/_lib/concern_estate.ts:53-73`, called at `src/scripts/check_estate_count.ts:512`, allowance 0 at `:156`). Retiring `hot-context` takes it to **57**. A three-way split then lands at **59** if it dissolves one existing concern into three (+2) or at **60** if it adds three ids beside the two concerns that keep other work (+3). Both exceed 58. Retiring one concern buys one, and the split costs two or three, so **the payment is short by one or two whichever way the split is drawn**. The reordering is therefore still necessary and is no longer sufficient. What would actually pay: a second concern retirement (none is authorised in this roadmap — 3.2, 3.3 and 3.4 retire a CLI verb, a state file and two command documents, none of which is a concern), or a split that costs +1 rather than +2, or a maintainer decision on the ratchet itself. The first is the only agent-reachable option and it needs a candidate this roadmap does not carry. Both seats of the 2026-09-08 council refused a temporary allowance — openai: *"No temporary allowance."* — so widening it is not on the table either.
- **What to do (unchanged half):** whatever pays for it, the split's own shape is settled — three ids in `hook_manifest.yaml` plus the fault-injection test over every handler combination, per step 2.1.
- **Resolved when:** `concern_count` at HEAD is at or below the base ref's floor with the three ids declared, proven by `./scripts-run src/scripts/check_estate_count` exiting 0 on the branch that adds them.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-09-08 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | The writer lands and the retirements never do | product | The parent's Risk 1 inherited one file further on, and now sharper: the measurement and the reader tolerance already shipped, so the cheapest remaining move is to add the writer, declare continuity solved, and leave five surfaces standing. That is the fourteenth layer, and it would look like completion. | Phase 3 is where the numbers move, and `check_continuity_surface` publishes them on every CI run — a writer that lands with no retirement shows `1 / 2 / 5 / 1 / 1` unchanged in the gate's own output, which is much harder to narrate past than a prose claim. | Phase 3 |
| 2 | The record slot loses fresh state to a stale one | implementation | Create-if-absent on a single-slot queue silently drops the newer record whenever an older unconsumed one is still sitting there, and automatic production makes that common rather than rare. The failure is invisible: the successor resumes from something plausible and older. | 1.1 settles the capacity policy and its state machine BEFORE 1.2 writes anything, and its verify requires an interruption test on both sides of the atomic rename. | Phase 1 |
| 3 | The concern split is attempted before it is paid for | implementation | Step 2.1 is the most obviously "next" piece of work and the ratchet that forbids it lives in a different file, so a reader who starts there gets a red they will be tempted to fix by widening an allowance. | The ordering is stated in 2.1's own text, the blocker names the exact allowance and cites both seats refusing to widen it, and `check_estate_count` fails the branch rather than warning. | Phase 2 |
| 4 | Retiring `hot-context` silently changes what a session restores | implementation | The `memory.session_index` restore rides on the hot-context injection surface, and moving it is easy to treat as a relocation when it is a change of trust boundary — restored memory is untrusted context arriving on a new path. | 3.1 requires byte-identical output for the same inputs plus a written trust contract with a test per property, which is the 2026-09-07 D3 ruling rather than this roadmap's preference. | Phase 3 |
| 5 | `context-fill.json` is retired out from under a parked roadmap | product | It reads as a free win — a producer with no consumer in code — and the consumer that exists is three steps inside a file parked in `later/`, which nobody opens while doing this work. | 3.3 states the dependency with its file and step numbers and routes the decision to that roadmap's owner instead of taking it here. | Phase 3 |

## Acceptance Criteria

- [x] AC-1 — A session ending at a bound slot leaves a continuity record without
      model spend, and a session that did nothing substantive leaves none. The
      count comes from the concern's own state, never from file presence.
      Carried from the predecessor's AC-5.
      Measured 2026-09-08 through the real dispatcher, under
      `continuity.auto_record: on`: one authoritative record and no temp litter
      (`tests/hooks/continuity_writer_dispatch.test.ts`), none for a session
      that crosses the recycle threshold but not the substantive floor, and none
      for a session with no claimed roadmap. The threshold-crossed-but-not-
      substantive fixture is the one that separates the two: it proves the
      decision comes from the counters and not from the threshold, and a
      further fixture shows an existing record in the slot does not change the
      transformation. No provider, network or child-process import reaches the
      writer, asserted statically over its own import list.
      The default stays `off` per 1.2, so this criterion describes a capability
      the tree HAS and does not exercise by default — stated here rather than
      left for a reader to infer from a green box.
- [ ] AC-2 — `./scripts-run src/scripts/check_continuity_surface` reports
      exactly `0 / 0 / 1 / 1 / 0`, and no exclusion in its inventory represents
      a normal-path continuity mechanism that would change the vector if
      counted. Carried from the predecessor's AC-7b; the vector read
      `1 / 2 / 5 / 1 / 1` when this roadmap was written.
      **Still `1 / 2 / 5 / 1 / 1`, measured 2026-09-08 after Phase 1 closed** —
      unchanged, and unchanged on purpose. Phase 1 adds a producer for the
      artifact that is already counted (`recycle-envelope.json`), so it moves no
      axis; Phase 3 is where every axis moves, and none of its four steps is
      done. This is Risk 1 of this roadmap holding exactly as written: the
      writer landed, the retirements did not, and the gate's own output is what
      makes that impossible to narrate past.
- [x] AC-3 — Disabling any one of the three lifecycle switches restores
      pre-change behaviour for that handler and leaves the other two firing,
      proven by a test rather than by the rollback note that describes it.
      Measured 2026-09-08: `tests/hooks/continuity_switches.test.ts` drives the
      real dispatcher on both slots with an all-armed baseline and then one case
      per switch, each asserting ALL THREE outcomes so an entanglement fails
      rather than passes. Sensitivity: forcing `continuity.auto_record` on reds
      2 cases, forcing `continuity.run_checkpoints` on reds 1, inverting the
      checkpoint guard reds 5.
      One limit, named rather than papered over: for `memory.session_index` the
      case proves the OFF direction and the independence (the stop handlers are
      byte-for-byte identical either way), NOT the ON injection — with the
      switch armed a scratch workspace emits no `memory-index` block, because
      it carries no curated corpus. The injection half is covered by
      `tests/scripts/session_memory_index.test.ts`.
