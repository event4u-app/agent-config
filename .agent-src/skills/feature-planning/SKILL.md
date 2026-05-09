---
name: feature-planning
description: "Use when the user says "plan a feature", "brainstorm", "explore this idea", or wants to go from idea to structured plan and roadmap."
source: package
---

# feature-planning

## When to use

Use this skill when:
- The user has a feature idea they want to explore or plan
- An existing feature plan needs refinement
- A feature plan needs to be turned into actionable roadmaps

Do NOT use when:
- Bug fixes (use `bug-analyzer` skill)
- Simple, well-understood changes that don't need planning

## Procedure: Plan a feature

1. **Gather requirements** — What problem does this solve? Who benefits? What's the expected outcome?
2. **Analyze scope** — Which modules, routes, models, services are affected?
3. **Write the plan** — Create a feature plan document (see template below).
4. **Verify** — Confirm all affected areas are identified, no missing dependencies.

A **feature plan** captures the "what and why" of a feature:
- Problem it solves, who benefits, expected outcome
- Scope, affected modules, technical approach
- Open questions and decisions

A **roadmap** captures the "how and when" — the step-by-step implementation plan.
Feature plans and roadmaps are linked but separate concerns.

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

### Quick workflow (small features)

```
Explore → Plan → Refine → Roadmap → Implement
  ↑                ↑
  └── iterate ─────┘
```

| Phase | Command | Output |
|---|---|---|
| **Explore** | `/feature-explore` | Brainstorming notes, feasibility check, rough scope |
| **Plan** | `/feature-plan` | Structured feature doc in `agents/features/` |
| **Refine** | `/feature-refactor` | Updated feature doc with changes |
| **Roadmap** | `/feature-roadmap` | Roadmap(s) in `agents/roadmaps/`, linked from feature |

### Full workflow (complex features, 7 phases)

Use the full workflow for features that span multiple files, require architecture decisions,
or have unclear requirements. Trigger with `/feature:dev`.

```
Discovery → Exploration → Questions → Architecture → Implementation → Review → Summary
```

#### Phase 1: Discovery
- Clarify the feature request — what problem does it solve?
- Identify constraints, requirements, and affected users.
- **Understanding Lock (Hard Gate):** Summarize understanding in 5–7 bullets covering:
  what is being built, why, who it's for, key constraints, explicit non-goals.
- List all **assumptions** explicitly.
- **Wait for explicit confirmation before proceeding.** Do NOT design until confirmed.

#### Phase 2: Codebase Exploration
- Search for similar features in the codebase.
- Map the architecture and abstractions in the affected area.
- Identify key files, services, models, routes involved.
- Present findings with file references.

#### Phase 3: Clarifying Questions
- Review codebase findings against the feature request.
- Identify underspecified aspects: edge cases, error handling, integrations, backward compatibility.
- **Non-functional requirements** — explicitly clarify or propose defaults for:
  - Performance expectations (response time, throughput)
  - Scale (users, data volume, concurrent requests)
  - Security / privacy constraints
  - Reliability / availability needs
  - Maintenance and ownership expectations
- Present all questions in an organized list.
- **Wait for answers before proceeding.**

#### Phase 4: Architecture Design
- Design 2-3 implementation approaches with different tradeoffs:
  - **Minimal changes** — smallest change, maximum reuse.
  - **Clean architecture** — maintainability, elegant abstractions.
  - **Pragmatic balance** — speed + quality.
- Present comparison with pros/cons and a recommendation.
- **Ask the user which approach to use** (present as numbered options).

#### Phase 5: Implementation
- **Wait for explicit approval** before starting.
- Follow chosen architecture from Phase 4.
- Follow codebase conventions strictly.
- Track progress via task list or roadmap.

#### Phase 6: Quality Review
- Review the implementation for:
  - Simplicity, DRY, elegance.
  - Bugs and correctness.
  - Convention adherence.
- Present findings with severity levels.
- **Ask what to fix now vs. later.**

#### Phase 7: Summary
- Summarize what was built, key decisions, files modified.
- Suggest next steps (tests, documentation, follow-up features).
- Update roadmap if applicable.

## Decision log

Maintain a running **decision log** throughout the planning process. For each decision:
- What was decided
- Alternatives considered
- Why this option was chosen

Include the decision log in the feature plan file under a `## Decisions` section.
This ensures future developers (and agents) understand the reasoning, not just the outcome.

## Bite-sized task granularity (structural roadmaps only)

