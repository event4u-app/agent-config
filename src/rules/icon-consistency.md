---
type: "auto"
tier: "2a"
description: "One icon system per project unless the brand defines otherwise — flag mixed icon sets in a UI (the 'every AI UI is default Lucide' anti-pattern)."
triggers:
  - keyword: "icon"
  - keyword: "iconography"
  - keyword: "lucide"
  - keyword: "heroicons"
  - keyword: "icon set"
  - phrase: "icon system"
applies_to_user_types:
  - "creator"
  - "developer"
  - "maintainer"
workspaces:
  - engineering
packs:
  - frontend-design
---

# Icon Consistency

Icon choice is a brand decision, not a convenience decision. Mixing icon sets in a single UI creates visual noise and signals "default AI scaffold" to anyone who looks at the product.

## The Iron Law

```
ONE ICON SYSTEM PER PROJECT.
NEVER MIX ICON SETS WITHOUT A BRAND REASON.
CONSISTENCY OVER NOVELTY.
```

## What this gates

- **Mixed sets in one UI** — Lucide for some components, Heroicons for others, Material Icons elsewhere. Flag all three on sight.
- **Ad-hoc inline SVGs alongside a chosen set** — one-off `<svg>` embeds that don't match the project's adopted library.
- **Defaulting to Lucide without a deliberate choice** — Lucide as the "AI default" is the anti-pattern; the project must have consciously adopted it, not inherited it from a scaffold.

## When it fires

Any of the trigger keywords appear in a UI-building context: new component, new screen, icon prop, import of an icon library, or a design review of an existing surface.

## When NOT to fire

- The project's brand guide explicitly defines multiple icon sets for distinct contexts (e.g., filled icons for navigation, outlined for inline text).
- The task is documentation or a non-UI surface (scripts, CLI output, markdown).
- The user explicitly scopes to "just explore options" without committing to a UI change.

## See also

- [`iconography`](../skills/iconography/SKILL.md) — full icon-system selection, audit, and migration workflow.
- [`ui-audit-gate`](ui-audit-gate.md) — broader UI consistency gate; runs before any new component lands.
