---
name: playwright-testing
description: "Use when writing Playwright E2E tests — browser automation, visual regression testing, Page Objects, fixtures, and reliable test patterns."
---

# playwright-testing

## When to use

E2E tests, browser automation, visual regression, Playwright MCP, flaky tests, CI config.

See: `.augment/guidelines/e2e/playwright.md` (conventions), `.augment/rules/e2e-testing.md` (constraints).

## Before: guideline, `playwright.config.ts`, existing tests, utilities/page objects, CI setup.

## Test structure

```ts
import { test, expect } from '@playwright/test'

test.describe('User Authentication', () => {
  test('should login with valid credentials', async ({ page }) => {
    await page.goto('/login')
    await page.getByLabel('Email').fill('user@example.com')
    await page.getByLabel('Password').fill('password123')
    await page.getByRole('button', { name: 'Sign in' }).click()

    await expect(page).toHaveURL('/dashboard')
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()
  })

  test('should show error for invalid credentials', async ({ page }) => {
    await page.goto('/login')
    await page.getByLabel('Email').fill('wrong@example.com')
    await page.getByLabel('Password').fill('wrong')
    await page.getByRole('button', { name: 'Sign in' }).click()

    await expect(page.getByText('Invalid credentials')).toBeVisible()
  })
})
```

## Locator strategies (priority order)

| Strategy | Example | When to use |
|---|---|---|
| **Role** | `getByRole('button', { name: 'Submit' })` | Default — most accessible |
| **Label** | `getByLabel('Email')` | Form inputs |
| **Text** | `getByText('Welcome')` | Visible text content |
| **Placeholder** | `getByPlaceholder('Search...')` | Input placeholders |
| **Test ID** | `getByTestId('submit-btn')` | Last resort — when no semantic locator works |
| **CSS** | `page.locator('.my-class')` | Avoid — brittle |

**Prefer semantic locators** (`getByRole`, `getByLabel`) over CSS selectors.

## Reliable test patterns

### Wait for network idle

```ts
// Wait for page to fully load
await page.goto('/dashboard', { waitUntil: 'networkidle' })

// Wait for specific API response
await page.waitForResponse(resp =>
  resp.url().includes('/api/users') && resp.status() === 200
)
```

### Assertions with auto-retry

```ts
// ✅ Auto-retrying assertions (Playwright retries until timeout)
await expect(page.getByText('Success')).toBeVisible()
await expect(page.getByRole('list')).toHaveCount(5)

// ❌ Non-retrying — can be flaky
const text = await page.textContent('.message')
expect(text).toBe('Success')
```

### Page Object Model

```ts
// pages/LoginPage.ts
export class LoginPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto('/login')
  }

  async login(email: string, password: string) {
    await this.page.getByLabel('Email').fill(email)
    await this.page.getByLabel('Password').fill(password)
    await this.page.getByRole('button', { name: 'Sign in' }).click()
  }
}
```

## Visual regression testing

```ts
test('homepage visual regression', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveScreenshot('homepage.png', {
    maxDiffPixelRatio: 0.01,
  })
})
```

- Screenshots are stored in `tests/*.png` (or configured path).
- First run creates baseline screenshots.
- Subsequent runs compare against baselines.
- Update baselines: `npx playwright test --update-snapshots`.

## Viewport testing

```ts
test.describe('Responsive design', () => {
  for (const viewport of [
    { width: 1440, height: 900, name: 'desktop' },
    { width: 768, height: 1024, name: 'tablet' },
    { width: 375, height: 812, name: 'mobile' },
  ]) {
    test(`renders correctly on ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize(viewport)
      await page.goto('/')
      await expect(page).toHaveScreenshot(`home-${viewport.name}.png`)
    })
  }
})
```

## Debugging

```bash
# Run with headed browser (see what's happening)
npx playwright test --headed

# Run with Playwright Inspector (step through)
npx playwright test --debug

# View test report
npx playwright show-report

# Run specific test
npx playwright test -g "should login"
```

## Avoiding flaky tests

| Problem | Solution |
|---|---|
| Element not ready | Use auto-retrying assertions (`toBeVisible`, `toHaveText`) |
| Animation interference | Use `page.evaluate(() => document.body.style.setProperty('--transition-duration', '0s'))` |
| Network timing | Wait for specific responses, not arbitrary timeouts |
| Test isolation | Use fresh browser context per test (Playwright default) |
| Shared state | Reset database/state before each test |

## Authentication pattern

```ts
// Use storageState to avoid logging in via UI in every test
// auth.setup.ts
import { test as setup } from '@playwright/test'

setup('authenticate', async ({ page }) => {
  await page.goto('/login')
  await page.getByLabel('Email').fill(process.env.TEST_USER_EMAIL!)
  await page.getByLabel('Password').fill(process.env.TEST_USER_PASSWORD!)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await page.waitForURL('/dashboard')
  await page.context().storageState({ path: '.auth/user.json' })
})
```

```ts
// playwright.config.ts — use storage state in projects
projects: [
  { name: 'setup', testMatch: /.*\.setup\.ts/ },
  {
    name: 'chromium',
    use: { ...devices['Desktop Chrome'], storageState: '.auth/user.json' },
    dependencies: ['setup'],
  },
]
```

## Network mocking

```ts
// Mock API responses for isolated testing
await page.route('**/api/users', route =>
  route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify([{ id: 1, name: 'Test User' }]),
  })
)
```

## Gotcha: no `waitForTimeout` (masks problems), semantic locators over CSS, `test.fixme()` = app bugs / `test.skip()` = env, 3 failures → `test.fixme()`.

## Do NOT: skip assertions, share state, hardcode URLs, test implementation, assertions in Page Objects, commit `.only`.
