---
name: design-review
description: "Use when the user says "review the design", "check the UI", or wants a comprehensive UI/UX review. Uses a 7-phase methodology covering interaction, responsiveness, accessibility, and more."
---

# design-review

## When to use

Use this skill when:
- Reviewing pull requests with UI changes
- Auditing frontend components for design quality
- Verifying responsive design across viewports
- Checking accessibility compliance (WCAG 2.1 AA)
- Testing interaction flows and user experience
- Conducting visual QA on new features

Do NOT use when:
- Creating new designs (use `fe-design` skill instead)
- Reviewing backend/API code only
- Quick syntax checks (use linters)

## Prerequisites

One of the following browser automation tools:
- **Playwright MCP** (recommended) — browser automation, screenshots, viewport testing
- **Chrome DevTools** — screenshot capture, performance analysis

A **live preview URL** is required for testing.

## The 7-Phase Methodology

### Phase 0: Preparation

- Read PR description and git diff.
- Identify changed components and affected pages.
- Navigate to preview URL.
- Take baseline screenshot.

### Phase 1: Interaction

- Test user flows end-to-end.
- Verify hover, focus, active, and disabled states.
- Test keyboard navigation (Tab, Enter, Escape, Arrow keys).
- Check loading states and transitions.
- Verify form submission and error recovery.

### Phase 2: Responsiveness

Test at three viewports:

| Viewport | Width | Device |
|---|---|---|
| Desktop | 1440px | Standard monitor |
| Tablet | 768px | iPad |
| Mobile | 375px | iPhone SE |

- Take screenshots at each viewport.
- Check layout shifts, overflow, and content reflow.
- Verify touch targets are at least 44x44px on mobile.

### Phase 3: Visual Polish

- **Typography:** Font sizes, weights, line heights, hierarchy.
- **Spacing:** Consistent margins, padding, alignment.
- **Colors:** Contrast ratios, brand consistency, dark mode.
- **Alignment:** Grid alignment, visual balance.
- **Icons:** Consistent size, style, and spacing.

### Phase 4: Accessibility (WCAG 2.1 AA)

| Criterion | Check |
|---|---|
| **1.1.1** | All images have meaningful alt text |
| **1.3.1** | Semantic HTML (headings, landmarks, lists) |
| **1.4.3** | Color contrast ≥ 4.5:1 (text), ≥ 3:1 (large text) |
| **1.4.11** | Non-text contrast ≥ 3:1 (UI components, borders) |
| **2.1.1** | All functionality available via keyboard |
| **2.4.3** | Focus order is logical and predictable |
| **2.4.7** | Focus indicator is visible |
| **3.3.1** | Error messages identify the field and describe the error |
| **3.3.2** | Labels and instructions for form inputs |
| **4.1.2** | ARIA roles, states, and properties are correct |

### Phase 5: Robustness

- **Empty states:** What happens with no data?
- **Error states:** What happens when things fail?
- **Content overflow:** Long text, many items, large numbers.
- **Loading states:** Skeleton screens, spinners, progressive loading.
- **Boundary values:** Min/max inputs, special characters.

### Phase 6: Code Health

- Component reuse — are existing components used where possible?
- Design tokens — are colors, spacing, fonts from the design system?
- CSS patterns — utility classes vs. custom CSS, consistency.
- Accessibility in code — semantic HTML, ARIA attributes.

### Phase 7: Content & Console

- Grammar and spelling in UI text.
- Consistent terminology and tone.
- No placeholder text left in production.
- Check browser console for JavaScript errors or warnings.

## Communication principles

### Problems over prescriptions

Describe **what's wrong and why it matters**, not how to fix it.

```
❌ "Change margin to 16px"
✅ "Spacing feels inconsistent with adjacent elements, creating visual clutter near the CTA."
```

### Triage matrix

Every issue gets a severity:

| Severity | Meaning | Action |
|---|---|---|
| **Blocker** | Must fix before merge | Blocks PR |
| **High** | Should fix before merge | Strong recommendation |
| **Medium** | Consider for follow-up | Suggestion |
| **Nitpick** | Optional polish | Prefix with "Nit:" |

### Evidence-based

Screenshots required for all visual issues. Reference specific viewport and state.

### Start positive

Acknowledge what works well before listing issues.

## Report structure

```markdown
## Design Review Summary
[Positive opening + overall assessment]

### 🚫 Blockers
[Critical issues — must fix]

### ⚠️ High Priority
[Significant issues — should fix]

### 💡 Suggestions
[Improvements for follow-up]

### ✨ Nitpicks
[Minor aesthetic details]

### Testing Evidence
[Screenshots: Desktop, Tablet, Mobile]

### Next Steps
1. [Fix blockers]
2. [Address high-priority]

**Overall: [Ready to merge | Needs revisions]**
```


## Visual QA with browser automation

When Playwright MCP or browser tools are available, use them for automated visual verification:

### Before/After comparison

1. **Capture baseline** — screenshot before changes at all 3 viewports.
2. **Apply changes** — deploy or hot-reload.
3. **Capture after** — screenshot at the same viewports and states.
4. **Compare** — visually diff the screenshots, flag regressions.

### State-based verification

Don't just screenshot the default state. Capture:

| State | How to trigger |
|---|---|
| Empty | Remove data, check empty state UI |
| Loading | Throttle network, capture skeleton/spinner |
| Error | Force an error response, check error UI |
| Overflow | Add very long text, many items |
| Interactive | Hover, focus, open dropdowns |

### Mockup-to-code verification

When implementing from a design mockup or screenshot:

1. **Open the mockup** — use the provided image/screenshot.
2. **Implement** — build the UI component.
3. **Side-by-side** — compare mockup vs. implementation at the same viewport.
4. **Flag deviations** — spacing, colors, typography, alignment differences.

This is especially useful when the user provides a screenshot or Figma export as a reference.

## Auto-trigger keywords

- design review
- UI review
- UX audit
- accessibility
- WCAG
- responsive

## Gotcha

- Don't review design without understanding the user's constraints (time, resources, scope).
- The model tends to suggest accessibility improvements that break the existing design system.
- "Best practice" is not always the right choice — sometimes "good enough" ships faster.

## Do NOT

- Do NOT skip accessibility testing — it's not optional.
- Do NOT report issues without evidence (screenshots, specific elements).
- Do NOT prescribe solutions — describe problems and impact.
- Do NOT block PRs on nitpicks.
- Do NOT test only at desktop resolution.
