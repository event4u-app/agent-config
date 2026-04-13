# Playwright E2E Guidelines

**Skills:** `playwright-testing` | **Guidelines:** [php.md](../php/php.md)

## Project Structure

```
tests/
  e2e/
    fixtures/           # Custom fixtures (auth, data, etc.)
    pages/              # Page Object Models
    specs/              # Test files grouped by feature
      auth/
        login.spec.ts
        logout.spec.ts
      dashboard/
        overview.spec.ts
    helpers/            # Shared utilities (API helpers, test data)
playwright.config.ts    # Root config
```

Group by feature area. One spec per workflow. POs in `pages/`, fixtures in `fixtures/`.

## Locator Strategy

| Priority | Locator | Example | When |
|---|---|---|---|
| 1 | **Role** | `getByRole('button', { name: 'Save' })` | Default — most accessible and resilient |
| 2 | **Label** | `getByLabel('Email')` | Form inputs with labels |
| 3 | **Placeholder** | `getByPlaceholder('Search...')` | Inputs without visible labels |
| 4 | **Text** | `getByText('Welcome back')` | Static visible content |
| 5 | **Test ID** | `getByTestId('submit-btn')` | When no semantic locator works |
| 6 | **CSS/XPath** | `page.locator('.class')` | **Avoid** — brittle, breaks on UI changes |

Prefer semantic > `data-testid` > CSS. Chain to narrow scope. Never auto-generated IDs.

## Assertions (web-first, auto-retrying)

```ts
// ✅ Auto-retrying — waits until condition is met
await expect(page.getByText('Success')).toBeVisible()
await expect(page.getByRole('list')).toHaveCount(5)
await expect(page).toHaveURL('/dashboard')

// ❌ Non-retrying — flaky
const text = await page.textContent('.message')
expect(text).toBe('Success')
```

### Soft assertions

```ts
await expect.soft(page.getByTestId('status')).toHaveText('Active')
await expect.soft(page.getByTestId('count')).toHaveText('42')
// Test continues even if soft assertions fail
```

## Waiting

```ts
// ✅ Wait for specific conditions
await page.waitForResponse(resp => resp.url().includes('/api/users') && resp.status() === 200)
await expect(page.getByText('Loaded')).toBeVisible()

// ❌ Never use fixed timeouts
await page.waitForTimeout(3000)
```

Never `waitForTimeout()`. Trust auto-waiting. `networkidle` sparingly.

## Page Object Model

```ts
// pages/LoginPage.ts
import { type Page, type Locator } from '@playwright/test'

export class LoginPage {
  private readonly emailInput: Locator
  private readonly passwordInput: Locator
  private readonly submitButton: Locator

  constructor(private readonly page: Page) {
    this.emailInput = page.getByLabel('Email')
    this.passwordInput = page.getByLabel('Password')
    this.submitButton = page.getByRole('button', { name: 'Sign in' })
  }

  async goto(): Promise<void> {
    await this.page.goto('/login')
  }

  async login(email: string, password: string): Promise<void> {
    await this.emailInput.fill(email)
    await this.passwordInput.fill(password)
    await this.submitButton.click()
  }
}
```

One PO per page/component. Locators in constructor. Methods = user actions.

## Test Data (API-based preferred)

```ts
test.beforeEach(async ({ request }) => {
  // Create test data via API — faster than UI
  await request.post('/api/test/seed', { data: { scenario: 'basic-customer' } })
})

test.afterEach(async ({ request }) => {
  await request.post('/api/test/cleanup')
})
```

API > UI for setup. Seeded accounts. No cross-test data deps.

## Configuration

```ts
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e/specs',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['html', { open: 'never' }],
    ...(process.env.CI ? [['github'] as const] : []),
  ],
  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
    { name: 'mobile-chrome', use: { ...devices['Pixel 5'] } },
    { name: 'mobile-safari', use: { ...devices['iPhone 13'] } },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
  },
})
```

### Key settings

| Setting | Local | CI | Why |
|---|---|---|---|
| `workers` | Auto (CPU cores) | `1` | Stability over speed in CI |
| `retries` | `0` | `2` | Catch flakes in CI, fail fast locally |
| `trace` | `off` | `on-first-retry` | Traces are expensive, only collect on failure |
| `fullyParallel` | `true` | `true` | Tests must be isolated anyway |
| `forbidOnly` | `false` | `true` | Prevent `.only` from reaching CI |