When a feature plan's generated roadmap declares `complexity: structural` in its frontmatter, every task bullet must be self-contained and 2–5 minutes of work. Lightweight roadmaps (the default) skip this section — coarse-grained tasks ("Add login endpoint", "Update tests") are correct when the work is well-scoped and low-risk.

Structural roadmap tasks must include:

1. **Exact file path** — `app/Modules/Auth/Services/LoginService.php`, never *"the login service"*.
2. **Complete code** — every method body, import, and signature ready to paste; no `// existing code` ellipses, no `…`.
3. **Exact command** — `php artisan migrate --path=database/migrations/2026_05_09_create_logins.php`, never *"run the migration"*.
4. **Expected output** — what success looks like (`Migrated: 2026_05_09_create_logins`) and the exit code.
5. **No placeholders** — angle-bracket placeholders, `TODO`, `FIXME`, `tbd`, and `???` are blockers; resolve before the task ships.

The complexity flag lives in the roadmap's YAML frontmatter:

```yaml
---
complexity: structural   # triggers bite-sized granularity
# or
complexity: lightweight  # default — skips bite-sized granularity
---
```

Source: adapted from `obra/superpowers` `writing-plans/SKILL.md` § Task Structure + § No Placeholders (v5.1.0); complexity-gating is our addition (Council Round 1, Q4 — mitigates UX pushback for senior engineers on well-scoped work).

## Self-review (3-scan checklist)

Before presenting any plan, run these three scans in order. Each is a fast pass — not a deep review. Failures block presentation; fix and re-scan.

1. **Spec coverage** — every requirement, AC bullet, or constraint from the input has a corresponding section / AC / scope item in the plan. Walk the input top-to-bottom; tick each requirement against the plan; missing items become open questions or new AC.
2. **Placeholder / TODO scan** — grep the draft for `<placeholder>`, `TODO`, `FIXME`, `tbd`, `???`, `XXX`. Either resolve them now or surface them in the *Open questions* section. No placeholder ships unflagged.
3. **Type / shape consistency** — proposed data structures, API shapes, file paths, and module names match existing codebase patterns. Cite at least one existing file per new structure as the convention anchor.

This scan is **separate from** adversarial-review (below). Self-review catches mechanical gaps (missing AC, leftover placeholders, mis-shaped types); adversarial-review challenges the plan's reasoning.

Source: adapted from `obra/superpowers` `writing-plans/SKILL.md` § Self-Review (v5.1.0).

## Adversarial self-review

After the 3-scan self-review passes, run the **`adversarial-review`** skill before presenting.
Focus on the "Feature plans / Architecture" attack questions. See that skill for the full process.

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

## Integration with other systems

### Sessions

```markdown
- **Feature:** `agents/features/my-feature.md`
```

### Roadmaps

Feature plans link to their roadmaps in the `## Roadmaps` section.
Roadmaps reference their source feature in the `## Context` section.

### Modules

If a feature is scoped to a single module, the feature plan and roadmaps live in the
module's `agents/` directory:
- Feature: `app/Modules/{Module}/agents/features/`
- Roadmaps: `app/Modules/{Module}/agents/roadmaps/`


## Behavior rules

### Research before planning

Before creating a feature plan, always:
1. **Search the codebase** for related code, existing patterns, and affected areas.
2. **Read module docs** if the feature touches a specific module.
3. **Check existing features** in `agents/features/` for overlap or dependencies.

### Be collaborative

- **Ask questions** — don't assume requirements.
- **Challenge scope** — suggest what can be deferred.
- **Show tradeoffs** — present options with pros/cons.
- **Validate feasibility** — check if the codebase supports the approach.

### Keep it navigational

Feature plans are decision documents, not implementation guides.
Implementation details belong in roadmaps.

## Output format

1. Feature plan document following the template structure
2. Decision log with rationale for key choices
3. Implementation roadmap with ordered tasks

## Auto-trigger keywords

- feature planning
- feature exploration
- feature roadmap
- requirements

## Gotcha

- Don't plan features without understanding the business context — ask the user before assuming.
- The model tends to over-engineer plans — start with the simplest viable solution.
- A plan without acceptance criteria is incomplete — always define what "done" means.
- Don't create plans for features that already exist — search the codebase first.

## Do NOT

- Do NOT create feature plans without user input — always collaborate.
- Do NOT skip codebase research — always check what exists.
- Do NOT put implementation steps in the feature plan — that's the roadmap's job.
- Do NOT commit or push without permission.
- Do NOT duplicate information from `AGENTS.md` or module docs.
