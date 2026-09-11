---
complexity: structural
status: ready
execution:
  mode: phase-checkpoints
owner: maintainer
relates:
  - slug: road-to-an-enforcement-table-nobody-hand-maintains
    relation: disjoint
    note: >
      That roadmap owns what a bound slot does with a refusal, per host and per
      slot. This one owns whether a turn discharged the obligations it triggered.
      Same subject area, different object; neither waits on the other.
  - slug: road-to-behaviour-evidence-over-pixels
    relation: disjoint
    note: >
      The UI lane this ledger discharges against is that roadmap's subject. It
      produces the evidence; this reads whether the evidence arrived.
estate_growth_exempt: >-
  The state this repository already writes has no reader. Verified 2026-09-11:
  `src/scripts/hooks/rule_inject_hook.ts:185,198-207` writes one record per session under
  `agents/runtime/state/rule-inject/`, and the only reads of that path are the writer itself at
  `:368` and its own test. So the tree knows which obligations it delivered into a turn and
  nothing asks whether the turn discharged them. Also grows open_blockers by four, every one of
  them a decision the source set could not take for itself.
estate_offset_exempt: >-
  No offset exists. The nearest held objects — `stubs/road-to-obligation-exposure-instrumentation.md`,
  `stubs/road-to-instructions-loaded-observer.md`, `stubs/road-to-task-completion-observability.md` —
  are each blocked on something this roadmap does not resolve, and the first is owner-reserved by a
  council lock. Retiring one to buy the slot would dispose of a recorded decision to make room for
  a plan that depends on it standing.
---
# Road to a ledger that closes the loop

> **Source:** `agents/tmp.old/inbox-2026-09-z/t1-obligation-gates/` — four plan revisions plus the
> originating transcript, analysed 2026-09-11. Claim verification at HEAD: 53 of 68 still true,
> **1 overtaken, 9 never true at the drafting SHA, 4 never true at all**. That ratio is the
> finding: the draft is five commits old and almost none of its error is staleness, so re-pinning
> it buys nothing and re-running its census buys everything. Three corrected figures below are
> tagged `corrected-from-reproduction`.

## Goal

The obligation record this repository already writes gains exactly one reader, so that a turn
which touched a path under a typed obligation and produced no discharge becomes visible at
turn-end — without a new command verb, a new rule, a new skill, or a second enforcement taxonomy,
and without ever asserting that delivery proves compliance.

## Non-goal, stated so no step can grow into it

This roadmap does not measure whether an obligation reached the model. That question is
council-locked as blocked-by-architecture (2026-08-31, two seats convergent) on the ground that
installation proves availability and not exposure, and its acceptance criterion was transferred
unweakened and owner-reserved to `agents/roadmaps/stubs/road-to-obligation-exposure-instrumentation.md`.
The records Phase 3 writes are an **emitter** record. They may never be cited as evidence that a
rule reached the model.

## Phase 1 — Re-census, because the source's own numbers are wrong

- [ ] **1.1 Re-run the enforcement census and record its summary verbatim** into
      `agents/evidence/analysis/`.
      verify: `./scripts-run src/scripts/check_enforcement_coverage --json` and the committed
      artefact carry the same figures, with the date of the reading.
- [ ] **1.2 Correct three figures wherever any of this material is adopted.**
      `corrected-from-reproduction` — measured 2026-09-11: blocking concerns are **8, not 9**
      (`grep -c 'severity: blocking'` returns 9 because `src/scripts/hook_manifest.yaml:608` is a
      comment containing the string; parse the YAML); the `enforced_by:` split is
      **12 / 11 / 17 plus one `none` and one `observer`**, not 13 / 9 / 14; the frozen routing
      corpus is **318** gate-open fires, not 330, per `src/config/hook-token-budget.json`.
      verify: no adopted text carries any of the three old figures, and no concern count in the
      tree is derived by grepping the string rather than parsing the file.
