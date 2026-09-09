---
complexity: structural
status: ready
parent_roadmap: road-to-continuity-retirement-sequencing
execution:
  mode: phase-checkpoints
estate_growth_exempt: "AMENDED 2026-09-09, because the gate reads the claim from the diff and the earlier text authorised a different change. This diff grows `open_blockers` 42 -> 43 by adding ONE entry, `memory-index-relocation-target-unspecified`. It is a NEW recorded blocker rather than a repaired undercount: step 3.1's second half was attempted this run, after its D3 precondition was discharged, and an AI council (2/2, convergent) established that the step names no relocation destination and that all thirteen concerns bound on `session_start` fail on subject rather than on cost. Nothing described that before, because nobody had got far enough to find it. The alternative to recording it is inventing a destination, which is the failure this file's own Risk 1 names from the other direction -- the retirement performed against a target nobody chose, numbers moving while the surface gets worse. `open_blockers` carries no growth allowance by policy, so a claim is the only green path, and suppressing the entry to keep the metric flat would launder an unmade decision. MEASURED on this branch: `check_estate_count` reads the growth on that axis only; `active_roadmaps`, `later_roadmaps`, `skill_count`, `skill_description_tokens` and `concern_count` are all +0. Earlier text, kept because the addition it authorised is still this file's reason to exist: Receiver for five items carried out of road-to-continuity-retirement-sequencing, which is archived by the same change — the estate is flat, not larger. It cannot be folded into any active roadmap: the carried items are the automatic writer and the retirements that depend on it, and the only other file that ever owned them is the one being archived. Its predecessor road-to-one-continuity-record is archived too. The alternative to this file is dropping five items an owner authorised and two councils sequenced, which is the outcome both councils named as the failure mode."
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

- [-] **2.1 Three concern ids with three kill switches, paid for by a retirement.**
      **CANCELLED 2026-09-09 by the AI council under the owner's written delegation for this
      drain run (2 seats, converged on option (d)).** The blocker
      `three-concern-split-is-unpaid-under-the-concern-ratchet` carries the full reasoning;
      the short form is that the arithmetic does not close and the substance is already
      shipped. `concern_count` is 58 against a floor of 58, and even retiring TWO concerns
      and adding three lands at 59 — so the only route is moving the floor, which both seats
      placed outside the council's reach.
      What Phase 1 already delivers is the requirement itself: three independently
      switchable handlers with fault-injection coverage, inside existing concerns. This step
      asked for the code-organisation FORM (three separate concern ids) on top of a
      SUBSTANCE that is already there. Declining the form loses no safety and no capability.
      `[-]` rather than `[~]`, and the distinction is load-bearing: a deferral needs a
      receiver carrying the criterion forward, and there is none — the criterion is met by
      Phase 1 and only its packaging is dropped. The glyph's owner-reservation is discharged
      by the owner's written delegation of this run to the council, cited above rather than
      assumed.
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

