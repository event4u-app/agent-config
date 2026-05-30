---
recommended_model: opus
name: playwright-architect
description: "Use when shaping a Playwright suite — locator strategy, Page Object boundaries, fixture composition, flake-prevention architecture, CI-vs-local split — even on 'design our E2E tests'."
personas:
  - frontend-engineer
domain: quality
recommended_for_user_types: [developer]
workspaces:
  - engineering
packs:
  - engineering-base
---

# playwright-architect

> Architectural lens **above** the existing tactical
> [`playwright-testing`](../playwright-testing/SKILL.md). Decides
> locator philosophy, Page Object boundaries, fixture composition,
> and the CI-vs-local split *before* the first test is written.
> The `playwright-testing` skill handles concrete assertions,
> selectors, and visual-regression mechanics once the design is
> locked.

## When to use

- A new Playwright suite is starting and the directory shape, fixture
  hierarchy, and locator strategy are unsettled.
- An existing suite has flake > 2 % runs, slow CI (> 10 min), or a
  god-test file mixing unrelated journeys.
- A second app / surface (admin, mobile-web, embedded widget) needs
  to share fixtures with the main suite.
- German triggers: "Playwright Setup planen", "Page Objects schneiden",
  "warum flaket der Test?".

Do NOT use when:

- A single test fails and the question is the assertion or selector
  — route to [`playwright-testing`](../playwright-testing/SKILL.md).
- The platform is mobile-native (Detox, Appium, Maestro) — route to
  [`mobile-e2e-strategy`](../mobile-e2e-strategy/SKILL.md).
- Unit / component tests are the question — Playwright is the wrong
  tool; route to the stack-specific testing skill.

## Procedure

### 1. Inspect the suite, pick the locator philosophy

Review existing tests for current locator patterns; the established
strategy wins unless it is the "last resort" tier. One philosophy
per suite, written into `CONTRIBUTING-tests.md`:

| Strategy | When |
|---|---|
| `getByRole` + accessible name | Default — couples tests to the user contract, not markup |
| `data-testid` | Legacy markup, third-party widgets, hash-suffixed CSS modules |
| Text content (`getByText`) | Static marketing pages, copy-stable surfaces |
| CSS / XPath | Last resort — every use is a debt entry |

Mixing strategies inside one test file is the smell — pick one and
fall back only with comment.

### 2. Cut Page Object boundaries

A Page Object owns: (a) one URL or one logical surface (modal,
drawer), (b) the locators on that surface, (c) the **actions** a
user can perform there. It does NOT own assertions about other
surfaces or test setup. Boundary rule: if two POs need to call
each other, introduce a **flow object** (`SignupFlow`) above them.

### 3. Compose fixtures, don't inherit

Playwright fixtures stack via `test.extend()`. Three layers max:

| Layer | Owns |
|---|---|
| Base | Browser, context, storageState, network mocks |
| Auth | Logged-in user states (admin, member, guest) |
| Domain | Pre-seeded entities for a journey |

Deeper stacks become un-debuggable; flatten by extracting helpers.

### 4. Plan flake prevention before the first failure

Bake in: auto-retry on network idle, soft assertions for parallel
checks, deterministic seed data, time freezing (`page.clock`),
explicit `expect.poll()` for eventual consistency, no
`waitForTimeout` ever. If a test needs `sleep`, the fixture is
wrong.

### 5. Split CI vs local execution

Local: headed browser, single worker, slowMo enabled, video off,
trace-on-retry. CI: headless, sharded workers (2–8), trace-on-first-retry,
video-on-failure, Github reporter + HTML. Document both in
`playwright.config.ts`; do not let local config leak into CI.

## Output format

Return:

1. Locator + Page Object plan — chosen strategy, PO list with surface
   and action count, flow objects when ≥ 2 POs collaborate.
2. Fixture composition — base / auth / domain layer with what each
   layer sets up.
3. Parallelism + flake budget — worker count, shard strategy,
   isolation, target flake ceiling, CI-vs-local config delta.

Concrete shape:

```
Suite:            <name>
Locator strategy: <getByRole | data-testid | text | mixed (justified)>
Page Objects:     <list with surface owned + action count>
Flow objects:     <list — only when ≥ 2 POs collaborate>
Fixture layers:   base / auth / domain — each with what it sets up
Parallelism:      <workers, shards, isolation strategy>
Flake budget:     ≤ 1 % failure on green main; alert threshold
CI-vs-local:      <key config delta, one bullet each>
```

## Gotcha

- `page.waitForSelector` is almost always wrong — `expect(locator).toBeVisible()`
  has built-in retry. The former teaches devs to think "wait, then
  assert" instead of "auto-retry assertion".
- Storage-state reuse across workers requires cookie domain
  isolation; the same `auth.json` across two browsers in parallel
  shares a session and corrupts state.
- Visual regression in CI requires identical fonts and renderer —
  pin the Docker image, never run visual tests against host
  Chromium.
- One Page Object per URL **looks** clean but creates god-objects
  for SPA routes; cut by *user surface*, not by `pathname`.

## Do NOT

- Do NOT cite this skill alongside [`playwright-testing`](../playwright-testing/SKILL.md)
  in the same step — they sit at different tiers; pick one per phase.
- Do NOT design suites for component tests with this skill —
  Playwright Component Testing has different fixture rules; route
  there instead.
- Do NOT promise zero flake; budget for ≤ 1 % and instrument the
  metric. Zero is a goal that disguises silent retries.
- Do NOT push the architecture into the tracker as code AC — output
  is a design note for refinement, not implementation steps.
