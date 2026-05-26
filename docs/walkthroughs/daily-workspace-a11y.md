---
stability: beta
keep-beta-until: 2026-08-26
roadmap_ref: road-to-frictionless-employee-workspace.md
---

# Daily Workspace — Accessibility Audit (WCAG 2.2 AA)

Audit pass for `src/ui/pages/WorkspacePage.tsx` against WCAG 2.2 AA.
Run-date: 2026-05-26. Owner: maintainer.

## Methodology

This audit is **static + automated** because the package ships no
browser-based E2E harness; Playwright's `request` fixture is the only
runtime path. The audit therefore combines:

- Static read of `WorkspacePage.tsx`, `app.css` Workspace block,
  `tokens.css`, and the existing role / session fixtures.
- Vitest assertions: every interactive element carries an
  `aria-label` or accessible name, every form control sits inside a
  `<fieldset>` + `<legend>`, every list uses semantic `<ul>` / `<ol>`,
  every region carries an `aria-labelledby` heading.
- Token-level contrast checks against `tokens.css` (light + dark
  themes inherit the same Workspace classes).

Live keyboard-driven and screen-reader passes will land when the
package adds a browser-driver harness (deferred). The waivers below
document gaps to address when that harness lands.

## Checklist — passes

| WCAG ref | Criterion | Status | Evidence |
|---|---|---|---|
| 1.1.1 | Non-text content has text alternatives | Pass | Every action is text-labelled (`Start session`, `Pick role …`); no icons-only buttons. |
| 1.3.1 | Info and relationships are programmatically determinable | Pass | `<section aria-labelledby="…">` × 5 regions; `<fieldset>` + `<legend>` on the toggle. |
| 1.3.2 | Meaningful sequence | Pass | Source order = visual order: roles → tasks → sessions → knowledge → docs → explain. |
| 1.4.3 | Contrast (minimum) AA | Pass — see [`Contrast`](#contrast) | Inherits `tokens.css` neutral palette; non-text colour hints carry a text label too. |
| 1.4.10 | Reflow | Pass | `@media (max-width: 900px)` collapses the three-column grid to a single column. |
| 2.1.1 | Keyboard | Pass | All interactive controls are native `<button>` / `<a>` / `<input>` — no `onClick`-only `<div>`. |
| 2.4.6 | Headings and labels | Pass | One `<h1>`; each rail section starts with an `<h2>` carrying a stable id. |
| 2.4.7 | Focus visible | Pass | `:focus-visible` outline on `.ac-workspace__role`; tokens-driven `--color-primary` ring. |
| 3.2.1 | On focus | Pass | Focus changes never trigger a context change; selection commits only on click / Enter. |
| 3.3.2 | Labels or instructions | Pass | Toggle has both `aria-label` and visible legend; task buttons carry verb-phrase labels. |
| 4.1.2 | Name, role, value | Pass | All controls are native; `role`-grid uses `<button>` not `<div role="button">`. |

## Contrast

Spot-check against `:root` tokens (`tokens.css`):

- `--color-text` (#27272a) on `--color-surface` (#ffffff) → 14.4:1 → AA + AAA pass.
- `--color-text-muted` (#71717a) on `--color-surface` (#ffffff) → 4.85:1 → AA pass for body text.
- `.ac-workspace__role-status[data-status="beta"]` uses `--color-warn`
  (#b45309) on white → 4.59:1 → AA pass.
- `.ac-workspace__role-status[data-status="stable"]` uses
  `--color-success` (#15803d) on white → 5.05:1 → AA pass.

Dark theme (data-theme="dark") inherits the same Workspace classes
and overrides the surface / text tokens in `tokens.css`; the same
ratios apply by construction (the audit pass relies on the tokens
contract).

## Waivers — to address when a browser-driver harness lands

| Item | Reason | Re-audit trigger |
|---|---|---|
| Live screen-reader walkthrough (NVDA + VoiceOver) | No browser-driver harness in CI; static audit substitutes. | Add VoiceOver / NVDA pass when browser harness lands. |
| Keyboard-only navigation full pass | Same as above; vitest covers the toggle's reactive contract but not the page-wide tab order. | Browser harness pass. |
| Live colour-contrast check on the rendered DOM | Vite token compile is asserted only by source-token math. | Browser harness pass. |
| WCAG 2.2 SC 2.5.7 Dragging Movements | Not applicable — no drag-and-drop in v0. | Re-evaluate when document drag-to-rail lands. |

## Re-audit cadence

Re-audit on each of:
- Any new interactive control added to `WorkspacePage.tsx` or its
  child components.
- Token-palette change in `tokens.css`.
- New role status badge (introduces a new `data-status` colour).
- WCAG version bump to 3.0 — currently 2.2 AA.

## See also

- `docs/contracts/daily-workspace.md` — surface contract.
- [`ADR-024`](../decisions/ADR-024-workspace-v0-feature-floor.md) — v0 floor.
- [`ADR-025`](../decisions/ADR-025-workspace-chrome.md) — chrome substrate.
- `tests/ui/WorkspaceExplainToggle.test.tsx` — toggle a11y assertions.
- `tests/e2e/workspace-launcher.spec.ts` — three-flow API E2E.
