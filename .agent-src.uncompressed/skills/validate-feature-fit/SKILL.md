---
name: "validate-feature-fit"
description: "Validate whether a feature request fits the existing codebase — check for duplicates, contradictions, scope creep, and architectural misfit"
source: package
execution:
  type: assisted
  handler: internal
  allowed_tools: []
---

# Validate Feature Fit

## When to use

- The `improve-before-implement` rule detected a potential misfit
- User explicitly asks to validate a feature idea before implementing
- A feature request seems to overlap with existing functionality
- A requested approach contradicts established patterns

## Procedure

### 1. Understand the request

Read the feature description / user message. Extract:
- **Goal**: What should be achieved?
- **Scope**: What files/modules are affected?
- **Approach**: How does the user want it done?

### 2. Check for duplicates

Search the codebase for existing functionality that covers (partially or fully) the same goal:
- Services with similar names or methods
- Controllers handling similar routes
- Models with similar scopes or relations
- Existing tests covering similar behavior

**If duplicate found** → report with file references, suggest extending vs. duplicating.

### 3. Check for contradictions

Verify the request doesn't conflict with:
- Existing module boundaries (does it cross module lines?)
- Established patterns (does it introduce a new pattern where one exists?)
- Naming conventions (does it use different naming than the codebase?)
- Data flow (does it bypass existing services or repositories?)

**If contradiction found** → show the existing pattern, explain why it matters.

### 4. Check for scope creep

Evaluate if the request is:
- Bigger than it appears (hidden complexity, many affected files)
- Under-specified (missing error handling, edge cases, validation)
- Over-engineered (complex solution for simple problem)

**If scope concern** → quantify the impact (est. files, est. complexity).

### 5. Present findings

Format as a clear, concise summary:

```
## Feature Fit Analysis: [Feature Name]

### ✅ Fits well
- [What aligns with the codebase]

### ⚠️ Concerns
- [Concern 1 — with file reference]
- [Concern 2 — with evidence]

### Recommendation
> 1. Proceed as-is
> 2. Adjust approach — [brief suggestion]
> 3. Discuss further
```

## Output format

Always end with numbered options. The user should be able to reply with just a number.

## Gotchas

- Don't spend more than 2 minutes on this analysis — quick scan, not deep audit
- Don't block work — if no clear issues found, say "looks good" and proceed
- Don't challenge every request — only when there's actual evidence of misfit
- Don't nitpick — focus on structural/architectural concerns, not style

## Do NOT

- Do NOT refuse to implement after the user made their choice
- Do NOT repeat concerns the user already addressed
- Do NOT make this analysis visible when there are no concerns
- Do NOT run this on bug fixes, config changes, or trivial tasks
- Do NOT use this as a reason to delay work
