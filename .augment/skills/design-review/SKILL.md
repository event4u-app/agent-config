---
name: design-review
description: "Use when the user says "review the design", "check the UI", or wants a comprehensive UI/UX review. Uses a 7-phase methodology covering interaction, responsiveness, accessibility, and more."
source: package
---

# design-review

## When to use

PR with UI changes, component audit, responsive verification, a11y (WCAG 2.1 AA), interaction testing, visual QA. NOT for: creating designs (`fe-design`), backend-only, syntax checks.

## Prerequisites: Playwright MCP or Chrome DevTools + live preview URL.

## 7 Phases

0. **Prep** — PR diff, changed components, navigate, baseline screenshot
1. **Interaction** — user flows, hover/focus/active/disabled states, keyboard nav, loading, forms
2. **Responsive** — Desktop 1440px, Tablet 768px, Mobile 375px. Screenshots, layout shifts, touch targets ≥44px
3. **Visual** — typography, spacing, colors/contrast, alignment, icons
4. **A11y (WCAG)** — alt text (1.1.1), semantic HTML (1.3.1), contrast ≥4.5:1 (1.4.3), keyboard (2.1.1), focus order (2.4.3), visible focus (2.4.7), error messages (3.3.1), labels (3.3.2), ARIA (4.1.2)
5. **Robustness** — empty/error/overflow/loading states, boundary values
6. **Code health** — component reuse, design tokens, CSS patterns, semantic HTML
7. **Content** — grammar, consistent terminology, no placeholders, console errors

## Communication: describe problems + impact, not fixes. Severity: Blocker → High → Medium → Nitpick. Screenshots required. Start positive.

## Report: Summary → 🚫 Blockers → ⚠️ High → 💡 Suggestions → ✨ Nitpicks → Evidence → Next Steps → Overall verdict.

## Visual QA: before/after at 3 viewports. Capture states: empty, loading, error, overflow, interactive. Mockup comparison: side-by-side at same viewport.

## Gotcha: understand constraints first, a11y suggestions may break design system, "good enough" sometimes ships faster.

## Do NOT: skip a11y, report without evidence, prescribe solutions, block on nitpicks, desktop-only testing.
