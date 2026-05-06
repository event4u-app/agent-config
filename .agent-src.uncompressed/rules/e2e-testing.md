---
type: "auto"
tier: "3"
description: "Playwright E2E tests — locators, assertions, Page Objects, fixtures, CI, and flaky test prevention"
source: package
triggers:
  - keyword: "playwright"
  - keyword: "e2e"
  - phrase: "page object"
routes_to:
  - "command:e2e-heal"
---

# E2E Testing

**Iron Law.** Playwright E2E: stable locators, no `waitForTimeout`, Page Objects for shared flows, fixtures over `beforeEach`.

Body migrated to `command:e2e-heal` (per P4 of `road-to-kernel-and-router.md`).
Trigger-set above activates this routing under the `balanced` and `full` profiles.
