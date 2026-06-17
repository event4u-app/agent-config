---
model_tier: inherit
name: iconography
description: "Resolve an icon request to a concrete Iconify name and emit the embedding for the project's stack. Use when adding icons, picking an icon set, or wiring Lucide/Heroicons/Phosphor/Tabler."
domain: product
personas: []
workspaces:
  - engineering
packs:
  - frontend-design
trust:
  level: professional
install:
  removable: true
execution:
  type: manual
---

# iconography

> Resolve an icon request to a verified Iconify name (`set:name`) and emit the
> correct embedding for the project's stack — CSS class, inline SVG, or
> framework component — while keeping icon-set usage consistent across the UI.

## When to use

- Adding any icon to a component or page.
- Picking an icon set for a new project or feature area.
- Wiring Lucide, Heroicons, Phosphor, or Tabler into a stack (React, Blade, Tailwind).
- Auditing inconsistent icon usage across a UI surface.

## Procedure

1. **Identify the icon need** — what does the icon communicate? Name the semantic
   intent (e.g., "download action", "warning state", "user profile") rather than
   visual description alone.
2. **Pick the icon set** per stack and brand context. Default open sets:
   **Lucide** (clean, Tailwind-native), **Heroicons** (Tailwind/React first-party),
   **Phosphor** (multi-weight, flexible), **Tabler** (comprehensive, stroke-based).
   Brand/provider marks use **lobe-icons** (`lobe-icons:openai-color`, etc.).
   Stack consumers: `react-shadcn-ui` → Lucide; `blade-ui` → Heroicons or Lucide;
   `tailwind-engineer` → any web-font-friendly set.
3. **Resolve to a concrete Iconify name** in `set:name` format, e.g.
   `lucide:arrow-right`, `heroicons:user-solid`, `ph:warning-bold`,
   `tabler:download`. Verify the name exists on
   [iconify.design](https://iconify.design) before emitting.
4. **Emit the embedding** matched to the stack:
   - **CSS class (web-font path)** — `<span class="iconify" data-icon="lucide:arrow-right"></span>` plus the Iconify CDN or build-time bundle.
   - **Inline SVG** — fetch the SVG from the Iconify API (`https://api.iconify.design/{set}/{name}.svg`) and embed directly.
   - **Framework component** — `<Icon icon="lucide:arrow-right" />` via `@iconify/react`, `@iconify/vue`, or the stack's Iconify wrapper.
5. **Verify** — check the resolved name on `iconify.design/icon/{set}:{name}`;
   confirm the icon renders as expected before shipping.

## Output format

1. **Iconify name** — `set:name` string, e.g. `lucide:arrow-right`.
2. **Embedding snippet** — the ready-to-paste code for the project's stack
   (CSS class, inline SVG, or component import + usage).
3. **Set/consistency note** — which set was chosen, why, and whether it matches
   the icons already in use in this codebase.

## Gotcha

- **Mixing icon sets in one UI looks inconsistent.** Lucide and Heroicons have
  different stroke weights and visual rhythm; mixing them without a deliberate
  brand reason produces a jarring result. Audit the existing set before
  introducing a second one.
- **Nonexistent Iconify names 404 silently.** A name like `lucide:arrowRight`
  (camelCase) or `heroicons:user` (missing `-solid`/`-outline` suffix) resolves
  to nothing at render time — the slot is empty with no error. Always verify on
  `iconify.design` before committing the snippet.

## Do NOT

- Do NOT mix multiple icon sets in the same UI surface without an explicit brand
  reason and a note in the set/consistency output.
- Do NOT inline hundreds of raw SVGs when a CSS-class web-font set is available —
  the bundle cost is orders of magnitude higher than a single Iconify CDN include.
- Do NOT invent Iconify names — every name must be verified to exist in the
  Iconify registry; a plausible-sounding name that doesn't exist renders as
  nothing.

## See also

- [`design-tokens`](../design-tokens/SKILL.md) — token system the icon color/size variables should reference.
- [`typography-system`](../typography-system/SKILL.md) — sibling visual-consistency skill.
- [`fe-design`](../fe-design/SKILL.md) — broader frontend design discipline.
- [`icon-consistency`](../../rules/icon-consistency.md) — enforced rule for set discipline across the project.
