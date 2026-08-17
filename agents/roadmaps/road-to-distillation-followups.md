---
complexity: lightweight
---

# Road to the distillation follow-ups — two maintainer-gated items, relocated intact

> Successor to `road-to-inbox-harvest-distillation`, which reached
> `count_open == 0` with one deferred step and two open blockers. Iron Law 3
> forbids archiving a roadmap that still carries `[~]` work, and the archival
> sweep additionally refuses one with open blockers — correctly, because both
> are how planned work gets buried.
>
> This file exists so neither gets buried. The step and both blockers are
> carried over **verbatim in substance**: nothing here is newly decided, nothing
> is quietly dropped, and the predecessor archives honestly because its
> remaining work has an owner rather than because the work stopped mattering.

## Why relocation rather than a decision

Both items are maintainer calls of a kind an agent should not take:

- The retrofit is gated on an instrument that **does not exist** — and building
  it means observing what a host loads on skill trigger, which nothing in this
  tree can see. Proceeding without it would be deciding on an unmeasurable
  premise, which is exactly what ADR-202 forbids.
- The analysis run **spends** on external fetches and produces raw named
  evidence that `source-confidentiality` keeps local-only unless anonymised.

Neither is blocked on effort. Both are blocked on a call, and relocating them
is the only move that neither fakes the call nor loses the item.

## Phase 1 — The router-head retrofit

- [ ] **Step 1: Retrofit the four offenders.** Restructure the `SKILL.md`
      files that exceed the published K6 cap into an entry head (when-to-use,
      mode table, routing) plus its detail, per the router-head contract that
      already shipped as Phase 4.1 of the predecessor. Blocked — see
      `blocker: router-head-retrofit-instrument`.
      **Count corrected 2026-08-14: four, not three.** `lint_skill_router_head`
      reports *"4 over the 400-line cap, all grandfathered or routed · allowlist
      holds 4 entry(ies), shrink-only"*, and `GRANDFATHERED` in
      `src/scripts/lint_skill_router_head.ts:60-65` names them with their
      measured line counts — `ai-council` (1055), `skill-writing` (767),
      `roadmap-management` (552), `quality-tools` (445). The allowlist is
      shrink-only, so retrofitting three and closing this step would leave the
      fourth entry unremovable and the step falsely done.
      <!-- verify: ./scripts-run src/scripts/lint_skill_router_head -->

  > **`quality-tools` at 445 is the one to check first, not last.** It is 45
  > lines over a 400-line cap, i.e. the only offender where the retrofit might
  > be a section move rather than a restructure — and if the instrument (see the
  > blocker) ever arrives, the smallest offender is where a before/after reading
  > is cheapest to take and least likely to be confounded by the restructure
  > itself.

**Falsifier.** The instrument arrives and its first before/after reading shows
no measurable difference on one skill → the retrofit is not worth its churn;
cancel this phase and record the reading, because a restructure that costs
review attention and buys nothing is worse than the cap being unmet on paper.

**Rollback.** Four skill files; the contract itself is already shipped and
unaffected.

## Phase 2 — The untested contract path

- [ ] **Step 1: Run `/analyze:reference-repo` end to end under its own §5b
      convergence contract** against a small reference, and land the evidence
      artefact. Blocked — see `blocker: first-contract-true-analysis-run`.

**Falsifier.** The run shows the §5b contract cannot converge on a real
reference (the verdict table never stops flipping within its four-pass cap) →
the contract is wrong rather than untested, and this becomes a fix to the
command instead of an evidence gap.

**Rollback.** One evidence artefact.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-08-13 | reviewer: claude/host -->
| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | A relocation roadmap that is really a graveyard | product | Moving two blocked items into a new file discharges the predecessor's gates without advancing either item. If nobody ever returns, the relocation has bought archival tidiness at the cost of a second file nobody reads — which is worse than the honest red it replaced | Both phases carry a falsifier that can DELETE them on evidence rather than only on completion, and each blocker keeps its original `Resolved when` verbatim, so the condition that would restart the work is unchanged and checkable | Phase 1, Phase 2 |
| 2 | The carried-over text drifts from what the predecessor argued | implementation | Substance restated in a new file is substance that can be paraphrased into something slightly different, and the predecessor is archived where nobody will diff it | The blockers below are copied unchanged including their `What to do` and `Resolved when` fields, and the predecessor's step note is quoted rather than summarised | Blockers |

## Blockers

### blocker: router-head-retrofit-instrument
- **Status:** open
- **Owner:** maintainer
- **Class:** 2 — consent-once
- **Blocks:** Phase 1 Step 1 only.
- **What to do:** either supply an instrument that observes what the host
  actually loads on skill trigger (no such observation exists in this tree
  today), or decide explicitly that the published K6 cap is reason enough to
  restructure the three offenders without a token claim.
- **Resolved when:** an instrument exists and has produced a before/after
  reading on one skill, **or** a maintainer decision is recorded that the
  contract alone justifies the retrofit.

### blocker: first-contract-true-analysis-run
- **Status:** open
- **Owner:** maintainer
- **Class:** 2 — consent-once
- **Blocks:** Phase 2 Step 1 only.
- **What to do:** run the command against a small reference and land the
  evidence artefact. Two things make this a maintainer call rather than an
  autonomous step: it spends on external fetches, and its output is raw named
  evidence, which `source-confidentiality` keeps local-only unless anonymised.
- **Resolved when:** one evidence artefact exists that was produced by the
  command rather than by an ad-hoc pass.

## Non-goals

- **No new decisions.** This file relocates two items and decides neither.
- **No re-derivation of the predecessor's evidence** — its Context section
  stays authoritative and is archived, not deleted.
