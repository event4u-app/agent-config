---
complexity: structural
status: ready
execution:
  mode: phase-checkpoints
owner: maintainer
relates:
  - slug: road-to-a-ledger-that-closes-the-loop
    relation: disjoint
    note: >
      That roadmap asks whether a turn discharged the obligations delivered into
      it. This one asks whether a turn dropped a question the PREVIOUS assistant
      turn already put to the user. Same slot, different object; neither waits on
      the other.
  - slug: road-to-decision-closure
    relation: disjoint
    note: >
      That file owns the ownership routing of a grant object and is blocked on
      road-to-typed-grants-that-persist. This one adds no grant, no typed
      obligation and no new obligation taxonomy - it reads the transcript the
      gate already reads. It neither consumes nor unblocks that roadmap.
estate_growth_exempt: >-
  Grows active_roadmaps by one, open_blockers by two, and concern_count by
  exactly one (`review-baseline`, session_start). The two blockers are both
  decisions the source set could not take for itself and neither is actionable
  by an agent: one is a kernel-rule edit that
  `src/scripts/hooks/block_kernel_rule_writes.ts` denies at tool-call time, the
  other changes the definition of a pre-registered claim in `docs/CLAIMS.md`.
  Recording them is the alternative to silently shipping a gate whose rule text
  and whose measurement interaction were never decided. The concern is the
  deliverable of Phase 2, not a side
  effect: `src/scripts/hooks/end_review_nudge_hook.ts:29-34` records its own
  measurement defect and names the reason it was not fixed - "no such baseline
  exists anywhere a `stop` concern can read it (recording one would be new
  session-wide state, out of this roadmap phase's one-concern scope)". Verified
  2026-09-11 at `src/scripts/hook_manifest.yaml:1279`: `session_start` IS bound,
  on seven hosts, carrying fourteen concerns. The stated blocker is stale, and
  the fix is one concern. Phase 1 adds NO concern - detector E rides the existing
  `turn-end-gate` guard rather than becoming a second refusal-capable stop
  concern.
estate_offset_exempt: >-
  Offsets nothing. The adjacent held objects are each blocked on something this
  roadmap does not resolve: `road-to-decision-closure` on
  `road-to-typed-grants-that-persist` (kernel writes denied at tool-call time,
  pending a forge-administrator settings change), and
  `agents/roadmaps/stubs/road-to-batch-elicitation-kernel-delta.md` on an owner
  authority question about `ask-when-uncertain`. Retiring either to buy the slot
  would dispose of a recorded decision to make room for a plan that depends on
  it standing.
design_validated: >-
  Claim verification at HEAD against the supplied plan: both architectural gaps
  reproduce, and three of the plan's own implementation steps diverge from the
  tree. Each divergence is carried at the step it corrects, tagged
  `corrected-from-reproduction`.
capability_gap: none
---
# Road to a question that survives the turn

> **Source:** `agents/tmp.old/round-7b3e91/` - a session transcript plus one
> supplied plan, analysed 2026-09-11. Claim verification at HEAD: both
> architectural gaps **still-true**; three of the supplied plan's implementation
> steps **diverged** and carry corrected wording below. The reported failure is
> the operator's own: a turn put a three-option decision to the user, the
> `end-review-nudge` stop concern produced a second assistant execution with no
> intervening user message, and that second turn demoted the open question to a
> subordinate clause. From the user's side the conversation ended without a
> question.

## Goal

A decision this package has already put to the user cannot disappear because the
runtime produced another assistant turn. When an assistant turn carries a
numbered-options block and a later assistant turn in the **same** user turn
carries none, the turn-end gate refuses and names the block that went missing.
Separately, the review nudge stops charging a session for mutation it did not
make: it subtracts a session-start baseline instead of reading the whole dirty
working tree, so an accumulator branch no longer fires it every turn. Someone
else can tell whether this happened by running the two fixtures added in Phase 0
- a transcript whose second assistant turn drops an options block must refuse,
and a 5-line turn on a session whose baseline already held 1,771 changed lines
must not fire the nudge.

## Non-goal, stated so no step can grow into it

This roadmap does **not** build the `PendingDecision` object the supplied plan
proposes - an id, a `pending -> answered/cancelled/superseded/invalidated`
lifecycle, semantic answer matching, and a `continuation_reason` field. That is a
grant-shaped obligation object, and `road-to-decision-closure` already owns the
ownership routing for one, blocked on `road-to-typed-grants-that-persist`.
Building a second obligation ledger here would create the parallel taxonomy that
roadmap exists to prevent. What ships is the deterministic transcript-adjacency
gate the supplied plan itself calls "an excellent Phase-0 regression gate", and
nothing above it.

It also does not touch `src/rules/user-interaction.md`. The supplied plan's
section 5.1 adds a third Iron Law to that file; `user-interaction` is a kernel
rule, `src/scripts/hooks/block_kernel_rule_writes.ts` denies agent writes to it
at tool-call time, and the delta is parked as a blocker below rather than
smuggled into a step.

## Phase 0 - Fixtures and the demotion bar, before the detector

- [x] **0.1 Add two golden transcript fixtures and the test that reads them.**
      One JSONL where a single user turn is followed by two assistant entries,
      the first carrying a numbered-options block with a recommendation line and
      the second carrying none (the reported failure). One near-miss where the
      same shape is separated by a **genuine** user prompt, which must stay
      silent. Both pass through the `isSyntheticPrompt` and `isSidechain`
      filtering the gate already applies, so a task notification between the two
      assistant entries does not read as an answer.
      verify: `npx vitest run tests/scripts/turn_end_gate_pending_decision.test.ts` passes with the positive case refusing and the near-miss allowing.
- [x] **0.2 Register detector E in `docs/contracts/turn-end-detector-demotion.md`.**
      That contract's own removal-condition section requires every blocking
      detector to carry a pre-registered demotion bar before it ships. Add the
      row to the detector table, a Q1/Q2 bar row, and the sample floor. Bar: Q1
      re-refusal share at or above 40 percent, Q2 median at or above 3 - the
      `verification` row's numbers, because like `verification` this detector
      reads turn structure rather than prose and its false-positive shape is the
      same class.
      verify: `grep -c 'pending-decision' docs/contracts/turn-end-detector-demotion.md` returns at least 3, covering the detector table, the bar table and the sample floor.

**Exit criteria:** both fixtures exist and the demotion bar for detector E is
written down before any detector code lands.

## Phase 1 - Detector E: a dropped decision refuses the turn-end

- [x] **1.1 Extend `TranscriptTail` with the assistant texts of the current user turn.**
      `readTranscriptTail` already walks every entry, already resets `toolCalls`
      at each genuine user prompt, and already skips sidechains and synthetic
      prompts. Add `assistantTurnTexts: string[]`, appended on every assistant
      entry carrying text and reset on the same line that resets `toolCalls`.
      `lastAssistant` stays exactly as it is - four detectors read it and none of
      them change.
      verify: `npx vitest run tests/scripts/turn_end_gate_hook.test.ts` stays green and the new field is asserted non-empty for an assistant-bearing fixture.
- [x] **1.2 Add `detectDroppedDecision` and wire it as detector `pending-decision`.**
      `corrected-from-reproduction`: the supplied plan's section 9 Phase 1.1 adds
      a new `pending-decision-continuity` Stop concern. Reproduced against the
      tree - `turn-end-gate` is the suite's only refusal-capable stop concern and
      it carries both re-entrancy layers (`stop_hook_active` plus the per-turn
      refusal marker) as well as the demotion contract. A second refusal-capable
      stop concern would duplicate that machinery and could refuse a turn the
      gate had already refused. The corrected step is a fifth detector on the
      existing guard. It fires when the current turn holds at least two assistant
      texts, an earlier one carries an option block and the last one carries
      none. Block detection is **imported** from `check_reply_consistency.ts`
      (`find_option_blocks`), the spec-backed parser, never a third copy -
      `interruption_ledger_hook` and the gate would otherwise hold three separate
      readings of the same rule.
      verify: `grep -n 'find_option_blocks' src/scripts/hooks/turn_end_gate_hook.ts` resolves to an import from `check_reply_consistency.js`, and the Phase 0.1 positive fixture refuses naming `pending-decision`.
- [x] **1.3 Add `pending-decision` to `DETECTOR_IDS` and to the gate's `DetectorId` union.**
      `src/scripts/_lib/turn_end_refusals.ts` reads its set off the union
      deliberately, so the counters, the per-detector refusal ledger and the
      demotion instrument pick the new id up without a second edit.
      verify: `npx vitest run tests/scripts/turn_end_refusals.test.ts` passes, and `grep -c 'pending-decision' src/scripts/_lib/turn_end_refusals.ts src/scripts/hooks/turn_end_gate_hook.ts` is non-zero for both files.
- [x] **1.4 Run detector E unconditionally, not behind the open-dispatch narrowing.**
      Detectors A and D are skipped while a subagent dispatch is open, because a
      completion claim mid-dispatch is not yet a claim. A dropped user decision is
      the opposite: an open dispatch is exactly the continuation that drops it, so
      narrowing E the same way would make it silent in the reported case. E runs
      on every turn-end, like B and C.
      verify: a fixture with an open dispatch and a dropped options block still refuses; the assertion lives in the Phase 0.1 test file, not in prose.

**Exit criteria:** the reported failure shape refuses at turn-end, the near-miss
does not, and the refusal names the block that went missing.

## Phase 2 - The review nudge stops charging a session for a dirty tree

- [x] **2.1 Add a `review-baseline` `session_start` concern.**
      `corrected-from-reproduction`: `src/scripts/hooks/end_review_nudge_hook.ts`
      declines to fix its own measurement on the ground that no session baseline
      exists anywhere a `stop` concern can read it. Verified at
      `src/scripts/hook_manifest.yaml:1279`: `session_start` is bound on seven
      hosts with fourteen concerns. The blocker is stale. The new concern writes
      `head_sha`, `baseline_lines` and `written_at` to
      `agents/runtime/state/review-baseline/<sessionKey>.json`, reusing
      `deriveSessionKey` and `totalNonDocMutatedLinesWithMeasure` exported from
      the nudge itself rather than reimplementing the count.
      verify: `npx vitest run tests/scripts/review_baseline_hook.test.ts` passes, and a session_start run against a tree with N dirty non-doc lines writes `baseline_lines` equal to N.
- [x] **2.2 Subtract the baseline in `end_review_nudge_hook`, and fail open when it cannot.**
      The fire condition becomes measured minus `baseline_lines`, clamped at
      zero, compared against `MUTATION_LINE_THRESHOLD`. Three states where
      subtraction is invalid, each falling back to today's whole-tree reading and
      **saying so in the telemetry record** rather than silently: no baseline
      file (a host without `session_start`, or a session that started before this
      shipped), an unreadable baseline, and a `head_sha` that no longer matches -
      a session that committed mid-run moved HEAD, so the baseline's own
      denominator is gone.
      verify: a fixture with `baseline_lines` 1771 and a 5-line turn does not fire; one with a moved `head_sha` fires on the unsubtracted count and its telemetry row records the fallback reason.
- [x] **2.3 Register the concern in the four places a concern is registered.**
      The `hook_manifest.yaml` concern block, the seven per-host `session_start`
      rows, `CONCERN_REGISTRY` in `src/scripts/hooks/concern_registry.ts`, and
      the manifest test expectations. The registry is the one that is missed,
      because a concern absent from it is dispatched by no host and fails no
      gate.
      verify: `grep -c 'review-baseline' src/scripts/hook_manifest.yaml` returns at least 8, and `grep -n 'review_baseline_hook' src/scripts/hooks/concern_registry.ts` resolves.

**Exit criteria:** a 5-line turn on a branch carrying 1,771 pre-session dirty
lines does not fire the review nudge, and every fallback path is visible in the
telemetry row rather than inferred.

## Blockers

### blocker: user-interaction-third-iron-law

- **Status:** open
- **Owner:** maintainer
- **Blocks:** nothing in this roadmap - the gate ships without it; this is the
  prose half the gate would enforce.
- **What to do:** decide whether `src/rules/user-interaction.md` gains a third
  Iron Law stating that an issued decision stays live across an assistant-only
  continuation. The file is kernel, `src/scripts/hooks/block_kernel_rule_writes.ts`
  denies the write at tool-call time, and the edit needs its own PR plus the soak
  window from `scope-control` section Kernel-rule edits.
- **Resolved when:** `git log --oneline -- src/rules/user-interaction.md` shows a
  commit adding the third Iron Law, or the maintainer records that the detector
  alone is sufficient and no rule text is owed.
- **If you do nothing:** the detector ships and enforces a continuity obligation
  that no rule states, so a reader who hits the refusal finds `user-interaction`
  silent on the subject and has to read the hook source to learn what was owed.
  The gate still works; only its explanation is missing.
- **Recommendation:** none; this is the owner's call - adding an Iron Law to a
  kernel rule is owner-reserved.

### blocker: interruption-baseline-contamination

- **Status:** open
- **Owner:** maintainer
- **Blocks:** nothing in this roadmap - Phase 1 ships regardless; this names a
  measurement interaction so it is not discovered later.
- **What to do:** decide whether detector E firing contaminates the
  `user-out-of-loop-baseline` claim in `docs/CLAIMS.md`, which reads `unbacked`,
  stood at 19 of a 20-run floor, and counts one contact per turn. A re-presented
  options block is the SAME contact, not a new one, but `interruption_report`
  counts per turn and would score it as two.
- **Resolved when:** `./scripts-run src/scripts/check_claims` reports
  `user-out-of-loop-baseline` as backed with the floor reached, or that claim's
  evidence block records that a re-presented decision is deduplicated on the
  dropped block's identity.
- **If you do nothing:** a re-presented block is counted as a second contact, so
  the pre-registered baseline reads slightly worse than the sessions it measures
  and the claim closes on a number the mechanism itself inflated. The effect is
  small and one-directional, which is exactly why it would go unnoticed.
- **Recommendation:** none; this is the owner's call - it changes the definition
  of a pre-registered claim.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-09-11 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | Detector E refuses a legitimate turn | implementation | A turn deliberately supersedes its own earlier question - the user's instruction made the options moot - and the gate refuses anyway, wedging the session behind a question nobody needs answered. | The two re-entrancy layers cap a turn at ONE refusal, so a wedge is structurally impossible; the refusal names the block so the reply can carry it in one line. The demotion bar in 0.2 is the measured exit if the re-refusal share turns out high. | Phase 0 - Fixtures and the demotion bar, before the detector |
| 2 | A tool call between two prose entries reads as a dropped decision | implementation | Two assistant entries inside one user turn is ordinary - a tool call splits them constantly. If the collector keeps text-free tool entries, almost every turn looks like a candidate and the detector fires everywhere. | `_messageText` returns null for a tool-only entry and the collector skips it, so a tool call creates no element. The Phase 0.1 near-miss asserts exactly this rather than trusting the reading. | Phase 1 - Detector E: a dropped decision refuses the turn-end |
| 3 | The baseline subtraction hides a real review obligation | implementation | A session that starts dirty and also reverts part of the pre-existing mess reads negative, clamps to zero, and the nudge goes quiet on a change that did need review. | The clamp is on the total and the three invalid-subtraction states in 2.2 fall back to the unsubtracted reading rather than to silence. The telemetry row records which path was taken, so the rate is measurable rather than assumed. | Phase 2 - The review nudge stops charging a session for a dirty tree |
| 4 | The gate enforces an obligation no rule states | product | A reader who hits the refusal cannot find the rule behind it and reads the gate as a bug, because `user-interaction` is silent on continuity. | The refusal message cites `user-interaction` Iron Law 1 as the rule the dropped block belongs to, and the rule delta is parked as a named blocker rather than silently skipped. | Blockers |

## Acceptance Criteria

- [x] AC-1 - A JSONL transcript whose single user turn is followed by two
      assistant entries, the first carrying a numbered-options block and the
      second carrying none, produces a turn-end refusal naming `pending-decision`.
- [x] AC-2 - The same shape with a genuine user prompt between the two assistant
      entries produces no refusal, and neither does a shape whose second entry is
      a tool call carrying no text.
- [x] AC-3 - `DETECTOR_IDS` in `src/scripts/_lib/turn_end_refusals.ts` carries
      five ids, and `docs/contracts/turn-end-detector-demotion.md` carries a
      pre-registered Q1/Q2 bar and sample floor for the fifth.
- [x] AC-4 - `end_review_nudge_hook` does not fire on a 5-line turn when the
      session baseline recorded 1,771 pre-session non-doc lines, and does fire on
      the unsubtracted count when the baseline's `head_sha` no longer matches.
- [x] AC-5 - `review-baseline` resolves in `CONCERN_REGISTRY`, in the manifest's
      concern block, and in every host's `session_start` row; no host binds a
      concern the registry cannot dispatch.
- [x] AC-6 - The two blockers above are recorded with owners and open status
      rather than resolved inside this roadmap.
