---
complexity: structural
status: later
tree_pin: 9b6242da90
review_by: 2027-01-15
entry_condition:
  what: "a free slot under the WIP cap of 25 active roadmaps, and the demand gate of step 0.1 passing"
  when: "when an active roadmap closes"
  who: owner
execution:
  mode: phase-checkpoints
owner: maintainer
estate_growth_exempt: >-
  Receiver for owner directive OD2 (round inbox-2026-11-xa: a decision always considers what
  breaks elsewhere, what an unchanged client does when a contract changes, and where a deeply
  rooted legacy method can break). Lands in later/ because 32 roadmaps are active against a
  WIP cap of 25.
estate_offset_exempt: >-
  Owner search ran before this file was written:
  grep -rlF -e 'code-graph reach' -e contract-diff -e 'estate consumers' -e blast-radius --
  agents/roadmaps/*.md agents/roadmaps/later agents/roadmaps/stubs — no owner of symbol reach,
  provider-side contract diff or estate consumers. Hits for blast-radius were passing mentions
  (knowledge-atlas, originality-gate, kernel-question-triangle, placeholders-on-the-wire).
  road-to-a-graph-that-feeds-the-gate (later) owns hook reach and staleness of the graph, a
  different subject.
relates:
  - slug: road-to-a-decision-that-shows-its-matrix
    relation: feeds
    note: "Supplies the computed Reach and Contract cells. Each phase here is useful without the matrix."
  - slug: road-to-honest-graph-freshness
    relation: disjoint
    note: "Active. Owns graph staleness; a stale graph makes a reach answer `unknown`."
  - slug: road-to-a-graph-that-feeds-the-gate
    relation: disjoint
    note: "later/. Owns which searches reach the graph hook and `untested --diff` in shadow."
---
# Road to a change that knows its reach

> **Source:** `agents/tmp.old/inbox-2026-11-xa/` — an owner transcript plus two external plan
> chains. Claims verified against `main@9b6242da90` on 2026-11-24.

> **Owner directive OD2 (2026-11-23, owner's own words, recorded as owner intent):** a decision
> always considers dependencies — what happens elsewhere in the code; what happens when an API
> contract changes and the client does not; in a legacy project, where a change to a method
> rooted through many levels can break. Where the code is available it is analysed, not
> guessed. Keep the whole in view.

## Goal

Before a change is written, AC can say how far it reaches — through every level of a legacy
call chain, not two — and which known or unknown consumer a contract change breaks, from the
provider's side. What it cannot establish is reported as `unknown` with the reason, never as
safe. A path with untested callers gets a "pin first" option and the points where a test buys
the most.

## Context — what the tree shows at `9b6242da90`

| ID | Finding | Evidence |
|---|---|---|
| R1 | No decision path consults a dependency fact: `decision-record`, `decision-review`, `stakeholder-tradeoff` name neither the blast-radius skill nor the graph | grep of the three skill dirs: no hit; `src/skills/ai-council/SKILL.md:170` names `code-graph ask` once |
| R2 | The before-a-change skill reads a diff, and an unwritten option has none | `src/skills/blast-radius-analyzer/SKILL.md:4`, `:53` |
| R3 | Depth stops at two by instruction and by code: the skill forbids more without approval; `impact` defaults to 2; `affected` hard-codes 2; `tree()` clamps any `--depth` to at most 3 | `SKILL.md:74`, `:182`; `src/scripts/code_graph/cli.ts:478`, `:520`, `:599`; `src/scripts/code_graph/query.ts:549`, `:862` |
| R4 | A contract change is checked from the consumer's side only; `ContractOp` models no response field | `src/scripts/code_graph/lanes/interfaces/drift_rules.ts:14`, `:36`; `lanes/interfaces/contracts.ts:15-22` |
| R5 | The hub already matches one project's HTTP calls to another's routes; no verb asks it for a route | `src/scripts/code_graph/hub_facts.ts:4`, `:70`; `estate_cli.ts:78` (verbs: where-used, projects-using, advisory-impact) |
| R6 | `api-design` states the rule but delegates the check to an adversarial review and says "track clients" without an instrument | `src/skills/api-design/SKILL.md:42`, `:76`, `:82` |
| R7 | No skill turns "the callers on this path are untested" into a step; characterization tests appear only in passing | `tests-for` / `untested` in `src/scripts/code_graph/cli_help.ts`; grep of `src/skills` for characterization, Mikado |
| R8 | The graph already carries co-change edges, an independent second signal | `src/scripts/code_graph/vocabulary.ts:97` |

Kept: "a graph is an index, never the truth; counts are lower bounds"
(`src/rules/external-code-graph-interop.md`, ADR-303); the reach levels `local · module ·
cross-module · external` (blast-radius skill § 4) become the scale. The rule's own measurement
holds: no class of graph question beat `grep`, so every reach answer names what grep must
still confirm.

## What this roadmap is NOT

- No full transitive enumeration: closure over a call graph is cheap and imprecise in both
  directions. Depth is profiled and counted to the end, listed to hop 2.
- No bundled third-party OpenAPI differ; an installed one is shown beside ours.
- No claim of global completeness; `validated_safe` is only what a test or a witness backs.

## Phase 0 — A demand gate and planted repositories

Evidence (read): `src/skills/blast-radius-analyzer/SKILL.md:74`.

- [ ] **0.1 Demand gate.** Replay ten past changes of this tree whose follow-up fixes are known
      from history: did the two-hop limit or the missing provider view hide a break? Fewer than
      two hits parks Phases 2-3 with the evidence.
      verify: `grep -cE '^\| [0-9a-f]{7,} \| (hidden|not-hidden) \|' agents/evidence/analysis/reach-demand-gate-*.md` -> 10
- [ ] **0.2 Planted fixtures** under `tests/fixtures/change-reach/`, ground truth as data:
      (a) a method reached through five call levels with one string-dispatched caller, an
      untested middle layer and a raw-SQL reader of the same table; (b) a provider with an
      OpenAPI file and a second project calling it, one option removing a response field;
      (n) a negative: an edge invented by a name collision that must not be reported.
      verify: `jq -e '.expected_nodes | length > 0' tests/fixtures/change-reach/a/truth.json tests/fixtures/change-reach/b/truth.json tests/fixtures/change-reach/n/truth.json` -> 0
- [ ] **0.3 Thresholds K7-K9** pre-registered in the matrix roadmap's vocabulary file, one
      council round, before any number exists.
      verify: `grep -cE '^ *K[7-9]:' src/config/decision-vocabulary.yaml` -> 3

## Phase 1 — Reach for a change that is not written yet

Evidence (read): `src/scripts/code_graph/query.ts:862`.

- [ ] **1.1 Failing tests on fixture (a)**: all five levels found; the string-dispatched caller
      reported as `unknown`, not omitted; the untested middle layer counted; the raw-SQL reader
      found through the table; the depth profile matches the truth file; fixture (n) reports
      no collision edge.
      verify: `npx vitest run tests/scripts/code_graph/reach.test.ts` -> /failed/
- [ ] **1.2 `code-graph reach`** with its own budgeted walk (not `tree()`'s clamp): takes
      `--symbol`, `--column`, `--route` or `--event`, optional `--change
      signature|behaviour|remove|rename`, and `--direction callers|effects` (effects = what the
      change triggers: writes, events, jobs). Output: reach level, depth profile per hop until
      no new node or the budget, witnesses for hops 1-2, counts beyond, untested callers on the
      path, co-change partners outside the option, and three numbers kept apart —
      `known_impacted`, `unknown_frontier` (listed when the budget cuts), `validated_safe`. A
      graph that is behind returns `unknown` with the reason. The listing depth is one
      constant shared with `impact` and `review-risk`.
      verify: `npx vitest run tests/scripts/code_graph/reach.test.ts` -> 0
- [ ] **1.3 Correct the skill's before/after split**: in `blast-radius-analyzer`, before the
      edit `reach`, after it `impact --diff`; "list to second order, count to the end" replaces
      the second-order stop.
      verify: `grep -c 'code-graph reach' src/skills/blast-radius-analyzer/SKILL.md` -> /[1-9]/
- [ ] **1.4 Measure** recall and precision against fixture (a) and against the 0.1 historical
      changes; gate K7. Results split by stack and by graph present/absent.
      verify: `grep -cE '^\| (fixture-a|historical) \| recall 0\.[0-9]+ \| precision 0\.[0-9]+ \|' agents/evidence/analysis/reach-recall-*.md` -> 2

## Phase 2 — A contract change sees its consumers

Evidence (read): `src/scripts/code_graph/lanes/interfaces/contracts.ts:15-22`.

- [ ] **2.1 Response fields** in `ContractOp`, per status where the contract states them;
      formats that do not state them yield `unknown`.
      verify: `npx vitest run tests/scripts/code_graph/contracts.test.ts` -> 0
- [ ] **2.2 `code-graph contract-diff <base> <head>`** classifies each changed operation:
      `additive`, `breaking-request`, `breaking-response`, `removed`. The table is data in the
      vocabulary file, one planted case per row; same signature but changed nullability, error
      shape or ordering is `breaking-response`. An installed OpenAPI differ's verdict is shown
      beside ours, and a disagreement is a finding.
      verify: `npx vitest run tests/scripts/code_graph/contract_diff.test.ts` -> 0
- [ ] **2.3 `code-graph estate consumers <METHOD> <path>`** from the hub's existing matches:
      registered projects calling the operation, with witnesses, and how many calls were
      unmatched (`dynamic_baseurl`, `no_endpoint_match`, `ambiguous`). Names stay in the hub.
      verify: `npx vitest run tests/scripts/code_graph/estate_consumers.test.ts` -> 0
- [ ] **2.4 The Contract cell**: `none · additive · breaking, consumers known and in scope ·
      breaking, consumers known and out of scope · breaking, consumers unknown`; `unknown`
      whenever the estate index is off, the route is public, or unmatched calls exist. Fixture
      (b) comes out `breaking, consumers known and out of scope`.
      verify: `npx vitest run tests/scripts/code_graph/contract_diff.test.ts -t cell` -> 0
- [ ] **2.5 Expand → migrate → contract as a generated option** in `api-design`, replacing the
      adversarial review as the first line of defence (it stays second); for a schema change
      the same shape adds backfill and one writer during the migration.
      verify: `grep -c 'contract-diff' src/skills/api-design/SKILL.md` -> /[1-9]/
- [ ] **2.6 Event payload compatibility** as an extension of 2.2 where the project states event
      schemas in a file (AsyncAPI or a typed payload class); stated nowhere → `unknown`.
      verify: `npx vitest run tests/scripts/code_graph/contract_diff.test.ts -t event` -> 0

## Phase 3 — Pin first, then change (legacy)

Evidence (read): `src/scripts/code_graph/cli_help.ts` (`tests-for`, `untested`).

- [ ] **3.1 `references/pin-first.md`** in `code-refactoring`: when `reach` reports untested
      callers on the path, write characterization tests at the highest fan-in points first;
      change as expand → migrate → contract; order prerequisites leaves-first; the legacy
      dynamic-edge checklist (string dispatch, stored job payloads, cron, raw SQL,
      serializers) is read before claiming a reach.
      verify: `test -f src/skills/code-refactoring/references/pin-first.md` -> 0
- [ ] **3.2 `code-graph reach --pin-points`** ranks symbols on the path by fan-in and missing
      tests — where a test buys the most — and lists the tests to run for the change.
      verify: `npx vitest run tests/scripts/code_graph/reach.test.ts -t pin-points` -> 0
- [ ] **3.3 Fixture (a) end to end**: the pin-first option is generated, wins or loses on the
      matrix, and the run records which.
      verify: `npx vitest run tests/scripts/code_graph/reach.test.ts -t end-to-end` -> 0

## Kill criteria (thresholds set in 0.3)

| ID | Fires when | Then |
|---|---|---|
| K7 | `reach` recall on fixture (a) or the historical changes is below the floor | the Reach cell reports `unknown` everywhere until fixed; it never guesses |
| K8 | `contract-diff` disagrees with an installed differ above the set rate | the Contract cell stays advisory |
| K9 | the collision fixture (n) reports an edge | precision fix before any further phase |

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-11-24 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | False safety | product | An unresolved dynamic caller is dropped and the change reads as `local` | `unknown_frontier` is a first-class output; K7 forces `unknown` on low recall | Phase 1 — Reach for a change that is not written yet |
| 2 | Walk cost on large legacy repos | implementation | An unbounded walk over a 1M-edge graph stalls the session | budgeted walk with the frontier listed on cut; profile, not enumeration | Phase 1 — Reach for a change that is not written yet |
| 3 | Building on a null | product | The graph has never beaten grep on any measured class, so new verbs may add cost without catching more | 0.1 demand gate parks the phases on fewer than two hits | Phase 0 — A demand gate and planted repositories |
| 4 | A second contract taxonomy | implementation | Contract classes stated in the script and again as prose in `api-design` | the table lives in the vocabulary file; `api-design` cites the verb | Phase 2 — A contract change sees its consumers |

## Acceptance Criteria

- [ ] AC-1 — Fixture (a): five levels, the dynamic caller as `unknown`, the raw-SQL reader found.
- [ ] AC-2 — Fixture (b): a removed response field is `breaking-response` with the second project named.
- [ ] AC-3 — No `reach` output renders an unknown frontier as "no impact".
- [ ] AC-4 — The listing depth is one constant (`grep` finds one definition).
