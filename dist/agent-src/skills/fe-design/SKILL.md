---
model_tier: medium
name: fe-design
description: "Reference for frontend-design heuristics — component architecture, layout patterns, form/table design, responsive strategy, a11y, UX principles. Stack-agnostic; cited by directives/ui/design.ts."
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
| Layout / states / microcopy lock | [`directives/ui/design.ts`](../../templates/scripts/work_engine/directives/ui/design.ts) |
| Stack-dispatched implementation | [`directives/ui/apply.ts`](../../templates/scripts/work_engine/directives/ui/apply.ts) → `blade-ui` / `livewire` / `flux` / `react-shadcn-ui` |
| Existing-component inventory + tokens | [`existing-ui-audit`](../existing-ui-audit/SKILL.md) (mandatory pre-step) |
| Grounded selection (style, color tokens, typography, pattern, anti-patterns) | [`design-intelligence`](../design-intelligence/SKILL.md) — corpus-grounded; this skill stays the heuristic layer and *invokes* it |
| Design-review polish loop | [`directives/ui/review.ts`](../../templates/scripts/work_engine/directives/ui/review.ts) + [`directives/ui/polish.ts`](../../templates/scripts/work_engine/directives/ui/polish.ts) |

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

> **Resource-first, before taste.** Any request to recreate / redesign / mock /
> prototype / improve an existing UI runs the
> [resource-first context gate](../existing-ui-audit/SKILL.md#resource-first-context-gate-design-fidelity)
> FIRST — search the project's tokens/design-system/assets, hard-stop and ask
> when a referenced source is inaccessible (never invent from memory), and
> prefer code over screenshots for exact values. Planning here starts from that
> inventory, not from generic aesthetic memory (design-artifact lifecycle,
> Inspect stage).

## How the directive set cites this skill

`directives/ui/design.ts` produces the design brief (layout, components,
states, microcopy, a11y). Selection decisions (style, semantic color
tokens, typography pairing, layout pattern, anti-patterns) come **grounded**
from [`design-intelligence`](../design-intelligence/SKILL.md) — run its
corpus query first; fall back to the heuristics in this reference only
where the corpus reports an evidence gap or the audit already pins a
project pattern. Stack-specific choices come from the dispatched
implementation skill, not from here.

> **When the corpus is not installed.** `design-intelligence` ships in the
> `frontend-design` pack; this skill ships in `engineering-base`. A consumer
> who installed only `laravel` or only `react` therefore has this skill and
> **not** the corpus. Fall back to the heuristics here and say so in the
> result — "selected from heuristics; `frontend-design` not installed, so no
> corpus grounding". The evidence-gap fallback above is about a corpus that
> answered "nothing here"; this is about a corpus that is absent. Never
> present an ungrounded pick as grounded, and never record a missing pack as
> an evidence gap.

## Section index — load on demand

Load the reference file whose sections the task needs — never all of them by default:

- [`references/design-patterns.md`](references/design-patterns.md) — Component Architecture · Form Design · Table Design · Responsive Strategy · Accessibility (a11y) · Motion — decision-tree and rationale · UX Principles · Craft details — typography & imagery · Presenting variants
- [`references/design-read-and-memory.md`](references/design-read-and-memory.md) — Cross-task design memory — read DESIGN.md / PRODUCT.md first · Register — brand vs product · Design Read — articulate intent before generating · Aesthetic direction

## Procedure

When `directives/ui/design.ts` (or any caller) cites this skill:

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
- Do NOT use this skill as an executor — it is a reference cited by `directives/ui/design.ts`.