- [x] **3.1 `hot-context` — retire the concern, relocate the restore.** The
      2026-09-07 council (D3) authorised retiring the concern and required
      evidence of equivalence plus an explicit trust contract before the
      `memory.session_index` restore moves anywhere: repository and worktree
      identity, path canonicalization, freshness, ordering, duplicate invocation
      and size limits, because *"restored memory is untrusted context"*. A
      global kill switch is inadequate — an operator must be able to disable
      restoration while continuity writing and run verification stay active.
      verify: **REPLACED 2026-09-09 by the AI council under the owner's written delegation
      (2 seats, both agreeing on this half).** Byte-identity alone tested the wrong thing:
      with the change being a manifest edit plus a moved function, identical bytes are
      trivially true and the check is vacuous. Three sub-tests instead —
      **byte:** restored bytes match the persisted fixture;
      **sabotage:** a missing or corrupt index prevents restoration or produces the
      specified safe failure, so the restore is shown to be load-bearing rather than
      incidental;
      **ordering:** restoration completes before prompt/context consumption.
      Two clauses of the old verify also change. The trust contract IS written and each of
      its six properties has a test — that half is done and is the precondition this step's
      body already records. And `check_continuity_surface` will **not** show the artefact
      axis one lower: the blocker resolution keeps the `hot-context` concern with a narrower
      job rather than retiring it, so no axis moves. Superseded text, kept for the reader:
      *the relocated restore produces byte-identical output to today's for the same inputs;
      the trust contract is written and each of its six properties has a test;
      `check_continuity_surface` shows the artefact axis one lower.*
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

      **THE PRECONDITION IS DISCHARGED, 2026-09-09. THE STEP IS NOT — and the
      split is D3's own ordering, not a descope.** D3 requires the trust
      contract and the equivalence evidence to exist BEFORE the restore moves
      anywhere, so building them first is the sequence the ruling imposes.
      What landed:
      - `src/scripts/_lib/session_index_trust.ts` — all six properties in one
        module, which is what makes the relocation a move rather than a
        rewrite: identity (the canonical memory root must be contained in the
        canonical workspace root), canonicalization (`realpath` both sides,
        containment by path SEGMENTS because a string prefix says `/a/bc` is
        inside `/a/b`), freshness (newest curated source mtime; refuses a
        future date as clock skew or tampering, and an abandonment bound),
        ordering (a declared TOTAL order — cheapest first, id as tie-break, so
        the cap truncates the same way twice), duplicate invocation (a
        create-exclusive per-session latch), and size limits (the pre-existing
        cap, moved here so all six read from one place).
      - `tests/scripts/session_index_trust.test.ts` — 24 cases, one refusal per
        property, each on a fixture built to violate exactly that one thing.
      - `tests/hooks/session_index_trust_e2e.test.ts` — 8 cases through the
        REAL dispatcher, and **the corpus fixture this step said the tree
        lacks**. Step 1.4 measured that an armed `memory.session_index` emits
        no block in a scratch workspace, so a byte-identity proof there would
        compare two empty strings; these cases write real curated entries into
        `agents/memory/` and the first one asserts the block is non-empty
        precisely so the refusal cases cannot pass vacuously.

      **The threat is now named concretely rather than as a category, because
      finding it changed the design.** `MEMORY_ROOT` is the RELATIVE path
      `agents/memory`, resolved against the process cwd, and the hook chdirs to
      a workspace root it received from a host payload. So the attacker is not
      an intruder: it is a wrong or stale root — a sibling checkout, a worktree
      pointed elsewhere, a symlink out of the tree — serving another
      repository's curated memory into this session as this session's own. The
      e2e P1 case is that exact fixture: two workspaces, the victim's
      `agents/memory` symlinked into the donor's corpus, asserting the donor's
      ids never appear.

      **Three findings from the tests, each of which changed the code:**
      1. A `..` root whose target does not exist was reported as
         `memory-root-absent`. That reads as "this workspace has no memory"
         when the truth is "this root pointed outside the tree". Containment is
         now checked LEXICALLY first and on the canonical path second, so the
         escape is the fact reported either way.
      2. The hook-level trust call **enforces nothing** — sabotaging it left
         every case green, because `build_session_index_block` re-checks the
         root itself. Found by sabotage, not by reading.
      3. Its stderr diagnostic reaches nobody: the dispatcher does not forward
         a concern's stderr, verified by hand. So the hook layer's real and
         only contribution is ORDERING — the latch is claimed after the
         verdict, so a refused root leaves the session's one claim unspent and
         a corrected root is still served. That is now its own e2e case,
         sabotage-proven, and it is why the layer was kept rather than deleted.

      **What remains, unchanged in shape:** relocate the restore off this
      concern, then retire the concern across the 17 bindings enumerated above,
      keeping the MODULE alive for `handoff_generate.ts` and the
      `ephemeral-lossy` loss-class declaration. The byte-identity verify is now
      buildable, which it was not before this change.

      **The abandonment bound's falsifiers**, recorded here because a
      `Revisit-if` belongs in the roadmap rather than in a source docblock:
      `MAX_ROOT_AGE_DAYS = 400` is a stated default, not a measured optimum.
      Reopen it if a real workspace refuses on it (too tight), or if a
      wrong-root incident passes it (the bound is not the control that would
      have caught it, and identity is).

      **THE FIRST VERSION OF THIS CONTRACT DID NOT HOLD. Corrected 2026-09-09 on
      an R2 completion review that found SEVEN defects, three of them high, and
      proved every one by running it rather than by reading.** Recorded at this
      length because the failure is instructive in a specific way: the contract
      passed 32 tests of its own writing while three of its six properties were
      bypassable, and every bypass sat on a path those tests did not take.

      - **P5 was inert** whenever the session id lived only on the dispatcher
        envelope. `dispatch_hook` resolves `envelope.session_id` from the
        payload OR `AGENT_SESSION_ID`; the hook read the payload alone, so a
        host supplying no payload id received the block on every start and never
        latched. Every sibling concern already read the envelope first.
      - **P4 was decorative.** Retrieval was asked for the CAP, and every
        curated hit scores an identical 0.1 with an empty key set, so
        `memory_lookup` sliced the first 30 in STORE order and the declared
        order then sorted a set the cap had already chosen. A 40-entry corpus
        with the five cheapest last emitted zero cheap rows.
      - **P1 stopped at the root.** Canonicalizing the memory root does not stop
        a symlinked FILE inside it from resolving into another tree — the exact
        threat the module's own docblock names. The reviewer read a donor
        workspace's entry out of a victim session.
      - **P3 no-opped on two of three layouts**, because the read was root-only
        and non-recursive while `_iter_curated_entries` supports
        `<root>/<type>.yml`, `<root>/<type>/**/*.yml` and `intake/*.jsonl`. A
        3-year-old type-directory corpus was served past the 400-day bound.
      - **The latch burned on an empty corpus**, so a session that started
        before its memory was curated could never receive an index afterwards —
        the same defect class as the refused-root case fixed one branch earlier,
        one branch later.
      - **The trust check was opt-in**, and `session_index_cost()` omitted it:
        the one function whose name suggests it only measures was also the one
        that could render unchecked.

      All seven are repaired with a test each, sabotage-proven in three batches
      so attribution is clean. P1's file half and P3's reading turned out to be
      ONE omission and are fixed by one recursive, canonicalizing,
      containment-checking walk. Render and serve are now two operations with
      two names, and `serve_…` takes a `TrustGrant` so "did you check?" is
      answered by the signature rather than by convention.

      **A second falsifier, from the P4 repair:**
      `SESSION_INDEX_RETRIEVAL_LIMIT = 500` is a stated default, not a measured
      optimum. Reopen it when a curated corpus approaches it, because past that
      bound store order silently decides again and P4 becomes decorative a
      second time in exactly the way it just was.

      **Process note, recorded because it changes what the artefact is.** The
      reviewed change merged as PR #1958 at 07:01 while the review was still
      running, so the three high findings reached `main` before their repair
      did. Nothing was live — the feature is default-off, which is the only
      reason this is a repair rather than an incident — but the sequencing is
      worth naming: a review that finishes after its own merge cannot gate
      anything, and this one only functioned as a follow-up.

      **AND THE SECOND HALF TURNS OUT NOT TO BE EXECUTABLE — the step is
      UNDER-SPECIFIED, not merely hard. Established 2026-09-09 by AI council,
      2/2 present, convergent, after the precondition was discharged and the
      relocation was actually attempted.** The finding is that "relocate the
      restore" names no destination, and neither does D3.
      What was checked before asking: thirteen other concerns bind
      `session_start` across all seven hosts (`hook_manifest.yaml:1263` and its
      six sibling rows), so a destination costs no new concern — which matters,
      because a NEW concern is unpayable: `concern_count` reads 58 against a
      floor of 58 with allowance 0, retiring `hot-context` buys exactly one, and
      both seats of the 2026-09-08 council refused a temporary allowance. So the
      obstacle is not the ratchet.
      The obstacle is that **every candidate fails on subject**, and the council
      converged on that rather than picking the least-bad one:
      `handoff-context` is the handoff surface and a memory index is not a
      handoff; `session-register`'s subject is cross-worktree session
      visibility; `chat-history` is itself a retirement candidate in this same
      roadmap, so relocating onto it moves the restore to a surface this file is
      trying to shrink. It also found a second reading of 3.1 the text does not
      disambiguate — retire the CACHE half and keep the memory index where it
      is, which inverts which half survives — and called the step **ambiguous**
      rather than merely incomplete on that basis.
      **Two further findings from the same round, both worth more than the
      destination question.** First, D3's independence requirement is arguably
      already unmet in the CURRENT state, so a relocation would be lateral
      movement rather than degradation — which changes what step 1.4's three
      independent switches are worth here and is the owner's to read. Second,
      **3.1's byte-identity verify tests the wrong thing**: with the relocation
      being a manifest change plus a moved function, the block's bytes are
      trivially identical, so the proof establishes that the move did not break
      the code and says nothing about equivalence. The council asked for three
      sub-tests (byte, sabotage, ordering) in place of the one.
      Recorded as the blocker `memory-index-relocation-target-unspecified`
      below rather than executed. Inventing a destination here would be the
      failure this roadmap's own Risk 1 names from the other direction: the
      writer lands, the retirement is performed against a target nobody chose,
      and the numbers move while the surface gets worse.
      **Done 2026-09-09.** openai's mechanism, operative per the resolved
      relocation blocker: the startup CACHE half is gone — write and restore
      both, because removing only the write would leave a reader over a file
      nobody maintains — and the `hot-context` concern id STAYS, with its
      description rewritten to `restore persisted memory session index`. The
      `stop` bindings on all seven hosts and the `pre_compact` binding on
      claude are removed; the seven `session_start` bindings are untouched.
      `concern_count` is unchanged at 58, which is the point of keeping the id:
      the competing proposal bought −1 and paid for it in manifest
      completeness.
      Three sub-tests land in `tests/hooks/session_index_trust_e2e.test.ts` —
      byte (the corpus renders to a pinned block, and two independent
      workspaces render identically), sabotage (a missing and a corrupt index
      each emit nothing and burn no latch, with a control case so the two are
      not vacuous), ordering (the block is on the `session_start` stdout, and a
      `stop` writes no cache file). The last one asserts the FILE rather than
      the absence of a block on purpose: "stop emits no block" was true before
      this step too, so it would have had no sensitivity.
      **TWO PREDICTIONS IN THIS STEP'S OWN VERIFY WERE WRONG, and they are
      corrected here rather than quietly overwritten.**
      (1) It said `check_continuity_surface` would **not** show the artefact
      axis one lower. It does: `1 / 2 / 5 / 1 / 1` → `1 / 2 / 4 / 1 / 1`. The
      prediction conflated two counters — that axis counts ARTEFACTS, and
      `hot-context.md` was a counted row, while the concern lives in
      `concern_count` and did not move. A drawdown is gate-legal (the ratchet
      forbids growth), and it is what the superseded verify line asked for.
      (2) It said `build_hot_context` must survive because
      `src/scripts/_cli/handoff_generate.ts` reuses it. It does not: the only
      reference there is a prose analogy in a docblock, and that file carries
      its own `WORD_CAP` and its own branch probe. Grepped at HEAD, the
      function had exactly one caller, inside the file that defined it.
      **A real coverage gap opened and is tracked, not absorbed** — see
      blocker `loss-class-corpus-is-empty-after-hot-context` below.

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
- [x] **3.3 `context-fill.json` — retire it, or record that its parked consumer keeps it.**
      Authorised by the 2026-09-08 council on producer/no-consumer
      evidence that turned out incomplete: there is no consumer in code, but
      `agents/roadmaps/later/road-to-cost-parity-2-state-aware-dispatch.md` has
      open steps 1.1 and 1.4c that read it as a planned input, and 1.4c is
      specifically about bounding its staleness. That roadmap's owner decides,
      not this one.
      verify: either the file and its producer are gone and that roadmap's steps
      are re-anchored in the same change, or its inventory row records the
      owner's decision to keep it.
      **Done 2026-09-09 on the second limb, which the verify admits explicitly.** The AI
      council under the owner's written delegation resolved
      `context-fill-retirement-has-a-parked-consumer` as retain, both seats agreeing, and
      the inventory row at `src/config/continuity-surface.json` now records that DECISION
      rather than only the evidence that blocked the retirement — which is the difference
      between a row explaining why nothing happened and a row stating what was decided.
      `writeContextFill` at `src/scripts/hooks/session_eol_hook.ts:269` stays and the row
      stays `counted`.
      The artefact-axis reduction 5 → 4 is **not** claimed. Retention was chosen over
      re-anchoring because option (1) requires editing a roadmap that is parked precisely
      because nobody is working on it — trading one small per-session write for work inside
      a file the estate has deliberately set down.
