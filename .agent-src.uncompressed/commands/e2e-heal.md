---
name: e2e-heal
skills: [playwright-testing]
description: Find, debug, and fix failing Playwright E2E tests
disable-model-invocation: true
suggestion:
  eligible: true
  trigger_description: "fix the failing E2E tests, playwright tests are red"
  trigger_context: "failing test output from tests/e2e/"
---

# e2e-heal

## Instructions

### 1. Identify failing tests

- Ask the user:

> 1. Run all E2E tests and fix whatever fails
> 2. Fix a specific test file — which one?
> 3. Fix tests that failed in CI — provide the CI run URL or error output

- Read the Playwright guideline: `../../docs/guidelines/e2e/playwright.md`

### 2. Run failing tests

- Execute the test(s) to see current errors:
  ```bash
  npx playwright test [file] --reporter=list 2>&1 | tail -30
  ```
- If all tests pass → report success and stop.
- List all failing tests with their error messages.

### 3. Debug each failure (one at a time)

For each failing test:

1. **Read the error** — understand what's expected vs. actual.
2. **Classify the failure**:

| Type | Symptom | Action |
|---|---|---|
| Selector changed | Element not found | Update locator (prefer semantic) |
| Timing issue | Timeout | Add proper waits or `waitForResponse` |
| Assertion mismatch | Expected ≠ Actual | Update expected value or test logic |
| App bug | Test is correct, app is broken | Mark `test.fixme()` |
| Data dependency | Missing test data | Fix seed/setup |
| Environment issue | Works locally, fails in CI | Check config, viewport, baseURL |

3. **Fix the test** — make the smallest change that resolves the issue.
4. **Verify** — re-run only the fixed test:
   ```bash
   npx playwright test [file] -g "test name"
   ```
5. **If it passes** → move to next failure.
6. **If it still fails** → try one more approach. After 3 failed attempts on the same test, mark as `test.fixme()`.

### 4. Handle unfixable tests

If a test fails because the **application** is broken (not the test):

```ts
test.fixme('should display avatar', async ({ page }) => {
  // BUG: Avatar endpoint returns 404 since API v2 migration.
  // TODO: Remove fixme when GALA-XXXX is resolved.
  await page.goto('/profile')
  await expect(page.getByRole('img', { name: 'Avatar' })).toBeVisible()
})
```

- Always add a comment explaining current vs. expected behavior.
- Ask the user if a bug ticket should be created.

### 5. Final verification

- Run all tests once more to confirm everything passes (or is properly marked `fixme`):
  ```bash
  npx playwright test --reporter=list
  ```
- Report results to the user.

### 6. Summary

Present a table:

```
| # | Test | Status | Action |
|---|---|---|---|
| 1 | login.spec.ts > should login | ✅ Fixed | Updated email locator |
| 2 | checkout.spec.ts > should pay | ✅ Fixed | Added waitForResponse |
| 3 | profile.spec.ts > should show avatar | ⚠️ fixme | App bug — avatar 404 |
```

### Rules

- **Fix one test at a time** — don't batch fixes.
- **Max 3 attempts per test** — then mark `test.fixme()` and move on.
- **Never use `waitForTimeout()`** as a fix — always find the proper wait condition.
- **Prefer updating locators** over adding retries.
- **Do NOT commit or push** unless the user asks.
- **Do NOT delete failing tests** — fix them or mark as `fixme`.
