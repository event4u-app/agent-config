---
stability: stable
---

# UI Track — Mental Model (1 page)

> **Audience:** anyone driving `/work` or `/implement-ticket` on a UI-shaped
> prompt, or reading code that touches `state.directive_set`.
> **Not a contract.** For shapes, schemas, and slot wiring see
> [`ui-track-flow.md`](contracts/ui-track-flow.md) and
> [`adr-product-ui-track.md`](contracts/adr-product-ui-track.md).
> **Not a roadmap.** Phased delivery lives in
> [`road-to-product-ui-track.md`](../agents/roadmaps/archive/road-to-product-ui-track.md)
> and [`road-to-visual-review-loop.md`](../agents/roadmaps/archive/road-to-visual-review-loop.md).
> This page is the picture you keep in your head while the engine runs.

## The three (+1) directive sets

| Set | Shape | Halt budget |
|---|---|---:|
| `backend` | `refine → memory → analyze → plan → implement → test → verify → report` | depends on confidence band |
| `ui` | `audit → design → apply → review → polish → report` | **2** (audit pick + design sign-off) |
| `ui-trivial` | `refine → apply → test → report` | **0** on the happy path |
| `mixed` | `refine → memory → analyze → contract → ui → stitch → verify → report` | inherits both |

The first three are sibling routes; `mixed` stitches `backend` and `ui`
in one envelope. The dispatcher picks one and refuses to switch
mid-flight.

## When to pick which

| Signal | Set |
|---|---|
| No UI keywords, no UI envelope, prompt edits services / migrations / tests / config | `backend` |
| New component / screen / partial; "improve this dashboard"; "build a settings panel"; major edit to a screen | `ui` |
| Bounded edit, **provably** ≤ 1 file, ≤ 5 changed lines, no new component, no new state, no new dependency | `ui-trivial` |
| One prompt that adds a backend endpoint **and** the screen that consumes it | `mixed` |

The classifier picks; the agent does not override the pick silently.
A misclassified `ui-trivial` that grows during edit must reclassify
**loudly** (stop, restart at `audit`) — never quietly upgrade in place.

## What the agent must never do

1. **Skip the audit.** No new component, screen, or partial without
   `state.ui_audit` populated (or `greenfield_decision` recorded).
   Defense-in-depth: dispatcher refuses *and* `ui-audit-gate`
   refuses, even when the engine is not in the loop.
2. **Render the UI.** The engine never opens a browser, never takes a
   screenshot, never runs axe. Rendering and a11y scanning happen
   out-of-process; the engine consumes the `preview_envelope` /
   `a11y` envelope written by the skill.
3. **Edit microcopy.** The design brief is **locked**. `apply` reads
   strings verbatim. `<placeholder>`, `lorem`, `todo:`, `tbd`, `xxx`
   are rejected at the producer (design) **and** the consumer (apply).
4. **Loop polish indefinitely.** Hard ceiling is 2 rounds, +1 with
   the explicit Extend pick (one-shot, never returns). Round 4 is
   rejected on disk regardless of flags.
5. **Confuse "ship as-is" with "review clean".** `review_clean=False`
   plus `findings=[]` is a malformed envelope, not a green light.

## Where each set stops

| Set | Stops cleanly when … | Stops with a halt when … |
|---|---|---|
| `ui` | `report` written; design brief + audit + apply + review + polish all `SUCCESS` | audit ambiguous · greenfield decision missing · design unconfirmed · review dirty at ceiling · a11y violation un-accepted · preview render failed |
| `ui-trivial` | `report` written; classifier preconditions held throughout | preconditions fail mid-flight → reclassify to `ui` (loud halt) |
| `mixed` | `stitch` joins both subtrees; `verify` + `report` clean | either subtree halts → mixed waits, never auto-completes the other |

## What "audit" actually means

A non-empty `state.ui_audit` carrying **at least one of**:

- `components_found` — `[{path, name, kind, similarity?}]` from
  [`existing-ui-audit`](../.agent-src/skills/existing-ui-audit/SKILL.md).
- `greenfield: true` plus `greenfield_decision ∈ {scaffold, bare, external_reference}`.
- Legacy `components` alias — same shape.

Empty dict, `null`, or a dict without those keys is **not** an audit.
The gate fires; the dispatcher emits `@agent-directive: existing-ui-audit`
instead of advancing.

## What "design locked" actually means

The brief carries `layout`, `components`, `states`, `microcopy`,
`a11y`. State coverage requires `empty`, `loading`, `error`, `success`,
`disabled`. `apply` does not re-decide microcopy — it copies strings.
"The button label feels off" is a **new** design pass, not a polish
fix.

## Polish termination — subjective vs objective

| Findings at ceiling | Halt branch | User options |
|---|---|---|
| Non-a11y only | `polish_ceiling_reached` | ship as-is · abort · hand off |
| Includes a11y violation | `polish_a11y_blocking` | extend (one-shot, sets `extension_used=True`) · accept (rule ids land in `accepted_violations`) · abort |

Pre-existing a11y violations recorded in `state.ui_audit.a11y_baseline`
stay informational and never block.

## Stack dispatch (apply / review / polish)

`state.stack.frontend` decides which skill bundle runs:

| Stack | Skill bundle |
|---|---|
| `blade-livewire-flux` | `flux` + `livewire` + `blade-ui` |
| `react-shadcn` | `react-shadcn-ui` |
| `vue` | `ui-apply-vue` |
| `plain` (or unknown) | `blade-ui` + Tailwind base |

The directive set stays `ui`; only the skill changes. Adding a new
stack ships as a new skill bundle and a recipe — see
[`ui-stack-extension.md`](contracts/ui-stack-extension.md).

## See also

- [`adr-product-ui-track.md`](contracts/adr-product-ui-track.md) — *why* this shape.
- [`ui-track-flow.md`](contracts/ui-track-flow.md) — slot-by-slot contract.
- [`ui-stack-extension.md`](contracts/ui-stack-extension.md) — adding a stack.
- [`ui-audit-gate`](../.agent-src/rules/ui-audit-gate.md) — the always-on rule that mirrors the dispatcher gate.
