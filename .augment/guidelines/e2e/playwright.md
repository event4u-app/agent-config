# Playwright E2E Guidelines

> Best practices for writing end-to-end tests with Playwright.
> Applies to all projects using Playwright (API, web, or hybrid).

**Related Skills:** `playwright-testing`, `pest-testing`
**Related Guidelines:** [php.md](../php/php.md)

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

- Group specs by **feature area**, not by page.
- One spec file per user workflow or feature.
- Keep Page Objects in `pages/`, fixtures in `fixtures/`.

## Locator Strategy (Priority Order)

| Priority | Locator | Example | When |
|---|---|---|---|
| 1 | **Role** | `getByRole('button', { name: 'Save' })` | Default — most accessible and resilient |
| 2 | **Label** | `getByLabel('Email')` | Form inputs with labels |
| 3 | **Placeholder** | `getByPlaceholder('Search...')` | Inputs without visible labels |
| 4 | **Text** | `getByText('Welcome back')` | Static visible content |
| 5 | **Test ID** | `getByTestId('submit-btn')` | When no semantic locator works |
| 6 | **CSS/XPath** | `page.locator('.class')` | **Avoid** — brittle, breaks on UI changes |

### Rules

- **Always prefer semantic locators** (`getByRole`, `getByLabel`) over CSS.
- Use `data-testid` as a stable fallback — add it to the component, not the test.
- Chain and filter locators to narrow scope: `page.getByRole('listitem').filter({ hasText: 'Product' })`.
- Never use auto-generated class names or dynamic IDs as selectors.

## Assertions

### Always use web-first assertions

```ts
// ✅ Auto-retrying — waits until condition is met
await expect(page.getByText('Success')).toBeVisible()
await expect(page.getByRole('list')).toHaveCount(5)
await expect(page).toHaveURL('/dashboard')

// ❌ Non-retrying — flaky
const text = await page.textContent('.message')
expect(text).toBe('Success')
```

### Use soft assertions for non-critical checks

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

- **Never use `waitForTimeout()`** — use auto-retrying assertions or `waitForResponse`.
- Trust Playwright's auto-waiting for actions (click, fill, etc.).
- Use `networkidle` sparingly — prefer waiting for specific elements.

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

### Rules

- One Page Object per page or major component.
- Locators are **defined in the constructor**, not inline in methods.
- Methods represent **user actions**, not DOM manipulations.

## Test Data Management

### API-based setup (preferred)

```ts
test.beforeEach(async ({ request }) => {
  // Create test data via API — faster than UI
  await request.post('/api/test/seed', { data: { scenario: 'basic-customer' } })
})

test.afterEach(async ({ request }) => {
  await request.post('/api/test/cleanup')
})
```

### Rules

- **Prefer API calls** over UI interactions for test data setup — faster and more reliable.
- Use seeded test accounts with known credentials.
- Never depend on data created by another test.
- For database-backed apps: use a dedicated test database or transactional rollback.

## Configuration

### `playwright.config.ts` essentials

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

- **Only install browsers you need** — `npx playwright install chromium --with-deps` not `npx playwright install`.
- Use **Linux runners** in CI — cheapest and most stable.
- Upload `playwright-report/` as artifact for failure debugging.
- Use **sharding** when suite exceeds ~5 minutes.

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

- Store baselines in version control.
- Update with `npx playwright test --update-snapshots`.
- Pin OS + browser version in CI — visual diffs are platform-sensitive.
- Use `maxDiffPixelRatio` or `maxDiffPixels` for tolerance.

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

## Handling Unfixable Tests

When a test fails and the failure is in the **application** (not the test), use `test.fixme()`:

```ts
test.fixme('should display user avatar', async ({ page }) => {
  // BUG: Avatar endpoint returns 404 since API v2 migration.
  // Tracked in JIRA: GALA-1234
  await page.goto('/profile')
  await expect(page.getByRole('img', { name: 'Avatar' })).toBeVisible()
})
```

### Rules

- Use `test.fixme()` — **not** `test.skip()` — for tests that should work but don't due to app bugs.
- Use `test.skip()` only for **environment-specific** skips (e.g., `test.skip(process.env.CI, 'requires local GPU')`).
- Always add a **comment before the failing step** explaining the current behavior vs. expected.
- Link to an issue tracker ticket if available.

## Healer Workflow (Debugging Failing Tests)

When tests fail, follow this systematic approach:

1. **Run** — Execute the failing test(s) to see current errors
2. **Debug** — Use `--debug` mode or trace viewer to inspect state at failure point
3. **Investigate** — Check: selectors changed? Timing issue? Data dependency? App change?
4. **Fix** — Update the test code (one fix at a time)
5. **Verify** — Re-run the specific test to confirm the fix
6. **Iterate** — Repeat until all tests pass

### Common failure patterns

| Symptom | Likely Cause | Fix |
|---|---|---|
| Element not found | Selector changed | Update locator, prefer semantic |
| Timeout waiting for element | Slow load / missing element | Add `waitForResponse` or check if feature removed |
| Assertion mismatch | App behavior changed | Update expected value or test logic |
| Intermittent pass/fail | Race condition | Add proper waits, remove shared state |
| Works locally, fails in CI | Environment difference | Check `baseURL`, headless mode, viewport |

### When to give up

If a test **consistently fails** despite correct test logic (confirmed by manual inspection):
- Mark with `test.fixme()` + detailed comment
- File a bug ticket for the underlying application issue
- Move on — don't spend more than 3 attempts fixing a single test

## Agent-Driven Test Pipeline

For AI-assisted E2E workflows, follow this pipeline:

### Phase 1: Plan
- Explore the application (navigate pages, identify flows)
- Document test scenarios in Markdown with numbered steps
- Include: happy path, edge cases, error handling, validation

### Phase 2: Generate
- Convert Markdown plans into Playwright test files
- Follow all conventions from this guideline
- One test file per scenario group
- Add step comments before each action

### Phase 3: Heal
- Run all generated tests
- Debug failures systematically (see Healer Workflow above)
- Fix or mark as `test.fixme()` if the app is broken
- Verify all fixes, iterate until green

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
