---
complexity: structural
status: ready
execution:
  mode: phase-checkpoints
relates:
  - slug: road-to-observed-learning-signal
    relation: disjoint
    note: >
      That roadmap measures whether a recorded learning changed a later
      outcome. This one measures whether the skill surface is entered at all.
      Both read the transcript store and they answer different questions —
      a learning signal can be positive while zero skills are invoked, and
      the census says that is the current state.
estate_growth_exempt: "The measurement exists, is published as a backed claim, and reads zero: `report_skill_activation` over 30 sessions and 11,049 assistant turns records 0 Skill invocations and 0 of 299 distinct skills (docs/proof.md:98). The instrument is in no CI job, no Taskfile target, `src/config/gate-coverage.yml` and `src/config/release-gate-locality.yml` alike — so the number is a dated one-shot that will rot silently. No active roadmap, later roadmap or stub owns the consequence; the nearest, road-to-observed-learning-signal, measures a different question and says so. This adds no new instrument: it gives the existing one a caller and puts the framing choice in front of its owner."
estate_offset_exempt: "Cannot be offset. The natural offset would be another active roadmap in the routing family, and the only candidates are the nine that this same round confirms are direction rather than capability; retiring one to pay for this would trade an open plan for an open plan and close nothing."
---
# Road to the activation census consequence

> **Source:** `agents/tmp.old/inbox-2026-09-q/` — an external multi-model review
> round on releases 14.17.0 and 14.18.0, verified against the tree at
> `99d14b2e7` on 2026-09-06. Every number below was re-derived; the review's
> own figures for the census and the trigger share are exact.

> **Arrivals:** 3 (at least) — latest `inbox-2026-09-q` (2026-09-06); earlier:
> `agents/roadmaps/archive/road-to-the-tenth-arrival.md`, whose coverage work
> produced the census, and the round that commissioned the census itself.

## Goal

The zero this package measured about its own skill surface is either a number
that keeps being measured, or a framing that changed because of it — and not,
as today, a dated sentence in a claims file with no reader. Re-derived at
`99d14b2e7`: `ls -d src/skills/*/` is 299; `check_routing_coverage` reports
skills `100 / 299 = 0.3344` and rules `94 / 105 = 0.8952`; exactly 12 skills
declare a machine-matchable trigger key in frontmatter (a thirteenth grep hit,
`src/skills/rule-writing/SKILL.md:195`, is a documentation example in the body);
and `docs/proof.md:98` carries the backed claim that over 30 sessions and 11,049
assistant turns the census records 0 Skill invocations and 0 of 299 distinct
skills. `grep -rn report_skill_activation Taskfile.yml .github/workflows/`
returns nothing, and the script appears in neither `src/config/gate-coverage.yml`
nor `src/config/release-gate-locality.yml`. Out of scope by decision: building a
host-side activation mechanism (that is a host-capability question this
repository cannot answer alone), deleting any skill, and any change to the
`triggers.json` corpus, whose relationship to routing is already recorded as a
name collision rather than a mechanism.

## Phase 1 — The census keeps being taken

- [x] **1.1 Give `report_skill_activation` a caller.** Add a Taskfile target and a
      release-time invocation so the census is re-taken rather than quoted. The script
      exists and needs no change for this step.
      verify: `task` exposes the target, it runs against the transcript store without
      arguments, and its output names the session count and turn count it actually read.
- [x] **1.2 Register it in `src/config/gate-coverage.yml` with a CI-identical `argv`.**
      Without the row, removing the caller added in 1.1 is invisible.
      verify: `./scripts-run src/scripts/check_gate_coverage` passes with the row and
      fails when the row's `argv` and the caller's invocation disagree.
- [x] **1.3 Date the published claim from the run, not from prose.** `docs/CLAIMS.md:245`
      and `docs/proof.md:98` carry `<!-- count: dated -->` and a hand-written date. The
      figure and its date come from the census output.
      verify: re-running the census and regenerating the proof surface changes the date
      and the numbers together, and a stale figure is distinguishable from a fresh one
      without reading git history.

