---
complexity: lightweight
---

# Road to Context Layer Maturity

**Status:** v2 — council-greenlit (`agents/council-sessions/2026-05-03T17-56-21Z/`),
ready for execution.
**Started:** 2026-05-03
**Trigger:** Two independent reviewers converged on the same gap after
the structural-optimization roadmap closed: the **rule layer is now
mature; the context layer is unproven**. Feedback #1 named it the
"3-Layer Architecture" thesis (Rule = Obligation, Context = Decision
Logic, Examples = Pattern Memory). Feedback #2 named the same finding
from the budget angle (Always-Budget v2: slimming is exhausted, the
next hebel is amortization + demotion + outcome-proof).
**Mode:** Lightweight. Six phases, one or two days each. No nested
council debates inside the roadmap. Roadmap-complexity standard
(Phase 6) explicitly forbids the structural-optimization-style depth
for normal feature work.

## Purpose

The structural-optimization roadmap proved that the **rule** layer can
be governed (budget, concentration gate, golden tests, slow rollout).
It also proved — by the Phase 2A revert — that further rule slimming
under Model (b) hits a structural ceiling. The **context** layer is
the next architectural surface and is currently underspecified:

- No activation contract — when does a rule load which context, in
  which order, with what budget?
- No outcome measurement — golden tests verify structure, not whether
  the agent actually decides better.
- No example-as-demo discipline — examples drift toward filler when
  they should be the load-bearing "Pattern Memory" of the layer.

This roadmap matures those three surfaces and explicitly closes out
PR #36 before any new structural work begins.

## Thesis

**3-Layer Architecture (locked):**

| Layer | Purpose | Size budget | Activation |
|---|---|---|---|
| **Rule** | Obligation surface (Iron Laws, MUSTs, NEVERs) | ≤ 6,000 chars per always-rule | Always-loaded |
| **Context** | Decision logic ("HOW to think") | No per-file cap; counts under owning rule's extended budget per Model (b) | On-demand via `load_context:` |
| **Examples** | Pattern memory ("HOW it looks") | No cap; lives in `docs/guidelines/` and `agents/contexts/` | Cited from rules/contexts, not auto-loaded |

Iron Laws stay in Rule layer. Decision logic moves to Context. Concrete
walk-throughs move to Examples. The Phase 2A revert proved the boundary
matters: moving Iron-Law prose into a context makes the rule unsafe;
moving decision-logic prose into a context only "pays" if the savings
exceed Context Tax (frontmatter + citations + headers).

## Out of scope