- [x] **3.4 `/chat-history` and `/chat-history import` — retire the two commands.**
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
      **Landed 2026-09-09 — AUTHORIZED CAPABILITY LOSS.** The AI council of
      2026-09-09, under the owner's written delegation, took the decision both
      seats had previously refused and chose **Option 1: remove the affordance and
      record it as an AUTHORIZED CAPABILITY LOSS** — `anthropic` and `openai`, both
      seats converging. The binding condition both seats attached is on the
      replacement prose, and it is honoured: the documentation claims no automatic
      restoration and no equivalent recovery. openai: *"documentation should not
      call a file's existence 'recovery'. Recording, locating a record,
      interpreting it, injecting it into a new session, and restoring usable
      context are separate capabilities. The replacement wording must name only
      those actually demonstrated."*

      `/chat-history import` was retired under the owner's authorization to accept
      loss of automated transcript import. No equivalent restoration mechanism was
      established; recovery from retained continuity records is manual.

      **Executed.** The two command documents are deleted; the two rows
      (`command:chat-history`, `picker:chat-history-import`) are gone from the
      continuity-surface inventory; the two `src/flows/surface-map.yaml` refs, the
      `docs/contracts/command-clusters.md` cluster row plus its worked example, the
      `docs/getting-started.md` quick-start row and the stale routing-mechanics
      table row are hand-edited; the `/agent-handoff` recovery references and the
      `learning-to-rule-or-skill` link carry the council's wording; every other
      surface is regenerated rather than hand-edited.

      **Measured, not asserted.** `check_continuity_surface` moved `1 / 2 / 4 / 1 / 1`
      to `1 / 1 / 4 / 1 / 1` — `session_resume_pickers` 2 to 1, which is the whole
      movement available on that axis. `check_cluster_patterns` reports 25
      dispatchers, down from 26. The command count moved 204 to 202. The memory
      pack's `artefact_count` moved 9 to 7 and its token passport 12,851 to 10,396.

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

- **Status:** resolved
- **Owner:** maintainer
- **Asked:** 2026-09-08, by the AI council convened during the predecessor's drain run (2 seats, anthropic + openai, subscription transport, 0.0000 USD, quorum 2/2). Recorded verbatim in `agents/evidence/analysis/council-2026-09-08-continuity-retirement-scope.md`.
- **Blocks:** the retirement of the `chat-history:checkpoint` NAME. It blocks nothing else in this roadmap — chat-history capture itself is out of scope by decision and keeps working untouched.
- **Recommendation:** none. Both seats declined to choose the name, and the reason is the substance: openai ruled *"Net zero describes a count, not authorization. A new endpoint name is a new callable contract. A deprecation alias also means the old name remains operational and therefore has not yet been retired."* The owner's 2026-09-06 authorisation names what is retired, not what is added.
- **If you do nothing:** the verb keeps a name that collides with the run-checkpoint concept, which is a vocabulary defect and not a functional one. Capture is unaffected. This is the cheapest of the open items to leave alone.
- **What to do:** decide five things and record them here — the surviving endpoint name; the compatibility period; the migration mechanism for hooks already installed in downstream checkouts (`src/scripts/install-hooks.sh:459-484` generates four of them, and `post-merge` and `post-checkout` carry a second appended auto-sync segment, so ownership detection must match two generated contents per hook); how a migrated installation is detected and counted; and the objective threshold at which the alias is removed. A locally modified hook is **reported, never rewritten** — that half is already settled and is not part of this decision.
- **Resolved when:** the five decisions above are written into this entry and `Status:` reads `resolved`.
- **RESOLVED 2026-09-09 — option (c), decline the rename.** AI council 2026-09-09 under the owner's written delegation for this drain run (2 seats, anthropic/claude-sonnet-4-5 + openai/codex-default, subscription transport, $0.0000, quorum 2/2, two rounds with peer review). Both seats
  put the option inside the council's reach and neither picked a rename.
  openai: *"Option (c) — decline the rename. Council-decidable. This preserves the existing
  callable contract and creates no compatibility commitment. Renaming under either option
  (a) or (b) remains owner-reserved. The invariant is: creating, deprecating, or breaking a
  public callable compatibility contract requires owner authorization."*
  anthropic reached the same place by a different route — it asked for a contract-boundary
  audit first, and its own branch 4 says accepting the collision *"is council-decidable"*.
  Since (c) adds no name, the audit that would gate (a) and (b) is not needed to take it.
  **The five decisions are therefore answered by not being reached**, and that is the
  resolution rather than an evasion of it: there is no surviving new name, no compatibility
  period, no migration mechanism for the four hooks `install-hooks.sh:459-484` generates, no
  migration detection, and no alias sunset — because no alias is created. `install-hooks.sh`
  and every installed hook are untouched.
  **What this costs, stated plainly:** `chat-history:checkpoint` keeps a name that collides
  with the run-checkpoint concept. That is the vocabulary defect this entry already called
  the cheapest of the set to leave alone, and it is now left alone deliberately rather than
  by default.
  **Revisit-if:** repository evidence shows actual user confusion, or the owner authorises a
  replacement name together with a compatibility policy. Either is owner-reserved.

