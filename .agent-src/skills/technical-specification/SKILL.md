---
recommended_model: inherit
name: technical-specification
description: "Use when the user says "write a spec", "create RFC", "write a PRD", or "document this decision". Writes technical specifications, PRDs, RFCs, and ADRs with clear structure."
domain: product
council_depth: deep
workspaces:
  - product
packs:
  - product-basic
trust:
  level: professional
install:
  removable: true
---

# technical-specification

## When to use

Use this skill when:
- Writing a technical specification for a new feature or system
- Writing a Product Requirements Document (PRD) when user pain leads and solution shape follows
- Creating an architecture decision record (ADR)
- Documenting a technical RFC (Request for Comments)
- Planning a significant technical change that needs team review

Do NOT use when:
- Trivial changes (a good PR description is enough)
- Implementation work (use `feature-planning` or `php-coder` skill)

## Procedure: Write a spec

### Technical Specification (full)

For complex features or systems. Stored in `agents/features/` or module `agents/features/`.

```markdown
# Technical Specification: {Title}

## Status
{ Draft | In Review | Approved | Implemented | Superseded }

## Summary
{2-3 sentences explaining what this spec proposes and why.}

## Problem
{What pain point or limitation does this address?}

## Goals
- {Specific, measurable goal}
- {Another goal}

## Non-Goals
- {What this spec explicitly does NOT cover}

## Proposed Solution

### Overview
{High-level description of the approach.}

### Detailed Design
{Technical details — data models, APIs, algorithms, flows.}

### Alternatives Considered
| Alternative | Pros | Cons | Why rejected |
|---|---|---|---|

## Migration Plan
{How to transition from current state to the proposed solution.}

## Risks and Mitigations
| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|

## Open Questions
- [ ] {Unresolved question}

## References
- {Links to related docs, tickets, or external resources}
```

### Product Requirements Document (PRD)

For features whose **shape is product-driven** rather than implementation-driven —
when "what users get" matters more than "how the code is wired". Use a PRD
when a Technical Specification would over-index on internals and under-index
on user value. Stored in `agents/features/` next to the technical spec when
both exist.

```markdown
# PRD: {Title}

## Status
{ Draft | In Review | Approved | Shipped | Parked }

## Problem
{The user-visible pain. One paragraph. Cite evidence — support tickets,
analytics, user quotes — not assumptions.}

## Success Criteria
- {Measurable outcome with a number and a timeframe}
- {Another measurable outcome}

## Non-Goals
- {What this PRD explicitly does NOT cover — protect scope}

## User Stories
- As a {role}, I want to {action}, so that {outcome}.
- As a {role}, I want to {action}, so that {outcome}.

## Major Modules
{The 3-7 functional building blocks the feature decomposes into. One
sentence each — what it does, not how. Implementation lives in the
technical spec, not here.}

- **{Module name}** — {one-sentence responsibility}
- **{Module name}** — {one-sentence responsibility}

## Open Questions
- [ ] {Unresolved product question — pricing, permission, copy, edge case}

## References
- {Links to research, related PRDs, technical spec when it exists}
```

**PRD vs Technical Specification — when to pick which:**

- **PRD first** when the user pain is clear but the solution shape is not
  ("users can't share dashboards" → PRD scopes the problem; spec follows).
- **Spec first** when the solution shape is clear but the implementation
  is non-trivial ("rebuild auth on OAuth2" → spec leads; PRD often skipped).
- **Both** when the feature is large enough that product and engineering
  decisions belong in different artifacts.

### Architecture Decision Record (ADR)

For significant technical decisions. Stored in `agents/decisions/`.

```markdown
# ADR-{number}: {Title}

## Status
{ Proposed | Accepted | Deprecated | Superseded by ADR-{N} }

## Context
{What is the issue? What forces are at play?}

## Decision
{What is the change that we're proposing or have agreed to implement?}

## Consequences

### Positive
- {Benefit}

### Negative
- {Drawback or tradeoff}

### Neutral
- {Other notable consequences}
```

### Lightweight RFC

For smaller decisions that need team input. Can be a PR description or a short doc.

```markdown
# RFC: {Title}

## Proposal
{What do you want to do?}

## Why
{Why is this needed?}

## How
{Brief technical approach.}

## Impact
{What does this change? Who is affected?}

## Open for feedback until: {date}
```

## Writing guidelines

### Be specific, not vague

```
❌ "The system should be fast"
✅ "API response time should be < 200ms at p95 for list endpoints"
```

### Include constraints

- Performance requirements (latency, throughput)
- Compatibility requirements (PHP version, browser support)
- Security requirements (authentication, data sensitivity)
- Scale requirements (data volume, concurrent users)

### Show your reasoning

Don't just present the solution — show **why** it was chosen over alternatives.
The "Alternatives Considered" section is often the most valuable part.

### Keep it actionable

A spec should be implementable by someone who wasn't in the original discussion.
If a developer reads only this document, they should be able to build it.

## Integration with other systems

- **Feature plans** reference specs when technical depth is needed.
- **Roadmaps** are generated from specs after approval.
- **ADRs** are referenced from `AGENTS.md` or module docs for historical context.
- **Sessions** link to the spec being implemented.

## Output format

1. Technical specification document with architecture decisions
2. API contracts, data models, and sequence diagrams
3. Implementation plan with dependencies

## Auto-trigger keywords

- technical spec
- PRD
- product requirements
- RFC
- ADR
- architecture decision

### Validate

- Verify every section of the spec template is filled in (no placeholders left).
- Confirm constraints and limitations are explicit, not implied.
- Check that the spec answers: What, Why, How, What not, and When.

## Gotcha

- A spec without constraints is fiction — always include technical limitations, timeline, and scope boundaries.
- The model tends to write specs that describe the ideal solution without acknowledging existing code.
- Don't write specs for trivial features — a spec is overhead that's only worth it for complex changes.

## Do NOT

- Do NOT write specs without researching the codebase first.
- Do NOT present only one option — always consider alternatives.
- Do NOT leave specs in "Draft" forever — push for a decision.
- Do NOT implement before the spec is reviewed (for significant changes).
