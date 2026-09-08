---
complexity: structural
status: draft
parent_roadmap: road-to-continuity-retirement-sequencing
execution:
  mode: phase-checkpoints
estate_growth_exempt: "Receiver for five items carried out of road-to-continuity-retirement-sequencing, which is archived by the same change — the estate is flat, not larger. It cannot be folded into any active roadmap: the carried items are the automatic writer and the retirements that depend on it, and the only other file that ever owned them is the one being archived. Its predecessor road-to-one-continuity-record is archived too. The alternative to this file is dropping five items an owner authorised and two councils sequenced, which is the outcome both councils named as the failure mode."
estate_offset_exempt: "Offset in the same change by archiving agents/roadmaps/road-to-continuity-retirement-sequencing.md, which reaches 100% with this file as its declared carry destination. Recorded rather than omitted because the archival and the addition are one commit and a reader should not have to reconstruct that they pay for each other."
---
# Road to continuity writer activation

> **Source:** the five items carried out of
> `road-to-continuity-retirement-sequencing` when it closed on 2026-09-08, each
> under a recorded ruling. Two AI councils sequenced this work — 2026-09-07
> (transcribed in `agents/roadmaps/stubs/road-to-continuity-retirement-sequencing.md`)
> and 2026-09-08 (transcribed verbatim in
> `agents/evidence/analysis/council-2026-09-08-continuity-retirement-scope.md`).
> Nothing here is a new proposal; every item arrives with its ruling attached.

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

- [ ] **1.1 Settle the authoritative record slot before anything writes to it.**
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
- [ ] **1.2 A deterministic writer that runs without model spend, default-off.**
      It emits the `continuity_record` variant, computes every field from
      on-disk state, and is gated by its own settings switch defaulting to
      `false`. Default-off is not caution for its own sake: until 1.1 is
      settled and 1.3 is measured, enabling it by default would put an
      unverified producer on the normal path.
      verify: a session ending at a bound slot leaves a record without model
      spend; a session that did nothing substantive leaves none; the count comes
      from the concern's own state, never from file presence; with the switch at
      its default the tree behaves exactly as it does today.
- [ ] **1.3 Parity, in the two halves the 2026-09-08 council separated.**
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
- [ ] **1.4 Independent kill switches, and a rollback note that distinguishes
      the two kinds of undo.** The continuity writer, `run_checkpoint`
      production and the session-index restore each get their own switch, and
      disabling one restores pre-change behaviour for that handler only.
      Rollback documentation must separate disabling new behaviour from
      reverting a deletion — a switch cannot bring back a removed command.
      verify: a test disables each switch in turn and shows the other two still
      fire; the rollback note names the residual behaviour of each switch and
      the trip criteria that should cause an operator to throw one.

## Phase 2 — the split the concern ratchet currently forbids

- [ ] **2.1 Three concern ids with three kill switches, paid for by a
      retirement.** `hook_manifest.yaml` declares the continuity-record writer,
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
- [ ] **3.2 `session:recycle` — retire the manual writer once the automatic one
      is proven.** It is the only writer today, so this step is gated on Phase 1
      in full, not merely started. The advisory that instructs a human to run it
      before `/clear` goes with it — that advisory IS the counted normal-path
      manual action.
      verify: `check_continuity_surface` shows `public_continuity_commands` and
      `normal_path_manual_actions` both one lower; no reader of the retired verb
      remains in the tree.
- [ ] **3.3 `context-fill.json` — retire it, or record that its parked consumer
      keeps it.** Authorised by the 2026-09-08 council on producer/no-consumer
      evidence that turned out incomplete: there is no consumer in code, but
      `agents/roadmaps/later/road-to-cost-parity-2-state-aware-dispatch.md` has
      open steps 1.1 and 1.4c that read it as a planned input, and 1.4c is
      specifically about bounding its staleness. That roadmap's owner decides,
      not this one.
      verify: either the file and its producer are gone and that roadmap's steps
      are re-anchored in the same change, or its inventory row records the
      owner's decision to keep it.
- [ ] **3.4 `/chat-history` and `/chat-history import` — retire the two
      commands.** Named in the owner's 2026-09-06 authorisation and blocked in
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
### blocker: chat-history-command-retirement-has-documented-dependencies

