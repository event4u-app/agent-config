---
type: "auto"
alwaysApply: false
description: "Playwright E2E tests — locators, assertions, Page Objects, fixtures, CI, and flaky test prevention"
source: package
---

# E2E Testing

## Before writing

1. Read `.augment/guidelines/e2e/playwright.md`
2. Check existing tests — match structure, fixtures, Page Objects
3. Check `playwright.config.ts` — base URL, browsers, timeouts

## Locators

- Prefer: `getByRole` > `getByLabel` > `getByText` > `getByTestId` > CSS
- Never: auto-generated classes, dynamic IDs, XPath
- No semantic locator → add `data-testid`

## Assertions

- Web-first assertions only (`toBeVisible`, `toHaveText`, `toHaveURL`)
- Never `expect(await ...)` — no auto-retry
- Never `page.waitForTimeout()` — wait for condition

## Test structure

- One test = one workflow/behavior
- Fully isolated — no shared state, no order dependency
- Page Objects = actions only, no assertions
- Fixtures for reusable setup
- API calls for test data (not UI)

## CI

- `workers: 1`, `retries: 2` (CI) / `0` (local)
- `forbidOnly: !!process.env.CI`
- `trace: 'on-first-retry'`
- Install only needed browsers
- Upload `playwright-report/` as artifact

## Quality checks

1. All tests pass: `npx playwright test`
2. No `waitForTimeout`
3. No CSS/XPath where semantic locators work
4. No `.only` left
5. Page Objects have no assertions
