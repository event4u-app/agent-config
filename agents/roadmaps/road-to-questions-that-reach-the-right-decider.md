---
complexity: lightweight
status: ready
tree_pin: 811cea61d6
execution:
  mode: autonomous
estate_offset_exempt: "Owner-directed 2026-11-21: one roadmap per measure of the session retrospective, to be planned and worked through. No active roadmap covers question routing for ordinary sessions or subagents. The nearest owner, road-to-decision-closure, sits in later/ and covers roadmap planning only, so no existing roadmap can be offset against this one. Owner record: agents/evidence/owner-directives/2026-11-21-session-retro-roadmaps.md."
estate_growth_exempt: "Measure 4 (P0) of the owner's session retrospective of 2026-11-21, which the owner asked to have planned and executed in the same request. +1 open_blockers: owner-rows-outside-the-four. Removing a row from the owner-reserved set is governance self-amendment, which only the owner can clear."
relates:
  - slug: road-to-decision-closure
    relation: extends
    note: "Owns the eight ownership classes (Phase 0, landed) and the closure cascade for roadmap planning and mid-run residue (Phase 1 and § 5a-residue, landed). This roadmap adds what it leaves out: asks in ordinary sessions and commands, the impact-axis keyword lock, subagents, and a measurement. Its open steps 3.1, 4.1 and 5.1 stay there."
  - slug: road-to-kernel-question-triangle
    relation: disjoint
    note: "Owns the band-4 amendment to the kernel rule ask-when-uncertain, which is maintainer-applied. This roadmap edits no kernel rule (D5)."
  - slug: road-to-owner-reserved-table-as-data
    relation: extends
    note: "Stub whose trigger is a second consumer of the owner-reserved table as data. Step 3.2 is such a consumer only if the council in 2.1 picks a data source. Otherwise the stub's trigger stays unfired."
  - slug: open-questions-3
    relation: disjoint
    note: "Archived 2026-05 council-mode question list; lexical hit only."
  - slug: road-to-a-git-convention-that-reaches-every-checkout
    relation: disjoint
    note: "Archived; git convention reach, lexical hit only."
  - slug: road-to-an-invocation-contract-that-reaches-the-wire
    relation: disjoint
    note: "Archived; skill invocation contract, lexical hit only."
  - slug: road-to-authorization-that-reaches-further
    relation: disjoint
    note: "Archived; grant reach, not question routing."
  - slug: road-to-orchestrator-discipline-carriers
    relation: disjoint
    note: "Archived; delegation and end-review carriers, not question routing."
  - slug: road-to-scheduled-reds-that-reach-someone
    relation: disjoint
    note: "Stub about scheduled CI reds; lexical hit only."
---
# Road to questions that reach the right decider

> **Source:** the owner's session retrospective of 2026-11-21 (about 380 Claude
> Code sessions in 23 chunks, 643 incidents). This roadmap carries measure 4 (P0)
> and pattern B, "questions and repeated permissions land with the owner",
> seen in at least 12 chunks. An AI council round on the same day (anthropic
> claude-sonnet-4-5 and openai codex-default, analysis mode, one round, 2/2
> answered) doubted a council-first default. Its reasons: the council runs on
> the same rules and adds latency, and two "1" answers in a row are weak
> evidence that the owner hands off decisions. Both seats asked for a sample of
> the reported 269 decision questions before any default changes. The owner
> then asked for every retrospective measure to be planned and worked through
> (2026-11-21). Tree facts verified at `811cea61d6` on 2026-11-21.

## Goal

A question reaches the owner only when it belongs to one of four owner classes:
changing the purpose, lowering a safety floor, an irreversible act, or money
above a delegated cap. A question with one dominant option is decided by the
agent. A real technical trade-off goes to the council. This holds in ordinary
sessions, in commands and in subagents. A generated census, re-run from the
transcripts by a command, shows the before state, and the routing is tested on
fixtures drawn from that census.

## Context

