---
complexity: structural
status: ready
tree_pin: fe05d121c7
execution:
  mode: phase-checkpoints
estate_offset_exempt: "Owner choice of 2026-10-28 after the host's instruction-limit notice persisted past 19.0.0: the measured thinned form of the user layer is 180,903 chars, so no existing roadmap's done state removes the notice, and the owner rejected any opt-in path. Added straight into later/ because five roadmaps are active (owner WIP limit); it takes no active slot until pulled."
estate_growth_exempt: "Pulled from later/ on 2026-11-07: the owner chose this file as next in line on 2026-10-28 and raised the active-roadmap cap to 25 on 2026-11-07 (agents/evidence/owner-directives/2026-11-07-wip-cap-25.md), so a slot is free; round inbox-2026-11-za asked for it to be active."
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

> **Arrivals:** 3 — latest `inbox-2026-11-za` (2026-11-07): asks for the D14 verdict (2.2) as the one decision between the package and ~16k tokens per session. Earlier: `inbox-2026-11-z` (2026-11-07): a census of ~99k tokens at
> session start, 91 % rules, and a request to stop loading floors whose pack is inactive.
> It widens 2.2 by three floors this file did not name (step 2.4).

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
consumer promotion is also switched off (`src/config/layer-form-promotion.json` <!-- ref-ignore -->
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

- **D3** (2026-11-07, AI council, anthropic + openai, both seats answered): with its
  pack inactive, each D14 floor (legal, finance, strategy, image-likeness) ships its
  **startup contract**, not its full body and not nothing. Common ground: both seats
  rejected the full body and rejected "nothing at start" for legal, finance and image;
  openai chose the contract for all four, anthropic for image. brand, scale and history
  stay pack-following (both seats).
  Dissent: anthropic preferred a smaller split for legal and finance (a ≤500-char
  session floor at start, the rest with the skill) and "nothing at start" for strategy
  unless the audit found session-wide obligations — the clause audit (1.1) found them
  (the forbidden moves and the footer apply whenever strategy keywords appear).
  Revisit-if: a per-clause session/skill scope audit shows a floor's session-wide
  obligations fit under 500 chars, or a governed action is observed proceeding on a
  contract where the body would have stopped it.

## Phase 1 — A contract form that keeps every obligation

- [x] **1.1 Audit the 28 never-thinned rules clause by clause.** <!-- receipt: class=R3 · shadow · would-skip=none · bound=override-list path: src/config/startup-contract-clauses.json agents/evidence/analysis/startup-contract-clause-audit-2026-11-07.md --> For each rule
      extract every trigger, obligation, prohibition, exception, ordering rule,
      stop condition, escalation, precedence statement and numeric bound, and
      record which of them the current law block already carries.
      verify: one table row per clause for all 28 rules, with no rule left
      unaudited; a rule with an unresolved "below" / "the table" / "the steps"
      reference is marked.
      > note: done 2026-11-07 — 28 rules, 647 clauses, each with a byte-exact `source` in the rule and its `in_law` flag; 9 source references to "below"/"the table"-style referents recorded under `unresolved_ref` and resolved inline. Record: `src/config/startup-contract-clauses.json`; readable form `agents/evidence/analysis/startup-contract-clause-audit-2026-11-07.md`.
- [x] **1.2 Define the startup-contract form and write it for the 28 rules.** <!-- receipt: class=R0 · shadow · would-skip=council,evidence,retro,revalidation,review · bound=every touched path is non-behavioural -->
      The contract is the projected session-start text; the full body stays
      reachable through the existing body pointer. Source of truth stays in
      `src/rules/`, so the contract is a marked section of each source file,
      not a second file.
      verify: every operative clause from 1.1 appears in its rule's contract;
      the contracts total at most 34,000 chars.
      > note: done 2026-11-07 — a `## Startup contract` section ends each of the 28 source rules (≤11 lines, ≤2,000 chars, no dangling referent); total **32,361 chars** ≤ 34,000. `build_thin` emits it via `thin_entry_with_contract` (digest-marked, body pointer kept); `neverThinned` no longer holds these rules whole. A first draft measured 44,535 and was compacted per rule with every clause kept.
      > note: 2026-11-08 — the contracts moved out of the rule files into `src/agent-src/startup-contracts/rules/<id>.md` (projected to `dist/agent-src/startup-contracts/rules/`): carried inside the rule, every host that delivers the full rule paid them twice, +8,072 tok per subagent spawn against the preamble payload ratchet. The stub builder reads them through `readStartupContract`; the ratification gate covers the new path (`…/rules/<slug>.md`).
- [x] **1.3 Contract tests, one deterministic case per operative branch.** <!-- receipt: class=R1 · shadow · would-skip=council,evidence,retro,revalidation,review · bound=test-only change -->
      Each case states the trigger, loads only the contract (body unavailable),
      and asserts the required stop, ask or refusal.
      verify: the suite runs in CI and passes 100 %; neutralising one clause in
      a contract turns at least one case red.
      > note: done 2026-11-07 — `check_startup_contracts` + `tests/scripts/check_startup_contracts.test.ts`: one case per audited clause (647), each asserting the clause has its witness in the contract; deleting that witness turns the gate red for exactly that clause (sabotage pass, all 647 red). Deterministic and structural — it does not run a model; the behavioural non-inferiority check is step 3.3's release-time benchmark, said here so the claim is not read wider than it is.

## Phase 2 — Fewer files at session start

- [x] **2.1 Move `design-review-after-ui-write` and `ui-audit-gate` off session <!-- receipt: class=R3 · shadow · would-skip=none · bound=override-list path: .github/workflows/rule-backstops.yml -->
      start.** Both fire on UI writes, which the host can scope by path. Deliver
      them as path-scoped rules instead of unconditional ones.
      verify: a session that never touches a UI path loads neither; a session
      that writes a UI file loads both before the write lands.
      > note: done 2026-11-07, already true on claude-code before this roadmap: both rules are path-only, so the claude rule rewrite gives them `paths:` and the installed layer reports them `scoped`. Witnessed by the host's own InstructionsLoaded records under `~/.event4u/agent-config/runtime/arrivals/` (host 2.1.316): across every recorded session the two load only with `path_glob_match` or `compact`, never with `session_start`.
- [x] **2.2 Reopen D14 for inactive pack floors in the AI council.** <!-- receipt: class=R3 · shadow · would-skip=none · bound=override-list path: .github/workflows/rule-backstops.yml --> D14 ships a
      floor with the skill it guards because claude-code lists every skill. The
      question is whether the floor's contract form (1.2) — not the full body —
      is what ships when the pack is inactive.
      verify: a recorded verdict with scope and revisit-if under Decisions.
      > note: done 2026-11-07 — AI council (anthropic + openai, both answered), recorded with conditions in `agents/evidence/council/session-start-pack-floors-question-20261107.md`; verdict D3 below.
- [x] **2.3 Apply the 2.2 verdict.** <!-- receipt: class=R1 · shadow · would-skip=council,evidence,retro,revalidation,review · bound=test-only change -->
      verify: on a machine with no legal, finance or strategy pack active, the
      projected layer carries the verdict's form of those three floors and
      nothing more.
      > note: done 2026-11-07 — no code beyond Phase 1: the D14 branch still ships the four floors with no pack active, and the thin pass now writes them as contract stubs. Test "with no pack active, the D14 floors still arrive, and arrive as their contract only" asserts both, and that brand/scale/history do not arrive.
- [x] **2.4 Put the remaining pack floors before the same verdict.** <!-- receipt: class=R3 · shadow · would-skip=none · bound=override-list path: .github/workflows/rule-backstops.yml --> 2.2 names legal,
      finance and strategy. The media, brand and persistence floors (`image-likeness-and-rights`,
      `brand-source-of-truth`, `scale-discipline`, `history-discipline`) also carry a
      `packs:` key (`ai-image`, `brand`, `scale-discipline`, `history-discipline`), and
      no roadmap owns them. Add them to the 2.2
      question, or record why they differ.
      verify: the 2.2 verdict names all seven floors, or a recorded reason for each one
      it leaves out.
      > note: done 2026-11-07 — the question named all seven; brand, scale and history differ because they carry no `consequence_class`, so `rule_in_scope` already ships them only with their pack, and both seats kept that. `image-likeness-and-rights` is the fourth D14 floor and is in the verdict.

## Phase 3 — Enforced, and on by default

- [x] **3.1 A hard size budget on the package-delivered session-start layer.** <!-- receipt: class=R1 · shadow · would-skip=council,evidence,retro,revalidation,review · bound=test-only change -->
      A `check_` script projects a default global install into a scratch HOME
      (as `installed_layer_report` already does) and fails when the
      session-start total exceeds 80,000 chars. It reports the remaining
      allowance for the project layer.
      verify: the gate is red on the current tree and green after Phases 1–2;
      raising one contract past the budget turns it red.
      > note: done 2026-11-07 — `check_session_start_budget` runs the real `install --global --tools=claude-code` into a scratch HOME (no settings, no enrolment, no pin) and sums the unconditional files under `~/.claude/rules`. The scratch HOME path is counted as `/Users/username` and both totals are printed. Red on the tree before Phases 1–2 (99,158), green after: **79,762** normalised (raw 79,876), project-layer allowance 40,238. Wired into `task ci` and `rule-backstops.yml`; an inflated fixture file turns it red (`check_session_start_budget.test.ts`). Reaching the budget also took: short contract markers, a bare `Body: <id>.md` pointer with one bodies index, and installed stubs without the `Fires on:` hint (rule-inject matches triggers on a reached carrier).
- [x] **3.2 The contract form is what every install writes.** <!-- receipt: class=R1 · shadow · would-skip=council,evidence,retro,revalidation,review · bound=test-only change --> Install and
      upgrade write the contract form for the 28 rules and the stub form for the
      thinnable rest, without an opt-in. Consumer-edited files stay as they are.
      verify: on a scratch HOME carrying a 19.0.0 layer, an agent-config upgrade run
      yields at most 80,000 chars under `~/.claude/rules`; a file the consumer
      edited is byte-identical afterwards; a second upgrade changes nothing.
      > note: done 2026-11-07 — `installerThinsHost` is true for claude-code; the install-time thin pass writes contract stubs, pointer stubs and the kernel whole, still only on a reached carrier probe and no `--full` pin (a dead carrier keeps the full layer — a safety condition, not an opt-in). `tests/install/session_start_upgrade.test.ts`: a full layer upgraded comes out reduced with contract stubs present, a user-edited rule is byte-identical, a second upgrade changes nothing. ADR-293 carries Amendment 3 for the changed behaviour.
- [x] **3.3 Replace the benchmark gate on the consumer promotion.** <!-- receipt: class=R0 · shadow · would-skip=council,evidence,retro,revalidation,review · bound=every touched path is non-behavioural --> The size
      budget (3.1) and the contract tests (1.3) replace the pre-registered
      5.2 / 5.3 benchmark as the gate for the default; the benchmark becomes a
      release-time non-inferiority check over the contract form, not an opt-in
      switch.
      verify: `src/config/layer-form-promotion.json` no longer stands between an <!-- ref-ignore -->
      upgrade and the reduced layer; the carried setup roadmap's 5.2 / 5.3 name
      this step.
      > note: done 2026-11-07 — `src/config/layer-form-promotion.json` and its reader are deleted; session promotion runs only for `install --enrol` machines, the default path is the installer. Notes under 5.2 and 5.3 of `road-to-a-setup-that-decides-itself-carried` name this step and the release-time non-inferiority role of the benchmark. <!-- ref-ignore -->

## Phase 4 — Close the overlap

- [ ] **4.1 Measure the host notice on a fresh 200K-window session.**
      verify: a fresh session after an agent-config upgrade run shows no
      instruction-limit notice in a repository with a project layer of ~13k.
- [ ] **4.2 Dispose of road-to-an-installed-layer-that-is-thinned.** Its done
      state assumed the thinned form removes the notice; 4.1 settles whether
      anything in it is still open work.
      verify: the file is archived with its steps done here, or its remaining
      steps name what this file did not cover.

## Blockers

### blocker: released-upgrade-observation
- **Status:** open
- **Owner:** user — publishing a release is a Hard-Floor action
- **Blocks:** 4.1, 4.2, AC-3
- **What to do:** after the release carrying this roadmap's Phase 1–3 work, run
  `agent-config upgrade` on a machine with a 200K-window host, open a fresh session in a
  repository with a ~13k project layer, and record whether the instruction-limit notice
  appears. Then 4.2 disposes of `road-to-an-installed-layer-that-is-thinned`.
- **If you do nothing:** the CI gate keeps the delivered layer at or under 80,000 chars,
  but no fresh host session has confirmed the notice is gone.
- **Resolved when:** the observation is recorded under 4.1.

### blocker: contract-ratification-non-convergent
- **Status:** resolved (2026-11-08)
- **Owner:** user — the ratification gate (ADR-268 § 4) needs a passing two-provider record or an owner decision; the agent may not ratify its own change
- **Blocks:** merge of the PR carrying Phases 1–3
- **Resolution:** the owner chose to raise the council prompt cap first (2026-11-08). `council_cli` gained `--max-bundle-bytes` and `--member-timeout` for one run, so rounds 12–21 showed all 28 rule files in full. Every finding was verified and fixed test-first; round 22 closed with both seats `ratified` over subject `7192f4deff0b…` (round 21 ratified the rules; round 22 re-ratified after the hook-chunk ceiling raise changed the subject). Record: `agents/evidence/ratifications/session-start-contracts.md`; `check_kernel_edit_ratified` green.
- **Resolved when:** a ratification record under `agents/evidence/ratifications/` with a passing verdict lands with the PR.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-10-28 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | An obligation lost in compaction | implementation | A contract drops an exception or a stop-before-acting clause that lived in the body; the agent acts where the full rule would have stopped. | Clause audit (1.1) before writing; 100 % deterministic contract tests (1.3) with the body unavailable; a sabotage check per clause. | Phase 1 — A contract form that keeps every obligation |
| 2 | Path scoping misses a UI write | implementation | A UI file outside the scoped paths is written without the two moved rules in context. | Path set derived from the existing UI path triggers; 2.1 verifies a load before the write lands. | Phase 2 — Fewer files at session start |
| 3 | The budget is met on the maintainer machine only | product | Another host version or a larger default pack set exceeds the budget after release. | 3.1 measures a default global install in a scratch HOME, not a maintainer machine. | Phase 3 — Enforced, and on by default |

## Acceptance Criteria

- [x] AC-1 — A default global install, upgraded without flags, delivers at most
      80,000 chars at session start, enforced by a CI gate.
- [x] AC-2 — Every operative clause of the 28 consequence-class and
      safety-floor rules is in its session-start contract, proven by contract
      tests that pass with the body unavailable.
- [ ] AC-3 — A fresh 200K-window session in a repository with a ~13k project
      layer shows no instruction-limit notice.