### blocker: context-fill-retirement-has-a-parked-consumer

- **Status:** resolved
- **Owner:** maintainer
- **Asked:** 2026-09-08. The 2026-09-08 council authorised this retirement on producer/no-consumer evidence supplied from this session; the reference sweep that followed found the evidence incomplete, so the authorisation is not acted on.
- **Blocks:** one artifact of step 4.1. It blocks nothing else, and the other five candidates in that step are blocked for unrelated reasons.
- **Recommendation:** do not retire it here, and route the decision to the owner of `agents/roadmaps/later/road-to-cost-parity-2-state-aware-dispatch.md`. There is no consumer in code, but that roadmap has open steps 1.1 and 1.4c which read `agents/runtime/state/context-fill.json` as a planned input, and 1.4c exists specifically to bound its staleness. Retiring the file makes a parked roadmap's step unbuildable as written, which is a decision for that roadmap rather than a side effect of this one. The same council seat had already named this failure shape: *"no consumer in the tree" proves no in-repository consumer, not that no packaged or external consumer exists* — and a planned consumer INSIDE the tree is the stronger case, because it is checkable.
- **If you do nothing:** the artefact axis stays at 5 instead of 4 and a producer with no code consumer keeps writing a file on every Stop. The cost is one small write per session and one row in the inventory; nothing breaks, and the row states the reason so the next reader does not re-derive it.
- **What to do:** either (1) the owner of that parked roadmap re-anchors steps 1.1 and 1.4c onto another source, after which this file and `writeContextFill` in `src/scripts/hooks/session_eol_hook.ts:269` are deleted in one change; or (2) the owner decides the parked roadmap keeps it, and the inventory row at `src/config/continuity-surface.json` records that decision and stays `counted`. Step 3.3 of `road-to-continuity-writer-activation` carries whichever is chosen.
- **RESOLVED 2026-09-09 — option (2), retain it.** AI council 2026-09-09 under the owner's written delegation for this drain run (2 seats, anthropic/claude-sonnet-4-5 + openai/codex-default, subscription transport, $0.0000, quorum 2/2, two rounds with peer review), and both seats
  agreed. openai: *"Option (b) — retain `context-fill.json`. Council-decidable. This is a
  reversible internal cost-versus-dependency decision with no public or governance invariant
  at stake."* anthropic listed the same disposition among its agreements.
  The asymmetry that decided it: option (1) requires editing a roadmap that is parked
  **precisely because nobody is working on it**, so it trades a one-line-per-session write
  for work inside a file the estate has deliberately set down.
  **Executed here:** `writeContextFill` at `src/scripts/hooks/session_eol_hook.ts:269` stays,
  the row in `src/config/continuity-surface.json` stays `counted`, and its `reason` now
  records the RETENTION DECISION rather than only the evidence that blocked the retirement.
  The artefact-axis reduction 5 → 4 is **not** claimed, here or anywhere.
  **Revisit-if:** `road-to-cost-parity-2-state-aware-dispatch` is resumed, cancelled, or
  re-anchors steps 1.1 and 1.4c onto another source.
- **Resolved when:** one of the two options above is taken and recorded, either by the file being gone or by its inventory row naming the owner's keep decision.
### blocker: chat-history-command-retirement-authorization

- **Status:** resolved 2026-09-09
- **How it resolved, and it is a LOSS rather than a discharge.** The AI council of
  2026-09-09, under the owner's written delegation, chose **Option 1 of the three this
  entry put to the owner: remove the recovery affordance** — both seats converging on
  the option that accepts the capability loss rather than the two that would have
  preserved or replaced it. The entry's own `Revisit-if` named exactly this path: *"the
  owner explicitly authorises the loss."* No executable test was produced showing an
  already-shipped mechanism reproduces `/chat-history import` recovery semantics, and
  none is claimed. `/chat-history import` was retired under the owner's authorization to
  accept loss of automated transcript import. No equivalent restoration mechanism was
  established; recovery from retained continuity records is manual.
  The binding condition both seats attached is on the documentation, and it is honoured:
  the replacement prose names only recording, and states that reconstruction is manual.