- **What the retrospective measured.** Owner quotes, 2026-10-13: "Die waren
  alle AI Council geeignet. Warum hast Du mich gefragt?" 2026-11-03: "die fragen
  soll der fucking ai council klären". The synthesis reports 269 decision <!-- md-language-check: ignore -->
  questions answered mostly with "1" or "mach weiter". **Unverified:** the <!-- md-language-check: ignore -->
  retrospective's scratch files cite the number to "a throughput analysis" with
  no derivation. Phase 1 re-derives it rather than carrying it forward.
- **What already exists (verified).**
  - The ownership axis: `src/scripts/ai_council/ownership_classes.ts:35`
    `OWNER_LOCKED_CLASSES` = `product-owned`, `business-owned`,
    `destructive-owned` (ADR-268 § 10, owner ruling of 2026-09-08).
  - The roadmap-planning cascade (`/challenge-me closure`) and the mid-run
    residue table (`roadmap-process-loop` § 5a-residue). Both landed under
    `road-to-decision-closure`.
- **Why it still reaches the owner (verified).**
  1. **The impact axis still locks to the user.** In
     `src/scripts/ai_council/necessity.ts:604-611`, `high_impact` holds 29
     keywords, including design-level ones such as `migration`, `auth`, `tenant`
     and `security`. `LOCKED_IMPACT_CLASSES` (`:565`) sends them to the user.
     `docs/contracts/ai-council-config.md:996` documents the same lock, and the
     kernel rule `src/rules/ask-when-uncertain.md:58` repeats it. The result is
     that a migration *design* question reaches the owner, although ADR-268
     § 10 classes it as `critical-technical`, which goes to the council.
  2. **The second owner-reserved list is wider than the owner's four.**
     `src/rules/decision-revisit-gate.md:134-142` reserves seven rows. Four of
     them (legal or public commitment, governance self-amendment, "cannot be
     bounded from available evidence", and `business-owned` taste) are not
     among the owner's four classes.
  3. **Subagents carry no cascade.**
     - The generated `SUBAGENT-FLOOR`
       (`src/scripts/generate_subagent_floor.ts:57`, for example
       `src/skills/subagent-orchestration/prompts/do-in-parallel.md:5-31`) names
       five lines and none of them is about questions.
     - `NEEDS_CONTEXT` hands a free-text `blocking_question` to the
       orchestrator
       (`src/skills/subagent-orchestration/schemas/subagent-status.json:30,109`)
       without an ownership class, so the orchestrator cannot route it.
     - `subagent-constraints` (`src/scripts/hook_manifest.yaml:1503`) injects
       context only for definitions that set `omitClaudeMd`.
     - The owner's personal memory "Council, not user questions" is a body file
       the package does not ship. In this authoring session (a workflow
       subagent, 2026-11-21) the memory **index line** was visible but its body
       was not.
  4. **No routing code runs at ask time.** `route_decision` (`necessity.ts:894`)
     has no production caller outside the council module. Routing is
     agent-carried, so every change here is tested on fixtures and measured on
     transcripts. A unit test alone is not the claim.
- **What this roadmap does not do.**
  - It does not build goal-scoped mandates for repeated "create the PR"
    permissions. That is the sibling `road-to-mandates-scoped-to-the-goal`,
    measure 3 of the same retrospective. The two roadmaps touch no file in
    common.
  - It does not edit a kernel rule (D5).
  - It does not add a "1-1-1" auto-switch heuristic (D2).
  - It does not hand-write a context file. The owner's constraint of
    2026-11-21 applies: project knowledge is generated by a command, never
    authored by a human.

## Phase 1 — Re-derive the asks from the transcripts

- [ ] **1.1 Write the failing fixtures for an all-asks census.** Extend the
      `--self-test` cases of `src/scripts/probe_unblocked_ask.ts` with these
      cases for a new `--all-asks` mode:
      - a hand-back with a numbered-options block counts as an ask (today it is
        excluded on purpose, see its header bound 2);
      - the reply `1` to a block whose `Recommendation:` names 1 is classed as
        `confirmed-recommendation`;
      - `mach weiter`, `weiter` and `ok` are classed the same way;
      - a reply that picks another number is classed as `overrode`;
      - free text is classed as `redirected`;
      - an `isSidechain` turn is tagged `subagent` through
        `src/scripts/_lib/cc_transcript.ts:234`.

      Run the self-test and see it fail, because the mode does not exist yet.
      verify: `./scripts-run src/scripts/probe_unblocked_ask --self-test` -> 1
- [ ] **1.2 Implement `--all-asks`, repeatable `--store`, and per-ask attribution.**
      For each ask, record these fields:
      - `producer`: the last slash command or `Skill` tool call earlier in the
        session, else `freeform`;
      - `session_kind`;
      - the `classify_impact` class from `necessity.ts`;
      - the reply class from 1.1.

      `--write` emits `agents/evidence/analysis/decision-asks-census-<date>.md`
      with these properties:
      - it is pinned to the commit and carries the store list;
      - it holds counts only, never raw transcript text, under the
        `domain-safety-pii` floor;
      - it exits 0 like every census.

      The 1.1 fixtures turn green.
      verify: `./scripts-run src/scripts/probe_unblocked_ask --self-test` -> 0
- [ ] **1.3 Run the census over every local transcript store and reconcile 269.**
      Pass one `--store` for each profile under
      `~/.agent-switch/claude/*/config/projects` and for `~/.claude/projects`.
      In the artefact, state the measured total of owner-reaching asks next to
      the reported 269. Any difference is explained in the artefact, for
      example a different window, numbered-block-only counting, or
      deduplication.
      verify: `grep -q 'measured: [0-9]* · reported: 269' agents/evidence/analysis/decision-asks-census-2026-*.md` -> 0
- [ ] **1.4 Label a seeded sample with an independent session.**
      `--sample 60 --seed 20261121` writes a label sheet into the artefact. A
      subagent that did not write 1.1-1.3 labels each row with its cascade rung:
      `dominant`, `contested-technical`, `owner-four`, or `other-owner-row`. The
      labeller id goes in the sheet (`evaluator-independence`). If there are
      fewer than 60 asks, every ask is labelled.
      uses: subagent-orchestration
      verify: `grep -c '^| S[0-9]' agents/evidence/analysis/decision-asks-census-*.md` -> /^(60|[1-5][0-9]|[1-9])$/
- [ ] **1.5 Derive the producer ranking and the fixture corpus from the labels.**
      `--emit-fixtures tests/fixtures/decision-asks/` writes one file per
      labelled row. Question text goes through
      `src/scripts/ai_council/redact_low_impact_entry.ts` first, and a row the
      redactor refuses is dropped and counted. The artefact ranks producers by
      the count of rows labelled `dominant` or `contested-technical` that
      reached the owner. That ranking is what Phase 4 reads.
      verify: `ls tests/fixtures/decision-asks/*.md | wc -l` -> /[1-9]/

## Phase 2 — Narrow the owner-reserved set to the four

- [ ] **2.1 Run the council on the mapping before touching any list.**
      Run `agent-config council:status` first, then one council round. Its
      input is the three lists cited in Context § 2 and § 1 and the 1.4 label
      sheet. The question: map every entry to one of the four owner classes,
      or to `council` (a technical answer exists), or to `outside` (an owner
      row that is not one of the four). The verdict goes into `## Decisions` as
      D6, with the date and members inline.
      verify: `grep -c '^| D6 ' agents/roadmaps/road-to-questions-that-reach-the-right-decider.md` -> 1
- [ ] **2.2 Write the failing routing test from the fixtures.** In
      `tests/scripts/ai_council/necessity.test.ts`, assert two things:
      - every 1.5 fixture labelled `contested-technical` whose text hits a D6
        `council` keyword classifies below `high_impact`;
      - `drop table`, `truncate`, `prod database`, `delete column` and the
        keywords D6 maps to money stay `high_impact`.

      See the test red against the current list.
      verify: `npx vitest run tests/scripts/ai_council/necessity.test.ts` -> 1
- [ ] **2.3 Move the D6 `council` keywords from `high_impact` to
      `medium_impact`.** The edit is in `necessity.ts:599-611`, and
      `docs/contracts/ai-council-config.md:996` is updated in the same change.
      The kernel line `ask-when-uncertain.md:58` stays literally true, because
      `high_impact` still reaches the user and now holds only owner-class
      keywords.
      verify: `npx vitest run tests/scripts/ai_council/necessity.test.ts tests/scripts/ai_council/low_impact.test.ts tests/scripts/council_dispatch_routing.test.ts` -> 0
- [ ] **2.4 Name the owner class on every reserved row.** Add an `Owner class`
      column to `src/rules/decision-revisit-gate.md:134`. Each row gets its D6
      mapping (`purpose`, `safety-floor`, `irreversible`, `money`) or
      `outside`. The change is additive: no row's scope changes in this step.
      verify: `grep -c 'Owner class' src/rules/decision-revisit-gate.md` -> /[1-9]/
- [ ] **2.5 Fold or remove the rows mapped `outside`.** <!-- blocked-by: owner-rows-outside-the-four | asked: no — authored by a non-interactive workflow subagent; the question reaches the owner in the run's end report -->
      Apply the owner's answer to the blocker row by row, then run
      `task sync` and `task generate-tools`.
      verify: `grep -c '| outside |' src/rules/decision-revisit-gate.md` -> 0

## Phase 3 — Subagents carry the cascade

- [ ] **3.1 Write the failing floor test.** Create
      `tests/scripts/generate_subagent_floor.test.ts`. It asserts that the
      generated floor carries a sixth line naming the cascade:
      - decide when one option dominates;
      - a technical trade-off returns `NEEDS_CONTEXT` with its class;
      - only the owner classes reach the owner.

      It also asserts that the class names in that line come from
      `OWNER_LOCKED_CLASSES` and from D6's money row: a fixture that changes
      the set changes the line. See it fail.
      verify: `npx vitest run tests/scripts/generate_subagent_floor.test.ts` -> 1
- [ ] **3.2 Generate the cascade line.** Implement the line in
      `generate_subagent_floor.ts` and source it from the data, never from a
      hand-copied list. Rewrite every span with the generator; this includes
      the `dist/agent-src/` copies, which the generator already writes.
      verify: `./scripts-run src/scripts/generate_subagent_floor --check` -> 0
- [ ] **3.3 Make the subagent's question routable.** In
      `subagent-status.json:109`, `NEEDS_CONTEXT` also requires
      `ownership_class`, an enum from `OWNERSHIP_CLASSES`. Write the failing
      case in `tests/scripts/subagent_contract.test.ts` first, then make the
      schema change.
      verify: `npx vitest run tests/scripts/subagent_contract.test.ts tests/scripts/ai_team/team_dispatch.test.ts` -> 0
- [ ] **3.4 Route `NEEDS_CONTEXT` by class at the orchestrator.** In
      `src/skills/subagent-orchestration/SKILL.md` (the § near line 249) and in
      the eight `prompts/*.md` envelope blocks:
      - a non-owner class is answered by the orchestrator or by the council;
      - an owner class is bundled into one end-of-run ask;
      - the orchestrator never forwards the question to the user mid-run.
      verify: `./scripts-run src/scripts/skill_linter src/skills/subagent-orchestration/SKILL.md` -> 0
- [ ] **3.5 Decide the carrier for host-native subagents, council first.** The
      question is whether `subagent-constraints` should inject the 3.2 line
      for every subagent, not only for `omitClaudeMd` definitions. Its input is
      the 1.3 count of `subagent` asks and the line's byte cost per spawn.
      - Run the council first.
      - If the verdict is yes, write the failing case in
        `tests/hooks/subagent_constraints_hook.test.ts`, then implement.
      - If no, record the reason as D7 and leave the step closed.
      verify: `npx vitest run tests/hooks/subagent_constraints_hook.test.ts` -> 0

## Phase 4 — The producers the census names

- [ ] **4.1 Generate one cascade section from the same data.** Add a generated
      `Who answers a question` span to
      `src/agent-src/contexts/communication/rules-auto/user-interaction-mechanics.md`.
      It is written by the 3.2 generator, from `OWNER_LOCKED_CLASSES` and D6,
      and checked by the same `--check`. The span lists the three rungs and the
      four owner classes. It holds no hand-authored list.
      verify: `./scripts-run src/scripts/generate_subagent_floor --check` -> 0
- [ ] **4.2 Point each ranked producer at the cascade.** Take every producer
      with at least 10 % of the 1.5 ranking. At its ask site in `src/` (its
      `command.md` or rule), route through the 4.1 section before any hand-back,
      and add one 1.5 fixture of that producer to the 2.2 test.
      verify: `./scripts-run src/scripts/ask_block_census --root src/domains` -> 0
- [ ] **4.3 File the remeasurement as a stub, not as a step.** The remeasure
      needs elapsed sessions, so it goes in a stub (template rule 17c). Write
      `agents/roadmaps/stubs/road-to-questions-that-reach-the-right-decider-remeasure.md`
      with this trigger: 30 owner sessions after the 2.3 change lands, re-run
      the 1.3 command and compare the share of `confirmed-recommendation`
      replies against the 1.3 artefact.
      verify: `./scripts-run src/scripts/lint_roadmap_complexity` -> 0

## Phase 5 — An owner decision the agent cites has a source

The retro's third anger trigger: in azeroth on 2026-11-14 the agent invented a
deploy gate, presented it as the owner's rule, and the owner replied "Kippe
diese scheiß regel die von dir kommt, nicht von mir". This is the opposite of <!-- md-language-check: ignore -->
the routing defect above. There the agent asks the owner too often. Here it
answers in the owner's name without the owner. Nothing in the tree checks that
a claimed owner decision has a recorded source.

**The provenance requirement.** An assistant turn that attributes a rule, gate
or decision to the owner is *sourced* only when the same turn cites one of:
a path under `agents/evidence/owner-directives/` that exists; a memory file
name; an `owner`-resolved `## Decisions` row named by roadmap and ID; or an
owner sentence quoted verbatim from an earlier user turn of the same
transcript. The phrase set is EN and DE ("your rule", "you decided", "per your
instruction", "owner directive", and their German forms).

- [ ] **5.1 Write the failing detector fixtures.** Add a `--self-test` suite
      to a new `src/scripts/probe_owner_attribution.ts` with these cases:
      - (a) the azeroth shape: a gate attributed to the owner with no source is
        flagged `unsourced`;
      - (b) the same claim with an existing directive path is clean;
      - (c) a quote that matches an earlier user turn is clean;
      - (d) a quote that matches no user turn is flagged `fabricated-quote`;
      - (e) a slash-command expansion or `<task-notification>` turn is never
        read as an owner turn;
      - (f) the output carries no prompt text.

      verify: `./scripts-run src/scripts/probe_owner_attribution --self-test` -> 1 on the missing implementation.
- [ ] **5.2 Implement the detector.** Build it on
      `src/scripts/_lib/cc_transcript.ts` (main bucket, replay-deduped) with
      the repeatable `--store` and `--json` of 1.2. It outputs counts, session
      ids and finding classes only. It is a measurement, not a gate: exit 0,
      and `--self-test` exits 1 on a failing case.
      verify: `./scripts-run src/scripts/probe_owner_attribution --self-test` -> 0 and `--json` over this repo's store exits 0.
- [ ] **5.3 Write the baseline by command and check it against the retro.**
      Run it with `--write agents/evidence/analysis/owner-attribution-baseline.json`
      over every local store the 1.3 census read. The artefact records the
      command line and the commit. The azeroth session of 2026-11-14 is a
      positive control. If it is not flagged, the phrase set is extended and
      5.1 gets a case from that session before the baseline is written.
      verify: the artefact exists, its `command` field equals the invocation, and its `unsourced` list includes the azeroth 2026-11-14 session id.
- [ ] **5.4 Generate the provenance line.** Extend the 3.2 generator and the 4.1
      span with one line: "An owner decision you cite names its source: an
      owner-directive record, a memory file, an `owner` Decisions row, or the
      owner's quoted turn. Without a source it is your proposal, and you say so."
      The failing test comes first, in `tests/scripts/generate_subagent_floor.test.ts`.
      It asserts the line is in every generated floor and in the 4.1 span.
      verify: `npx vitest run tests/scripts/generate_subagent_floor.test.ts` -> 0 and `./scripts-run src/scripts/generate_subagent_floor --check` -> 0
- [ ] **5.5 File the re-measure with the 4.3 stub.** Add a second trigger to
      the 4.3 stub: 30 owner sessions after 5.4 lands, re-run 5.3 into a new
      file and compare `unsourced` plus `fabricated-quote` per 100 assistant
      turns against the baseline.
      verify: `grep -c 'probe_owner_attribution' agents/roadmaps/stubs/road-to-questions-that-reach-the-right-decider-remeasure.md` -> /^[1-9][0-9]*$/ and `./scripts-run src/scripts/lint_roadmap_complexity` -> 0

<!-- Release holds — none. Considered and not needed: every phase lands a
     complete, consistent state (the census is additive, 2.3 narrows a keyword
     list in one change with its doc, 3.2 regenerates every floor span in one
     run), so no intermediate tree state is unreleasable. Phase 5 adds a
     measurement and one generated line, both additive.

     resequenced: the keyword move (2.3) follows its own failing test (2.2) and
     the council mapping (2.1) in one phase, so no tree state routes a question
     by a half-moved list.
-->

## Decisions

| ID | ownership | resolved by | decision | evidence | revisit if |
|---|---|---|---|---|---|
| D1 | business-owned | owner | Only four classes reach the owner: purpose, lowering a safety floor, irreversible, money above a delegated cap | owner request of 2026-11-21 adopting retrospective measure 4 | the 1.4 sample shows the owner overriding the recommendation in a class outside the four |
| D2 | contested-technical | council:2026-11-21 retrospective round, anthropic + openai | No "1-1-1" heuristic: two confirmed recommendations in a row never switch a session to a council mode | both seats called two "1" answers weak evidence of delegation | the census shows owner-confirmed rows that the cascade still routed to the owner |
| D3 | contested-technical | council:2026-11-21 retrospective round, anthropic + openai | The council is the second rung, not the first. A dominant option is decided by the agent, and the council takes only a genuine trade-off | both seats: council-first only moves the problem and adds latency | the 1.4 sample shows `dominant` rows the agent got wrong |
| D4 | critical-technical | evidence | A security, auth, tenant or migration design question routes to the council, not the owner | ADR-268 § 10, owner ruling of 2026-09-08 | the owner reverses a council-routed design of that kind |
| D5 | deterministic | agent | This roadmap edits no kernel rule. `ask-when-uncertain.md:58` stays true because `high_impact` narrows rather than unlocks | `block-kernel-rule-writes` refuses agent writes to kernel rules (`hook_manifest.yaml:231`) | the 2.1 council finds the four classes impossible without unlocking `high_impact` |

## Blockers

### blocker: owner-rows-outside-the-four
- **Status:** open
- **Owner:** owner
- **Class:** 2
- **Ownership:** business-owned
- **Routed:** pending — the mapping is step 2.1's council output. Removing a reserved row is a governance self-amendment (`decision-revisit-gate.md` reserved row "Governance self-amendment"), which the council cannot clear.
- **Blocks:** Phase 2 — step 2.5
- **Question:** For each reserved row the council maps `outside` the four owner classes: fold it into one of the four, keep it, or remove it?
- **Recommendation:** fold or keep every row, remove none, so the reserved set shrinks to the four classes without dropping a protection:
  - Fold "legal, regulatory, contractual, licensing, compatibility, or public commitment" into `irreversible`, since an external commitment is one.
  - Keep "governance self-amendment", since it protects the floor.
  - Turn "cannot be bounded from available evidence" into "council first, owner only on a council split".
  - Narrow `business-owned` taste to product-visible semantics under `purpose`.
- **If you do nothing:** the four classes hold in subagents, in the impact keywords and in the producers. Rows outside them still reach the owner through `decision-revisit-gate`, which mostly fires on ADR and lock questions.
- **What to do:**
  1. Read the D6 row of this roadmap and the `outside` rows in `src/rules/decision-revisit-gate.md`.
  2. Answer fold, keep or remove per row in the end-of-run report. The agent applies it in step 2.5.
- **Resolved when:** a dated `owner` row D8 in `## Decisions` names each `outside` row's disposition, and `grep -c '| outside |' src/rules/decision-revisit-gate.md` returns 0.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-11-21 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | Routing stays agent-carried | implementation | No code runs at ask time (`route_decision` has no production caller), so tests pass while sessions still hand trade-offs to the owner | Fixtures come from real asks (1.5). The census is a command that can be re-run, and the remeasurement is filed as a stub in 4.3 | Phase 4 — The producers the census names |
| 2 | Narrowing lowers a floor by accident | product | Moving `auth` or `tenant` to `medium_impact` could send a floor-lowering question to the council | 2.1 maps each entry, 2.2 pins the destructive and money keywords as `high_impact`, and D4 cites the owner's own ADR-268 § 10 ruling | Phase 2 — Narrow the owner-reserved set to the four |
| 3 | The census leaks transcript content | implementation | Raw owner prose or identifiers land in a tracked artefact or fixture | Counts only in the artefact. Fixtures pass the low-impact redactor, and refused rows are dropped and counted (1.5) | Phase 1 — Re-derive the asks from the transcripts |
| 4 | The heuristic labels are biased | product | The reply class `1` may mean fatigue rather than agreement, which both council seats flagged | An independent labeller works on a seeded sample (1.4), and D2 refuses to act on reply streaks alone | Phase 1 — Re-derive the asks from the transcripts |
| 5 | The floor line costs bytes on every spawn | implementation | The sixth floor line and a wider `subagent-constraints` reach add context to every subagent | 3.5 decides the wider reach through the council, with the byte cost as an input | Phase 3 — Subagents carry the cascade |
| 6 | The attribution detector misfires | implementation | The phrase set flags the agent quoting a real owner turn, or misses a paraphrased invented rule, so the baseline misstates the defect | Verbatim-quote match against earlier user turns (5.1 c, d); the azeroth 2026-11-14 session is a positive control the baseline must flag (5.3); the detector is a measurement, never a gate | Phase 5 — An owner decision the agent cites has a source |

## Acceptance Criteria

- [ ] AC-1 — A census artefact under `agents/evidence/analysis/` is produced by
      `probe_unblocked_ask --all-asks --write`. It is pinned to a commit and
      states the measured ask total next to the reported 269.
- [ ] AC-2 — No 1.5 fixture labelled `dominant` or `contested-technical`
      classifies as `high_impact`, and the destructive and money keywords still
      do (`necessity.test.ts` green).
- [ ] AC-3 — Every generated subagent floor names the cascade, and the class
      names in it are read from `ownership_classes.ts`
      (`generate_subagent_floor --check` exits 0).
- [ ] AC-4 — A `NEEDS_CONTEXT` envelope without `ownership_class` fails
      `subagent_contract.test.ts`.
- [ ] AC-5 — No reply-streak heuristic exists. `grep -rniE '1-1-1|consecutive (answers|confirmations)' src`
      finds nothing. Positive control: the same grep finds D2 in this file.
- [ ] AC-6 — No kernel rule file changed:
      `git diff --name-only 811cea61d6 -- src/rules/ask-when-uncertain.md src/rules/no-cheap-questions.md`
      is empty.
- [ ] AC-7 — `probe_owner_attribution --self-test` exits 0, the 5.3 baseline
      flags the azeroth 2026-11-14 session, and every generated subagent floor
      carries the provenance line (`generate_subagent_floor --check` exits 0).
