---
complexity: structural
status: later
tree_pin: fe05d121c7
review_by: 2026-11-28
entry_condition:
  what: "a free slot among the five active roadmaps (owner WIP limit, 2026-10-24); this file is next in line, by owner choice of 2026-10-28"
  when: "when one of the five active roadmaps completes, or earlier if the owner pulls it"
  who: owner
execution:
  mode: phase-checkpoints
estate_offset_exempt: "Owner choice of 2026-10-28 after the host's instruction-limit notice persisted past 19.0.0: the measured thinned form of the user layer is 180,903 chars, so no existing roadmap's done state removes the notice, and the owner rejected any opt-in path. Added straight into later/ because five roadmaps are active (owner WIP limit); it takes no active slot until pulled."
estate_growth_exempt: "+1 later_roadmaps: a new file parked on arrival under the owner WIP limit of 2026-10-24 instead of taking a sixth active slot."
relates:
  - slug: road-to-an-installed-layer-that-is-thinned
    relation: extends
    note: Its done state was meant to remove the notice; the measured thinned form (180,903 chars) does not. Step 4.2 here decides what happens to it.
  - slug: road-to-a-setup-that-decides-itself-carried
    relation: extends
    note: Its 5.2 / 5.3 hold the consumer promotion behind an opt-in until a benchmark; step 3.3 here replaces that gate with the size budget plus contract tests.
---
# Road to a session start under the host limit

> **Source:** owner report on 2026-10-28 that the Claude Code notice
> "117 instruction files add up to 364.0k chars, over the 150.0k-char total limit"
> persisted after 19.0.0, and the measurement and council round of the same day
> recorded below.

## Goal

A consumer who runs `agent-config upgrade` and nothing else gets a session-start
instruction layer whose package-delivered part is at most 80,000 chars, so the
host's combined limit (120,000 on a 200K window, 150,000 on a 1M window) is not
exceeded and the notice does not appear for a project of ordinary size. No flag,
no enrolment, no settings edit. The binding obligation of every
consequence-class and safety-floor rule is still in context at session start.

## Context

Measured 2026-10-28 on a maintainer machine (package 19.0.0) by running the real
thin pass (`thinInstalledRuleLayer`) on a copy of `~/.claude/rules`, with the
keep-whole set the promotion uses (`neverThinned`):

| Group | Files | Chars today | Chars thinned |
|---|---|---|---|
| user layer total | 101 | 351,008 | 180,903 |
| stubs | 65 | — | 29,377 |
| kept whole by the thin predicate (kernel / trigger-less / path-only) | 8 | — | 30,147 |
| kept whole: consequence class | 25 | — | 110,786 |
| kept whole: `tier: safety-floor` | 3 | — | 10,593 |
| project layer + memory index | ~16 | ~13,000 | ~13,000 |

The thinned form still totals ~194k. The 28 never-thinned rules alone (121k)
exceed the 120k limit, so no layer-form decision can remove the notice. The
consumer promotion is also switched off (`src/config/layer-form-promotion.json`
`enabled: false`) until a benchmark, so an upgrade-only consumer gets the full
form today.

Largest kept-whole rules: `decision-revisit-gate` 8.5k, `settings-ask-protocol`
8.1k, `design-review-after-ui-write` 7.9k, `domain-safety-pii` 7.1k,
`domain-safety-disclaimer` 6.3k, `ui-audit-gate` 6.2k, `autonomous-execution`
6.2k, `evaluator-independence` 5.9k, `legal-safety-floor` 5.7k.

The legal, finance and strategy safety floors (13.8k together) arrive on
machines where their packs are inactive, because `rule_in_scope`
(`src/install/ruleInScope.ts`) ships a floor whose `routes_to` names a `skill:`
with that skill, and claude-code receives every skill — council D14 of
road-to-a-setup-that-decides-itself, 2026-10-25.

## Decisions

- **D1** (2026-10-28, owner): no opt-in path. The reduction reaches every
  consumer on `upgrade`; `install --enrol` is not part of the delivery.
- **D2** (2026-10-28, AI council, anthropic + openai, both seats answered):
  converged on (a) replacing the 28 never-thinned bodies with self-contained
  startup contracts — activation, the binding prohibition or action, exceptions,
  stop and escalation conditions, precedence, numeric bounds, and a body pointer —
  estimated at 20–34k for all 28 (saving 87–101k); (b) a hard CI size budget on
  the package-delivered layer, 80k (openai) / 85k (anthropic); the stricter 80k
  is taken; (c) per-rule contract tests alongside the size budget, because size
  alone can certify a compact but behaviourally broken layer; (d) moving only
  reliably triggered rules (`design-review-after-ui-write`, `ui-audit-gate`) off
  session start. Both named the clause-level audit as the precondition for any
  compaction: a law that refers to "below", "the table" or "the steps" without
  the referent is not self-contained.
  Dissent: anthropic proposed a phased rollout with an opt-in week and a 17/20
  test threshold; openai required 100 % on deterministic per-rule cases. The
  opt-in week is dropped under D1; the 100 % threshold is taken. Both seats
  ranked removing inactive pack floors highly; that conflicts with D14 and is
  step 2.2, not a given.
  Revisit-if: the clause audit (1.1) finds a rule whose operative clauses do not
  fit a contract under 2,000 chars, or a contract test in 1.3 cannot be made
  deterministic.