- New skills, rules, commands, guidelines (Feedback #1 explicit non-goal).
- New auto-rules (current 38 stays the working set).
- Persona / Block-A-D / UI work — sibling roadmap
  (`road-to-better-skills-and-profiles.md`).
- MCP server, distribution / adoption — sibling roadmaps.
- Skill-tool pilot (Block D) — sibling roadmap.

## Phases (six, lightweight)

### Phase 0 — PR #36 Closeout (≤ 1 day) — P0, blocking merge

Both reviewers flagged the same four cleanup items. They are not
optional and do not need a separate roadmap.

- [-] **0.1** PR #36 body rewritten to match the actual 174-file diff.
      Cancelled: PR #36 was merged at 20d20b2 before this cleanup ran;
      a merged PR body cannot be retroactively rewritten. The 2A revert
      finding is preserved as a Locked Decision via 0a.3 (ADR).
- [x] **0.2** One-off-script decision. Applied uniformly: all 16
      `_one_off_*.py` scripts moved to
      `scripts/ai_council/one_off_archive/2026-05/` with a folder
      README. CI guard `scripts/check_one_off_location.py` enforces
      the convention going forward (wired as `task check-one-off-location`).
- [-] **0.3** Budget-status block in the PR body rewritten honestly.
      Cancelled: PR #36 merged before cleanup. The honest figures
      (47,448 / 49,000 chars, 1,552 headroom, 96.8 % utilisation) are
      surfaced in `docs/contracts/load-context-budget-model.md`
      instead, which is the durable contract surface.
- [-] **0.4** Slow-rollout compression noted in the PR body. Cancelled
      for the same reason; the durable note lives in
      `road-to-1-16-followups.md` line 1.1.2.

**Exit gate:** PR #36 mergeable on its merits, not because the body
hides the size.

### Phase 1 — Context Activation Contract (1–2 days)

The current `load_context:` model is "rule lists files, linter checks
depth ≤ 2 and counts chars". Three questions remain unanswered:

- **Q1 — Order:** if a rule loads three contexts, in what order does
  the agent process them? File order in frontmatter? Citation order
  in prose? Does it matter?
- **Q2 — Concurrency:** can a rule load five contexts? Ten? Is there
  a per-rule context-count cap separate from the char budget?
- **Q3 — Cross-rule sharing:** when two rules load the same context
  (e.g. `commit-mechanics.md` cited by `commit-policy` and
  `scope-control`), does each rule "pay" the full cost under
  Model (b), or is a shared-context discount allowed? Phase 2A
  revealed this is the structural ceiling.

**Steps:**

- [x] **1.1** Inventory: list every `load_context:` chain in the 38
      auto-rules + every `type: always` rule. Output table:
      `rule → context → depth → chars`. → `agents/contexts/rule-trigger-matrix.md`
      (generated by `scripts/build_rule_trigger_matrix.py`).
- [x] **1.2** Decide Q1 (order). **Locked:** file order in
      frontmatter, deterministic, no priority field. Documented in
      `docs/contracts/load-context-budget-model.md § Load order (Q1)`.
- [x] **1.3** Decide Q2 (concurrency). **Locked:** hard cap ≤ 3
      contexts per rule. Enforced by
      `scripts/check_always_budget.py::MAX_CONTEXTS_PER_RULE`;
      contract in `docs/contracts/load-context-budget-model.md
      § Per-rule context-count cap (Q2)` and schema cross-link in
      `docs/contracts/load-context-schema.md`.
- [x] **1.4** Decide Q3 (sharing). **Locked:** 3a (Model (b)
      literal). Documented in `docs/contracts/load-context-budget-model.md
      § Cross-rule sharing (Q3)`. Phase 4c becomes a no-op; reopener
      conditions documented inline.
- [-] **1.4a** **Time-boxed feasibility for 3b** — not run. Skipped
      because Q3 locked at 3a in 1.4 (no current shared-context
      pattern with > 1 loader; spike would have no measurable upside
      under Phase 1.4a's reject-on-cost framing).
- [x] **1.5** `tests/test_load_context.py` extended with three
      Q1/Q2/Q3 contract checks
      (`test_q1_load_order_matches_frontmatter_yaml_order`,
      `test_q2_per_rule_context_count_cap`,
      `test_q3_model_b_literal_no_sharing_discount`). All four
      safety-floor tests stay green; 7/7 passing.

**Exit gate:** activation contract written, linter-enforced, and
council-greenlit. No prose changes to rules in this phase.

### Phase 2 — Outcome Measurement (2–3 days)

Today's regression suite (`tests/test_always_budget.py`,
`tests/test_load_context.py`, `tests/golden/`) measures **structure**
(budget, depth, content presence). It does not measure **behavior**
("does the agent actually ask one question per turn? does it actually
verify before claiming done?"). Feedback #1 named this the missing
outcome-system; both reviewers agreed.

**Steps:**

- [x] **2.1** Three behaviors locked: `ask-when-uncertain` (one-
      question-per-turn vague-request), `verify-before-complete` (no
      completion without fresh evidence), `direct-answers` (no
      flattery, brevity). Sharpest Iron Laws, cheapest observable
      signals.
- [x] **2.2** Observable signals defined as JSON fixtures under
      `tests/golden/outcomes/{ask_when_uncertain,verify_before_
      complete,direct_answers}.json` — `input_prompt`,
      `baseline_reply`, `expected_patterns`, `forbidden_patterns`,
      `counters`.
- [x] **2.3** Scorer wired at `tests/golden/outcomes/scorer.py` —
      regex + structural counters (`==`/`<=`/`>=`) over the locked
      reply. No external model calls.
- [x] **2.3a** **Scorer complexity cap held** — 41 LOC, stdlib only
      (`json`, `re`, `pathlib`), no AST, no third-party regex. Under
      the 50-LOC ceiling locked in this step.
- [x] **2.4** Three baselines locked at
      `tests/golden/outcomes/*.json`. CI gate at
      `tests/test_outcome_baselines.py` (3/3 green); a future edit
      that relaxes any Iron Law trips this test.
- [x] **2.5** Limits documented in
      `tests/golden/outcomes/README.md` § What outcome tests prove
      (and what they do not). Outcome ≠ universal quality.
- [x] **2.6** Scaling-criteria README at
      `tests/golden/outcomes/README.md` § Scaling criteria — when to
      add rule #4. Three gates: sharp Iron Law, fits 50-LOC scorer
      cap, two release cycles green.

**Exit gate:** three locked outcome baselines + scorer + CI gate +
scaling-criteria doc.

### Phase 3 — Examples → Holy Shit Demos (1–2 days)

Examples currently live as bullet lists inside guideline files
(`docs/guidelines/agent-infra/asking-and-brevity-examples.md`,
`language-and-tone-examples.md`). They are correct but not
load-bearing. Feedback #1's framing: examples should be **Pattern
Memory** — the place a reader (human or model) goes to recognise
the pattern, not to read prose about the pattern.

**Steps:**

- [x] **3.1** Pick three examples to harden into demos (the same
      three rules from Phase 2 — keeps the layer aligned). Each demo
      shows: (a) the wrong shape with the failure mode, (b) the
      right shape, (c) one sentence on why the right shape works.
- [x] **3.2** Format-lock: every example in `docs/guidelines/agent-
      infra/*-examples.md` must follow the demo shape (wrong / right
      / why). Migration is opt-in per file; only the three Phase-3
      files convert in this roadmap.
- [x] **3.3** Cross-link: each rule's "See also" block points to the
      demo file with a deep-link to the relevant section. Existing
      links audit-checked by `scripts/check_references.py`.
- [x] **3.4** Linter (`scripts/lint_examples.py`, new, ≤ 100 LOC,
      stdlib only): verifies every demo file follows the shape.
      Hooked into `task ci`.
- [x] **3.5** **Demo effectiveness check** (gpt-4o rev). After 3.3
      cross-links land, measure the prose-length delta in the three
      rules that point to demos: prose explaining the pattern in the
      rule itself should shrink (the demo is now the load-bearing
      Pattern Memory). Record before / after char counts in
      `docs/guidelines/agent-infra/<demo>.md` frontmatter as
      `prose_delta:`. No CI gate — just measurement.

**Exit gate:** three demo files lock-formatted, linter green, rule
back-references audit-clean, prose-delta recorded.

### Phase 4 — Always-Budget v2 (3–5 days, gated by Phase 2 + Phase 3)

**Sequencing note (Sonnet binding rev):** Phase 4 was originally
parallel with Phase 1. Council found this re-walks Phase 2A's path
— optimizing structure before behaviour is proven. **Phase 4 now
runs after Phase 2 + Phase 3 exit gates pass.** Budget restructuring
without locked outcome baselines and demo cross-links risks demoting
or merging rules whose behaviour is not yet outcome-tested.

Phase 2A of the structural-optimization roadmap proved that further
rule slimming under Model (b) hits a structural ceiling. Three
alternative strategies remain:

- **4a — Demote:** move an `always` rule to `auto` if its trigger
  surface is narrower than "every turn". Candidate audit pass.
- **4b — Merge:** combine two narrow `always` rules into one when
  their Iron Laws share a domain. Phase 6 of structural-optimization
  audited this and verdict was DO NOT CONSOLIDATE for the
  `chat-history-*` family — re-run the audit on the rest of the 38
  with the new evidence.
- **4c — Shared-context discount:** only viable if Phase 1 Q3 picks
  3b. If Q3 picks 3a, this phase has no engineering work — skip
  outright and document the decision.
- **4d — Hard compress:** caveman-format an Iron-Law section
  (already done on three rules; audit which of the remaining 35
  could absorb it without semantic loss).

**Steps:**

- [x] **4.0** **Inputs gate** (Sonnet binding rev). Confirm before
      starting 4.1: (a) Phase 2 outcome baselines locked under
      `tests/golden/outcomes/`; (b) Phase 3 demo cross-links audit-
      clean; (c) Phase 1 Q3 decision (3a or 3b) recorded. **Do not
      evaluate 4a (demote) or 4b (merge) for any rule whose
      behaviour is not yet outcome-tested.** Outcome-untested rules
      stay in scope only for 4d (hard compress).
- [x] **4.1** Decision matrix: per always-rule, evaluate 4a/4b/4c/4d
      feasibility *given the locked Phase 2 + 3 baselines*. Output
      (created by this step): `budget-v2-matrix.md` next to this
      roadmap.
- [x] **4.2** Pick the highest-leverage two paths from the matrix.
      No "do all four" — Feedback #2 explicit warning. **Picked:**
      4d on `direct-answers` + 4d on `no-cheap-questions`.
- [x] **4.3** Execute the picked paths in atomic commits. Each
      change must keep all four safety-floor rules untouched.
      Trims landed in source + compressed; safety-floor (scope-control,
      non-destructive-by-default, commit-policy, agent-authority)
      verified untouched via `git diff --stat`. Atomic-commit step
      held for user authorization per `commit-policy`.
- [x] **4.4** Re-measure: total extended budget, top-3 share,
      concentration gate. **Goal:** ≥ 4,000 chars headroom
      (currently 1,552). Not a hard gate — a goal.
      **Result:** 44,928 / 49,000 = 91.7 %, **headroom 4,072** —
      goal hit. Top-3 sum unchanged (22,197). Actuals logged in
      `budget-v2-matrix.md` § Exit-gate actuals.
- [ ] **4.5** Council audit on the resulting state. Lock decisions
      that did not pan out as deferred-or-rejected (Feedback #2
      "decline = silence" applies — re-asking forbidden in the next
      roadmap).

**Exit gate:** budget-v2-matrix locked, two paths executed, council
greenlit, headroom honestly reported (≥ 4k or stated reason it is
not).

### Phase 5 — Roadmap Complexity Standard (≤ 1 day)

Both reviewers flagged: the structural-optimization roadmap was
correctly heavy because the work was structural; normal feature
roadmaps must stay light. Without a written standard, drift is
guaranteed.

**Steps:**

- [x] **5.1** Write `docs/contracts/roadmap-complexity-standard.md`.
      Two tiers, each with **named exemplars** (gpt-4o rev) so the
      tier is recognizable, not just measurable:
      - **Lightweight (default):** ≤ 6 phases, ≤ 1 page per phase,
        no nested council debates inside the roadmap, no 178-step
        backlogs, ≤ 600 lines total.
        **Exemplars:** *this* roadmap (`road-to-context-layer-
        maturity.md`); `road-to-1-16-followups.md` (sibling, also
        lightweight). Typical use: feature work, follow-ups,
        bounded refactors.
      - **Structural (rare):** the heavy shape (multi-round
        council, locked decisions, file-ownership matrix, gating
        contracts, > 600 lines).
        **Exemplars:** archived `road-to-structural-optimization.md`
        (closed 2026-05-03 after 6 phases of council-driven budget
        work). Triggered only when the work changes a contract
        layer or a budget invariant. Requires explicit user opt-in
        on creation.
- [x] **5.2** Add a frontmatter field `complexity: lightweight |
      structural` to the roadmap template. Linter
      (`scripts/lint_roadmap_complexity.py`, new, ≤ 150 LOC, stdlib
      only) checks each roadmap matches its declared tier — line
      count, phase count, presence of council-session cross-links
      (a structural-only marker).
- [x] **5.3** Apply retroactively to the four open roadmaps. Tag
      each as lightweight or structural. No content rewrites — just
      the tag.

**Exit gate:** standard written with exemplars, linter green, four
open roadmaps tagged.

## Risk register

| # | Risk | Mitigation |
|---|---|---|
| 1 | Phase 1 Q3=3b explodes engineering scope (linter rewrite + test cascade) | Council vote in Phase 1; default is 3a (status quo); step 1.4a hard-caps the spike at 4 hrs / 200 LOC with auto-revert |
| 2 | Phase 2 outcome scorer becomes a flaky test that gets disabled | Scope to three rules with the sharpest Iron Laws + observable signals; step 2.3a caps the scorer at 50 LOC stdlib-only; failure mode is "the test was overfitted", not "outcome testing is wrong" |
| 3 | Phase 3 examples-as-demos drifts into a doc-rewrite project | Hard cap: three files, format lock, opt-in for the rest |
| 4 | Phase 4 fails to find ≥ 4k headroom | Step 4.4 contingency: document and accept the residual gap; do not add a third path mid-flight; the structural ceiling is real |
| 5 | Phase 4 demotes / merges a rule whose behaviour was not outcome-tested | Step 4.0 inputs gate: only 4d (hard compress) is permitted on outcome-untested rules; 4a / 4b require a locked Phase 2 baseline |
| 6 | Phase 5 roadmap-complexity linter is gamed (split a heavy roadmap into two lightweight ones) | The trigger is contract-layer change, not line count alone — reviewer judgment required |
| 7 | This roadmap itself violates Phase 5's lightweight tier | It does — by design, this is the seed; the standard locks afterwards |

## Sequencing

```
Phase 0 (P0, blocks PR #36 merge)
    ↓
Phase 1  (Context Activation Contract)
    ↓
Phase 2  (Outcome Measurement)
    ↓
Phase 3  (Examples → Demos)
    ↓
Phase 4  (Always-Budget v2 — gated on Phase 2 + 3 exit)
    ↓
Phase 5  (Roadmap Complexity Standard)
```

Recommended order: 0 → 1 → 2 → 3 → 4 → 5. Phase 4's gate on
Phases 2 + 3 (Sonnet binding rev) prevents Phase-2A redux: budget
restructuring waits until rule behaviour is outcome-tested and
example demos are lock-formatted. Phase 5 may run anywhere after
Phase 0 if the author prefers, but the recommended order treats it
as the closing phase that locks the standard for sibling roadmaps.

## Decision log

| Date | Decision | Source |
|---|---|---|
| 2026-05-03 | v2 lock — apply Sonnet's three binding revisions (1.4a time-box, 2.3a scorer cap, Phase 4 re-sequence after 2 + 3) and gpt-4o's clarifications (0.2 single-rule criterion, Q1/Q2/Q3 justifications, 2.6 scaling decision, 3.5 demo effectiveness, 4.4 contingency, 5.1 exemplars) | Council session `2026-05-03T17-56-21Z` (claude-sonnet-4-5 + gpt-4o, $0.0807 actual) |
| 2026-05-03 | Phase 4 sequencing: after Phase 2 + 3, not parallel with Phase 1 — prevents Phase-2A redux | Sonnet binding rev #3 |
| 2026-05-03 | Q3 default is 3a (Model (b) literal); 3b gated on 4-hr / 200-LOC feasibility spike | Sonnet binding rev #1 |
| 2026-05-03 | Outcome scorer hard-capped at 50 LOC stdlib-only; rules whose signals don't fit the cap defer to a future phase | Sonnet binding rev #2 |
| 2026-05-04 | Q1 locked: file order in frontmatter (no priority field). Q2 locked: ≤ 3 contexts per rule, enforced by `check_always_budget.py`. Q3 locked: 3a (Model (b) literal); 1.4a feasibility spike skipped because no current pattern has > 1 shared loader. | Phase 1.2/1.3/1.4 execution |

## Sources

| # | Source | Date | Scope |
|---|---|---|---|
| 1 | Reviewer #1 (preview-review on PR #36) | 2026-05-03 | 3-Layer Architecture thesis, context-loading gaps, outcome-system gap, examples-as-demos framing |
| 2 | Reviewer #2 (preview-review on PR #36) | 2026-05-03 | PR-size critique, Always-Budget v2 strategies, slow-rollout compression, roadmap-complexity standard, P0 cleanup list |
| 3 | Council session `2026-05-03T17-56-21Z` (claude-sonnet-4-5 + gpt-4o) | 2026-05-03 | v1 → v2 critique on this roadmap + PR #36 diff. Both verdicts: CONDITIONAL GREENLIGHT. Sonnet 3 binding revisions; gpt-4o 6 clarifications. All compatible revisions applied to v2. |
