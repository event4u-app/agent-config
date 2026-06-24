---
model_tier: medium
name: fe-design
description: "Reference for frontend-design heuristics — component architecture, layout patterns, form/table design, responsive strategy, a11y, UX principles. Stack-agnostic; cited by directives/ui/design.py."
personas:
  - frontend-engineer
domain: engineering
workspaces:
  - engineering
packs:
  - engineering-base
---

# Frontend Design Skill (Reference)

## Positioning — reference, not executor

`fe-design` is a **universal reference skill**, not an executor. It carries
stack-agnostic heuristics that the UI directive set cites; it does **not**
own the flow.

| Concern | Owner |
|---|---|
| Layout / states / microcopy lock | [`directives/ui/design.py`](../../templates/scripts/work_engine/directives/ui/design.py) |
| Stack-dispatched implementation | [`directives/ui/apply.py`](../../templates/scripts/work_engine/directives/ui/apply.py) → `blade-ui` / `livewire` / `flux` / `react-shadcn-ui` |
| Existing-component inventory + tokens | [`existing-ui-audit`](../existing-ui-audit/SKILL.md) (mandatory pre-step) |
| Grounded selection (style, color tokens, typography, pattern, anti-patterns) | [`design-intelligence`](../design-intelligence/SKILL.md) — corpus-grounded; this skill stays the heuristic layer and *invokes* it |
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

`directives/ui/design.py` produces the design brief (layout, components,
states, microcopy, a11y). Selection decisions (style, semantic color
tokens, typography pairing, layout pattern, anti-patterns) come **grounded**
from [`design-intelligence`](../design-intelligence/SKILL.md) — run its
corpus query first; fall back to the heuristics in this reference only
where the corpus reports an evidence gap or the audit already pins a
project pattern. Stack-specific choices come from the dispatched
implementation skill, not from here.

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

## Cross-task design memory — read DESIGN.md / PRODUCT.md first

Before applying any heuristics from this reference, check the project root
for `DESIGN.md` and/or `PRODUCT.md` (written by `design-system-capture`):

- `DESIGN.md` present → use its captured radius/shadow/motion/spacing as
  project constraints. The heuristics in this skill are **fallbacks for
  gaps**, not overrides for captured decisions.
- `PRODUCT.md` present → honor its interaction patterns (empty-state approach,
  mutation feedback policy, filter persistence) in any UI design that touches
  those surfaces.

Flag any new decision for future capture: *"This establishes a new pattern —
suggest adding to PRODUCT.md: [pattern description]."*

## Design Read — articulate intent before generating

When this reference is cited for a UI planning task, emit one line declaring
the design read before any heuristics are applied:

```
Reading this as: <page-kind> for <audience>, <vibe> language, leaning <design-system>.
```

**If context is incomplete:** state so and proceed exploratory — do NOT block.

**Anti-Default Discipline:** Before committing to any layout or component
pattern, verify you are NOT defaulting to:
- Centered hero + 3-column feature grid + CTA (the "AI landing page" layout)
- Side-stripe `border-left` accent cards (V1 in `design-antipatterns`)
- Identical card grids with no visual rhythm (L2)
- `Inter` or `Space Grotesk` as the uncritical font pick (T7)
- Glassmorphism as a decoration device (V2)

If any of these was the first impulse, choose a different approach or
explicitly justify why this brief genuinely calls for it.

## Aesthetic direction

Audit-pinned tokens and components always take precedence (see `existing-ui-audit`). When the audit pins an aesthetic, honor it without deviation. When the audit shows **no pinned aesthetic** — greenfield surface, marketing landing page, brand-new feature without design-system precedent — the design brief is allowed (and expected) to commit to a deliberate direction instead of defaulting to safe centered hero + 3-column features + CTA.

Typography pairings (73 curated heading/body combinations with Google
Fonts URLs + Tailwind config) and icon-system guidance (104 Phosphor
entries with import code) come grounded from
[`design-intelligence`](../design-intelligence/SKILL.md)
(`--domain typography`, `--domain icons`) — query before picking from
memory.

Pick one direction up front and let composition, typography, and color follow from it. Avoid the "neutral AI default": uniform grid, system fonts as the visible body face, purple-to-blue gradients on white, predictable spacing. A direction that fits the brand intent (editorial / brutalist / refined / playful / retro / maximal / minimal / etc.) and is consistent across the page beats hedging.

Surface the chosen direction in the design brief as a one-line statement (e.g. `aesthetic: editorial-magazine — asymmetric grid, serif display + sans body, generous gutters`). The apply step (`react-shadcn-ui` / `blade-ui` / `livewire` / `flux`) reads this line and matches typography, spacing, and motion to it; if no line is present, the apply step uses project defaults.

## Procedure

When `directives/ui/design.py` (or any caller) cites this skill:

1. **Inspect `state.ui_audit` first** — review the audit produced by [`existing-ui-audit`](../existing-ui-audit/SKILL.md); it is mandatory. Stop and request the audit if missing.
2. **Pick the smallest matching section** — Component Architecture, Form Design, Table Design, Responsive Strategy, Accessibility, or UX Principles. Cite by H2/H3 heading, never paste the whole skill.
3. **Defer to audit findings** — when the audit pins a project pattern (token, primitive, layout convention), use it. The heuristics here are fallbacks for gaps, not overrides.
4. **Defer to the stack apply skill** — Blade vs. Livewire vs. Flux vs. React-shadcn choices come from the dispatched implementation skill, never from this reference.
5. **Surface conflicts** — if a heuristic here contradicts an audit finding or stack convention, name both and let the caller decide; do not silently pick.

## Output format

When this skill's content is folded into a design brief or review:

1. Quote the cited heuristic verbatim, with the H2/H3 heading and a one-line "why this applies" tie-back to the request.
2. Map each heuristic to a concrete artifact in the brief (component, form section, table column, breakpoint rule, a11y check, UX state).
3. Keep stack-agnostic — never name Blade/Livewire/Flux/React primitives in the cited prose; the apply step adds those.
4. Mark anything overridden by audit findings as `[audit override]` and link to the audit entry.

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

- Don't design components without running `existing-ui-audit` first — the audit's component/token inventory is the canonical source for "what already exists in this project". Reinventing is the #1 failure mode.
- Heuristics in this reference apply across stacks; do not promote them to project rules without checking the audit.
- Mobile-first is not optional — every layout must work on 320px width.

## Anti-slop discipline

Before proposing any UI layout, component, or aesthetic direction, pull
[`docs/guidelines/design-antipatterns.md`](../../../docs/guidelines/design-antipatterns.md)
and scan the Visual (V1–V7), Layout (L1–L8), and Quality-floors (Q1–Q12) sections.
If the first-impulse design matches a listed pattern, either choose a different
approach or explicitly invoke the override condition in the design brief.

## Do NOT

- Do NOT skip mobile viewport testing.
- Do NOT use fixed pixel widths for responsive layouts.
- Do NOT ignore accessibility requirements.
- Do NOT use this skill as an executor — it is a reference cited by `directives/ui/design.py`.
