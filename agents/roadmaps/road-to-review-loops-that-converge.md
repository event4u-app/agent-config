---
complexity: lightweight
status: ready
tree_pin: 811cea61d6
execution:
  mode: autonomous
estate_offset_exempt: "Owner search 2026-11-21: roadmap:context --roadmap road-to-review-loops-that-converge hit six siblings; only later/road-to-a-review-that-ends touches review rounds, and its Phase 3 measured three of 43 ratification subjects with five or more rounds and parks the cap behind an owner blocker. Merging this delta into that later/ file was rejected because it is parked on a time-based entry condition (20 post-cap completion reviews) this work does not need; archiving an active roadmap to offset was rejected because none of the active set is finished. Owner instruction of 2026-11-21 asked for one roadmap per retro measure. Owner record: agents/evidence/owner-directives/2026-11-21-session-retro-roadmaps.md."
estate_growth_exempt: "+2 open_blockers: convergence-stop-binding and owner-override-satisfies-ratification-ci, added in this change. Ending a ratification loop and letting an owner record turn the ratification gate green both change a recorded verification loop, which decision-revisit-gate reserves to the owner; recording them as blockers is the honest form of decisions no agent may take."
relates:
  - slug: road-to-a-review-that-ends
    relation: extends
    note: "Its ADR-294 capped the completion review at five passes; its 3.1 measured ratification yield on three subjects by hand and found the curve does not fall after round 5. This file widens that census to every subject, generates it by command, asks why findings rise, and adds a convergence criterion. Its 3.1b (spend and severity per round) and its ratification-cap blocker stay its own; 2.1 here hands that blocker the replay data."
  - slug: road-to-inbox-harvest-2026-08-c-evidence-lifecycle
    relation: disjoint
    note: "Archived. Its probe_review_binding_drift measures re-binds caused by non-code edits; 0.2 here reuses the probe as one origin class and does not reopen its refused relaxation."
  - slug: road-to-a-release-record-that-says-what-it-reviewed
    relation: disjoint
    note: "Archived. It made the release record state its own review coverage; it does not count or end review rounds."
  - slug: road-to-a-release-record-that-says-what-it-reviewed-carried
    relation: disjoint
    note: "Owns the post-cut delta review question (review-ceiling-is-spend). The release-cut audit growth the retro names is retro measure 20, not this file."
  - slug: road-to-composition-review-false-positive-rate
    relation: disjoint
    note: "Measures the false-positive rate of an advisory composition lint; no review loop is involved."
  - slug: road-to-orchestrator-discipline-carriers
    relation: disjoint
    note: "Archived. Carries the end-review obligation into sessions; says nothing about when a review ends."
---
# Road to review loops that converge

> **Source:** the owner's session retrospective of 2026-11-21 (about 380 Claude
> Code sessions, measure 5 and pattern C: review, ratification and release loops
> without convergence, in at least 11 chunks) and the AI council round of the
> same day (one analysis round, members anthropic and openai, both present).
> Both seats called a round cap alone a symptom fix and asked first why findings
> rise; the owner kept the limit as a pilot in this package and reserved whether
> an owner override satisfies CI. Tree facts verified at `main@811cea61d6` on
> 2026-11-21.

## Goal

Every review loop in this package — completion review and council ratification
— has a count the tree generates, a named reason when its findings rise, and a
convergence verdict computed from its rounds. Finished means: a command
regenerates the census of every loop; the dominant origin of rising rounds is
measured; a convergence script replayed over every historical loop states where
it would have stopped and which high/critical findings came after; and the two
owner decisions (binding stop, owner override in CI) are either answered and
enforced or open with that replay attached.

## Context

Owner constraint (2026-11-21): no hand-maintained or owner-written context.
Every artefact below is produced by a command over the tree.