- [ ] **1.3 Record what the source set did not know it had.**
      `corrected-from-reproduction` — the plans assert that no field says what enforces a rule.
      **111 of 120 rules carry `obligation_frequency:`** with a closed seven-value vocabulary, and
      `src/scripts/check_enforcement_coverage.ts` already joins it against per-platform carrier
      frequency. Neither parent mentions the key once.
      verify: `grep -lE '^obligation_frequency:' src/rules/*.md | wc -l` reads 111 against 120
      rules, and the evidence artefact names the key as the existing taxonomy this work extends.
- [ ] **1.4 Fix the stale decision pointer** at `src/scripts/hooks/rule_inject_hook.ts:14`.
      verify: the cited record is the delivery-default one rather than the iron-law-reserve one.

## Phase 2 — Close the class vocabulary before typing anything

- [ ] **2.1 Decide whether `observer` and `none` are first-class enforcement values** or stay
      outside the declared set. The tree already emits `observer`; the source's proposed five-value
      taxonomy has no slot for it, so adopting that taxonomy would silently remap a value the
      census reports as a misdeclaration.
      verify: the resulting value set is closed and written beside the existing
      `obligation_frequency` vocabulary rather than in a new file.
- [ ] **2.2 Do not create a second census artefact.** The existing baseline is the one that
      ratchets.
      verify: no new metrics file is added, and `check_enforcement_coverage` remains the only
      producer of enforcement counts.

## Phase 3 — The ledger, write side only

- [ ] **3.1 Add `src/scripts/_lib/obligations.ts`** with a session-addressed state path resolved
      through the existing helper rather than a path literal, and an atomic write.
      verify: the path helper is imported, not reimplemented — `grep -n 'statePathFor' src/scripts`
      shows one definition shape shared with the existing consumer.
- [ ] **3.2 The rule-injection concern appends one delivered row per delivered rule**, carrying the
      enforcement class from frontmatter and `none` when the rule declares none.
      verify: a run over the frozen routing corpus produces rows for its **318** gate-open fires,
      and the class distribution is recorded.
- [ ] **3.3 The hook doctor gains two lines** — ledger writable, rows this session. **No reader is
      added in this phase.**
      verify: `agent-config hooks:doctor` prints both, and
      `./scripts-run src/scripts/check_estate_count` shows `concern_count` unchanged, because this
      phase adds no concern.

## Phase 4 — Discharge, read from the diff and not from the tool event

- [ ] **4.1 Add one concern on the turn-end slot, advisory**, computing the touched set from
      `git diff --numstat HEAD` plus untracked files, the way the existing end-review concern does.
      Not from a tool event's file path — that misses every file a shell heredoc wrote.
      verify: a file created by a Bash heredoc on a UI path appears in the settle set.
- [ ] **4.2 The design-pass concern writes a discharge** for the audit-gate obligation when its
      freshness check already returns true. The decision exists today; only the write is missing.
      verify: the discharge appears in the ledger on a run where the audit is fresh, and the
      post-tool latency p95 is not above the Phase 1 baseline. No per-write validator is added.

## Phase 5 — Shadow, and only shadow

- [ ] **5.1 The turn-end gate computes the new detector and records a would-refuse row**, refusing
      nothing — the same posture the design-pass stop concern already ships.
      verify: zero refusals occur across the shadow window, and the rows exist.
- [ ] **5.2 Pre-register the bar in `docs/CLAIMS.md`** with its sample floor and its demotion
      condition, per the turn-end detector demotion contract, **before** any code that can refuse.
      verify: `./scripts-run src/scripts/check_claims` is green and the row names the bar, the
      floor and the condition.
- [ ] **5.3 State the shadow window in both wall-clock and session count.**
      verify: both numbers are in the claim row, so the window cannot be declared over by whichever
      measure happens to be reached first.

## Phase 6 — Arm the detector, conditional like its siblings

- [ ] **6.1 Arm it only after the pre-registered bar holds.**
      verify: the claim carries a verdict measured over the declared window before the arming
      commit.
- [ ] **6.2 The new detector respects an open subagent dispatch** the way two of the four existing
      detectors do. Both are gated on the dispatch being closed, and neither parent records this —
      an open dispatch would otherwise be refused for a file that dispatch is still writing.
      verify: a fixture with an open dispatch leaves the detector silent.