- **Owner:** maintainer
- **Asked:** 2026-09-08. The AI council made these two retirements conditional — anthropic: *"Do they appear in any shipped examples, docs, or error messages? … Retiring them requires proving non-use, not just proving they're marked internal. If that proof doesn't exist, they're not 'reachable in this session.'"* A full tracked-source audit ran on 2026-09-08 against `drain/continuity-retirement`. It answers every other class in the negative and this one in the affirmative.
- **Blocks:** the AUTHORIZATION half only — whether the removal may proceed at all. The enumerated edits are split out into `chat-history-command-retirement-execution` below, on a 2/2 AI-council ruling of 2026-09-08 that this entry conflated a governance question with a work item. openai: *"A completed checklist resolves the discovery work. It does not itself resolve governance precedence or prove that the accepted evidentiary standard was met."*
- **Why it is still open, checked against the governance record rather than assumed.** The 2026-09-08 council did not supersede the owner's 2026-09-06 authorisation; it made the two retirements *conditional on a proven non-use audit* (`agents/evidence/analysis/council-2026-09-08-continuity-retirement-scope.md:41`). That condition **explicitly names documentation**: *"Do they appear in any shipped examples, docs, or error messages?"* (`:357-362`). The audit answered that question in the affirmative. So the condition is **unmet**, not satisfied-pending-execution — and whether updating the documentation satisfies it, or whether removing a recovery affordance that the PRESERVED command advertises needs the owner's word again, is the maintainer's call and nobody else's. Recorded this way rather than reassigned to the implementer because openai warned against the opposite error too: *"If the governance record clearly establishes continuing authorization, remove the first item entirely. Do not retain a fictional maintainer blocker merely for historical attribution."* It is retained because the record does NOT clearly establish it.
- **Blocks (residual):** the only movement available on the `session_resume_pickers` axis. `check_continuity_surface` reads `1 / 2 / 5 / 1 / 1`; this retirement alone takes position 2 to `1`.
- **Recommendation:** retire them, in a change whose subject is the removal. The audit clears every mechanical class — no CLI verb, no dispatcher case, no MCP tool, no hook, no runtime loader, no error path, and no test that reads the real tree (the one test naming the slug writes a synthetic fixture into a `mkdtemp` sandbox). What it does NOT clear is the documentation class the council named, and the two instances that matter are not incidental: `docs/getting-started.md:177` advertises `/chat-history import` in the user-facing quick-start table, and `src/domains/meta/agent-handoff/command.md:254`, `:259`, `:267` — the command the owner's authorisation explicitly PRESERVES — instructs its use after a crash or a fresh-chat reopen and links to the file. Removing a recovery affordance that the surviving command advertises is a deliberate act.
- **If you do nothing:** two internal commands stay listed, `session_resume_pickers` stays at 2, and `/agent-handoff` keeps pointing at a path that still works. Nothing degrades and nothing rots — the cost is that the surface stays one wider than the owner asked for on 2026-09-06, indefinitely.
- **What to do:** the audit enumerated the whole change, so this is a checklist rather than an investigation. **Delete** the two command documents in the (now removed) `chat-history` domain directory — the head and its `import` sub. **Hand-edit the four surfaces no generator owns**, each of which reddens a named gate: `src/config/continuity-surface.json` — delete the rows `command:chat-history` and `picker:chat-history-import` (gate `check_continuity_surface`, dead-locus); `src/flows/surface-map.yaml:168-169` (gate `lint_command_flow_coverage`, phantom ref); `docs/contracts/command-clusters.md:34` plus the worked example at `:92` (gate `check_cluster_patterns`, dispatcher-missing); `docs/getting-started.md:177` (no gate — it is the user-facing row). **Fix the links no gate catches**, because `check_references` does not match parenthesised markdown targets: `src/domains/meta/agent-handoff/command.md:254`, `:259`, `:267` and `src/skills/learning-to-rule-or-skill/SKILL.md:383-384` both go dangling. **Then regenerate rather than hand-edit** — `task sync`, `task generate-tools`, `update_counts`, `generate_index`, `generate_command_flows`, `generate_capabilities_index`, `generate_pack_manifests`, `build_proof` — which moves the command count 204 → 202 across `README.md:7`, `docs/CLAIMS.md:393`, `docs/architecture.md:158`, `docs/command-flows.md:10`, `docs/featured-skills.md:96`, `docs/getting-started-by-role.md:5`, `docs/proof.md:55`, `CAPABILITIES.yaml:15`, and the memory pack's `artefact_count` and token passport. **Verify** with `check_continuity_surface` (expect `session_resume_pickers` 2 → 1), `lint_command_flow_coverage`, `check_cluster_patterns` (expect 25 dispatchers, down from 26), `check_command_count_messaging`, `check_artefact_count_messaging`, `check_public_catalog_links` and the four `--check` generators.
- **Resolved when:** the two command documents are gone, every surface above is updated or regenerated in the same change, and `check_continuity_surface` reports `session_resume_pickers` at 1.
- **STAYS OPEN, OWNER-RESERVED — AI council 2026-09-09 under the owner's written delegation for this drain run (2 seats, anthropic + openai, subscription transport, $0.0000, quorum 2/2), and BOTH seats refused it.**
  This is the one of six the council would not take, and they reached that from opposite
  starting points, which is worth more than agreement would be on its own.
  openai named the invariant: *"a documented crash-recovery affordance used by a preserved
  command may not be removed without authorization or proof of equivalent surviving recovery
  behavior."* And on the doc-update question this entry poses: *"The prior council authorized
  retirement only after an audit established non-use, explicitly including documentation.
  The audit found shipped uses. Editing away the evidence is not the same as satisfying the
  condition."*
  anthropic arrived by finding a circularity: authorising *"conditional on docs being
  updated"* is circular, because the docs can only be updated if an equivalent recovery path
  exists — and the fact this entry already records is that `/agent-handoff`'s own recovery
  instructions POINT AT `/chat-history import`. That is a dependency, not a replacement. Its
  rule: if `/agent-handoff` depends on the command being retired, escalate.
  **THE DECISION, for the owner, in the shape the council asked for it.** The affordance at
  stake is documented at `docs/getting-started.md:177` and
  `src/domains/meta/agent-handoff/command.md:254,259,267`. Choose one:
  1. remove the recovery affordance;
  2. preserve equivalent import behaviour under a surviving command;
  3. retain `/chat-history import`.
  **Until that lands, no retirement edit and no documentation edit is made** — openai was
  explicit that editing the docs first destroys the evidence the condition is measured
  against. The sibling execution blocker stays parked behind this one, and its expected
  counts are conditional on choice 1 (see its own entry).
  **Revisit-if:** an executable test proves an already-shipped mechanism reproduces
  `/chat-history import` recovery semantics, or the owner explicitly authorises the loss.

### blocker: chat-history-command-retirement-execution

- **Status:** resolved 2026-09-09
- **How it resolved.** Its authorization half resolved to FULL RETIREMENT, which is the
  branch this entry's `Resolved when` was written for — so its unconditional
  `session_resume_pickers == 1` and the 204 to 202 command move are both correct as
  written, and the `Revisit-if` below (a resolution to anything other than full
  retirement) did not fire. The sibling's checklist was then executed verbatim without
  re-investigation: the two command documents, the four hand-edited surfaces, the two
  link classes `check_references` cannot see, then regeneration rather than hand-editing.
  `check_continuity_surface` reports `session_resume_pickers` at 1.
