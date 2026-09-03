# fe-design — design patterns

> Section-level entry point of the `fe-design` skill (progressive
> disclosure, 2026-08-04). Content moved VERBATIM from SKILL.md —
> load this file when the section index in SKILL.md routes here.

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

The stack-specific mapping (Blade partial vs. Livewire component vs.
React island vs. Vue SFC) is the apply-step's concern, not this skill's.

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
- **Use the project's library primitives first** — never rebuild what the design system already provides (audit findings tell you which).
- **Extract a props-only UI shell when used 3+ times** — DRY applies to UI too; stateful components carry a higher bar (~4 + real state) — per-class canon: [`abstraction-thresholds`](../../../docs/guidelines/abstraction-thresholds.md).
- **Component workshop when the project is large enough** — for a real, growing shared-component library, isolate and document each reusable component in a component workshop so it stays discoverable and reused, not re-invented; skip it for a small surface of one-offs. Tool-specific setup is a carve-out (Storybook et al.) — see the implementation skill (e.g. [`react-shadcn-ui`](../react-shadcn-ui/SKILL.md) § Component workshop), never a generic mandate.

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

## Motion — decision-tree and rationale

Before adding any animation to a UI element, run through this decision tree:

**1. Should this animate at all?**
- Used 100+ times per day (keyboard shortcut, command palette)? **No animation. Why:** animations on high-frequency interactions feel sluggish; users wait for them on every invocation. Raycast has no open/close animation by design.
- Triggered by user action with visible result (button → state change)? **Micro-feedback only (< 160ms).** Why: quick enough to feel instant, visible enough to confirm the action.
- Modal/overlay/sheet entering/exiting? **Animate. Why:** position change needs motion to maintain spatial continuity.
- Background process with no user action? **No animation.** Why: unexplained motion is disorienting.

**2. Which easing?**
- Entering (element appearing)? **ease-out** (starts fast, slows to rest). Why: the element arriving quickly signals responsiveness; the deceleration feels natural as it settles.
- Exiting (element disappearing)? **ease-in** (starts slow, accelerates out). Why: the reverse is true — fast exit signals completion.
- **Never ease-in for entering elements.** Why: ease-in delays the initial movement — the exact moment the user is watching most closely — making it feel slow even at the same total duration.
- **Never bounce or elastic easing in UI.** Why: bounce draws attention to the animation itself, not the content; it feels dated.

**3. How long?**
- Button/micro-feedback: 100–160ms. Tooltip: 100ms. Dropdown open: 150–200ms. Modal: 200–350ms. Page transition: 300–500ms. Above 500ms: almost never.
- **Never animate layout properties** (width, height, top, left, padding). Why: triggers browser layout recalculation on every frame; always solvable with `transform`.
- **Always add `@media (prefers-reduced-motion: reduce)`** — gentler animation (reduced distance/opacity), NOT display:none. Why: vestibular disorders make motion UI unusable; reducing is better than removing.

**4. Is the trigger the reader's position, or the reader's action?**

Position-triggered motion is the interaction layer's current tell, and it is
the one case where the decision tree above returns "no" and gets overridden
anyway. Two shapes, both catalogued:

- **Scroll-reveal on every section** (catalog M6). The reader has already
  scrolled to the content; fading it in delays what they asked for. Animate a
  reveal only where position carries meaning — a stepped narrative whose beats
  must land in order, or a long-form piece using position to signal progress —
  and then say so in the brief. A reveal applied per section is a default.
- **A pointer-tracking spotlight** (catalog M7). The cursor is the one element
  on the page whose position the reader already knows, so highlighting it
  carries no information. Legitimate only where the spotlight *is* the
  interaction: an inspection tool, a reveal mechanic, a magnifier.

**5. Does the hover state spend contrast or add it?**