## CI Integration (GitHub Actions)

```yaml
name: E2E Tests
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  e2e:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - run: npx playwright install chromium --with-deps
      - run: npx playwright test
      - uses: actions/upload-artifact@v4
        if: ${{ !cancelled() }}
        with:
          name: playwright-report
          path: playwright-report/
          retention-days: 14
```

### Sharding for large suites

```yaml
strategy:
  matrix:
    shard: [1, 2, 3, 4]
steps:
  - run: npx playwright test --shard=${{ matrix.shard }}/4
```

Only install needed browsers. Linux runners. Upload reports. Shard when >5min.

## Visual Regression

```ts
test('dashboard layout', async ({ page }) => {
  await page.goto('/dashboard')
  await expect(page).toHaveScreenshot('dashboard.png', {
    maxDiffPixelRatio: 0.01,
    fullPage: true,
  })
})
```

Baselines in VCS. Update: `--update-snapshots`. Pin OS+browser in CI.

## Avoiding Flaky Tests

| Problem | Solution |
|---|---|
| Element not ready | Use auto-retrying assertions (`toBeVisible`, `toHaveText`) |
| Animation interference | Disable transitions: `page.addStyleTag({ content: '*, *::before, *::after { transition: none !important; animation: none !important; }' })` |
| Network timing | Wait for specific responses, not arbitrary timeouts |
| Test isolation | Fresh browser context per test (default) |
| Shared state | Reset data via API before each test |
| Date/time dependent | Use Playwright's clock API: `page.clock.setFixedTime()` |
| Third-party resources | Mock with `page.route()` |

## Debugging

```bash
# Headed mode — watch the browser
npx playwright test --headed

# Debug mode — step through with inspector
npx playwright test --debug

# Specific test
npx playwright test -g "should login"

# View HTML report
npx playwright show-report

# Generate tests interactively
npx playwright codegen http://localhost:3000
```

## Unfixable Tests — use `test.fixme()`

```ts
test.fixme('should display user avatar', async ({ page }) => {
  // BUG: Avatar endpoint returns 404 since API v2 migration.
  // Tracked in JIRA: GALA-1234
  await page.goto('/profile')
  await expect(page.getByRole('img', { name: 'Avatar' })).toBeVisible()
})
```

`test.fixme()` for app bugs. `test.skip()` only for env-specific. Comment explaining behavior. Link ticket.

## Healer Workflow

Run → Debug (`--debug`/trace) → Investigate (selectors? timing? data? app change?) → Fix → Verify → Iterate

### Common failure patterns

| Symptom | Likely Cause | Fix |
|---|---|---|
| Element not found | Selector changed | Update locator, prefer semantic |
| Timeout waiting for element | Slow load / missing element | Add `waitForResponse` or check if feature removed |
| Assertion mismatch | App behavior changed | Update expected value or test logic |
| Intermittent pass/fail | Race condition | Add proper waits, remove shared state |
| Works locally, fails in CI | Environment difference | Check `baseURL`, headless mode, viewport |

3 failed attempts → `test.fixme()` + comment + bug ticket.

## Agent Pipeline

**Plan** → explore, document scenarios. **Generate** → Playwright files from plans. **Heal** → run, debug, fix/fixme, verify.

## Do NOT

- Do NOT use `page.waitForTimeout()` — always wait for a condition.
- Do NOT use CSS selectors when `getByRole`/`getByLabel`/`getByTestId` work.
- Do NOT put assertions in Page Objects — only in test files.
- Do NOT share state between tests — each test must be independent.
- Do NOT hardcode URLs — use `baseURL` from config.
- Do NOT test third-party dependencies — mock external services with `page.route()`.
- Do NOT commit `.only` — use `forbidOnly: !!process.env.CI` to prevent this.
- Do NOT use `networkidle` as default `waitUntil` — it's slow and unreliable.
- Do NOT skip writing `data-testid` when no semantic locator is available.
- Do NOT use deprecated APIs — check Playwright changelog for removed features.
