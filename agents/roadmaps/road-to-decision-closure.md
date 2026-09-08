---
complexity: structural
status: draft
execution:
  mode: phase-checkpoints
owner: maintainer
depends:
  - road-to-typed-grants-that-persist
relates:
  - slug: road-to-typed-grants-that-persist
    relation: depends
    note: consumes the grant object and ADR-268 § 5's interrupt semantics
  - slug: road-to-adversarial-verification-and-long-runs
    relation: extends
    note: the recovery ladder there is the runtime twin of the ownership routing here
estate_growth_exempt: >-
  Second of the three receiver roadmaps ADR-260 § Consequences records as missing; it owns
  ADR-268 § 10's ownership axis, which neither sibling can hold without splitting the routing
  table from the grant model. Owner-recorded precedence, ADR-268 § 11, 2026-09-08.
design_validated: >-
  Owner rulings of 2026-09-08 transcribed in ADR-268 § 10 and §§ 5-7; the native-ask form
  directive of 2026-09-05.
capability_gap: none
---
# Road to decision closure

> **Source:** `agents/tmp.old/inbox-2026-09-w/` — an inbox round carrying two challenge-me
> interviews with the owner plus three generations of consolidated proposals. Verified against
> `main@399beecab` on 2026-09-08.

> **Proposal, not adopted — but its authority is decided.** Consolidates the two providers'
> parallel plans for front-loading decisions. ADR-268 is **accepted**, owner-directed on
> 2026-09-08, so Phase 0 is not waiting on a decision.
>
> **ADR-268 § 10 is the ruling this file implements, and § 0 is the outcome it serves.**
> `critical-technical` leaving the owner lock is the point, not a side effect: a technical
> decision does not become owner-owned because it is hard. A council may make this routing
> stricter — more independence, provider diversity where it was optional — and may not route a
> technical class back to the owner, which § 0's table names as a break rather than a
> narrowing.

## Goal

Every roadmap enters execution as an **execution contract**: every foreseeable decision
closed, the closing done council-first, the owner reached only for product, business, taste
or destructive residue, one host-native question at a time, and the answers written into the
roadmap so a twelve-hour run never meets a question that planning could have closed. When no
owner-owned residue remains, closure completes with zero owner interaction.

## Reproduced, on this tree at `399beecab`

| ID | Fact | Where |
|---|---|---|
| D1 | `planning.challenge_on_create` is read by three entrances only | `roadmap/create`, `feature/plan`, `feature/roadmap` command files |
| D2 | `implement-ticket`, `jira-ticket`, `roadmap/materialize` and `analyze/roadmap-repos` contain no closure step; `analyze/inbox` mentions challenge once | grep over `src/domains/**/command.md` |
| D3 | The gate fires at the **start** of planning as a seed-confidence check, not at the end as a plan-closure check | `roadmap/create` and `contexts/execution/plan-confidence-gate.md` |
| D4 | `/challenge-me` writes no file by design; the pitch routes forward into create with no reverse edge | `challenge-me/command.md`; `challenge-me/vision/command.md` |
| D5 | Council routing is agent-carried — no TypeScript path reads `decision_resolution.classes[*]`; `high_impact` and `user_required` are locked to the user | `docs/contracts/ai-council-config.md` § decision_resolution |
| D6 | The council offer at roadmap creation is verbosity-gated and suppressed when `personal.autonomy: on`, on the stated ground that it is billable — stale, because the council resolves CLI-first | `roadmap/create/command.md`; `src/scripts/ai_council/config.ts` |
| D7 | No host-native ask primitive is referenced anywhere in the tree; asks are numbered text blocks, one question per turn | `grep -rn AskUserQuestion src` returns 0; `src/rules/ask-when-uncertain.md` § Iron Law |
| D8 | `blocked-by:` markers park judgement calls in files; `roadmap/next` already separates a human ACTION from a judgement call | `process-full` § blocked terminal; `roadmap/next/command.md` |
| D9 | No `produces_roadmap` command metadata exists | `grep -rn produces_roadmap src` returns 0 |
| D10 | Team mode exists — the `ai_team` settings key, `/team:delegate`, `/team:adversarial`, `/team:review` — and sits on no routing path | `src/domains/meta/team/` |
| D11 | The council is configured with two enabled members and resolves user-global, never from the project tree | `agent-config council:status`; ADR-104 |

## What this roadmap is NOT

