---
name: e2e-plan
description: "e2e-plan"
disable-model-invocation: true
---

# e2e-plan

## Instructions

### 1. Gather context

- Ask the user:

> 1. Which URL/page should be explored? (e.g., `http://localhost:3000/dashboard`)
> 2. Which feature area? (e.g., "checkout flow", "user settings", or "all visible flows")
> 3. Is there an existing seed/setup file? (e.g., `tests/e2e/fixtures/auth.ts`)

- Read the Playwright guideline: `.augment/guidelines/e2e/playwright.md`
- Check for existing test plans in `specs/` or `tests/e2e/specs/`.

### 2. Explore application

Playwright MCP → navigate, snapshot, identify interactive elements, map user journeys.

### 3. Design scenarios

Per flow: happy path, edge cases, error handling, negative tests.

### 4. Write the test plan

Save as a Markdown file (ask user for location, default: `specs/plan.md`).

Format:

```markdown
# [Feature Area] — E2E Test Plan

## Application Overview
Brief description of the page/feature and its core functionality.

## Test Scenarios

### 1. [Flow Name]
**Seed:** `tests/e2e/fixtures/[setup].ts`

#### 1.1 [Scenario Name]
**Steps:**
1. Navigate to [URL]
2. Click [element]
3. Fill in [field] with [value]
4. ...

**Expected Results:**
- [What should happen]
- [What should be visible]

#### 1.2 [Next Scenario]
...
```

### 5. Review — present summary, ask for missing/excluded flows, confirm.

### Rules

- Plan only, no test code. No modifying tests. Independent scenarios. Specific steps with expected results.
