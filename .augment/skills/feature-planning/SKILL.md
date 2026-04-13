---
name: feature-planning
description: "Use when the user says "plan a feature", "brainstorm", "explore this idea", or wants to go from idea to structured plan and roadmap."
---

# feature-planning

## When to use

Feature ideas, plan refinement, plan→roadmap. NOT for: bugs (`bug-analyzer`), simple known changes.

## Concept: **feature plan** = what/why (problem, scope, approach, decisions). **Roadmap** = how/when (steps). Linked but separate.

## File structure

```
agents/features/                         # Project-wide feature plans
├── {feature-name}.md

app/Modules/{Module}/agents/features/    # Module-scoped feature plans
├── {feature-name}.md

.augment/templates/
└── features.md                          # Feature plan template
```

Roadmaps generated from features live in `agents/roadmaps/` (or module-level `agents/roadmaps/`).

## Feature lifecycle

### Quick: Explore → Plan → Refine → Roadmap → Implement

| Phase | Command | Output |
|---|---|---|
| Explore | `/feature-explore` | Brainstorming, feasibility |
| Plan | `/feature-plan` | Feature doc in `agents/features/` |
| Refine | `/feature-refactor` | Updated doc |
| Roadmap | `/feature-roadmap` | Roadmap in `agents/roadmaps/` |

### Full (7 phases, `/feature-dev`): Discovery (clarify, understanding lock, wait for confirmation) → Codebase Exploration (search similar, map area) → Questions (edge cases, NFRs, wait for answers) → Architecture (2-3 approaches, pros/cons, ask user) → Implementation (approved, track progress) → Quality Review (simplicity, bugs, conventions) → Summary (built, decisions, next steps).

## Decision log: what decided, alternatives, why. `## Decisions` section in feature plan.

## After plan: run `adversarial-review` skill.

## Feature plan format

See `.augment/templates/features.md` for the full structure. Key sections:

- **Problem** — What pain point does this solve?
- **Proposal** — What's the solution?
- **Scope** — What's in, what's out?
- **Affected Areas** — Which modules, models, services, routes?
- **Technical Approach** — High-level architecture decisions
- **Non-Functional Requirements** — Performance, scale, security, reliability
- **Decisions** — Decision log with alternatives and reasoning
- **Open Questions** — Unresolved decisions
- **Roadmaps** — Links to generated roadmap files

## Integration: sessions link features. Roadmaps ↔ features cross-reference. Module-scoped → `app/Modules/{Module}/agents/features/` + `agents/roadmaps/`.

## Before planning: search codebase, read module docs, check existing features. Be collaborative (ask, challenge scope, show tradeoffs). Plans = decisions, not implementation.

## Gotcha: understand business context first, simplest viable solution, define acceptance criteria, search before creating.

## Do NOT: create without user input, skip codebase research, implementation in feature plan (→ roadmap), commit/push without permission.
