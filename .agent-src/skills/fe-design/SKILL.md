---
name: fe-design
description: "Reference for frontend-design heuristics — component architecture, layout patterns, form/table design, responsive strategy, a11y, UX principles. Stack-agnostic; cited by directives/ui/design.py."
source: package
---

# Frontend Design Skill (Reference)

## Positioning — reference, not executor

`fe-design` is a **universal reference skill**, not an executor. Stack-agnostic heuristics that the UI directive set cites; does **not** own the flow.

| Concern | Owner |
|---|---|
| Layout / states / microcopy lock | [`directives/ui/design.py`](../../templates/scripts/work_engine/directives/ui/design.py) |
| Stack-dispatched implementation | [`directives/ui/apply.py`](../../templates/scripts/work_engine/directives/ui/apply.py) → `blade-ui` / `livewire` / `flux` / `react-shadcn-ui` |
| Existing-component inventory + tokens | [`existing-ui-audit`](../existing-ui-audit/SKILL.md) (mandatory pre-step) |
| Design-review polish loop | [`directives/ui/review.py`](../../templates/scripts/work_engine/directives/ui/review.py) + [`directives/ui/polish.py`](../../templates/scripts/work_engine/directives/ui/polish.py) |

## When to use

Cite this skill when:

- Planning a new page or feature UI before implementing
- Choosing between component patterns (modal vs. inline, table vs. cards)
- Designing forms with complex validation or multi-step flows
- Making responsive design decisions
- Reviewing UI for accessibility and usability

Do NOT use this skill to:

- Implement components — that is the apply-step's stack-dispatched skill
- Audit an existing UI — that is `existing-ui-audit`
- Drive the full UI flow — that is the `directives/ui/` orchestrator

## How the directive set cites this skill

`directives/ui/design.py` produces the design brief (layout, components, states, microcopy, a11y). Brief picks heuristics from this reference when audit doesn't already pin a project pattern. Stack-specific choices come from the dispatched implementation skill.

## Component Architecture

### Page structure (universal shape)

```
Page layout
├── Header (static)
├── Navigation (interactive — active state)
├── Content area
│   ├── Page heading + actions (static)
│   ├── Filters (interactive — reactive)
│   ├── Data display (interactive — table / cards)
│   └── Pagination (interactive)
└── Footer (static)
```

Stack-specific mapping (Blade partial vs. Livewire component vs. React island vs. Vue SFC) is the apply-step's concern.

### When to use what (kind, not framework)

| Kind | When | Example |
|---|---|---|
| **Static partial** | No interactivity, server-rendered only | Header, footer, static info |
| **Reusable UI component** | Props-only, no state | Button, badge, card shell |
| **Stateful component** | Needs server interaction or local state | Forms, tables, filters |
| **Library primitive** | Standard UI from a design system | Modal, dropdown, input, toast |
| **Client-only micro-interaction** | No server roundtrip needed | Toggle, accordion, clipboard |

### Component granularity

- **One stateful component per concern** — don't build mega-components.
- **Compose with reusable UI components** for shared shells, headers, fields.
- **Use the project's library primitives first** — never rebuild what the design system provides (audit findings tell you which).
- **Extract when used 3+ times** — DRY applies to UI too.

## Form Design

### Principles

1. **Labels always visible** — no placeholder-only inputs
2. **Validation on blur + submit** — immediate feedback, not on every keystroke
3. **Error messages below the field** — red text, specific message
4. **Required fields marked** — asterisk (*) or "(required)" label
5. **Logical grouping** — related fields in sections with headings
6. **Primary action prominent** — submit button stands out, cancel is secondary

### Layout patterns

| Fields | Layout | When |
|---|---|---|
| 1–3 fields | Single column | Simple forms (login, search) |
| 4–8 fields | Two columns on desktop, single on mobile | Standard CRUD forms |
| 8+ fields | Sections with headings or tabs/steps | Complex entity forms |
| Related pairs | Side by side (first/last name, city/zip) | Logically paired fields |

### Multi-step forms

```
Step indicator (1 — 2 — 3)
├── Step 1: Basic info     → Next
├── Step 2: Details        → Back / Next
└── Step 3: Review + Submit → Back / Submit
```

- Show progress indicator (step numbers or progress bar)
- Allow going back without losing data
- Validate each step before allowing next
- Show summary on final step

## Table Design

### Principles

1. **Right-align numbers** — easier to compare
2. **Left-align text** — natural reading direction
3. **Sortable columns** — click header to sort
4. **Sticky header** — visible when scrolling long tables
5. **Row actions** — edit/delete as icon buttons or dropdown menu
6. **Empty state** — helpful message when no data, not just blank

### Responsive tables

| Screen | Strategy |
|---|---|
| Desktop (≥1024px) | Full table with all columns |
| Tablet (768–1023px) | Hide less important columns |
| Mobile (<768px) | Card layout or horizontal scroll |

### Pagination

