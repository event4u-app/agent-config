---
model_tier: high
name: ui-component-architect
description: "Shaping a UI component tree — composition vs inheritance, slot patterns, prop API design, controlled vs uncontrolled, polymorphic — on 'split this component'. Feeds react-shadcn-ui."
personas:
  - frontend-engineer
domain: engineering
workspaces:
  - engineering
packs:
  - engineering-base
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

## Componentization threshold — ≥4 repeats AND real state

Extract a **stateful component** only when an element **repeats ~4× or more AND
carries real props/state** (the stateful-component bar of the per-class canon,
[`abstraction-thresholds`](../../../docs/guidelines/abstraction-thresholds.md) —
it does not lower the code-level two-repetition bar). One or two repeats, or a
repeat with no varying props, is not a component — inline it (a props-only
shell earns extraction at 3+ uses). A long single-file body is **normal**, not a smell;
premature extraction (a "component" used once, or a pure-markup fragment split
for tidiness) adds indirection without reuse and is the more common mistake
than under-splitting. Meet BOTH conditions before you extract.

## Procedure

### 1. Inspect prior art, state the responsibility in one sentence

**Read `DESIGN.md` § Owned components first** — it is the project's own inventory of what
it already owns (component, status, story file, registry item), filled from the story files
rather than from memory by
[`design-system-capture`](../design-system-capture/SKILL.md). It is the cheapest possible
prior-art check: one table, and a `deprecated` row tells you not to reach for something that
still exists in the tree. Absent or empty → fall through to
[`existing-ui-audit`](../existing-ui-audit/SKILL.md), which reads the codebase itself.

Then review existing components in the codebase for the same
responsibility — extend rather than rebuild when a match is found.

**A new component's workshop is part of its design, on every React lane and not
only `react-shadcn`.** When the extraction is agreed, the story set comes from
[`storybook-workshop`](../storybook-workshop/SKILL.md) — one story per concept
off the state-coverage matrix below, which is what makes the component
agent-readable and its contrast floor checkable before it reaches a page. That
skill is stack-agnostic and ships in `engineering-base`, so a plain-`react`
project receives it exactly as a `react-shadcn` one does.
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

Over-budget is a **prompt to look**, not a verdict. Extract a config object,
push state into context, or split into compound parts — **or record why the
count is right for this component.**

```
THE CAPS ABOVE ARE ADVISORY. THEY ARE NOT A GATE AND MUST NOT BECOME ONE
WITHOUT A NEW MEASUREMENT. NOTHING COMPUTES THE TIER, SO NOTHING CAN APPLY THEM
AUTOMATICALLY EVEN IF IT WANTED TO.
```

**Why advisory, measured rather than asserted** (2026-08-24, one production
component library: 55 atoms, 3 molecules, 2 organisms):

| component | its level | props | cap here | over |
|---|---|---:|---:|---:|
| `file-upload` | **atom** | 19 | 6 | **3.2×** |
| `date-navigator` | molecule | 18 | 8 | 2.25× |
| `picker-sheet` | organism | 14 | 4 | **3.5×** |
| `duration-input` | molecule | 13 | 8 | 1.6× |
| `stepper` | molecule | 4 | 8 | — |

**The budget is INVERTED, and that is the finding rather than a calibration
error.** This table tightens as granularity rises. Reality goes the other way:
a higher-level component legitimately surfaces every label, callback and test id
of the pattern it orchestrates, so a cap that shrinks with tier flags the
components that are **correctly built** and clears the one that is 3.2× over.

**And for most components the number does not exist.** Between **45 % and 72 %**
of that library declares no root prop interface at all, depending on how you
count — `React.ComponentProps<'div'> & VariantProps<cva>` is the dominant idiom.
A cap over an uncountable quantity is not a lenient rule; it is no rule.

**The tier itself is not computable.** Composition depth, state, sub-component
count and prop count were each tested as a discriminator between the three
levels. **Every one overlapped completely, and several inverted.** Sub-component
count is the tempting replacement and fails the same way: `atoms/combobox`
exports **16**, more than every molecule (1, 1, 2) and more than one of the two
organisms. So there is no measurement that could assign the tier a cap would be
applied to.

**Revisit-if:** a corpus of levelled libraries — plural, and not four days old —
yields a discriminator that separates the tiers without overlap, at which point
the caps can be re-derived against it rather than restated. Until then these
numbers are a conversation starter for a human reviewer, which is the only role
the evidence supports.

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

## Cross-task design memory

Before proposing a component, check the project root for `DESIGN.md`
(written by `design-system-capture`). If present, apply its captured
visual conventions (radius/shadow/motion/spacing) to the new component
rather than deriving them from scratch. Flag any new design decision
(e.g., a first-use of a new elevation tier) for capture:
*"Suggest adding to DESIGN.md: [decision]."*

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
