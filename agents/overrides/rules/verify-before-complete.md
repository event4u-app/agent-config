# Override: Rule — verify-before-complete

> Override for `.augment/rules/verify-before-complete.md`

---
**Mode:** `extend`
**Original:** `.augment/rules/verify-before-complete.md`
---

## Project-specific addition — Playwright is mandatory for UI changes

This package ships a browser UI (the wizard / settings panels served by
`agent-config setup`). Code-only tests (vitest unit + CLI e2e) cannot
prove that what the user sees in the browser matches the promise.

### The Iron Law (project scope)

```
ANY CHANGE THAT AFFECTS WHAT THE BROWSER RENDERS — UI COMPONENTS,
COPY STRINGS, BANNERS, ERROR MESSAGES, FORM STATE, ROUTING, OR ANY
DRY-RUN / SUPPRESSED-WRITE CONTROL — MUST BE VERIFIED WITH PLAYWRIGHT
BEFORE A COMPLETION CLAIM. UNIT TESTS AND CLI E2E TESTS ARE NOT A
SUBSTITUTE.
```

### What counts as a "UI change"

Any edit to one of these triggers the Iron Law:

- `src/ui/**/*.{ts,tsx,css}`
- `src/server/app.ts` route handlers that the UI consumes
- `src/cli/commands/uiServe.ts` — startup banner, dry-run output, token
  exposure to the UI
- `src/server/token.ts` — UI auth wiring
- Copy strings in `src/ui/copyErrors.ts` or any visible label

### Required verification flow

1. **Start the server** in the relevant mode (`--dry-run`, `--no-open`,
   write-mode, etc.) — use the Playwright MCP `launch-process` pattern
   so the process is reachable and killable.
2. **Drive the UI** with `browser_navigate_Playwright` to the wizard
   URL printed by the CLI (`/?token=…#/wizard`).
3. **Capture state** with `browser_snapshot_Playwright` (accessibility
   tree, not screenshot) so the assertion is text-based, not pixel-based.
4. **Walk every affected screen** — wizard steps, settings panel,
   user-md panel — for the change set.
5. **Assert the visible text** matches the intent. For dry-run work:
   no "file does not exist" / "use the wizard to create" banner that
   contradicts the suppressed-write promise.
6. **Kill the server** after capture.

### What "verified" looks like in the completion claim

The completion message must name:

- Mode tested (`--dry-run`, write, etc.).
- Wizard URL fetched (with the token redacted).
- Screens walked (e.g. `identity → personality → … → review`).
- Text assertions that passed.

A claim that says "tests are green" without naming the Playwright run
is **not** evidence for a UI change.

### Tooling

Use the Playwright MCP tools (`browser_navigate_Playwright`,
`browser_snapshot_Playwright`, `browser_click_Playwright`,
`browser_evaluate_Playwright`, `browser_close_Playwright`). The
package's own vitest suite does not exercise the rendered DOM.

### When this rule does NOT fire

- Pure server-side changes with no UI surface (e.g. logger format,
  filesystem path helper, type-only refactor).
- Changes inside `tests/` that don't ship runtime code.
- Documentation, README, roadmap edits.

For everything else, Playwright runs **before** the completion claim.
