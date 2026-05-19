---
name: livewire-architect
description: "Use when shaping a Livewire component before code — full-page vs partial, parent/child split, event flow, state-vs-props boundary, hydration cost — even on 'add this Livewire component'."
personas:
  - frontend-engineer
source: package
domain: engineering
workspaces:
  - engineering
packs:
  - laravel
lifecycle: active
trust:
  level: professional
  confidence: high
  human_review_required: false
install:
  default: false
  removable: true
---

# livewire-architect

> Architectural lens **above** the existing tactical [`livewire`](../livewire/SKILL.md)
> skill. Decides component shape, lifecycle ownership, and the
> full-page-vs-partial split *before* the first `mount()` is written.
> The `livewire` skill handles Flux-component patterns and hydration
> debugging once the shape is locked.

## When to use

- A Livewire feature is about to be built and the boundary between
  components is unclear (one big component vs nested children?).
- An existing component is "doing too much" — multiple unrelated
  concerns, large `$listeners`, props bag growing turn over turn.
- A page mixes Livewire + Blade partials and the data flow is
  ambiguous (who owns `$user`, who emits, who listens?).
- German triggers: "wie schneide ich das?", "Vollseite oder
  Teilkomponente?", "wer feuert das Event?".

Do NOT use when:

- The shape is already locked and the question is mechanical
  (Flux variant, `wire:model` modifier, `@entangle`) — route to
  [`livewire`](../livewire/SKILL.md).
- The page has no Livewire — pure Blade or Inertia/React — route
  to [`blade-ui`](../blade-ui/SKILL.md) or [`react-shadcn-ui`](../react-shadcn-ui/SKILL.md).
- The bug is a runtime hydration error — debug with `livewire`,
  not redesign with this skill.

## Procedure

### 1. Analyze the existing screen — before designing anything

Inspect the route and read the existing Blade / Livewire files to
understand what's already there. List every dynamic surface on the
page (form, table row, modal, nav badge). Mark each: **shared
state** (other surfaces re-render on change), **local state** (only
this surface cares), **server state** (must hit DB / queue). This
analysis feeds every later step — do NOT skip ahead before the
inventory is on paper.

### 2. Choose the component shape

Pick one **before** writing code:

| Shape | When | Cost |
|---|---|---|
| Full-page component | Route owns the whole screen, single backing model, ≤ 3 related actions | Cheapest; one mount, one render |
| Parent + nested children | Two or more independent state islands on one route | Two mounts; coordinate via events, not props churn |
| Partial component on Blade | Mostly static page, one reactive island | Cheap; component sees the world via props only |
| Stack of full-page components | Wizard / multi-step flow with own URL per step | Expensive; pick only when URL semantics matter |

Rule: if a child needs ≥ 4 props from the parent and emits ≥ 3
events back, the boundary is wrong — collapse or re-cut.

### 3. Lock the state-vs-props boundary

For each piece of data the component reads, mark **public property**
(reactive, persisted in payload, expensive to dehydrate) or
**computed / method-local** (cheap, recomputed on render). Public
properties are the budget — keep ≤ 8 per component; more means
the component is doing two jobs.

### 4. Map the event flow

Draw the events: `dispatch('foo')` → who listens? Cross-component
events use `dispatch()`; parent ↔ child stays on `$parent.method()`
when the child is owned. Avoid global events for parent-owned
children — they break the ownership story.

### 5. Lifecycle ownership

For each side-effect (DB write, queue dispatch, redirect, flash),
name the lifecycle hook: `mount` (one-time setup), `boot` (every
request, idempotent), action method (user-initiated), `updated*`
(reactive on property change). One hook per side-effect; if two
hooks fire the same write, the design is wrong.

### 6. Validate the design — before any code is written

Walk the design back through these checks; every "no" means
re-cut, not push forward:

- Each component owns ≤ 8 public properties.
- No child needs ≥ 4 props *and* emits ≥ 3 events back.
- Every event has exactly one named listener.
- Each side-effect maps to exactly one lifecycle hook.
- The component shape table is filled in (no `<TBD>` cells).

If any check fails, return to the relevant step and re-cut. The
design must be approved by the user before handing off to
`/livewire` for implementation.

## Output format

Return:

1. Component shape decision — full-page / parent+children / partial /
   stack — with the one-sentence trade-off rationale.
2. Component inventory — for each: public props (≤ 8), state islands
   owned, events listened/dispatched, side-effects on mount and action.
3. Boundary-risk list and tactical follow-up — prop bags > 8, event
   chains > 3 hops, shared mutable state, and the next handoff.

Concrete shape:

```
Screen:           <route or feature>
Component shape:  <full-page | parent+children | partial | stack>
Why:              <one sentence — the trade-off chosen>

Components:
  - <Name> (full-page | partial)
      Public props: [a, b, c]   (≤ 8)
      Owns:         <state islands>
      Listens to:   [event1, event2]
      Dispatches:   [event3]
      Side-effects: mount=<...>, action=<...>

Boundary risks:
  - <prop bag > 8 / event chain > 3 hops / shared mutable state>

Tactical follow-up:
  Hand off to /livewire for Flux variant + hydration check.
```

## Gotcha

- Livewire 3 reactive props are not free — every public property
  ships in the payload. Big arrays / DTOs as public state are a
  performance bug waiting to fire under load.
- Parent-owned children and global events do not mix; pick one
  ownership story per component tree.
- "Just one more public property" is the smell that turns a partial
  into a god-component over three tickets.
- Full-page component + Flux modal stack: the modal owns its own
  mount cycle; do not push modal state into the page component.

## Do NOT

- Do NOT write `mount()` / Blade partials before the shape table is
  filled in — picking the shape after coding is the most common
  source of refactor debt.
- Do NOT cite this skill alongside [`livewire`](../livewire/SKILL.md)
  in the same step — they sit at different tiers; pick one per phase.
- Do NOT design Inertia / React components with this skill — the
  state-vs-props axis differs; route to the matching stack skill.
- Do NOT push the architecture into the tracker as code AC — output
  is a design note for refinement, not implementation steps.