| # | Finding | Evidence at `811cea61d6` |
|---|---|---|
| F1 | The completion review is capped: five passes, then open high/critical rows go to an owner report. The retro's 25-round glob fix (2026-10-05) predates the cap. | `docs/contracts/plan-review-gates.md:667` (§ 2.8, ADR-294); `agents/evidence/reviews/fix-release-shape-allows-its-own-census.round25.findings.md` exists |
| F2 | Ratification has no cross-round stop. `non-convergent` means only "fewer concluding providers than required" inside one round. | `src/scripts/ai_council/modification_review.ts:135`, `:151` |
| F3 | ADR-268 § 4 sends the ladder to the owner "only on non-convergence" and never defines it across rounds. | `docs/decisions/ADR-268-mission-scoped-authority-persistence-and-ratified-self-amendment.md:201-203` |
| F4 | Loop sizes: 43 ratification subjects ran five or more rounds — 40 in the `-rN-<date>` naming (max 31, `session-start-contracts-ratification`), 3 in the `.roundN.` naming (56, 20, 11). The later file's 3.1 read only the three. | `ls agents/evidence/council` grouped by subject and max round |
| F5 | Round packets are written by hand: no script in `src/scripts` writes a `*.question.md` packet, so each round restates its own scope. | `grep -rln 'question\.md' src/scripts/*.ts src/scripts/ai_council/*.ts` → no hits |
| F6 | An owner override leaves CI red: a `refused` or `non-convergent` record is a gate failure; the only owner path is the forge bypass with a bypass record (ADR-281 § 5). The 56-round session-pins change merged that way. | `src/scripts/check_kernel_edit_ratified.ts:1100-1104`; `docs/contracts/ratification-artifact.md:343-349`; `agents/evidence/ratifications/session-pins-phase-2-20261109.md:7` |
| F7 | Editing the verdict or record modules is itself a reviewer change the owner decides. | `check_kernel_edit_ratified.ts:171-176` (`REVIEWER_PATHS`), `:500-512` (`MECHANISM_PATHS`); `ratification-artifact.md:726-731` condition 4 |

Unverified, carried from the retro: findings rose 3→5→8→11 in the glob-fix
loop (a crude table-row count of rounds 14-25 reads 2 to 8); hook-budget ran 24
rounds on 2026-11-20 with one seat adding small items each round (no
`hook-budget` packet under `agents/evidence/council/` at the pin). "Review until
honest null" is the owner's phrase for the practice; it has zero hits in `src/`
and `docs/`.

**Not in scope.** The debate round limit (`debate_max_rounds`,
`src/scripts/council_cli.ts:1691`, one question per debate); CI iteration
(retro measure 9 — the council asked to keep CI and review iteration apart);
the release-cut review gate (retro measure 20); spend and severity per round
(`road-to-a-review-that-ends` 3.1b). Nothing here relaxes a Hard Floor, a kernel
rule or review independence; every stop routes open high/critical findings to
the owner and never closes them.

## Phase 0 — A census the tree generates, and why findings rise

- [ ] **0.1 Census script, test-first.** Write
      `tests/scripts/review_loop_census.test.ts` first: fixtures in a temp dir
      with both packet namings (`<slug>.roundN.question.md`,
      `<slug>-rN-<date>.question.md`), completion-review `roundN.findings.md`
      files and a ratification record; assert per subject the loop kind,
      round count, first and last date and final verdict. See it red, then
      write `src/scripts/review_loop_census.ts` emitting JSON plus
      `agents/evidence/analysis/review-loop-census.md` with the producing
      command in its header. On demand only — no CI gate (D2).
      verify: `npx vitest run tests/scripts/review_loop_census.test.ts` red
      before the script, green after; `./scripts-run src/scripts/review_loop_census`
      lists `session-pins-phase-2-20261108` at 56 and
      `session-start-contracts-ratification` at 31, and 43 ratification
      subjects at five or more rounds at the pin.
