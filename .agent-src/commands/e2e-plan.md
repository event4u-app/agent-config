---
name: e2e-plan
skills: [playwright-testing]
description: Explore the application and create a structured E2E test plan in Markdown
disable-model-invocation: true
suggestion:
  eligible: true
  trigger_description: "plan E2E tests for this feature, what should we cover in playwright"
  trigger_context: "new feature or page added without tests/e2e/ coverage"
---

# e2e-plan

## Instructions

### 1. Gather context

- Ask the user:

> 1. Which URL/page should be explored? (e.g., `http://localhost:3000/dashboard`)
> 2. Which feature area? (e.g., "checkout flow", "user settings", or "all visible flows")
> 3. Is there an existing seed/setup file? (e.g., `tests/e2e/fixtures/auth.ts`)

- Read the Playwright guideline: `../../docs/guidelines/e2e/playwright.md`
- Check for existing test plans in `specs/` or `tests/e2e/specs/`.

### 2. Explore the application

- Use Playwright MCP tools to navigate the target URL.
- Take a browser snapshot to understand the page structure.
- Identify all interactive elements: forms, buttons, links, modals, navigation.
- Map primary user journeys and critical paths.
- Consider different user roles and their typical behaviors.

### 3. Design test scenarios

For each discovered flow, create scenarios covering:

- **Happy path** — normal user behavior, expected outcomes
- **Edge cases** — boundary values, empty states, long inputs
- **Error handling** — validation errors, server errors, network failures
- **Negative tests** — unauthorized access, invalid data

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

### 5. Review with user

- Present a summary of discovered flows and scenario count.
- Ask if any flows are missing or should be excluded.
- Wait for the user's confirmation before finalizing.

### Rules

- **Do NOT generate test code** — this command only creates the plan.
- **Do NOT modify existing test files.**
- Each scenario must be independent — no shared state assumptions.
- Steps must be specific enough for any tester (human or agent) to follow.
- Always include both the action and the expected result.
- Reference seed files if test data setup is needed.
