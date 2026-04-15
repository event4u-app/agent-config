---
name: playwright-testing
description: "Use when writing Playwright E2E tests — browser automation, visual regression testing, Page Objects, fixtures, and reliable test patterns."
source: package
---

# playwright-testing

## When to use

Use this skill when:
- Writing end-to-end tests with Playwright
- Automating browser interactions for testing
- Setting up visual regression testing
- Using Playwright MCP for design reviews
- Debugging flaky E2E tests
- Configuring Playwright for CI/CD

**Guideline:** `.augment/guidelines/e2e/playwright.md` — full conventions, config templates, CI setup.
**Rule:** `.augment/rules/e2e-testing.md` — constraints enforced during E2E test work.

## Procedure: Write Playwright tests

1. **Read the guideline** — `.augment/guidelines/e2e/playwright.md` for detailed conventions.
2. **Check Playwright config** — `playwright.config.ts` for browsers, base URL, timeouts.
3. **Check existing tests** — match patterns in `tests/e2e/` or `e2e/`.
4. **Check test utilities** — look for page objects, fixtures, helpers.
5. **Check CI setup** — how are E2E tests run in the pipeline?

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

## Auto-trigger keywords

- Playwright
- E2E test
- browser automation
- visual regression
- end-to-end

## Gotcha

- Don't use `page.waitForTimeout()` as a fix — it masks the real problem and makes tests flaky.
- The model tends to use CSS selectors instead of semantic locators — always prefer `getByRole`, `getByLabel`.
- `test.fixme()` is for app bugs, `test.skip()` is for environment constraints — don't confuse them.
- After 3 failed fix attempts on one test, mark it `test.fixme()` and move on.

## Do NOT

- Do NOT skip assertions — every test must verify something meaningful.
- Do NOT share state between tests — each test should be independent.
- Do NOT hardcode URLs — use `baseURL` from config.
- Do NOT test implementation details — test user-visible behavior.
- Do NOT put assertions in Page Objects — assertions belong in test files.
- Do NOT commit `.only` — enforce via `forbidOnly: !!process.env.CI`.
