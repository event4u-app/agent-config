---
name: technical-specification
description: "Use when the user says "write a spec", "create RFC", or "document this decision". Writes technical specifications, RFCs, and ADRs with clear structure."
source: package
---

# technical-specification

## When to use

Specs, ADRs, RFCs for significant changes. NOT for: trivial (PR description enough), implementation (`feature-planning`/`coder`).

## Spec types

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

## Gotcha: no constraints = fiction, acknowledge existing code, don't spec trivial.

## Do NOT: spec without codebase research, one option only, perpetual draft, implement before review.
