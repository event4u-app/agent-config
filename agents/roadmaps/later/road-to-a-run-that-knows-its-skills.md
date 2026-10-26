---
complexity: lightweight
status: later
review_by: 2027-01-31
tree_pin: 01bb841cbd
entry_condition:
  what: >
    Two readings exist. (i) `road-to-a-plan-that-stays-true` Phase 4 is on main,
    so a step's `uses:` line is read back from tool events. (ii) The shadow window
    of `obligation-settle` owned by `road-to-a-stop-that-holds-carried` has been
    read (window end 2026-10-29), so a second stop concern is not built on top of
    a first one that never wrote a row.
  when: >
    Producer-driven. (i) lands with the active file; (ii) is dated by its owner.
  who: >
    An implementer for Phases 1-3. ADR-263 is not reopened: the owner narrowed
    Phase 2 to declared skills instead (OQ-14, 2026-10-26).
estate_growth_exempt: "+1 later_roadmaps on 2026-10-25, round inbox-2026-10-at: topic 1 asks that the base skills of a run are determined once at the start and enforced, extendable during the run. No roadmap owns a run basis or a skill stop gate — the same search as road-to-a-plan-that-stays-true's offset claim plus `grep -rlniE 'run.basis|skill-settle|forced.verdict' agents/roadmaps` returned nothing. It cannot start now: the active estate is at its cap with that file, and its entry condition names two readings that do not exist yet. Parked rather than added active, per the owner directive of 2026-10-24."
execution:
  mode: phase-checkpoints
relates:
  - slug: road-to-a-plan-that-stays-true
    relation: depends
    note: "Its Phase 4 parses `uses:` and reads applied skills from tool events; this file binds a run to that plan."
  - slug: road-to-a-stop-that-holds-carried
    relation: disjoint
    note: "Owns `obligation-settle` for rules. This file adds a skill concern beside it, never inside the turn-end gate."
depends: road-to-a-plan-that-stays-true
---
# Road to a run that knows its skills

> **Source:** `agents/tmp.old/inbox-2026-10-at/` — topic 1, programme S of the
> supplied master plan, verified at `main@01bb841cb`.
>
> **Owner decision, 2026-10-26 (OQ-14):** Phase 2 is narrowed, ADR-263 stands.
> A run basis holds only skills that are declared — a step's `uses:`, a
> command's `required` skills, a flow's skills — never ranked candidates, and
> nothing is enforced on a skill nobody declared. A census over all 11 store
> slugs (`agents/evidence/metrics/skill-activation-census-all-slugs-2026-10-26.md`)
> did not fire ADR-263's review trigger (AI council 2026-10-26, 2/2); the
> directive is `agents/evidence/owner-directives/2026-10-26-owner-questions-14-15-16.md`.

## Goal

A run — a command, a `/work` run, or a roadmap lane — determines its base skills
once at its start, from what is declared (the step's `uses:`, the command's
required skills, the flow) and from nothing ranked; keeps at most three loaded;
may add more during the run; and ends with every required skill either applied
or waived with a reason from the closed set. The gate measures the outcome, not
an activation rate.

## Context

- 150 commands declare `skills:`, and no hook reads the field; the field mixes
  required and related skills (55 fully referenced in the body, 24 partly, 71 not
  at all, per the supplied plan's census, re-counted in Phase 1).
- The ranker is not fit to impose a skill: top-1 0.208 on the labelled corpus,
  and 153 of 315 labelled prompts deliberately have no skill answer. A hard
  "at least one skill per run" would force fake invocations.
- "At least one rule applied" is trivially true for always-loaded rules and not
  observable for 69 of 97 delivered rules; rules stay with `rule-inject` and
  `obligation-settle`.

## Phase 1 — Truth before building

Evidence (claimed): `src/scripts/hooks/skill_route_hook.ts:14`

- [ ] **1.1 Census over every store slug of this repository.** Main checkout and
      every worktree slug, no session limit, as a new dated record; this is the
      population ADR-263's zero is read from (see stub
      `road-to-a-census-that-refuses-a-partial-store`).
      verify: the record names every slug read and the session count per slug
- [ ] **1.2 Generated `required | related` classification per declared skill.**
      A skill referenced in the command body is `required`; the artefact is
      generated and drift-checked like the other generated files.
      verify: `./scripts-run src/scripts/classify_command_skills --check` -> 0 — the unclassified share printed; above 20 % it exits 1 and the step stops

## Phase 2 — The run basis

Evidence (claimed): `src/scripts/hooks/skill_route_hook.ts:32`

- [ ] **2.1 Run start and persistence.** A command expansion, a `/work` start or
      a lane start opens a run; conversation does not. The basis is stored as
      `{skill, class: required, source: roadmap|command|flow, run}`
      with the same `run` id the closure and the retro read.
      verify: fixtures — a conversation opens no run; a command, a `/work` start and a lane each open one
- [ ] **2.2 Resolver: `skill-route` extended, not twinned.** Order: the step's
      `uses:`, then `required`, then flow skills; cap three, required first. No
      ranked candidate enters the basis — the ranker may still suggest, and a
      suggestion binds nothing (OQ-14). Kernel rules and rules never in the basis.
      verify: fixture — a step `uses:` outranks a command's required skill when the cap is hit
- [ ] **2.3 Forced verdict per required skill.** One line `skill <id>: yes | no —
      <reason>` per required skill in the basis; a waiver only with a reason
      from the closed set of `road-to-a-plan-that-stays-true` 4.1. A waiver is
      text, an application is a tool event.
      verify: parser fixtures in German and English; an unlisted skill does not count

## Phase 3 — The gate, in shadow first

Evidence (claimed): `src/scripts/hooks/host_lowering.yaml:107`

- [ ] **3.1 `skill-settle` on `stop`, outside the turn-end gate.** A required
      skill with neither application nor waiver is `missing`. Nothing outside the
      declared basis is judged. Shadow only; on Claude Code it later holds
      once per run with the concrete list, then records `waived-by-exhaustion`.
      Other hosts only record.
      verify: fixtures — applied allows, closed-reason waiver allows, neither writes a shadow `missing` row, a second stop records `waived-by-exhaustion`
- [ ] **3.2 Subagents inherit the basis.** The subagent capsule carries the run
      basis; a worker's application discharges the parent's entry.
      verify: fixture — a worker applying a required skill clears the parent's `missing`

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-10-25 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | Goodhart through waivers | product | every candidate answered "no" to pass the gate | closed waiver reasons for required skills; the outcome, not the activation rate, is measured | Phase 2 — The run basis |
| 2 | A silent instrument | implementation | the gate reads a ledger nobody writes | entry condition (ii); shadow before any hold | Phase 3 — The gate, in shadow first |

## Acceptance Criteria

- [ ] AC-1 — A run's required skills end applied or waived with a closed reason,
      read from tool events, on every host that records them.
- [ ] AC-2 — No run is held for a skill the ranker alone proposed.
