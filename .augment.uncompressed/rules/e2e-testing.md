---
type: "auto"
alwaysApply: false
description: "Playwright E2E tests — locators, assertions, Page Objects, fixtures, CI, and flaky test prevention"
---

# E2E Testing

## Before writing E2E tests

1. **Read the guideline** — `.augment/guidelines/e2e/playwright.md` for all conventions and patterns.
2. **Check existing tests** — match the project's structure, fixtures, and Page Object patterns.
3. **Check `playwright.config.ts`** — base URL, browsers, timeouts, projects.

## Locator rules

- **Always prefer semantic locators**: `getByRole` > `getByLabel` > `getByText` > `getByTestId` > CSS.
- Never use auto-generated class names, dynamic IDs, or XPath.
- If no semantic locator works, add a `data-testid` to the component.

## Assertion rules

- **Always use web-first assertions** (`toBeVisible`, `toHaveText`, `toHaveURL`).
- Never use `expect(await ...)` pattern — it doesn't auto-retry.
- Never use `page.waitForTimeout()` — wait for a condition instead.

## Test structure rules

- One test = one user workflow or behavior.
- Tests must be **fully isolated** — no shared state, no execution order dependency.
- Page Objects contain **actions only**, never assertions.
- Use **fixtures** for reusable setup (auth, page objects, test data).
- Use **API calls** for test data setup — faster and more reliable than UI interactions.

## CI rules

- Set `workers: 1` in CI for stability.
- Set `retries: 2` in CI, `0` locally.
- Set `forbidOnly: !!process.env.CI` to prevent `.only` in CI.
- Collect `trace: 'on-first-retry'` — not on every run.
- Only install browsers you need (`npx playwright install chromium --with-deps`).
- Upload `playwright-report/` as CI artifact.

## Quality checks

Before claiming E2E tests are complete:

1. All tests pass locally: `npx playwright test`
2. No `waitForTimeout` calls in the code.
3. No CSS/XPath selectors where semantic locators work.
4. No `.only` left in test files.
5. Page Objects have no assertions.