A control that lowers its own opacity on hover (catalog M8) reads as retreating
from the pointer, and it reduces legibility at the moment the reader is
committing to the target. Hover is carried by brightness, background, border or
elevation — never by removing contrast. A fade is correct only when it
communicates a real state change, such as an item being dismissed.

The six interaction states every interactive element must assert are
[`design-review`](../../design-review/SKILL.md)'s; this entry is the motion half
of the hover one.

**4. What to animate?**
Animate `transform` and `opacity` only. Why: these run on the GPU compositor thread, not the main thread; they never trigger layout or paint.
`scale(0)` → `scale(1)` is wrong. Why: nothing in the real world appears from nothing. Use `scale(0.95)` + `opacity: 0` → `scale(1)` + `opacity: 1` instead.

## UX Principles

1. **Feedback** — Every action gets a response (toast, loading state, success message). **Why:** users interpret no feedback as failure.
2. **Forgiveness** — Undo beats confirmation dialogs. Users click through confirmations mindlessly. **Why:** remove destructively then show undo toast; actually delete after toast expires.
3. **Consistency** — Same patterns for same interactions across the app. **Why:** predictability reduces cognitive load; inconsistency forces users to re-learn.
4. **Progressive disclosure** — Show basics first, details on demand. **Why:** premature complexity overwhelms; reveal information as it becomes relevant.
5. **Loading states** — Skeleton screens preferred over spinners. **Why:** skeletons reduce perceived wait time by showing structure immediately.
6. **Error recovery** — Clear error messages with suggested actions. **Why:** "something went wrong" gives the user nothing to do; a specific message with a next step reduces support burden.

## Craft details — typography & imagery

- **`text-wrap: pretty` on body copy** — avoids widows/orphans without manual
  breaks; cheap, no layout risk. (Display headlines: `text-wrap: balance`.)
- **Honest placeholders over weak assets** — when the real image/illustration
  is missing, use a striped placeholder with a monospace size label
  (`repeating-linear-gradient(45deg, #E5E5E5 0 10px, #F5F5F5 10px 20px)` +
  `product shot (1200×800)`) instead of a hand-drawn SVG or stock-ish filler.
  A placeholder signals "asset needed"; a weak illustration signals nobody
  had the asset. Never Lorem-ipsum copy in review-bound output
  (per `output-discipline`) — use short label-style skeleton copy.

## Presenting variants

This skill produces ONE refined solution by default. **Plan the variation
decision before generating** — do not reflexively emit one generic design when
exploration was asked, nor spam options when one production answer was asked.

- **Decide whether to vary (ask only if ambiguous).** For ambiguous creative
  work, decide the variation count and the axis that varies — visual direction,
  UX flow, interaction model, copy, density, or brand strictness. Ask about
  count + axis only when the choice changes the work materially; for a clear
  implementation task, proceed with one answer. (fixture: `daf-requested-variations`.)
- **Variation floors.** When the user asks to explore, produce **two to three
  meaningfully different** options along the stated axis — different *decisions*,
  not the same layout recoloured. When the user asks for one production answer,
  produce one; no decorative option spam. (fixtures: `daf-requested-variations`,
  `daf-unwanted-variations`.)
- **Canvas / exploration contract (host-neutral).** Presenting side-by-side
  concepts: give each a **stable frame label**, keep frames flat (no nested
  cards), use generous spacing, and — on tools with a canvas — export-safe
  coordinates so the layout survives export. Same labelled-frames shape whether
  the host has a real canvas or just stacked sections.
- **Cost / UX tie-breaker.** Ask about the axis only when it changes the work
  materially; otherwise choose a strong default and **document the axis used in
  the handoff** ("explored along visual-direction; density held constant").

Hand off the actual variation **mechanics** — the basic→bold method and the
single-file tweak-panel (CSS custom properties + floating "Tweaks" panel +
`localStorage`) — to [`design-variations`](../design-variations/SKILL.md): this
section owns the *planning decision*, that skill owns the *execution*.