## Phase 2 — Say what a zero census means for the surface

- [x] **2.1 Separate the three populations, with counts.** The 299 skills split into: the
      12 that declare a machine-matchable trigger, the 100 that carry a `triggers.json`
      corpus, and the remainder that are reachable only by a human naming them. Publish
      the three counts and their overlap as one table.
      verify: the table's three counts are produced by commands stated beside them, and
      they reconcile to 299 with the overlap named.
- [x] **2.2 State, per population, what invocation would even look like.** For the
      human-named remainder, invocation is a reader opening a file — which is a
      legitimate answer and is currently unstated, so the census's zero reads as a
      failure of all 299 rather than of the subset where automatic selection was ever
      claimed.
      verify: `docs/proof.md`'s census claim distinguishes the population where zero is a
      defect from the population where zero is the design, and neither is asserted
      without the count behind it.
- [x] **2.3 Correct any surface that implies automatic selection for the remainder.** A
      claim that skills are selected for the agent, made about a population that has no
      selection mechanism, is a claim the census refutes.
      verify: `./scripts-run src/scripts/check_claims` passes and no surviving claim
      asserts automatic selection over a population larger than the one 2.1 counts.

## Phase 3 — The framing decision reaches its owner

- [~] **3.1 Put the two options in front of the owner as one decision packet.** Either the
      12 trigger-carrying skills get a host-side activation path built and measured, or the
      surface is reframed as human-named reference and the claims follow. This roadmap
      builds neither; it makes the choice concrete, dated, and costed from the Phase 2
      counts. Recorded as a blocker below.
      verify: the packet names both options, the count each affects, and what would falsify
      the option chosen — and `adr_cite_check` on any resulting record reports a live
      status.
      <!-- deferred-resolution: carried-to=road-to-the-skill-surface-framing-choice -->
      Deferred, not done and not cancelled. The AI council of 2026-09-06 descoped Phase 3
      out of this roadmap; the receiver holds the packet content — both options, the count
      each affects, and each option's falsifier — and the choice itself is the owner's.

## Blockers

### blocker: skill-surface-framing-owner-choice

- **Status:** resolved
- **Outcome:** transferred
- **Owner:** maintainer
- **Asked:** 2026-09-06, in the round `inbox-2026-09-q` disposition and in the reply that carried it.
- **Blocks:** Phase 3 only. Phases 1 and 2 are independent and agent-doable in full — keeping the census alive and counting the populations honestly is required under either option.
- **Recommendation:** none; this is the owner's call — it changes what the package claims to be for its consumers, which is a public commitment and owner-reserved under `decision-revisit-gate`.
- **If you do nothing:** `docs/proof.md:98` keeps publishing a dated zero over 299 skills with no stated population, and the fourth review round re-derives the same argument from scratch.
- **What to do:**
  1. Choose the activation path — commit to building a host-side selection mechanism for the 12 trigger-carrying skills and to measuring it, and say which host.
  2. Or choose the reframing — declare the human-named remainder reference material by design, and let Phase 2.3 bring `docs/CLAIMS.md` into line with that.
  3. Or accept the zero as-is with a stated reason, recorded next to the claim in `docs/proof.md` so the next round meets an answer.