- **Not a rewrite of `/challenge-me vision`.** Its interview loop is the engine this reuses.
- **Not a TypeScript decision dispatcher.** D5 is a documented choice; a lint over the table
  is the whole mechanism.
- **Not a new top-level command.** `/challenge-me closure` is a cluster sub-command (ADR-041).
- **Not the grant model.** That is `road-to-typed-grants-that-persist`.

## Phase 0 — Ownership replaces impact

- [ ] **0.1 Rewrite `decision_resolution`'s axis.** The classes gain content and the axis
      changes from impact to ownership:

      | Class | Examples | Resolver |
      |---|---|---|
      | `deterministic` | naming from convention, file placement, generated artefacts, commit split | agent |
      | `reversible-technical` | a pattern inside the stated convention, refactor shape, test organisation | agent |
      | `contested-technical` | two valid architectures, a dependency trade-off, migration design | independent agent → council, CLI-first → team |
      | `critical-technical` | security-sensitive design, authority implementation, compatibility risk | provider-diverse council; owner only where a typed op or an owner-reserved dimension is touched |
      | `product-owned` | two valid user-visible semantics, UX with no source of truth | owner, native ask, carrying the council's proposal |
      | `business-owned` | a deadline, a policy, a taste only the owner holds | owner |
      | `destructive-owned` | ADR-260's eleven-op vocabulary | owner, naming the exact object |
      | `spend-exhaustion` | a required API fallback over the configured ceiling | pause and report, never a question |

      The schema loader's Iron Law is rewritten so the **owner-owned** classes are locked to
      the owner and `critical-technical` is not.
      verify: the loader's rejection test is updated, and a new `lint_decision_classes`
      accepts only these eight names in a `## Decisions` block.
- [ ] **0.2 Delete the council offer and its autonomy suppression.** Under a mission the
      council is a step, not an offer, and the billable premise behind the suppression is
      false since the transport resolved CLI-first.
      verify: `grep -c 'suppress when personal.autonomy' src/domains/product-basic/roadmap/create/command.md`
      returns 0, and `agent-config council:status` is what the command consults.

## Phase 1 — Closure at every producer, mechanically

- [ ] **1.1 A `/challenge-me closure` sub-command.** Input is a roadmap path. The detector is
      `lint_roadmap_complexity`'s prose checks plus a scan for `TBD`, *decide later*, unpicked
      alternatives, unchecked assumptions, missing verify lines, ambiguous acceptance criteria,
      a missing target branch, contradictory requirements, product semantics with several
      valid outcomes, and an unresolved typed-op need. Merge intent is raised only if the
      owner already discussed merge; PR topology is never asked about. Resolution order per
      question: evidence → convention, ADR or contract → agent, if reversible → independent
      session → council → team → owner, only if owner-owned.
      verify: fixture `F1` — twelve seeded technical ambiguities produce zero owner questions
      and twelve rows in `## Decisions`.
- [ ] **1.2 `produces_roadmap: true` replaces the hard-coded entrance list.** The key is added
      to `roadmap/create`, `feature/plan`, `feature/roadmap`, `roadmap/materialize`,
      `implement-ticket`, `jira-ticket`, the Linear derivation, `analyze/inbox` and
      `analyze/roadmap-repos`. A new `lint_roadmap_producers` reds a producer that does not end
      in closure. `planning.challenge_on_create` becomes `planning.closure_pass`, default
      `true`, with the old key accepted for one minor.
      verify: `grep -rl 'produces_roadmap: true' src/domains | wc -l` returns 9, and removing
      the closure step from any one of them reds the new lint.
- [ ] **1.3 Keep the bypass, and count it.** An explicit *just write it* still drops closure,
      is recorded, and is never inferred from a mission grant.
      verify: the ask census reports bypasses as their own axis rather than as absent closures.

## Phase 2 — The roadmap decisions contract

- [ ] **2.1 A `## Decisions` section, mandatory at `status: ready`.** Columns: ID, ownership,
      resolved by, decision, evidence, revisit if. `resolved_by` is one of `evidence`, `agent`,
      `independent:<session or model>`, `council:<record>`, `team:<record>`, `owner`. Execution
      reads it before any step, and a closed decision is re-asked only when its `revisit_if`
      condition became true.
      verify: a `ready` fixture roadmap with an unresolved technical marker is red; the same
      roadmap with the marker resolved into `## Decisions` is green.