- **Owner:** implementer
- **Blocks:** step 3.4 only, and only once its sibling authorization blocker resolves. Split out of `chat-history-command-retirement-authorization` on the 2026-09-08 AI-council ruling that authorization and execution are different obligations with different owners, and that filing them as one hides a ready work item behind a pending decision.
- **Recommendation:** hold until the authorization resolves, then execute the enumerated checklist in the sibling entry without re-investigating. The audit already ran and cleared every mechanical class; nothing in this entry is discovery work. Executing it early is the failure the split exists to prevent — the edits are irreversible in the sense that matters (a removed documented affordance), and the decision that licenses them is not this owner's.
- **If you do nothing:** nothing degrades. This entry holds no work that is currently permitted; it exists so that when the maintainer's decision arrives, the next reader sees a ready checklist with a named owner rather than re-deriving it from a blocker that reads as a governance question.
- **What to do:** on resolution of the authorization half, run its `What to do` checklist verbatim — the two command documents, the four hand-edited surfaces, the two link classes `check_references` cannot see, then regenerate rather than hand-edit, then verify with the seven named gates.
- **Resolved when:** the authorization half reads `resolved`, its checklist has been executed, and `check_continuity_surface` reports `session_resume_pickers` at 1.
- **ORDERING CONFIRMED 2026-09-09, and one assertion in this entry is now conditional.**
  AI council 2026-09-09 under the owner's written delegation for this drain run (2 seats, anthropic + openai, subscription transport, $0.0000, quorum 2/2) was asked whether any part of the checklist may run before its
  authorization half resolves. openai: *"No deletions, reference rewrites, generated-file
  changes, or count changes before B2 is resolved. Read-only preparation may occur earlier:
  enumerate references, classify generated versus hand-maintained files, and verify the
  baseline gates."* So this entry stays `open` and the split it was created for holds.
  **The conditional half matters and was not previously stated.** openai: *"Require
  `session_resume_pickers == 1` and command count 204 → 202 only if the owner chose full
  retirement. A replacement command may require different expected counts."* This entry's
  `Resolved when` asserts `session_resume_pickers` at 1 unconditionally. If the owner
  authorises a REPLACEMENT recovery path rather than outright retirement, that number and
  the 204 → 202 move are both wrong, and this checklist has to be rewritten rather than run.
  **Revisit-if:** the authorization half resolves to anything other than full retirement.

### blocker: the-command-usage-telemetry-cannot-prove-non-use

- **Status:** resolved 2026-09-08. `agents/evidence/metrics/skill-usage-report.md` now opens with a NON-EVIDENTIARY banner naming the absent source, the `Active: 0`-over-337 header, and the `agent-handoff` discriminator — a preserved command reading `dead / 0 / 0` identically to every retirement candidate, which is what proves the instrument distinguishes nothing. Taken as the durable form of the two options this entry offered, on a 2/2 AI-council ruling of 2026-09-08 that the one-line header edit was insufficient: with the source **absent** rather than empty, the provenance of the existing table is unknown and a regeneration could recreate the defect, so the label belongs on the file and states its own removal condition.
- **Correction to this entry's own text, recorded rather than silently fixed:** it said the source `is empty`. It is **absent from the tree** — verified 2026-09-08. The distinction is the reason the fix is a file-level banner and not a header line.
- **Owner:** implementer
- **Blocks:** nothing directly. It is recorded here because it nearly caused a wrong disposition on the blocker above, and the next reader will reach for the same file.
- **Recommendation:** do not cite `agents/evidence/metrics/skill-usage-report.md` as evidence that any command is unused. It reports `chat-history` and `chat-history-import` as `dead` with `0` exposures and `0` mentions in every window, which reads as exactly the proof the council asked for — and it is not. Its own header says **`Active: 0`** across all 337 tracked artefacts, and `agent-handoff`, the command the owner's authorisation explicitly preserves, is `dead / 0 / 0` on the same page. The collector recorded nothing for anything, so the report distinguishes nothing. An all-zero instrument produces a number for every question and an answer to none.
- **If you do nothing:** the next audit of any retirement candidate finds a table that appears to prove non-use, quotes it, and retires something on an instrument that never ran. The failure is silent and the artefact looks like evidence, which is the worst combination.
- **What to do:** either make the collector emit — `agents/runtime/metrics/skill-usage.jsonl` is its source and it is empty — or mark the report `baseline, instrument not yet emitting` in its own header so a reader cannot mistake a zero for a measurement. The second is a one-line change and closes the trap; the first is the real fix and is not this roadmap's subject.
- **Resolved when:** the report either carries real non-zero data or states in its header that its zeros are an unrun instrument rather than a measurement.


### blocker: memory-index-relocation-target-unspecified

- **Status:** resolved 2026-09-09
- **Owner:** maintainer
- **Asked:** 2026-09-09, by AI council (2 seats, anthropic + openai, api transport, $0.0617,
  quorum 2/2 after the run), convened after step 3.1's D3 precondition was discharged and the
  relocation was attempted rather than assumed.
- **Blocks:** the second half of step 3.1 only — the relocation and the concern retirement.
  3.1's precondition (the six-property trust contract, its 38 tests and the corpus fixture)
  is DONE and is unaffected, as is every other step in Phase 3.
- **Recommendation:** none on the destination, and that is the finding rather than a gap in
  effort. Both seats converged that 3.1 is under-specified and requires re-specification, not
  execution: "relocate the restore" names no target, D3 names none, and all thirteen concerns
  bound on `session_start` fail on subject rather than on cost. Picking the least-bad one
  would be inventing the decision.
- **If you do nothing:** the trust contract stays built and unused on the relocation axis, and
  `check_continuity_surface` keeps reporting `1 / 2 / 5 / 1 / 1` — the artefact axis does not
  move. Nothing degrades and nothing rots; the cost is that D3's precondition is paid for and
  the thing it was a precondition FOR cannot start.
- **What to do:** decide one thing and record it in this entry — whether 3.1 means (a)
  relocate the memory-index restore to a named concern, in which case name it and accept the
  subject mismatch explicitly, or (b) retire only the hot-context CACHE half and leave the
  memory index where it is, which the council read as a second valid parsing of the same
  sentence. Then, whichever is chosen, replace 3.1's byte-identity verify: with the
  relocation being a manifest change plus a moved function the bytes are trivially identical,
  so the council asked for three sub-tests (byte, sabotage, ordering) in place of the one.
  The candidate list and the objection to each is in step 3.1's own body; the concern-cost
  arithmetic is in `three-concern-split-is-unpaid-under-the-concern-ratchet` below.
- **Resolved when:** this entry names the chosen parsing and, for (a), the destination concern; and 3.1's `verify:` line states the three sub-tests rather than byte-identity alone.
- **RESOLVED 2026-09-09 on the PARSING and the VERIFY; the two seats split on the mechanism
  and both readings are recorded.** AI council 2026-09-09 under the owner's written delegation for this drain run (2 seats, anthropic + openai, subscription transport, $0.0000, quorum 2/2).
  **Parsing: neither (a) as written.** Both seats refused to name a destination concern,
  because every candidate fails on subject and forcing a mismatch is worse than not moving.
  The chosen reading is interpretation (b) — retire the startup CACHE half, leave the
  memory-index restore where it is.
  **The split, stated rather than smoothed.** openai's mechanism: remove only the startup
  cache write, KEEP the `hot-context` concern, rename its description from a cache-oriented
  one to *"restore persisted memory session index"*, and **do not mark the concern retired**
  — because *"option (b), as written, cannot both retire the concern and leave the restore in
  the same `hot-context` ownership location."* anthropic's mechanism: remove the concern id
  from `hook_manifest.yaml` (58 → 57) and leave the restore running as **unconcerned code**,
  tagged with no concern id at all.
  **openai's is operative, and the reason is B6.** anthropic's version buys a −1 on
  `concern_count`, and B6 resolved that no payment is needed — the split it would have paid
  for is declined. So the −1 purchases nothing, while untagged running code costs the
  manifest its completeness property: every executing handler currently carries a concern
  id, and a function deliberately outside that set is a new category with no reader.
  **What this does NOT achieve, said plainly:** step 3.1's *"retire the concern"* half is not
  done. The `hot-context` concern id survives with a narrower job. That is a real shortfall
  against the step as written, and it is recorded here rather than absorbed by calling the
  cache removal a retirement.
  **Verify: both seats converged on replacing byte-identity with three sub-tests**, because
  a pure code move makes byte-identity trivially true and therefore vacuous — byte (restored
  bytes match the persisted fixture), sabotage (a missing or corrupt index prevents
  restoration or produces the specified safe failure), ordering (restoration completes before
  prompt/context consumption). 3.1's `verify:` line is updated to state them.
  **Revisit-if:** a concern with a matching subject exists or is approved, at which point the
  restore can be relocated one-for-one with coherent ownership.