- [ ] **6.3 Continuation is one aggregate per missing set, never one per obligation**, and budget
      exhaustion leaves the obligation **open** rather than waived.
      verify: five missing obligations produce one continuation; an unchanged missing set on the
      second attempt stops forcing continuation and the obligations still read open; classes
      `none` and `judge` never refuse.

## Blockers

### blocker: observer-is-a-class-the-taxonomy-cannot-express
- **Status:** open
- **Owner:** maintainer
- **Class:** 3 — human-only
- **Blocks:** Phase 2, and Phase 3.2 through it — the row cannot carry a class before the class set
  is closed.
- **What to do:** run `./scripts-run src/scripts/check_enforcement_coverage --json` and read the
  `observer` count, then pick one: (a) `observer` becomes a first-class value in `enforced_by:`;
  (b) it stays a resolver output and never appears in frontmatter; (c) the existing rows are
  reported as misdeclarations and migrated.
- **Recommendation:** (a). The tree already emits it and the census already counts it, so (b)
  leaves a value the resolver produces and the vocabulary denies, and (c) pays a migration to
  delete information.
- **If you do nothing:** Phase 3 writes a class field whose value set disagrees with the census
  that ratchets it, which is the second-taxonomy failure this roadmap's own risk register names.
- **Resolved when:** the value set is written beside the `obligation_frequency` vocabulary and
  `check_enforcement_coverage` reports zero unclassified `enforced_by` values.

### blocker: the-payload-ceiling-forbids-a-new-rule
- **Status:** open
- **Owner:** maintainer
- **Class:** 3 — human-only
- **Blocks:** nothing yet, and it is recorded because the cheapest-looking implementation crosses
  it. This roadmap adds no rule; a step that decided to add one would red a gate at push.
- **What to do:** run `./scripts-run src/scripts/check_preamble_payload_budget` and read the grace
  ceiling, which is pinned at HEAD so any rule addition reds it. Pick one: (a) confirm this
  roadmap adds no rule and the obligation lives as a field on existing rules; (b) a rule is added
  and the ceiling moves deliberately in its own change; (c) an existing rule is shortened to make
  room.
- **Recommendation:** (a), and it is already the plan — this blocker exists to keep it the plan.
- **If you do nothing:** nothing, unless someone adds a rule; then a gate reds for a reason this
  file already predicted and nobody reads.
- **Resolved when:** option (a) is stated in this roadmap's non-goals, or a ceiling move lands with
  its own record.

### blocker: delivery-is-not-measurable-and-the-tree-already-says-so
- **Status:** open
- **Owner:** maintainer
- **Class:** 3 — human-only
- **Blocks:** the wording of Phase 3, not its code. The rows may be written; what they may be
  cited for is the open question.
- **What to do:** read `agents/roadmaps/archive/road-to-obligation-delivery-verification.md` — it
  closed 2026-08-31 as blocked-by-architecture on a two-seat convergent council, with a
  reproducible probe showing an obligation present in the shipped tree and absent from the
  operator's installed copy. Then confirm in writing, or refuse, that the delivered rows are an
  emitter record and are never cited as compliance evidence.
- **Recommendation:** confirm. The lock tested a different mechanism, so it does not bar this work
  — but a plan that rebuilds delivery observability without naming a council-locked finding that
  delivery is not measurable is re-deriving a decision the tree already has.
- **If you do nothing:** the ledger reads as a compliance record to the next person who opens it,
  which is exactly the claim the council refused.
- **Resolved when:** the sentence is in the non-goals above and no acceptance criterion reads
  compliance off a delivered row.

### blocker: the-source-set-contradicts-itself-on-exhaustion
- **Status:** open
- **Owner:** maintainer
- **Class:** 3 — human-only
- **Blocks:** Phase 6.3, which takes one side of the contradiction.
- **What to do:** the four source files are one argument with two leaves that never read each
  other — one keeps a waived-by-exhaustion state, the other calls it the most dangerous idea in
  the set and removes it. Read Phase 6.3 above and
  `agents/tmp.old/inbox-2026-09-z/t1-obligation-gates/` for both sides, then pick one:
  (a) exhaustion leaves the obligation open, which is what Phase 6.3 ships; (b) exhaustion writes
  a waived state, and Phase 6.3 is rewritten to match.