## Phase 1 — A contract form that keeps every obligation

- [ ] **1.1 Audit the 28 never-thinned rules clause by clause.** For each rule
      extract every trigger, obligation, prohibition, exception, ordering rule,
      stop condition, escalation, precedence statement and numeric bound, and
      record which of them the current law block already carries.
      verify: one table row per clause for all 28 rules, with no rule left
      unaudited; a rule with an unresolved "below" / "the table" / "the steps"
      reference is marked.
- [ ] **1.2 Define the startup-contract form and write it for the 28 rules.**
      The contract is the projected session-start text; the full body stays
      reachable through the existing body pointer. Source of truth stays in
      `src/rules/`, so the contract is a marked section of each source file,
      not a second file.
      verify: every operative clause from 1.1 appears in its rule's contract;
      the contracts total at most 34,000 chars.
- [ ] **1.3 Contract tests, one deterministic case per operative branch.**
      Each case states the trigger, loads only the contract (body unavailable),
      and asserts the required stop, ask or refusal.
      verify: the suite runs in CI and passes 100 %; neutralising one clause in
      a contract turns at least one case red.

## Phase 2 — Fewer files at session start

- [ ] **2.1 Move `design-review-after-ui-write` and `ui-audit-gate` off session
      start.** Both fire on UI writes, which the host can scope by path. Deliver
      them as path-scoped rules instead of unconditional ones.
      verify: a session that never touches a UI path loads neither; a session
      that writes a UI file loads both before the write lands.
- [ ] **2.2 Reopen D14 for inactive pack floors in the AI council.** D14 ships a
      floor with the skill it guards because claude-code lists every skill. The
      question is whether the floor's contract form (1.2) — not the full body —
      is what ships when the pack is inactive.
      verify: a recorded verdict with scope and revisit-if under Decisions.
- [ ] **2.3 Apply the 2.2 verdict.**
      verify: on a machine with no legal, finance or strategy pack active, the
      projected layer carries the verdict's form of those three floors and
      nothing more.

## Phase 3 — Enforced, and on by default

- [ ] **3.1 A hard size budget on the package-delivered session-start layer.**
      A `check_` script projects a default global install into a scratch HOME
      (as `installed_layer_report` already does) and fails when the
      session-start total exceeds 80,000 chars. It reports the remaining
      allowance for the project layer.
      verify: the gate is red on the current tree and green after Phases 1–2;
      raising one contract past the budget turns it red.
- [ ] **3.2 The contract form is what every install writes.** Install and
      upgrade write the contract form for the 28 rules and the stub form for the
      thinnable rest, without an opt-in. Consumer-edited files stay as they are.
      verify: `agent-config upgrade` on a scratch HOME carrying a 19.0.0 layer
      yields at most 80,000 chars under `~/.claude/rules`; a file the consumer
      edited is byte-identical afterwards; a second upgrade changes nothing.
- [ ] **3.3 Replace the benchmark gate on the consumer promotion.** The size
      budget (3.1) and the contract tests (1.3) replace the pre-registered
      5.2 / 5.3 benchmark as the gate for the default; the benchmark becomes a
      release-time non-inferiority check over the contract form, not an opt-in
      switch.
      verify: `src/config/layer-form-promotion.json` no longer stands between an
      upgrade and the reduced layer; the carried setup roadmap's 5.2 / 5.3 name
      this step.

## Phase 4 — Close the overlap

- [ ] **4.1 Measure the host notice on a fresh 200K-window session.**
      verify: a fresh session after `agent-config upgrade` shows no
      instruction-limit notice in a repository with a project layer of ~13k.
- [ ] **4.2 Dispose of road-to-an-installed-layer-that-is-thinned.** Its done
      state assumed the thinned form removes the notice; 4.1 settles whether
      anything in it is still open work.
      verify: the file is archived with its steps done here, or its remaining
      steps name what this file did not cover.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-10-28 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | An obligation lost in compaction | implementation | A contract drops an exception or a stop-before-acting clause that lived in the body; the agent acts where the full rule would have stopped. | Clause audit (1.1) before writing; 100 % deterministic contract tests (1.3) with the body unavailable; a sabotage check per clause. | Phase 1 — A contract form that keeps every obligation |
| 2 | Path scoping misses a UI write | implementation | A UI file outside the scoped paths is written without the two moved rules in context. | Path set derived from the existing UI path triggers; 2.1 verifies a load before the write lands. | Phase 2 — Fewer files at session start |
| 3 | The budget is met on the maintainer machine only | product | Another host version or a larger default pack set exceeds the budget after release. | 3.1 measures a default global install in a scratch HOME, not a maintainer machine. | Phase 3 — Enforced, and on by default |

## Acceptance Criteria

- [ ] AC-1 — A default global install, upgraded without flags, delivers at most
      80,000 chars at session start, enforced by a CI gate.
- [ ] AC-2 — Every operative clause of the 28 consequence-class and
      safety-floor rules is in its session-start contract, proven by contract
      tests that pass with the body unavailable.
- [ ] AC-3 — A fresh 200K-window session in a repository with a ~13k project
      layer shows no instruction-limit notice.
