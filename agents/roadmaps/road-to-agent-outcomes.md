# Roadmap: Engineering OS for Agents — the master frame

> **Enforce a senior working method. Don't try to boost the underlying
> model.** This roadmap positions the package as an *Engineering
> Operating System for Agents* and anchors three sub-roadmaps that
> build the operating system itself.

## Status

**Active frame, not a work plan.** This file sets vision, layers, and
scope. The actual phased work lives in the three sub-roadmaps listed
under "Sub-roadmaps" below.

## Prerequisites

- [x] [`road-to-defensive-agent.md`](road-to-defensive-agent.md) Waves 1-3 shipped — governance base is in place
- [x] [`road-to-stronger-skills.md`](road-to-stronger-skills.md) tier system defined — content-quality base is in place
- [x] [`road-to-trigger-evals.md`](road-to-trigger-evals.md) running — activation base is in place
- [x] `preservation-guard`, `skill-quality`, `augment-portability` rules active
- [x] PR #17 merged — path-fallback for ownership/patterns is consistent between docs and CI

## Principle — method over model

The package does **not** promise:

- Turning a smaller model into a bigger one
- Replacing a PO, a tester, or a senior engineer
- Autonomous delivery from a single-sentence prompt

The package **does** promise:

- Enforcing a disciplined working method so a capable model behaves
  like a structured staff engineer under that method
- Making the method reproducible across models and projects
- Carrying project-specific learnings forward as first-class input,
  not as prompt tweaks

Every artefact under this roadmap is judged by that promise.

## The four layers

The package is organized as four layers. Every existing and future
artefact maps to exactly one:

| Layer | What it contains | Existing anchors |
|---|---|---|
| **1. Governance** | Always-rules, confidence gating, evidence requirements, break-glass, scope control | `.agent-src.uncompressed/rules/*` |
| **2. Capability** | Skills, commands, guidelines — the how-to-do layer | `.agent-src.uncompressed/skills/*`, `commands/*`, `guidelines/*` |
| **3. Memory** | Project-specific facts the agent consults: ownership, historical bugs, domain invariants, architecture decisions, incident learnings, product rules | `templates/agents/*.yml` (ownership-map, historical-bug-patterns today) |
| **4. Execution** | CI gates, PR risk review, review routing, optional agent runtime hooks | `templates/github-workflows/*`, `templates/scripts/*` |

The layer model is a **maintenance tool**, not a marketing label. Its
job is to make "where does this new artefact belong?" answerable
without a committee.

## Sub-roadmaps

Each of the three sub-roadmaps owns one lever of the working-method
promise. None of them removes or replaces existing skills, rules, or
commands.

| Sub-roadmap | Layer focus | Lever |
|---|---|---|
| [`road-to-role-modes.md`](road-to-role-modes.md) | Capability + Governance | Explicit role modes (Developer, Reviewer, Tester, PO, Incident, Planner) with output contracts. Lets a smaller model stabilize its reasoning by loading the right frame instead of re-inventing it each task. |
| [`road-to-engineering-memory.md`](road-to-engineering-memory.md) | Memory | Expands the memory layer beyond `ownership-map` and `historical-bug-patterns` to `domain-invariants`, `architecture-decisions`, `incident-learnings`, `product-rules` — with an explicit adoption and maintenance story, not more unused schemas. Supported by [`road-to-project-memory.md`](road-to-project-memory.md) (settings + repo files, works standalone) and [`road-to-agent-memory-integration.md`](road-to-agent-memory-integration.md) (contract for the optional [`agent-memory/`](agent-memory/) package). |
| [`road-to-curated-self-improvement.md`](road-to-curated-self-improvement.md) | Governance + Capability | Closed-loop where the agent proposes rule/skill/pattern changes from project evidence, a human gate approves, and approved changes flow upstream via `upstream-contribute`. Replaces ad-hoc "I noticed this" with a reviewed pipeline. |

## Non-goals (explicit)

- **No** promise that Sonnet reaches Opus-level reasoning. The claim is
  *disciplined senior-like behaviour under the method*, not raw model uplift.
- **No** end-to-end "stakeholder prompt → merged PR" automation.
  Human gates for goal clarity, priority, and sign-off stay.
- **No** removal of existing skills, rules, or commands on the argument
  "a review said so". Removal follows `preservation-guard`.
- **No** bundled agent runtime. Execution layer hooks into the
  consumer's runtime; it does not ship one.
- **No** project-specific content in `.agent-src.uncompressed/`. Memory
  layer ships *schemas and templates*, consumer projects own the data.

## Open questions — carried forward from the PR #17 stub

These remain unresolved and belong to whichever sub-roadmap picks them up:

### Q1. Discoverability — "Top-5 for new teams"?

- Source: Claude review, GPT review #1 (PR #17)
- Status: *partially verified* — 59 commands, no curated starter list
- Home: likely [`road-to-role-modes.md`](road-to-role-modes.md) (role-default command sets)
- Not a reason to delete other commands

### Q2. Outcome measurement — how do we know a flow worked?

- Source: Opus review, GPT review #1 (PR #17)
- Status: *partially verified* — activation is measured, task
  completion is not
- Home: referenced from both [`road-to-curated-self-improvement.md`](road-to-curated-self-improvement.md)
  (improvement needs a success signal) and [`road-to-engineering-memory.md`](road-to-engineering-memory.md)
  (incident-learnings need closure data)
- Caveat: any number is a heuristic, not a KPI

### Q3. Killer-flow framing — is `/jira-ticket` underadvertised?

- Source: GPT review #1 (PR #17)
- Status: *opinion* — the flow exists; framing and adoption are the gap
- Home: picked up by [`road-to-role-modes.md`](road-to-role-modes.md)
  when defining role-default flows
- Not a mandate for a mega-command

### Q4. Runtime assumptions — which flows run autonomously?

- Source: GPT review #1 (PR #17)
- Status: *opinion* — depends on consumer setup
- Home: [`runtime-layer.md`](../../.agent-src.uncompressed/guidelines/agent-infra/runtime-layer.md)
  guideline already covers part of this; extension belongs in the
  Execution layer, not in a new roadmap

## Acceptance criteria for this frame

The master frame is "holding" when:

1. Every new artefact PR names its layer (Governance / Capability / Memory / Execution) in the description
2. The three sub-roadmaps each have at least one shipped phase
3. No PR is merged that contradicts the "method over model" principle
4. The open questions Q1-Q4 are each either closed or explicitly
   re-homed in a sub-roadmap

## See also

- [`open-questions.md`](open-questions.md) — **decision queue** across all active roadmaps (triage of blockers, 2026-04-22)
- [`road-to-defensive-agent.md`](road-to-defensive-agent.md) — Governance base, not replaced
- [`road-to-stronger-skills.md`](road-to-stronger-skills.md) — Capability-quality base, not replaced
- [`road-to-trigger-evals.md`](road-to-trigger-evals.md) — Activation base, extended under Q2
- [`road-to-autonomous-agent.md`](road-to-autonomous-agent.md) — Execution-layer history (judges, dispatchers)
