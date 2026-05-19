---
name: ui-component-architect
description: "Use when shaping a UI component tree — composition vs inheritance, slot patterns, prop API design, controlled vs uncontrolled, polymorphic — even on 'split this component'."
personas:
  - frontend-engineer
source: package
domain: engineering
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

# ui-component-architect

> Decide the **shape** of a component tree before the markup is
> written. Picks composition over inheritance, names the slot
> contract, draws the controlled/uncontrolled axis, and stops
> prop bags from growing into god-components. Stack-agnostic —
> the same lens applies to Blade, Livewire, React, or Vue trees.
> Pair with [`existing-ui-audit`](../existing-ui-audit/SKILL.md)
> first; never invent components that already exist.

## When to use

- A new component / screen is being designed and the boundary
  between parent and children is unclear.
- An existing component has > 10 props, conditional rendering
  trees nested ≥ 3 deep, or a `variant`-prop with > 4 values.
- A primitive (button, card, dialog) is being added to the design
  system and its API will be reused across teams.
- German triggers: "wie schneide ich die Komponente?", "Slots
  oder Props?", "controlled oder uncontrolled?".

Do NOT use when:

- The component is a one-off, used in one place, and unlikely to
  be reused — over-architecting hurts more than it helps.
- The question is **styling**, not shape — route to
  [`tailwind-engineer`](../tailwind-engineer/SKILL.md).
- The audit step has not run — route to
  [`existing-ui-audit`](../existing-ui-audit/SKILL.md) first; reusing
  beats inventing.

## Procedure

### 1. Inspect prior art, state the responsibility in one sentence

Review existing components in the codebase for the same
responsibility — extend rather than rebuild when a match is found.
If none exists, write the new component's purpose: *"Renders a
labelled input with inline error and hint."* If the sentence has an
"and" joining two unrelated jobs, the component is two components.
Reject the draft and split before continuing.

### 2. Pick composition over inheritance

Rules of thumb:

| Pattern | When |
|---|---|
| Compound components (`Card.Header`, `Card.Body`) | Multiple slots with order semantics |
| Children + named slots | One main child, plus 1–2 optional regions |
| Render props / function-as-children | Caller controls rendering of internal state |
| Polymorphic (`as` prop) | Same shell, different semantic element |
| Inheritance / class-extension | Almost never — last resort for legacy adapters |

Composition trades verbose call-sites for a tiny, stable component.
Inheritance trades short call-sites for ABI fragility.

### 3. Draw the controlled / uncontrolled axis

For every piece of state (open, value, selected, expanded), pick:

- **Controlled** — caller passes value + onChange. Caller owns
  state. Use when state must sync across siblings or persist.
- **Uncontrolled** — component owns state internally; caller reads
  via ref or onChange callback. Use for ephemeral state local to
  the component.
- **Controlled with default** — both APIs supported via
  `defaultValue` + optional `value`. The most flexible, also the
  most code; reserve for design-system primitives.

Mixing controlled / uncontrolled in the same prop without a
default is the single largest source of "why doesn't my component
update?" tickets.

### 4. Cap the prop API

Prop budget per component:

| Tier | Cap |
|---|---|
| Primitive (Button, Input) | ≤ 6 props + `...rest` to underlying element |
| Composite (Card, Dialog) | ≤ 8 props; prefer slots for variants |
| Page section / feature shell | ≤ 4 props; everything else via context |

Over-budget triggers a refactor: extract a config object, push
state into context, or split into compound parts.

### 5. Name the slot contract

For every slot, document: required vs optional, expected element
type or component, default rendering when absent, accessibility
implications (does the slot become the accessible name?). Slots
without contracts become "stuff a div in there and pray".

## Output format

Return:

1. Responsibility + composition pick — single-sentence purpose, chosen
   pattern (compound / slots / render-props / polymorphic) with the
   one-line trade-off.
2. State + prop API — controlled / uncontrolled / both per state piece,
   prop list with type and purpose, slot inventory with a11y notes.
3. Anti-case list — the combinations the component refuses to support
   (the explicit "no" surface that callers can rely on).

Concrete shape:

```
Component:        <Name>
Responsibility:   <one sentence — reject if "and" joins two jobs>
Pattern:          <compound | slots | render-props | polymorphic>
State:            value=<controlled|uncontrolled|both>; open=<...>; ...
Props (≤ tier):   [name: type — purpose]
Slots:            [name: required? default? a11y note]
Children:         <count, kind>
Anti-cases:       <combinations the component refuses to support>
```

## Gotcha

- `variant` props with > 4 values are usually two components in a
  trench coat — split when the rendering branches diverge.
- `as` polymorphism is cheap in TypeScript when typed via generics,
  expensive without — the type cost is invisible in plain JS.
- Compound components share state via context; nesting two
  compound trees of the same family in one parent silently
  crosses contexts — namespace the context per instance or
  refuse the nesting.
- "Render props" + memoization fight; if the function changes
  every render, the child re-renders too. Stabilize via
  `useCallback` or hoist.

## Do NOT

- Do NOT design a component without running
  [`existing-ui-audit`](../existing-ui-audit/SKILL.md) first.
  Reinventing primitives is the #1 source of design drift.
- Do NOT use inheritance when composition fits — class-extension
  hierarchies in UI age badly.
- Do NOT ship a "kitchen-sink" prop (`config={...}`) just to dodge
  the prop cap — that hides the API instead of taming it.
- Do NOT push the architecture into the tracker as code AC — output
  is a design note for refinement, not implementation steps.