- **Review trigger:** re-read when `road-to-continuity-writer-activation`'s other four
  blockers move, since three of them are maintainer decisions on the same file and one
  sitting alone is the shape that decays into abandoned-in-place.

### blocker: three-concern-split-is-unpaid-under-the-concern-ratchet

- **Status:** resolved
- **Owner:** implementer
- **Blocks:** step 2.1 only. Phase 1 is unaffected — a writer whose handlers are independently switchable inside existing concerns satisfies everything the 2026-09-07 council's D2 asked for in substance.
- **Recommendation:** reorder rather than negotiate the ratchet — do Phase 3 first — but note first that the arithmetic below shows the reorder alone does not pay, so this recommendation is now necessary-but-insufficient rather than a route to green. Step 3.1's retirement of the `hot-context` concern pays one of the two or three the split costs. It is the only one of the three resolutions the 2026-09-08 council left standing (anthropic listed changing the countable unit, introducing an allowance, and deferring the split; openai struck the first two with *"No temporary allowance"*), and it is also the cheapest: the retirement is authorised work this roadmap already carries, so the payment costs nothing that was not already planned.
- **If you do nothing:** step 2.1 stays unreachable and the three handlers stay inside existing concerns. That is a smaller loss than it sounds, and as of 2026-09-08 it is measured rather than argued: Phase 1 shipped the three handlers with three independent switches and a fault-injection fixture per switch (`tests/hooks/continuity_switches.test.ts`), which is the substance the 2026-09-07 D2 required, delivered with `concern_count` unchanged at 58. What is actually lost is per-concern observability and the ability to drop one handler from one host's slot list, and a later reader who does not know that will read the open box as a gap in safety rather than in ergonomics.
- **What to do:** the instruction this entry carried — *"land Phase 3 first, retiring `hot-context` is the payment"* — is **arithmetically insufficient, measured 2026-09-08**, and that is now the first thing to know. `concern_count` reads **58** at HEAD against a floor of **58** (`countConcerns` over the `concerns:` block of `src/scripts/hook_manifest.yaml`, `src/scripts/_lib/concern_estate.ts:53-73`, called at `src/scripts/check_estate_count.ts:512`, allowance 0 at `:156`). Retiring `hot-context` takes it to **57**. A three-way split then lands at **59** if it dissolves one existing concern into three (+2) or at **60** if it adds three ids beside the two concerns that keep other work (+3). Both exceed 58. Retiring one concern buys one, and the split costs two or three, so **the payment is short by one or two whichever way the split is drawn**. The reordering is therefore still necessary and is no longer sufficient. What would actually pay: a second concern retirement (none is authorised in this roadmap — 3.2, 3.3 and 3.4 retire a CLI verb, a state file and two command documents, none of which is a concern), or a split that costs +1 rather than +2, or a maintainer decision on the ratchet itself. The first is the only agent-reachable option and it needs a candidate this roadmap does not carry. Both seats of the 2026-09-08 council refused a temporary allowance — openai: *"No temporary allowance."* — so widening it is not on the table either.
- **What to do (unchanged half):** whatever pays for it, the split's own shape is settled — three ids in `hook_manifest.yaml` plus the fault-injection test over every handler combination, per step 2.1.
- **Resolved when:** `concern_count` at HEAD is at or below the base ref's floor with the three ids declared, proven by `./scripts-run src/scripts/check_estate_count` exiting 0 on the branch that adds them.
- **RESOLVED 2026-09-09 — option (d): the three-concern split is DECLINED, and step 2.1 is
  cancelled rather than left unreachable.** AI council 2026-09-09 under the owner's written delegation for this drain run (2 seats, anthropic + openai, subscription transport, $0.0000, quorum 2/2), converged.
  openai: *"Option (d) — leave step 2.1 unreachable. Council-decidable, assuming the written
  delegation permits closing roadmap items as declined. This preserves the hard ratchet and
  the already-shipped safety behavior."* anthropic reached (d) too, and got there by asking
  the question this entry had not: **is a three-way split a FORM requirement (three separate
  concern ids) or a SUBSTANCE requirement (handlers independently switchable)?** Phase 1
  already ships three independently switchable handlers with fault-injection coverage inside
  existing concerns. The substance is delivered; only the code-organisation form is not.
  **The arithmetic is settled and it does not close.** `concern_count` is 58 against a floor
  of 58. Even retiring two concerns and adding three lands at 59. anthropic wrote that out
  and concluded *"this still doesn't close unless the floor itself moves"* — and moving the
  floor is the one option both seats put outside the council's reach. openai names the
  invariant: *"a hard governance ratchet may not be relaxed or redefined by the body it
  constrains."*
  **One seat corrected the other, and the correction is why (d) rather than (b).** An
  earlier round proposed absorbing one handler into an existing concern so the split costs
  +2 instead of +3. openai refused the arithmetic — *"58 - 1 + 2 = 59, which exceeds a
  ceiling/floor fixed at 58; calling that within tolerance invents an allowance both
  councils rejected"* — and anthropic independently observed that absorbing one handler
  makes it a TWO-way split, not the three-way split the step names. Both objections kill (b).
  **Executed here:** step 2.1 is `[-]`. No code changes, no concern-count change, no
  weakening of `check_estate_count`, and the claim that retiring `hot-context` pays for the
  split is removed — it was arithmetically insufficient and this entry already said so.
  **Revisit-if:** a separately justified concern retirement lands and creates headroom, or a
  design demonstrates a net-zero count without semantic misclassification. A ratchet
  exception remains owner-reserved.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-09-10 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | The writer lands and the retirements never do | product | The parent's Risk 1 inherited one file further on, and now sharper: the measurement and the reader tolerance already shipped, so the cheapest remaining move is to add the writer, declare continuity solved, and leave five surfaces standing. That is the fourteenth layer, and it would look like completion. | Phase 3 is where the numbers move, and `check_continuity_surface` publishes them on every CI run — a writer that lands with no retirement leaves the gate's own output unchanged, which is much harder to narrate past than a prose claim. Re-reviewed 2026-09-10: 3.1 and 3.4 have both landed and the gate now reads `1 / 1 / 4 / 1 / 1`. Two of the three retirements happened, so the risk is materially smaller — and it is NOT discharged, because the one that remains (3.2) is the one that removes the manual action a human still has to take. The cheapest bad ending is now narrower and more specific: declare continuity solved on two retirements and leave `session:recycle` and its pre-`/clear` advisory standing forever. | Phase 3 |