- **Resolved when:** one of the three is recorded in `docs/decisions/` or beside the claim, and `./scripts-run src/scripts/check_claims` passes against the resulting text.
- **Resolution, 2026-09-06:** this closes the ROADMAP, and it does not decide the question. An AI council polled under the maintainer's standing delegation returned a unanimous DESCOPE: Phases 1 and 2 are executed in full here, Phase 3 leaves this roadmap's scope. None of the three options above was chosen, and nothing recorded here narrows the menu — the "Resolved when" condition above is still unmet and remains the condition for a substantive resolution. What was done instead is mechanical: step 3.1 and AC-6 are `[~]`, carried to `agents/roadmaps/road-to-the-skill-surface-framing-choice.md`, which holds the packet — the options, the count each affects, each option's falsifier — and carries a `parent_roadmap:` back-link so the carry is verifiable from both ends. That receiver is `status: carrier`; a human flips it to `ready` when the choice is taken up. The measurement itself is unchanged by any of this: the census reads 0 Skill invocations over 30 sessions and 11,338 assistant turns, and the roadmap closing says nothing about that reading in either direction.
- The choice changes what this package claims to be for its consumers, which is
  a public commitment and owner-reserved under `decision-revisit-gate`'s reserved
  set. Phases 1 and 2 are independent of it and agent-doable in full: keeping the
  census alive and counting the populations honestly is required under either
  option, and neither presumes the answer.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-09-06 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | The census is kept alive and read by nobody | product | A Taskfile target and a gate-coverage row make the number reproducible without making it consequential; the failure mode is a green pipeline re-deriving the same zero every release while nothing about the surface changes — which is exactly the state this roadmap was written to end. | Phase 2 converts the single number into three population counts, which is what makes the zero actionable; Phase 3 forces the framing choice to a named owner with a date rather than leaving it to accumulate. | Phase 1 — The census keeps being taken |
| 2 | The population split is drawn to make the zero look benign | implementation | 2.1 and 2.2 could be discharged by declaring almost all 299 skills "human-named by design", which would explain the zero away without a single check being able to object. | 2.1 requires each count to carry the command that produced it and to reconcile to 299; 2.3 then runs the claims gate over the result, so a population declared out of scope must not be one any surviving claim asserts selection over. | Phase 2 — Say what a zero census means for the surface |
| 3 | Phase 3 is read as authorization to build activation | implementation | "Build a host-side activation path" is a large, attractive piece of work that an autonomous run could start from the packet alone, committing the package to one of the two options before its owner has chosen. | The blocker states the reservation, 3.1's own text says the roadmap builds neither, and the goal's out-of-scope line names host-side activation explicitly; 3.1's verify is satisfied by the packet existing, never by an implementation. | Phase 3 — The framing decision reaches its owner |
| 4 | The transcript store is one machine's and the zero is an artifact of it | implementation | The census reads a local, gitignored store, so a zero could reflect this maintainer's usage rather than the package's behaviour — and a re-derived zero in CI would look like confirmation while measuring the same single source. | 1.1's verify requires the output to name the session and turn count it read, so a run over an empty or tiny store is visibly different from a run over 11,049 turns; 2.2 forces the claim to state the population it covers, which is what keeps a single-machine reading from being published as a general one. | Phase 1 — The census keeps being taken |

## Acceptance Criteria

- [x] AC-1 — `report_skill_activation` runs from a named Taskfile target and at release time, and its output states the session and turn count it read.
- [x] AC-2 — `src/config/gate-coverage.yml` carries a row for the census whose `argv` matches its invocation, and a deliberate mismatch fails `check_gate_coverage`.
- [x] AC-3 — The published census figure and its date are regenerated from a run, and a stale figure is distinguishable from a fresh one without reading git history.
- [x] AC-4 — Three population counts for the 299 skills are published with the commands that produced them, they reconcile to 299, and their overlap is named.
- [x] AC-5 — No surviving claim in `docs/CLAIMS.md` asserts automatic skill selection over a population larger than the one AC-4 counts.
- [~] AC-6 — A decision packet naming both framing options, their affected counts, and their falsifiers is in front of the owner, and no activation mechanism was built by this roadmap.
      <!-- deferred-resolution: carried-to=road-to-the-skill-surface-framing-choice -->
      Carried with 3.1. No activation mechanism was built. The packet exists in the receiver;
      what does not close here is Phase 3 as this roadmap's own scope.
