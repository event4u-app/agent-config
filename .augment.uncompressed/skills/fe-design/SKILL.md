---
name: fe-design
description: "Use when designing frontend interfaces — component architecture, layout patterns, form design, table patterns, responsive strategies, and UX principles for Blade/Livewire/Flux/Tailwind."
source: package
---

# Frontend Design Skill

## When to use

Use this skill when:
- Planning a new page or feature UI before implementing
- Choosing between component patterns (modal vs. inline, table vs. cards)
- Designing forms with complex validation or multi-step flows
- Making responsive design decisions
- Reviewing UI for accessibility and usability
- Deciding how to structure Livewire components

## Procedure: Design a frontend interface

1. **Understand requirements** — What data is shown? What actions are available? Who is the user?
2. **Choose technology** — Pick from the project stack (see table below).
3. **Design layout** — Mobile-first, component-based, consistent spacing.
4. **Implement** — Build with Blade components, Livewire for interactivity, Flux for UI primitives.
5. **Verify** — Check accessibility (labels, focus, contrast), responsive behavior, loading states.

This project uses a server-rendered stack:

| Layer | Technology | Skill |
|---|---|---|
| Templates | Laravel Blade | `blade-ui` |
| Interactivity | Livewire 3 | `livewire` |
| Component library | Flux (by Laravel) | `flux` |
| Styling | Tailwind CSS | `tailwind` |
| Icons | Heroicons / custom | — |

**Key principle:** Server-first. Use Livewire for interactivity. Avoid JavaScript unless Livewire can't handle it (e.g., drag-and-drop, complex animations).

## Component Architecture

### Page structure

```
Page (Blade layout)
├── Header (Blade partial)
├── Navigation (Livewire — active state)
├── Content area
│   ├── Page heading + actions (Blade)
│   ├── Filters (Livewire — reactive)
│   ├── Data display (Livewire — table/cards)
│   └── Pagination (Livewire)
└── Footer (Blade partial)
```

### When to use what

| Pattern | When | Example |
|---|---|---|
| **Blade partial** | Static content, no interactivity | Header, footer, static info |
| **Blade component** | Reusable UI element, props only | Button, badge, card shell |
| **Livewire component** | Needs server interaction or state | Forms, tables, filters |
| **Flux component** | Standard UI element from library | Modal, dropdown, input, toast |
| **Alpine.js** | Client-only micro-interaction | Toggle, accordion, clipboard |

### Component granularity

- **One Livewire component per concern** — don't build mega-components
- **Compose with Blade components** inside Livewire for reusable UI pieces
- **Use Flux for standard elements** — don't rebuild what Flux provides
- **Extract when used 3+ times** — DRY applies to UI too

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
- Use Livewire pagination (server-side)

## Responsive Strategy

### Breakpoints (Tailwind)

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

## Related

- **Skill:** `blade-ui` — Blade template implementation
- **Skill:** `livewire` — Livewire component implementation
- **Skill:** `flux` — Flux component library usage
- **Skill:** `tailwind` — Tailwind CSS utility patterns
- **Skill:** `dashboard-design` — Monitoring dashboard design (different domain)


## Gotcha

- Don't design components without checking existing Flux/Livewire components first — avoid reinventing.
- The model tends to use raw HTML instead of project component library — always prefer existing components.
- Mobile-first is not optional — every layout must work on 320px width.

## Do NOT

- Do NOT skip mobile viewport testing.
- Do NOT use fixed pixel widths for responsive layouts.
- Do NOT ignore accessibility requirements.

## Auto-trigger keywords

- frontend design
- component architecture
- layout
- form design
- responsive