- [ ] **2.2 Council and team records live where council records already live.** Under
      `agents/evidence/analysis/`, in the existing shape — question, evidence, member
      positions, convergence, verdict, confidence, revisit condition. The council output
      contract loses any mandatory owner-facing options block after a conclusive technical
      verdict.
      verify: fixture `F3` — a conclusive technical verdict produces a record with no
      owner-facing options block, and a non-convergent one still produces the proposal the
      owner confirms.
- [ ] **2.3 Retire `blocked-by:` for judgement calls.** `BLOCKED` is reached only per ADR-268
      § 7; a judgement call routes back through closure instead of parking in a file.
      verify: `grep -rc 'blocked-by:' agents/roadmaps/*.md` shows no marker whose body is a
      judgement call rather than a human ACTION.

## Phase 3 — Host-native, one at a time

- [ ] **3.1 Asks use the host's own primitive where one exists.** `user-interaction.md` and
      `ask-when-uncertain.md` name the native tool per host — Claude Code's `AskUserQuestion`,
      and the equivalent elsewhere — with the numbered text block as the fallback. Iron Law 1's
      recommendation becomes the native default option; each ask carries the agent's or the
      council's recommendation and what changes by answer; the answer is written to
      `## Decisions` immediately.
      verify: fixture `F2` — on Claude Code, exactly one native ask is emitted for two valid
      product semantics, and its answer appears in `## Decisions` before the next step runs.
- [ ] **3.2 The host manifest records which shape each host has.** `hook_manifest.yaml` host
      rows gain `ask: native | text`, and `hooks:status` prints it.
      verify: `agent-config hooks:status` prints the ask shape for the current host.
- [ ] **3.3 Residue is asked now, not filed.** A closure that ends with owner-owned residue
      asks immediately, one question per turn, and records the answer. Never *the four
      questions are in file X*.
      verify: no closure run produces a roadmap whose open questions exist only as prose.

## Phase 4 — Mid-run residue

- [ ] **4.1 The same table governs mid-run.** Technical residue resolves inline through agent,
      independent session, council or team and is appended to `## Decisions` with the step id.
      Owner-owned residue triggers a native ask only if the step cannot progress; otherwise the
      step is parked, independent phases continue, and the run returns to it. Mission-level
      `BLOCKED` only per ADR-268 § 7.
      verify: fixture `F4` — a mid-run architecture choice resolves without an ask; fixture
      `F5` — an interrupt leaves the grant and every closed decision intact.
- [ ] **4.2 The ask census gains four axes.** `phase` (planning, execution, delivery),
      `ownership`, `avoidable`, `resolver_attempted`. Targets: zero technical owner asks in
      execution; zero commit, push, CI or conflict asks; zero repeats of an already-answered
      question.
      verify: `ask_block_census` over the 30-session corpus reports all three targets met, or
      names the rows that miss them.

## Phase 5 — Interrupts

- [ ] **5.1 Closure records the mission id and the interrupt rule reads it.** A clarification
      is incorporated; a side task is paused, executed and auto-resumed; only stop, replace or
      revoke changes mission state. Grants, the delivery target and closed decisions survive an
      interrupt. Recognised state-changing words include the owner's own — *stop*, *abort*,
      *nicht weiter*, *stattdessen*, *ersetze die Roadmap*. <!-- md-language-check: ignore -->
      verify: fixture `F5` again — the side task completes, the mission resumes, and no
      *continue?* question is emitted.

## Phase 6 — Scope-growth ownership

- [ ] **6.1 Agent-owned growth, enumerated.** A necessary internal refactor, a missing test, a
      regression on a touched path, a small dependency adjustment, a local API change inside
      defined semantics, and a Boy-Scout cleanup that is small, local, low blast radius,
      testable and carries no new product decision. Recorded as a scope delta in the PR body.
      verify: a fixture run that adds a missing test on a touched path records a scope delta
      and asks nothing.
- [ ] **6.2 Council-owned and owner-owned growth, enumerated.** Council: a larger internal
      re-cut, two equal technical strategies, a risky compatibility design, an unclear boundary
      with no new product semantics. Owner: only where the work changes what the product or
      business does, or needs a typed op. Larger unrelated opportunities become a follow-up
      artefact.
      verify: a fixture run that discovers a larger unrelated refactor emits a follow-up
      artefact rather than expanding the mission.

## Kill register

