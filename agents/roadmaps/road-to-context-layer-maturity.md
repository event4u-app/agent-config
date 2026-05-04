
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

- [ ] **0.1** PR #36 body rewritten to match the actual 174-file diff.
      Frame it as `Structural optimization foundation + regression
      gates + command surface reduction` (Feedback #2 wording). Phase
      2A revert called out as a finding, not a defect.
- [ ] **0.2** One-off-script decision. Apply this **single rule
      uniformly** across every `scripts/ai_council/_one_off_*.py`:
      - **Keep in place** with a one-line docstring naming the roadmap
        + council-session id it served, **iff** the script is
        re-runnable today (imports resolve, prompt still meaningful).
      - **Delete** iff the script depends on prompts / file paths
        that no longer exist; the saved session under
        `agents/council-sessions/` is the audit trail.
      - **Do not** create a new `scripts/ai_council/sessions/` folder
        — sessions already live under `agents/council-sessions/`.
      Document the per-script decision in the PR body as a small
      table.
- [ ] **0.3** Budget-status block in the PR body rewritten honestly:
      headroom 1,552 / 49,000 (96.8 % utilization), Phase 2A revert
      explained, "Always-Budget v2" named as the next roadmap
      (this one).
- [ ] **0.4** Slow-rollout compression noted in the PR body. Already
      noted in `road-to-1-16-followups.md` line 1.1.2; surface it in
      the PR body so a future reviewer does not need to chase it.

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

- [ ] **1.1** Inventory: list every `load_context:` chain in the 38
      auto-rules + every `type: always` rule. Output table:
      `rule → context → depth → chars`.
- [ ] **1.2** Decide Q1 (order). **Default proposal:** file order in
      frontmatter, deterministic, no priority field.
      **Justification:** prose-citation order is non-machine-readable
      and would force every rule to embed a sort hint; deterministic
      file order is already what `load_context.py` returns and matches
      reader expectation. Lock in
      `docs/contracts/load-context-budget-model.md`.
- [ ] **1.3** Decide Q2 (concurrency). **Default proposal:** hard cap
      ≤ 3 contexts per rule.
      **Justification:** current max in the 38 auto-rules is 2; ≤ 3
      locks the ceiling without forcing any rewrite, and a 4th
      context is the empirical signal that the rule should split
      rather than load more. Add to `scripts/check_always_budget.py`
      as a CI gate.
- [ ] **1.4** Decide Q3 (sharing). Two options:
      - **3a — keep Model (b) literal:** each rule pays full cost.
        Status quo, but documented as deliberate.
        **Justification:** the linter is correct as-is; predictable
        budget; no new failure modes.
      - **3b — shared-context discount:** if context X is loaded by
        N rules, charge `chars(X) / N` per rule. Requires linter
        rewrite + new failure-mode test.
        **Justification:** unlocks Phase 4 leverage that 3a cannot
        reach (top-3 concentration is partially shared overhead).
      Pick by council vote; lock with a rollback path.
- [ ] **1.4a** **Time-boxed feasibility for 3b** (Sonnet binding rev).
      Spike capped at **4 engineer-hours** and **≤ 200 LOC** (linter
      changes + tests combined). If either ceiling is hit, **auto-
      revert to 3a** without a second council round. No re-debate.
      The cap exists because cross-rule budget attribution can grow
      a new data model that breaks the lightweight tier of this
      roadmap (Phase 5).
- [ ] **1.5** `tests/test_load_context.py` extended with the new
      contract checks. Existing four safety-floor tests stay green.

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

- [ ] **2.1** Pick three behaviors to outcome-test (not all 38 rules
      at once). Recommended seed: `ask-when-uncertain` (one-question-
      per-turn), `verify-before-complete` (no completion without
      fresh evidence), `direct-answers` (no flattery opener). These
      are the three with the sharpest Iron Laws and the cheapest
      observable signals.
- [ ] **2.2** For each, define the **observable signal** in
      `tests/golden/` format: an input prompt, an expected
      shape-of-reply, a forbidden shape-of-reply.
- [ ] **2.3** Wire a thin scorer: parse the golden-transcript reply
      and score against the shape contract. No external model calls;
      regex-and-structure level.
- [ ] **2.3a** **Scorer complexity cap** (Sonnet binding rev). Total
      scorer implementation **≤ 50 LOC, stdlib only, no AST parsing,
      no external regex engines**. If a rule's observable signal
      cannot be scored within this budget, **defer that rule to a
      future phase** and document the gap in
      `tests/golden/outcomes/README.md`. The cap exists because a
      flexible scorer is exactly the path to a flaky-test family
      (Risk #2) and to leaking outcome scope into rule-quality
      judgment (which is out of scope per 2.5).
- [ ] **2.4** Lock the three baselines in `tests/golden/outcomes/`.
      CI fails if a future change degrades any baseline without an
      explicit roadmap entry.
- [ ] **2.5** Document the limits: outcome tests prove the rule
      changed observable behavior on a held-out prompt, not that the
      agent is "better" overall. Outcome ≠ universal quality.
- [ ] **2.6** **Scaling decision process** (gpt-4o rev). Add a
      one-section README in `tests/golden/outcomes/` that names the
      criteria for adding rule #4 onward: (a) the rule has a sharp
      Iron Law, (b) the observable signal fits the 50-LOC scorer
      cap, (c) the three seed baselines have held across two release
      cycles. Without all three, the rule waits.

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

- [ ] **3.1** Pick three examples to harden into demos (the same
      three rules from Phase 2 — keeps the layer aligned). Each demo
      shows: (a) the wrong shape with the failure mode, (b) the
      right shape, (c) one sentence on why the right shape works.
- [ ] **3.2** Format-lock: every example in `docs/guidelines/agent-
      infra/*-examples.md` must follow the demo shape (wrong / right
      / why). Migration is opt-in per file; only the three Phase-3
      files convert in this roadmap.
- [ ] **3.3** Cross-link: each rule's "See also" block points to the
      demo file with a deep-link to the relevant section. Existing
      links audit-checked by `scripts/check_references.py`.
- [ ] **3.4** Linter (`scripts/lint_examples.py`, new, ≤ 100 LOC,
      stdlib only): verifies every demo file follows the shape.
      Hooked into `task ci`.
- [ ] **3.5** **Demo effectiveness check** (gpt-4o rev). After 3.3
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

- [ ] **4.0** **Inputs gate** (Sonnet binding rev). Confirm before
      starting 4.1: (a) Phase 2 outcome baselines locked under
      `tests/golden/outcomes/`; (b) Phase 3 demo cross-links audit-
      clean; (c) Phase 1 Q3 decision (3a or 3b) recorded. **Do not
      evaluate 4a (demote) or 4b (merge) for any rule whose
      behaviour is not yet outcome-tested.** Outcome-untested rules
      stay in scope only for 4d (hard compress).
- [ ] **4.1** Decision matrix: per always-rule, evaluate 4a/4b/4c/4d
      feasibility *given the locked Phase 2 + 3 baselines*. Output
      (created by this step): `budget-v2-matrix.md` next to this
      roadmap.
- [ ] **4.2** Pick the highest-leverage two paths from the matrix.
      No "do all four" — Feedback #2 explicit warning.
- [ ] **4.3** Execute the picked paths in atomic commits. Each
      change must keep all four safety-floor rules untouched.
- [ ] **4.4** Re-measure: total extended budget, top-3 share,
      concentration gate. **Goal:** ≥ 4,000 chars headroom
      (currently 1,552). Not a hard gate — a goal.
      **Contingency** (gpt-4o rev): if the picked paths land but
      headroom < 4,000, do **not** add a third path mid-flight.
      Document the residual gap in the matrix, accept it, and let
      the next roadmap decide whether the structural ceiling has
      moved. Do not force.
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

- [ ] **5.1** Write `docs/contracts/roadmap-complexity-standard.md`.
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
- [ ] **5.2** Add a frontmatter field `complexity: lightweight |
      structural` to the roadmap template. Linter
      (`scripts/lint_roadmap_complexity.py`, new, ≤ 150 LOC, stdlib
      only) checks each roadmap matches its declared tier — line
      count, phase count, presence of council-session cross-links
      (a structural-only marker).
- [ ] **5.3** Apply retroactively to the four open roadmaps. Tag
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

## Sources

| # | Source | Date | Scope |
|---|---|---|---|
| 1 | Reviewer #1 (preview-review on PR #36) | 2026-05-03 | 3-Layer Architecture thesis, context-loading gaps, outcome-system gap, examples-as-demos framing |
| 2 | Reviewer #2 (preview-review on PR #36) | 2026-05-03 | PR-size critique, Always-Budget v2 strategies, slow-rollout compression, roadmap-complexity standard, P0 cleanup list |
| 3 | Council session `2026-05-03T17-56-21Z` (claude-sonnet-4-5 + gpt-4o) | 2026-05-03 | v1 → v2 critique on this roadmap + PR #36 diff. Both verdicts: CONDITIONAL GREENLIGHT. Sonnet 3 binding revisions; gpt-4o 6 clarifications. All compatible revisions applied to v2. |
