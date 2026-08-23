---
model_tier: medium
name: design
disable-model-invocation: true
argument-hint: "[audit|render|review|polish|quieter|bolder|distill|harden|clarify] [path]"
pack: engineering-base
intent: "Design dispatcher — inventory, capture, review, or run one bounded intervention verb"
routes_to: [existing-ui-audit, design-review, fe-design]
replaces: []
visibility: internal
description: Design orchestrator — routes audit/render/review to the Class-A commands and the six intervention verbs to fe-design with a declared operation
cluster: design
type: orchestrator
suggestion:
  eligible: true
  trigger_description: "audit this UI, render it, review the design, polish or tighten this screen"
  trigger_context: "user wants something done to an existing UI surface without naming which design workflow"
workspaces:
  - agent-config-maintainer
packs:
  - meta
---

# /design

One entry point for work on an existing UI surface. A **command**, not a skill —
the skill catalogue is already the largest standing cost in this suite, and this
adds a router rather than a 295th entry to it.

## Sub-commands

| Verb | Routes to | What it does |
|---|---|---|
| `audit` | `agent-config ui:audit` | Inventory the tree into `agents/runtime/state/ui-audit.json`. Class A. |
| `render` | `agent-config ui:render` | Capture desktop / 375 / 320 into `agents/runtime/state/render/`. Class A. |
| `review` | [`design-review`](../../../skills/design-review/SKILL.md) | Two-pass review — judgement before detector, or the `DEGRADED: single-context` banner. |
| `polish` | [`fe-design`](../../../skills/fe-design/SKILL.md) | Spacing, rhythm, alignment. |
| `quieter` | `fe-design` | Spacing, weight, contrast within the palette. |
| `bolder` | `fe-design` | Palette, type family, weight, scale. |
| `distill` | `fe-design` | Content density, spacing. |
| `harden` | `fe-design` | Accessibility, focus, contrast within the palette. |
| `clarify` | `fe-design` | Hierarchy, copy, labels. |

## The six verbs are one field, not six commands

Each verb declares the `ui_authority` dimensions it may touch
([contract](../../../docs/contracts/ui-authority.md) § The six operations).
That makes a collision **decidable** rather than a judgement call:

```
A VERB WHOSE DECLARED DIMENSIONS COLLIDE WITH A CONSTRAINT SURFACES A
`conflicts[]` ENTRY AND PERFORMS NO WRITE. IT NEVER "MOSTLY" APPLIES.
```

`bolder` under `change_intent: preserve` is the worked case: it wants `palette`
and `type_family`, both locked, so it reports two conflicts and writes nothing.
`polish` under the same authority is clean, because spacing and rhythm are
outside the preserve threshold — which is the whole reason that threshold is
narrow.

## No argument — the menu is built from artefacts, not from a list

With no verb, read what is actually on disk and offer only what applies:

1. `agents/runtime/state/ui-audit.json` — present and fresh? Its `audit_path`
   and `coherence_signals` say whether an audit is needed at all.
2. `agents/runtime/state/render/*/manifest.json` — the last capture, its
   `verification`, and any `horizontal_overflow: true` viewport.
3. The changed UI files in the working tree, per `_lib/ui_surface.ts`.

A menu assembled from those three is a menu about this repository. A fixed list
of nine verbs is a menu about this command, which is not what the user asked.

## Order

`audit` before any write on a non-trivial change; `render` before a verdict that
claims anything about a viewport; `review` after the write. A verdict with no
render says which static checks ran and scopes itself — it never says "looks
good" with nothing behind it.

## Do NOT

- Do NOT add a tenth verb without removing one. The point of one field is that
  the set stays small enough to reason about.
- Do NOT apply a verb whose conflicts array is non-empty.
- Do NOT infer `surface_mode` or `change_intent` here — read the authority
  object. Re-deriving them is the drift the contract exists to prevent.
- Do NOT promote this to a skill. The routing is the whole content.