- Default: 25 rows per page
- Show total count: "Showing 1–25 of 142"
- Allow page size change (10, 25, 50, 100)
- Prefer server-side pagination — avoid loading the full set client-side

## Responsive Strategy

### Breakpoints (Tailwind reference scale)

| Prefix | Min width | Target |
|---|---|---|
| `sm:` | 640px | Large phones |
| `md:` | 768px | Tablets |
| `lg:` | 1024px | Small laptops |
| `xl:` | 1280px | Desktops |
| `2xl:` | 1536px | Large screens |

### Mobile-first approach

1. Design for mobile first (default styles)
2. Add complexity at larger breakpoints
3. Test at each breakpoint, not just desktop

### Common patterns

| Element | Mobile | Desktop |
|---|---|---|
| Navigation | Hamburger menu | Sidebar or top nav |
| Forms | Single column | Two columns |
| Tables | Cards or scroll | Full table |
| Actions | Bottom sheet / FAB | Inline buttons |
| Filters | Collapsible panel | Sidebar or inline |

## Accessibility (a11y)

### Minimum requirements

- **Color contrast:** 4.5:1 for text, 3:1 for large text (WCAG AA)
- **Keyboard navigation:** All interactive elements reachable via Tab
- **Focus indicators:** Visible focus ring on all focusable elements
- **Alt text:** All meaningful images have descriptive alt text
- **ARIA labels:** Interactive elements without visible text need `aria-label`
- **Semantic HTML:** Use `<button>`, `<nav>`, `<main>`, `<form>` — not `<div>` for everything

### Common mistakes

| Mistake | Fix |
|---|---|
| `<div onclick>` | Use `<button>` |
| Color-only status | Add icon or text alongside color |
| Missing form labels | Add `<label for="...">` |
| Auto-playing content | Provide pause/stop control |
| Tiny click targets | Min 44×44px touch target |

## UX Principles

1. **Feedback** — Every action gets a response (toast, loading state, success message)
2. **Forgiveness** — Undo for destructive actions, confirmation for irreversible ones
3. **Consistency** — Same patterns for same interactions across the app
4. **Progressive disclosure** — Show basics first, details on demand
5. **Loading states** — Skeleton screens or spinners, never blank screens
6. **Error recovery** — Clear error messages with suggested actions

## Procedure

When `directives/ui/design.py` (or any caller) cites this skill:

1. **Confirm audit ran first** — `state.ui_audit` from [`existing-ui-audit`](../existing-ui-audit/SKILL.md) is mandatory. Stop and request audit if missing.
2. **Pick smallest matching section** — Component Architecture, Form Design, Table Design, Responsive Strategy, Accessibility, or UX Principles. Cite by H2/H3 heading, never paste whole skill.
3. **Defer to audit findings** — when audit pins a project pattern (token, primitive, layout convention), use it. Heuristics here are fallbacks for gaps, not overrides.
4. **Defer to stack apply skill** — Blade vs. Livewire vs. Flux vs. React-shadcn choices come from dispatched implementation skill, never from this reference.
5. **Surface conflicts** — if heuristic here contradicts an audit finding or stack convention, name both and let caller decide; do not silently pick.

## Output format

When this skill's content is folded into a design brief or review:

1. Quote cited heuristic verbatim, with H2/H3 heading and one-line "why this applies" tie-back to request.
2. Map each heuristic to a concrete artifact in brief (component, form section, table column, breakpoint rule, a11y check, UX state).
3. Keep stack-agnostic — never name Blade/Livewire/Flux/React primitives in cited prose; apply step adds those.
4. Mark anything overridden by audit findings as `[audit override]` and link to audit entry.

## Related

- **Orchestrator:** [`directives/ui/`](../../templates/scripts/work_engine/directives/ui/) — owns the UI flow
- **Pre-step (mandatory):** [`existing-ui-audit`](../existing-ui-audit/SKILL.md) — inventory before design
- **Stack apply skills (dispatched, not standalone):**
  - [`blade-ui`](../blade-ui/SKILL.md) — Blade template implementation
  - [`livewire`](../livewire/SKILL.md) — Livewire component implementation
  - [`flux`](../flux/SKILL.md) — Flux component library usage
  - [`react-shadcn-ui`](../react-shadcn-ui/SKILL.md) — React + shadcn primitives
- **Adjacent reference:** [`dashboard-design`](../dashboard-design/SKILL.md) — monitoring dashboard design (different domain)

## Gotcha

- Don't design components without running `existing-ui-audit` first — audit's component/token inventory is canonical for "what already exists in this project". Reinventing is the #1 failure mode.
- Heuristics in this reference apply across stacks; do not promote them to project rules without checking the audit.
- Mobile-first is not optional — every layout must work on 320px width.

## Do NOT

- Do NOT skip mobile viewport testing.
- Do NOT use fixed pixel widths for responsive layouts.
- Do NOT ignore accessibility requirements.
- Do NOT use this skill as an executor — it is a reference cited by `directives/ui/design.py`.