| K | Killed | Why |
|---|---|---|
| K1 | A TypeScript decision dispatcher | D5 is a documented choice; a lint over the table is enough |
| K2 | Batched asks and file-parked asks | ADR-268 § 10 plus the 2026-09-05 form directive |
| K3 | The council as an offer under autonomy | the council is a step |
| K4 | A `/closure` top-level command | ADR-041 |
| K5 | A mission halt on an owner-owned mid-run question | Phase 4.1 parks the step instead |
| K6 | A hard-coded entrance list | `produces_roadmap` plus a lint |
| K7 | Topology questions at closure | the owner plans `stacked` or it does not happen |
| K8 | *high impact implies owner* as a class | the axis is ownership |

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-09-08 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | Closure becomes a gate that stops every producer | implementation | `lint_roadmap_producers` reds any of nine commands that does not end in closure. A detector that fires on normal prose turns nine entrances red at once, and the cheapest repair is to weaken the detector until it finds nothing. | The detector reuses `lint_roadmap_complexity`'s existing prose checks rather than inventing new ones, and Phase 1.1's fixture pins both directions — twelve seeded ambiguities must be found, and a clean roadmap must pass. A weakened detector fails the first half. | Phase 1 — Closure at every producer, mechanically |
| 2 | `critical-technical` unlocks the wrong decisions | product | Removing the owner lock from `critical-technical` moves security-sensitive design decisions to a council. Where one provider is configured, that council is one model reviewing itself. | The class routes to a *provider-diverse* council and reaches the owner whenever a typed op or an owner-reserved dimension is touched; with one provider configured, `agent-config council:status` reports it and the class degrades to owner-confirm of the agent's proposal. | Phase 0 — Ownership replaces impact |
| 3 | The native ask exists on one host and the contract assumes all | implementation | D7 records that no native primitive is referenced anywhere today. A contract written as though every host has one degrades silently to a text block that no longer says it is a fallback. | Phase 3.2 puts `ask: native \| text` in the host manifest and prints it in `hooks:status`, so the shape is a measured row rather than an assumption; the text fallback keeps its own Iron Law. | Phase 3 — Host-native, one at a time |
| 4 | Closed decisions are re-asked after a context reset | implementation | `## Decisions` is read before a step, but a compacted session that loses the roadmap path re-derives the question and asks it again — the failure the census axis *repeats of an already-answered question* is there to catch. | The continuity record in the sibling roadmap carries the decision refs, and Phase 4.2's target for repeats is zero rather than low, so a single repeat is a finding. | Phase 4 — Mid-run residue |

## Blockers

### blocker: adr-266-acceptance-closure
- **Status:** resolved
- **Owner:** maintainer
- **Class:** 3 — human-only
- **Blocks:** nothing further. It blocked Phase 0, which rewrites `decision_resolution`'s Iron
  Law and so changes which decisions reach the owner at all.
- **What to do:** nothing. Resolved 2026-09-08 with its sibling
  `adr-266-acceptance` in `agents/roadmaps/road-to-typed-grants-that-persist.md` — one owner
  act, recorded on both files because either could be read alone.
- **Recommendation:** none outstanding.
- **If you do nothing:** nothing — the ownership axis is decided. `critical-technical` is no
  longer owner-locked, which is ADR-268 § 10, and the direction it may not be moved back in is
  § 0's table.
- **Resolved when:** `grep -m1 '^status:' docs/decisions/ADR-268-*.md` reads `accepted` — it
  does, verified 2026-09-08.

## Fixtures

`F1` twelve seeded technical ambiguities → zero owner questions, twelve `## Decisions` rows ·
`F2` two valid product semantics → exactly one native ask carrying a recommendation ·
`F3` council non-convergence on a product trade-off → the owner confirms the council's
proposal · `F4` a mid-run architecture choice → resolved without an ask · `F5` an interrupt →
resumed with the grant and decisions intact · `F6` an API ceiling → pause and report ·
`F7` a producer without closure → the lint is red.

## Acceptance Criteria

- [ ] AC-1 — every command carrying `produces_roadmap: true` is mechanically proven to end in
      closure, and removing the step from any one of them reds CI.
- [ ] AC-2 — a `ready` roadmap cannot contain an unresolved technical marker.
- [ ] AC-3 — the council can conclude a technical decision without emitting an owner-facing
      options block.
- [ ] AC-4 — `critical-technical` is not owner-locked and `spend-exhaustion` is not
      owner-routed, both provable from the loader's own tests.
- [ ] AC-5 — an `F1` `process-full` run records zero owner asks in the execution phase.
- [ ] AC-6 — on a host with a native ask primitive, every owner ask used it; on a host without
      one, `hooks:status` says so.