- **Status:** open
- **Owner:** maintainer
- **Asked:** 2026-09-08. The AI council made these two retirements conditional — anthropic: *"Do they appear in any shipped examples, docs, or error messages? … Retiring them requires proving non-use, not just proving they're marked internal. If that proof doesn't exist, they're not 'reachable in this session.'"* A full tracked-source audit ran on 2026-09-08 against `drain/continuity-retirement`. It answers every other class in the negative and this one in the affirmative.
- **Blocks:** the only movement available on the `session_resume_pickers` axis. `check_continuity_surface` reads `1 / 2 / 5 / 1 / 1`; this retirement alone takes position 2 to `1`.
- **Recommendation:** retire them, in a change whose subject is the removal. The audit clears every mechanical class — no CLI verb, no dispatcher case, no MCP tool, no hook, no runtime loader, no error path, and no test that reads the real tree (the one test naming the slug writes a synthetic fixture into a `mkdtemp` sandbox). What it does NOT clear is the documentation class the council named, and the two instances that matter are not incidental: `docs/getting-started.md:177` advertises `/chat-history import` in the user-facing quick-start table, and `src/domains/meta/agent-handoff/command.md:254`, `:259`, `:267` — the command the owner's authorisation explicitly PRESERVES — instructs its use after a crash or a fresh-chat reopen and links to the file. Removing a recovery affordance that the surviving command advertises is a deliberate act.
- **If you do nothing:** two internal commands stay listed, `session_resume_pickers` stays at 2, and `/agent-handoff` keeps pointing at a path that still works. Nothing degrades and nothing rots — the cost is that the surface stays one wider than the owner asked for on 2026-09-06, indefinitely.
- **What to do:** the audit enumerated the whole change, so this is a checklist rather than an investigation. **Delete** `src/domains/meta/chat-history/command.md` and `src/domains/meta/chat-history/import/command.md`. **Hand-edit the four surfaces no generator owns**, each of which reddens a named gate: `src/config/continuity-surface.json` — delete the rows `command:chat-history` and `picker:chat-history-import` (gate `check_continuity_surface`, dead-locus); `src/flows/surface-map.yaml:168-169` (gate `lint_command_flow_coverage`, phantom ref); `docs/contracts/command-clusters.md:34` plus the worked example at `:92` (gate `check_cluster_patterns`, dispatcher-missing); `docs/getting-started.md:177` (no gate — it is the user-facing row). **Fix the links no gate catches**, because `check_references` does not match parenthesised markdown targets: `src/domains/meta/agent-handoff/command.md:254`, `:259`, `:267` and `src/skills/learning-to-rule-or-skill/SKILL.md:383-384` both go dangling. **Then regenerate rather than hand-edit** — `task sync`, `task generate-tools`, `update_counts`, `generate_index`, `generate_command_flows`, `generate_capabilities_index`, `generate_pack_manifests`, `build_proof` — which moves the command count 204 → 202 across `README.md:7`, `docs/CLAIMS.md:393`, `docs/architecture.md:158`, `docs/command-flows.md:10`, `docs/featured-skills.md:96`, `docs/getting-started-by-role.md:5`, `docs/proof.md:55`, `CAPABILITIES.yaml:15`, and the memory pack's `artefact_count` and token passport. **Verify** with `check_continuity_surface` (expect `session_resume_pickers` 2 → 1), `lint_command_flow_coverage`, `check_cluster_patterns` (expect 25 dispatchers, down from 26), `check_command_count_messaging`, `check_artefact_count_messaging`, `check_public_catalog_links` and the four `--check` generators.
- **Resolved when:** the two command documents are gone, every surface above is updated or regenerated in the same change, and `check_continuity_surface` reports `session_resume_pickers` at 1.

### blocker: the-command-usage-telemetry-cannot-prove-non-use

- **Status:** open
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
- **Recommendation:** reorder rather than negotiate the ratchet — do Phase 3 first and let step 3.1's retirement of the `hot-context` concern pay for the split. It is the only one of the three resolutions the 2026-09-08 council left standing (anthropic listed changing the countable unit, introducing an allowance, and deferring the split; openai struck the first two with *"No temporary allowance"*), and it is also the cheapest: the retirement is authorised work this roadmap already carries, so the payment costs nothing that was not already planned.
- **If you do nothing:** step 2.1 stays unreachable and the three handlers stay inside existing concerns. That is a smaller loss than it sounds — independent kill switches and failure isolation are the substance the 2026-09-07 D2 required, and Phase 1 delivers both without the manifest split. What is actually lost is per-concern observability and the ability to drop one handler from one host's slot list, and a later reader who does not know that will read the open box as a gap in safety rather than in ergonomics.
- **What to do:** land Phase 3 first. `check_estate_count` measures `concern_count` from `src/scripts/hook_manifest.yaml` against the base ref with allowance 0 (`src/scripts/check_estate_count.ts:156`, `:841`), so the +2 that a three-way split costs has to be paid by a concern that goes away. Retiring `hot-context` (step 3.1) is the payment. Both seats of the 2026-09-08 council refused the alternatives explicitly — openai: *"No temporary allowance."*
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

- [ ] AC-1 — A session ending at a bound slot leaves a continuity record without
      model spend, and a session that did nothing substantive leaves none. The
      count comes from the concern's own state, never from file presence.
      Carried from the predecessor's AC-5.
- [ ] AC-2 — `./scripts-run src/scripts/check_continuity_surface` reports
      exactly `0 / 0 / 1 / 1 / 0`, and no exclusion in its inventory represents
      a normal-path continuity mechanism that would change the vector if
      counted. Carried from the predecessor's AC-7b; the vector read
      `1 / 2 / 5 / 1 / 1` when this roadmap was written.
- [ ] AC-3 — Disabling any one of the three lifecycle switches restores
      pre-change behaviour for that handler and leaves the other two firing,
      proven by a test rather than by the rollback note that describes it.