- **Recommendation:** confirm the removal. A budget running out is a fact about the budget, and
  letting it write a policy verdict is how an unmet obligation becomes a satisfied one without
  anybody deciding.
- **If you do nothing:** Phase 6.3 ships the removing side by default, which is the outcome the
  recommendation names — but unrecorded, so the next round re-derives the argument.
- **Resolved when:** the choice is stated in this file with its reason.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-09-11 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | The new detector becomes a third turn-end refusal and one false block makes an operator disable the carrier for good | product | The existing design-pass concern names this failure in its own source; a refusal on a clean UI turn is the cheapest possible way to lose the whole lane | Phase 5 is shadow-only and Phase 6 cannot arm without the pre-registered bar and its demotion condition | Phase 5 — Shadow, and only shadow |
| 2 | The ledger becomes a second enforcement taxonomy and drifts from the one that ratchets | implementation | An enforcement class written into a new artefact beside an existing census is two sources for one fact | Phase 2 closes the value set against the existing vocabulary before any field is written, and Phase 2.2 forbids a second census artefact | Phase 2 — Close the class vocabulary before typing anything |
| 3 | The detector fires on files an open subagent dispatch is still writing | implementation | Two of the four existing turn-end detectors are gated on the dispatch being closed and two are not; modelling the new one on the wrong pair refuses exactly the turns a subagent did the work | Phase 6.2 is a frozen fixture written before the detector | Phase 6 — Arm the detector, conditional like its siblings |
| 4 | The evidence the plans want to read lives in a consumer template | implementation | The work-engine delivery state the source cites sits under the agent-source template tree, which ships into consumer projects and which the hook dispatcher cannot import | Phase 4 discharges only from artefacts the dispatcher already reaches; the template boundary is out of scope until it is designed | Phase 4 — Discharge, read from the diff and not from the tool event |
| 5 | Phase 3 lands and Phase 4 never does | product | The roadmap would then have added a second write-only state file beside the one it exists to give a reader — the exact defect, doubled | Phase 3 forbids a reader by its own exit criterion, and Phase 4 is the only phase that adds one; a Phase-3-only merge is the stated failure condition | Phase 3 — The ledger, write side only |
| 6 | The corrected figures are adopted from the source anyway | implementation | Nine of the source's claims were wrong at its own drafting commit, and the three load-bearing counts read plausibly | Phase 1.2 names all three with their measurement, and Phase 1.1 commits the census output so a later reader checks a file rather than a memory | Phase 1 — Re-census, because the source's own numbers are wrong |

## Acceptance Criteria

- [ ] AC-1 — A committed evidence artefact carries the enforcement census output with its reading
      date, and none of the three corrected figures survives anywhere in adopted text.
- [ ] AC-2 — No concern count in the tree is produced by grepping a string that also appears in a
      comment.
- [ ] AC-3 — The enforcement class value set is closed, written beside the existing
      `obligation_frequency` vocabulary, and expresses `observer` rather than remapping it.
- [ ] AC-4 — The rule-injection concern writes one row per delivered rule, and the hook doctor
      reports the ledger — with no reader and no new concern in that phase.
- [ ] AC-5 — A file written by a shell heredoc on a governed path appears in the discharge set;
      post-tool p95 is not above the Phase 1 baseline.
- [ ] AC-6 — The shadow window produced zero refusals, and its bar, sample floor and demotion
      condition were registered before any code able to refuse existed.
- [ ] AC-7 — The armed detector is silent while a subagent dispatch is open, emits one continuation
      per missing set rather than one per obligation, and never refuses on classes `none` or
      `judge`.
- [ ] AC-8 — Budget exhaustion leaves an obligation open. No path writes a satisfied or waived
      verdict that no check produced.
- [ ] AC-9 — No command verb, rule, skill or second census artefact was added, and the concern
      count is at or below its ratchet.
