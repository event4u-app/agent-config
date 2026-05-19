---
name: accessibility-auditor
description: "Use when reviewing UI for accessibility — WCAG 2.2 AA, keyboard nav, focus, ARIA, contrast, screen-reader semantics — even on 'is this a11y-OK?' or 'mach das barrierefrei'."
personas:
  - frontend-engineer
source: package
domain: quality
workspaces:
  - engineering
packs:
  - engineering-base
lifecycle: active
trust:
  level: core
  confidence: high
  human_review_required: false
install:
  default: true
  removable: false
---

# accessibility-auditor

> Audit a UI surface against WCAG 2.2 AA, keyboard-only operation,
> and screen-reader semantics. Output is a verdict with cited
> failures, not a vibes check. Pair with
> [`tailwind-engineer`](../tailwind-engineer/SKILL.md) for token-level
> contrast fixes and [`ui-component-architect`](../ui-component-architect/SKILL.md)
> for structural fixes (landmarks, heading order).

## When to use

- A new screen, component, or form lands and a11y has not been
  reviewed yet.
- A bug report mentions keyboard, screen reader, focus order,
  contrast, or "user can't reach the X button".
- A modal, dropdown, popover, tab strip, or tree view is being
  introduced — these are the highest-yield bug zones.
- German triggers: "barrierefrei prüfen", "Tastatur-Bedienung",
  "Screenreader testen".

Do NOT use when:

- The visual design itself is the question (palette, type scale) —
  route to [`fe-design`](../fe-design/SKILL.md).
- The diff has no UI surface — accessibility audits without a UI are
  speculation.
- A specific component spec is missing entirely — get the component
  built first via the stack-specific skill, then audit.

## Procedure

### 1. Identify the interaction surfaces

List every interactive element on the screen: links, buttons,
inputs, custom widgets (combobox, tab, dialog, tree). Each row
gets a verdict in step 5; missing one is a coverage failure.

### 2. Walk the four checklists

**Perceivable** — text alternatives for non-text (`alt`, `aria-label`),
contrast ≥ 4.5:1 for body / 3:1 for large or UI components, no
colour-only state ("error in red" must also be iconic or text).

**Operable** — every interactive element reachable by `Tab`, focus
order matches visual order, focus indicator visible (≥ 3:1 against
adjacent), `Esc` closes overlays, no keyboard traps.

**Understandable** — labels associated (`label[for]` or wrapping),
errors named in text (not just border colour), language attribute
on `<html>`, predictable navigation across pages.

**Robust** — landmarks present (`<header>`, `<nav>`, `<main>`,
`<footer>`), heading order without skips, ARIA only when no native
element exists, custom widgets follow ARIA-APG patterns.

### 3. Run the keyboard pass

`Tab` from page start: every interactive element receives focus,
in visual order, with a visible indicator. `Shift-Tab` reverses
cleanly. `Enter` / `Space` activate per role. Arrow keys work in
composite widgets (tab strip, listbox, menu). `Esc` dismisses the
top-most overlay only.

### 4. Run the screen-reader pass

Use VoiceOver (macOS), NVDA (Windows), or `aria-live` log
inspection. Each surface announces: role, name, state, value,
description (in that order). State changes (loading, expanded,
selected, error) announce. Decorative images are silent.

### 5. Score and report

For each surface from step 1:

| Surface | WCAG SC | Pass / Fail | Evidence |
|---|---|---|---|
| Submit button | 1.4.3 | Fail | contrast 3.1:1, expected 4.5:1 |
| Modal | 2.1.2 | Fail | Tab leaves modal — focus trap missing |

Verdict at the bottom: **AA-pass** (zero fails), **AA-pass-with-risk**
(non-blocking gaps + plan), or **AA-fail** (blocking — fix before
ship).

## Output format

```
Scope:        <screen / component / route>
Surfaces:     <count from step 1>
Tools used:   <axe-core | manual | VoiceOver | NVDA — pick at least 2>

Findings:
  1. <SC>  <Pass/Fail>  <Evidence + file:line if known>
  2. ...

Verdict:      <AA-pass | AA-pass-with-risk | AA-fail>
Top 3 fixes:  <ordered by user impact>
```

## Gotcha

- `aria-label` on a `<button>` overrides its text content for
  screen readers — only use when the visible text is not
  descriptive (icon-only buttons).
- `tabindex="-1"` removes from tab order *and* allows programmatic
  focus; `tabindex="0"` adds to tab order. `tabindex >= 1` is
  almost always wrong — fix the source order.
- Native `<button>` and `<a>` come with role + keyboard for free;
  reaching for `role="button"` on a `<div>` is a regression.
- Contrast on disabled state has no WCAG threshold — but if the
  user cannot tell it is disabled, that is a 1.4.1 failure on
  state cue.

## Do NOT

- Do NOT declare AA-pass without a keyboard-only pass; an axe-core
  green is necessary, not sufficient.
- Do NOT add ARIA "to be safe" — wrong ARIA is worse than no ARIA.
  Native semantics first.
- Do NOT silence the audit on "internal-only tool" or "small user
  base"; legal exposure does not scale with audience size in most
  jurisdictions.
- Do NOT close a finding by adjusting the test instead of the UI;
  the user's experience is the ground truth, not the test report.