| 2 | The record slot loses fresh state to a stale one | implementation | Create-if-absent on a single-slot queue silently drops the newer record whenever an older unconsumed one is still sitting there, and automatic production makes that common rather than rare. The failure is invisible: the successor resumes from something plausible and older. | 1.1 settles the capacity policy and its state machine BEFORE 1.2 writes anything, and its verify requires an interruption test on both sides of the atomic rename. | Phase 1 |
| 3 | The concern split is attempted before it is paid for | implementation | Step 2.1 is the most obviously "next" piece of work and the ratchet that forbids it lives in a different file, so a reader who starts there gets a red they will be tempted to fix by widening an allowance. | The ordering is stated in 2.1's own text, the blocker names the exact allowance and cites both seats refusing to widen it, and `check_estate_count` fails the branch rather than warning. | Phase 2 |
| 4 | Retiring `hot-context` silently changes what a session restores | implementation | The `memory.session_index` restore rides on the hot-context injection surface, and moving it is easy to treat as a relocation when it is a change of trust boundary — restored memory is untrusted context arriving on a new path. | DISCHARGED 2026-09-09. The mitigation as written cited byte-identical output, which the council struck as vacuous for a manifest edit plus a moved function; it was replaced by byte, sabotage and ordering sub-tests, and the trust contract's six properties each carry a test. The restore did not move: it stays in the same concern on the same slot, so the trust boundary this row worried about was never crossed. | Phase 3 |
| 5 | `context-fill.json` is retired out from under a parked roadmap | product | It reads as a free win — a producer with no consumer in code — and the consumer that exists is three steps inside a file parked in `later/`, which nobody opens while doing this work. | 3.3 states the dependency with its file and step numbers and routes the decision to that roadmap's owner instead of taking it here. | Phase 3 |
| 6 | The retired import path is quietly re-advertised | product | 3.4 removed a documented crash-recovery affordance under an explicit authorization to accept the loss. Nothing in the tree now performs transcript import, but seven surfaces described it and two of them were found outside the audit's own checklist. A future doc pass, or a generated page rebuilt from a stale source, can re-assert a capability that no longer exists — and the failure is silent, because a doc claiming recovery reds no gate. | The replacement prose names only recording and manual reconstruction, never restoration, which is the council's binding condition and makes a re-assertion visibly different from what is written. `check_references` and `check_public_catalog_links` catch a re-added LINK; neither catches a re-added CLAIM, and that gap is stated here rather than assumed covered. | Phase 3 |

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

### blocker: chat-history-settings-description-needs-the-main-checkout

- **Status:** open
- **Owner:** implementer
- **Asked:** 2026-09-09, while executing step 3.4. Found beyond the audit's
  checklist, attempted, and rolled back rather than shipped half-done.
- **Blocks:** nothing in this roadmap. Recorded because one of its three stale
  clauses went stale in THIS change, so it is partly our doc-drift and not purely
  inherited debt.
- **What is wrong.** `src/server/schemas/settings.ts:176` describes
  `chat_history.enabled` as *"Persist a structured log … so `/chat-history:show`,
  `:import`, and `:learn` can replay sessions"*. All three verbs are now gone —
  `:show` and `:learn` were retired earlier, `:import` by step 3.4 — and the path
  it names is not the real one either. The string is mirrored into
  `docs/settings-reference.md` and into `dist/install/install.mjs`.
- **Why it is not fixed here, and this is a worktree fact rather than a
  judgement.** The fix is three lines, but landing it requires
  `npm run build:install-bundle`, and in a worktree that resolves the symlinked
  `node_modules` as `../../../node_modules/…` and rewrote **190 lines** of the
  bundle with worktree-relative paths. CI rebuilds the bundle and asserts
  `git diff --exit-code -- dist/install/`, so a stale committed bundle reds and a
  path-poisoned one is worse. The attempt was reverted; the three files are
  byte-clean.
- **If you do nothing:** a consumer reading the settings reference is told three
  retired commands can replay their sessions. Nothing breaks; the documentation
  lies.
- **What to do:** from the **main checkout**, not a worktree — rewrite the
  description to name only recording, run
  `./scripts-run src/scripts/generate_settings_reference` and
  `npm run build:install-bundle`, and commit all three together.
- **Resolved when:** `grep -n 'chat-history:show' src/server/schemas/settings.ts`
  returns nothing, `docs/settings-reference.md` matches the regenerated output,
  and `git diff --exit-code -- dist/install/` is clean after a bundle rebuild.

### blocker: loss-class-corpus-is-empty-after-hot-context

- **Status:** open
- **Owner:** implementer
- **Asked:** 2026-09-09, while executing step 3.1. Not a governance question — a
  measured hole the step's own change opened.
- **Blocks:** nothing in this roadmap. Recorded because a gate that stopped
  seeing a real transform is worse than one that never saw it, and the change
  that emptied its corpus is the right place to say so.
- **What happened.** `check_loss_class_declared` matches a concern script only
  when its text carries both an emit pattern and a lossy pattern (`\bredact`,
  `\btruncat`, `(WORD|CHAR|MAX)_(CAP|CHARS|LEN|WORDS)`). Before 3.1 exactly ONE of 58 hook
  scripts matched — `hot_context_hook.ts`, on `_redact_lines` and `WORD_CAP`.
  Both left with the cache. Measured after the change: 58 scanned, 0 matched,
  gate green.
- **Why that is a hole and not bookkeeping.** The memory index still applies a
  30-row cap (`SESSION_INDEX_ROW_CAP` / `capRows` in
  `src/scripts/_lib/session_index_trust.ts`), which is a lossy, model-facing
  transform by the contract's own definition. It sits in a `_lib` module rather
  than a concern script, and the detector reads concern scripts only — so the
  transform survives and the gate can no longer see it. A gate that scans
  nothing exits green.
- **If you do nothing:** the gate stays green over an empty corpus and stops
  being evidence of anything. Nothing breaks; the guarantee quietly stops
  applying.
- **What to do:** widen `check_loss_class_declared` past concern scripts to the
  `_lib` modules a concern reaches, or declare `loss_class` on
  `session_index_trust.ts` and teach the detector to read it. Either way the
  three surfaces that record "1 module qualifies" —
  `src/scripts/check_loss_class_declared.ts`, `docs/contracts/loss-classes.md`
  and the `src/config/gate-coverage.yml` row — move together with it.
- **Resolved when:** `check_loss_class_declared` reports at least one matching
  module again AND that module is the one applying the surviving cap, with
  `tests/scripts/_lib/loss_class.test.ts` asserting it.
