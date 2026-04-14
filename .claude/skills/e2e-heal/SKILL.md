---
name: e2e-heal
description: "Run E2E tests and fix failing ones"
disable-model-invocation: true
---

# e2e-heal

## Instructions

### 1. Identify failing tests

> 1. Run all E2E tests and fix whatever fails
> 2. Fix a specific test file — which one?
> 3. Fix tests that failed in CI — provide the CI run URL or error output

Read `.augment/guidelines/e2e/playwright.md`.

### 2. Run failing tests
  ```bash
  npx playwright test [file] --reporter=list 2>&1 | tail -30
  ```
All pass → stop. Otherwise per failure:

### 3. Debug each failure

| Type | Symptom | Action |
|---|---|---|
| Selector changed | Element not found | Update locator (prefer semantic) |
| Timing issue | Timeout | Add proper waits or `waitForResponse` |
| Assertion mismatch | Expected ≠ Actual | Update expected value or test logic |
| App bug | Test is correct, app is broken | Mark `test.fixme()` |
| Data dependency | Missing test data | Fix seed/setup |
| Environment issue | Works locally, fails in CI | Check config, viewport, baseURL |

Smallest fix → verify:
   ```bash
   npx playwright test [file] -g "test name"
   ```
Pass → next. 3 failed attempts → `test.fixme()`.

### 4. Unfixable tests (app bug)

```ts
test.fixme('should display avatar', async ({ page }) => {
  // BUG: Avatar endpoint returns 404 since API v2 migration.
  // TODO: Remove fixme when GALA-XXXX is resolved.
  await page.goto('/profile')
  await expect(page.getByRole('img', { name: 'Avatar' })).toBeVisible()
})
```

Add comment explaining behavior. Ask about bug ticket.

### 5. Final verification
  ```bash
  npx playwright test --reporter=list
  ```
### 6. Summary

```
| # | Test | Status | Action |
|---|---|---|---|
| 1 | login.spec.ts > should login | ✅ Fixed | Updated email locator |
| 2 | checkout.spec.ts > should pay | ✅ Fixed | Added waitForResponse |
| 3 | profile.spec.ts > should show avatar | ⚠️ fixme | App bug — avatar 404 |
```

### Rules

- One at a time. Max 3 attempts → `test.fixme()`. No `waitForTimeout()`.
- Prefer locator updates. No commit/push unless asked. No deleting tests.