- [ ] **0.2 Deterministic origin classes.** Extend the census, test-first, with
      a per-round `--origins` reading for subjects with five or more rounds:
      paths each packet cites, and class `scope-widened` when a cited path is
      in neither round 1's packet nor the subject's diff. For completion
      reviews add `rebind-non-code` from `src/scripts/probe_review_binding_drift.ts`.
      verify: a fixture round citing a new path is classed `scope-widened`
      (red, then green); the census JSON carries both classes per round.
- [ ] **0.3 Reader origin classes.** For the ten subjects with the most rounds,
      two independent subagent readers class every new finding per round as
      `fix-introduced` (names what the previous round's fix changed),
      `single-seat` (one seat only, medium or low), `re-raised` (restates an
      earlier dismissed finding) or `other`; a third reader settles
      disagreements. Write `agents/evidence/analysis/review-loop-origins-2026-11.md`
      with the reader prompt, the agreement rate and per-round class counts
      merged with 0.2's classes.
      uses: subagent-orchestration
      verify: every new finding in the ten subjects carries exactly one class;
      the artefact states agreement before adjudication.
- [ ] **0.4 Name the driver of rising rounds.** Over every round whose new
      findings exceed the previous round's, compute each class's share. The
      lever is pre-registered: `scope-widened` above 40 % → 1.5 (generated
      packet) ships; `single-seat` above 40 % → 1.1 must offer a seat-novelty
      criterion; `fix-introduced` above 40 % → 1.1 must offer a fix-size
      criterion; none above 40 % → criterion only. Write the result as a
      Decisions row.
      verify: a `## Decisions` row cites the artefact, the shares sum to 100 %,
      and the named lever matches the threshold table.

## Phase 1 — A shadow convergence pilot

- [ ] **1.1 Council: the convergence criterion.** First action: run
      `/council:analysis` with both members on 0.3's artefact and 0.4's row.
      Candidates: (a) K consecutive rounds without a new high/critical finding
      that is not fix-introduced; (b) new findings non-decreasing over three
      rounds reads `diverging`; (c) the knee of the pooled yield curve; plus
      the lever 0.4 named. Record the verdict, both seats' positions and K as
      a Decisions row (`contested-technical`, `council:<date>`).
      verify: the row exists with both seat positions and a numeric K or knee.
- [ ] **1.2 `review_convergence`, advisory, test-first.** Write
      `tests/scripts/review_convergence.test.ts` first: fixtures that must read
      `converging`, `stalled` and `diverging` under 1.1's criterion, and an
      assertion that `isMechanismPath('src/scripts/review_convergence.ts')` is
      false, so the pilot never changes the ratification gate (F7). Then write
      `src/scripts/review_convergence.ts` over the census JSON; it prints the
      verdict per subject and always exits 0.
      verify: the test is red before the script and green after; the script
      exits 0 on a `diverging` fixture.
- [ ] **1.3 Replay every historical loop.** Run `review_convergence --replay`
      over the census: per subject the round the criterion fires, rounds that
      would not have run, and every high/critical finding raised after that
      round (the stop's cost). Write
      `agents/evidence/analysis/review-loop-replay-2026-11.md`, generated.
      verify: one row per subject with five or more rounds plus a pooled row;
      re-running the command reproduces the file byte for byte.
- [ ] **1.4 Put the verdict where rounds are written.** In
      `src/agent-src/contexts/authority/kernel-rule-edits.md` add one
      paragraph: before writing round N+1's packet, run `review_convergence
      --subject <slug>`; on `stalled` or `diverging`, stop re-submitting and
      take ADR-268 § 4's owner rung with the replay row attached. Run
      `task sync` and `task generate-tools`.
      verify: `grep -n review_convergence` hits the source context and its
      projection; `./scripts-run src/scripts/check_kernel_edit_ratified` on the
      branch reports the context outside `MECHANISM_PATHS`.
- [ ] **1.5 Generated round packet — only if 0.4 named `scope-widened`.** Write
      `src/scripts/ratification_round_packet.ts`, test-first: round N+1's
      packet is the diff since round N's head plus round N's open findings,
      nothing restated by hand (F5). Otherwise mark `[-]` with 0.4's row as
      reason.
      verify: a fixture packet lists only fix-delta paths and open findings;
      red before the script, green after.

## Phase 2 — Binding stop and owner override

- [ ] **2.1 Route both blockers and attach the replay.** Put each `## Blockers`
      entry below to the council with `decision-revisit-gate`'s owner-reserved
      table; record the verdict in its `Routed:` line. On ESCALATE append 1.3's
      pooled row and per-option cost to the entry and to the ratification-cap
      blocker of `road-to-a-review-that-ends`; on DECIDE turn the entry into a
      Decisions row.
      verify: both `Routed:` lines carry a dated council verdict; the replay's
      pooled row appears in both blockers.
- [ ] **2.2 Enforce the chosen stop.** <!-- blocked-by: convergence-stop-binding | asked: no — authoring run; step 2.1 routes it to the council first -->
      Test-first in `tests/scripts/check_kernel_edit_ratified.test.ts`: a
      subject past the chosen stop without an owner decision is refused and
      every open high/critical finding is listed for the owner. Then edit the
      reviewer modules; the change carries its own ratification record (F7).
      verify: the new test is red before the edit and green after;
      `npx vitest run tests/scripts/check_kernel_edit_ratified.test.ts` passes.
- [ ] **2.3 Owner record turns the gate green, per the chosen option.** <!-- blocked-by: owner-override-satisfies-ratification-ci | asked: no — authoring run; step 2.1 routes it to the council first -->
      Test-first: a committed record under `agents/evidence/owner-directives/`
      naming the subject digest passes the gate as the owner chose; the same
      record added by the change it ratifies is refused (ADR-268 § 4, gaining
      party). Then implement in `check_kernel_edit_ratified.ts`.
      verify: both tests red before the edit, green after; full test file passes.
- [ ] **2.4 Read the pilot.** After the next ten ratification subjects close,
      regenerate the census and replay; record median rounds per subject
      against Phase 0's and every high/critical finding the stop routed to the
      owner.
      verify: a Decisions row with both medians and the routed-finding count,
      citing the regenerated artefacts.

<!-- Release holds — none.
     guarded: Phase 1 ships advisory (review_convergence always exits 0, outside
     MECHANISM_PATHS); Phase 2's binding edits land whole, each with its own test,
     so no intermediate tree state is unpublishable.
-->

## Blockers

### blocker: convergence-stop-binding
- **Status:** open — raised 2026-11-21.
- **Class:** 3
- **Owner:** user
- **Ownership:** product-owned — ending a recorded verification loop is governance self-amendment (decision-revisit-gate, owner-reserved), as ADR-294 was for the completion review. Same decision as `road-to-a-review-that-ends` blocker `ratification-round-cap-is-an-owner-contract-change`; answering one resolves both, and 2.2 flips both Status lines.
- **Routed:** pending — not routed at authoring (single-file authoring run); step 2.1 routes it.
- **Blocks:** 2.2
- **Question:** Should a council ratification stop binding — refused past the stop, open high/critical findings to the owner — and where?
- **Recommendation:** (c) once 1.3's replay shows its cost: the retro's own data show the ratification yield does not fall after round 5, so a fixed N cuts rounds that still find defects while a criterion stops loops that stall or diverge.
- **If you do nothing:** loops keep running to 30-56 rounds; 1.4's advisory line still tells the agent to escalate, but nothing refuses the next round.
- **What to do:** after 1.3, pick (a) a cap at three rounds, (b) a cap at five, (c) the Phase 1 convergence criterion, or (d) no binding stop, advisory only.
- **Resolved when:** the choice is recorded under `agents/evidence/owner-directives/` or in this entry, and this Status reads resolved.

### blocker: owner-override-satisfies-ratification-ci
- **Status:** open — raised 2026-11-21.
- **Class:** 3
- **Owner:** user
- **Ownership:** product-owned — lowering what turns a required gate green touches the safety floor and ADR-268 § 4's gaining-party rule.
- **Routed:** pending — not routed at authoring (single-file authoring run); step 2.1 routes it.
- **Blocks:** 2.3
- **Question:** Should an owner-written record make the ratification gate pass, instead of the forge bypass that leaves CI red (F6)?
- **Recommendation:** (b) — the gate stays independent by default and an owner override exists only after the loop has demonstrably stopped converging.
- **If you do nothing:** an owner merge over a refused record keeps needing the forge bypass plus a bypass record, and CI stays red on that commit.
- **What to do:** pick (a) any owner record naming the subject digest passes, (b) it passes only after a recorded `stalled`/`diverging` verdict or a refused final round, or (c) no — keep the ADR-281 § 5 bypass route.
- **Resolved when:** the choice is recorded under `agents/evidence/owner-directives/` or in this entry, and this Status reads resolved.

## Decisions

| ID | ownership | resolved by | decision | evidence | revisit if |
|---|---|---|---|---|---|
| D1 | reversible-technical | evidence | No fixed round cap is authored here; the stop is a measured criterion piloted in shadow first. Rejected alternative: a 3+1 cap shipped now (retro draft). | Both council seats called a cap alone a symptom fix; F1's completion-review curve and the later file's ratification curve differ, so one N does not transfer. | 1.3's replay shows the criterion fires later than round 5 on most subjects. |
| D2 | reversible-technical | evidence | Census, origins and replay are generated on demand; no new CI gate. Rejected alternative: a `--check` staleness gate in `task ci`. | Owner constraint 2026-11-21 (generated, never hand-kept); the retro's measure 10 asks to remove blocking gates, not add them. | A stale census is cited by a decision. |
| D3 | reversible-technical | evidence | Debate rounds, CI iteration, release-cut review and per-round spend stay out of scope. | `debate_max_rounds` is wired (`council_cli.ts:1691`); the council asked to keep CI and review iteration apart; measures 9 and 20 and the later file's 3.1b own the rest. | Phase 0 shows a debate or CI loop carrying the round count. |

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-11-21 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | A binding stop drops a real late defect | product | The stop ends a loop whose next round would have found a high/critical defect. | 1.3 lists every high/critical finding after the stop before any owner choice; 2.2 routes open ones to the owner and never closes them. | Phase 2 — Binding stop and owner override |
| 2 | Reader classes are unreliable | implementation | Subagent readers disagree on `fix-introduced` vs `single-seat`, so 0.4 names the wrong lever. | Two independent readers plus an adjudicator; the agreement rate is in the artefact; 0.2's path-based classes need no reader. | Phase 0 — A census the tree generates, and why findings rise |
| 3 | The pilot becomes one more mechanism | product | The retro names "more mechanism on every objection" as part of the defect. | Advisory only, no CI gate (D2); 1.5 ships only when 0.4's data name it; 2.4 reads whether rounds fell. | Phase 1 — A shadow convergence pilot |
| 4 | Editing the gate triggers its own long loop | implementation | 2.2 and 2.3 touch reviewer modules, which need their own ratification (F7). | Each lands as one small test-first change after the owner's answer, and 1.4's advisory applies to that loop too. | Phase 2 — Binding stop and owner override |

## Acceptance Criteria

- [ ] AC-1 — One command regenerates the census of every completion-review and ratification loop, and no census, origin or replay file is edited by hand.
- [ ] AC-2 — The origin artefact names, for rising rounds, each class's share and the lever 0.4's threshold table selects, or states that none qualified.
- [ ] AC-3 — `review_convergence` returns a verdict for every census subject, and the replay states per subject where it would have stopped and every high/critical finding raised after that round.
- [ ] AC-4 — Each owner blocker is either resolved with its step enforced by a passing test, or open with a dated council `Routed:` verdict and the replay's pooled row attached.
