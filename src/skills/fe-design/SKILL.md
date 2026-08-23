---
model_tier: medium
name: fe-design
description: "Frontend design heuristics — and, outside the ticket engine, the loop that applies them: audit, brief, inventory, build, review. Use when building or changing any UI, not only when planning one."
personas:
  - frontend-engineer
domain: engineering
workspaces:
  - engineering
packs:
  - engineering-base
---

# Frontend Design Skill

## Ad-hoc mode — outside the engine, YOU run this loop now

One question decides which mode you are in: **is a `/implement-ticket` run
dispatching this?**

| Situation | Who owns the UI write | This skill is |
|---|---|---|
| A ticketed run — the UI directive set is dispatching | `directives/ui/*` | a reference it cites |
| Anything else — "build me the page", "improve this form", "implement the approved design" | **you, in this turn** | the executor |

Outside the engine, nothing else owns the design quality of a UI write. Reading
this skill and then writing the UI from priors is the failure it exists to
prevent — the loop below is not optional context, it is the work.

**Skip only when the change is `ui-trivial`, decidable off the diff:** ≤ 1 file,
≤ 5 changed lines, no new component, no new state, no new dependency. Anything
else runs the loop.

### The loop

1. **Audit first** — run [`existing-ui-audit`](../existing-ui-audit/SKILL.md).
   What already exists (components, tokens, layout conventions) outranks every
   heuristic below. Reinventing an existing component is the #1 failure mode.
2. **Brief** — cover the same five keys the engine requires before any code:
   `layout`, `components`, `states`, `microcopy`, `a11y`. `states` means all
   five of `empty`, `loading`, `error`, `success`, `disabled` — a brief missing
   one is unfinished, not concise.
3. **Inventory — only when an artifact was provided, and before you build.**
   List the artifact's **interactions, keyframes, and script includes** from its
   source (`design-fidelity-mechanics` § Data-basis ladder — read it, do not
   look at a picture of it). Then place **every** listed item in exactly one
   bucket, using the engine's own names (`apply.ts`, `COVERAGE_BUCKETS`) so the
   two surfaces read the same. **Nothing enforces that they stay the same** —
   this is a copied vocabulary, not a shared constant, and no test pins it;
   renaming a bucket in the engine leaves this list stale and silent:

   | Bucket | Meaning |
   |---|---|
   | `honoured` | carried over as-is |
   | `translated` | carried over in a different shape (a handler became a framework binding) |
   | `flagged` | **not** carried over — with the reason, in the output |

   Dropping a handler stays allowed; hiding one does not. An item in no bucket
   is the failure this step exists to catch — "missing JavaScript" is what it
   looks like from the user's side. Inside the engine this is enforced
   (`apply.ts`, `COVERAGE_BUCKETS`, an unaccounted item is a halt); out here it
   is a duty you carry, and nothing checks it for you. (fixture:
   `daf-adhoc-port-coverage`.)
4. **Build** — against the audit's primitives, in the project's stack. Where the
   artifact's own markup/CSS/JS is stack-compatible, adapt **that code**;
   re-deriving it from scratch is a deviation needing confirmation
   (`design-fidelity-mechanics` § Adopt the code).
5. **Review, then re-enter** — run [`design-review`](../design-review/SKILL.md)
   before calling it done, and scope the verdict honestly: render-scoped when
   you can render it, otherwise explicitly static-scoped, naming which checks
   actually ran. "Looks good" with neither scope named is a verdict without
   evidence. Findings → fix them and **re-enter step 5**, at most **2 rounds**,
   and **stop early on a null**: a round that produces **no new finding** ends
   the loop, and a round that produces only findings the provided artifact
   already covers produces no new finding. At the 2-round ceiling with findings
   still open, stop and hand the remaining list back — ship-as-is or abort is
   the user's call, never another silent pass. Judgement alone never buys a
   third round.

   The ceiling is **2**, the same number the engine enforces
   (`directives/ui/polish.ts`, `POLISH_CEILING`), so the ad-hoc path and the
   ticketed path bound the loop identically rather than by two conventions that
   can drift. Fixtures: `daf-adhoc-converges` (round 2 is a null, loop ends) and
   `daf-adhoc-ceiling` (findings remain at the ceiling, loop hands back).

### The heuristics — here, not one hop away

The load-bearing subset, inline so that "loaded" means the content is in
context. Depth stays in [`references/design-patterns.md`](references/design-patterns.md).

1. **Audit outranks heuristic.** A token, primitive or convention the audit
   found wins over anything on this list; say `[audit override]` when it does.
2. **Reuse tokens, never raw values.** A hex, font or px literal where the
   audit found a token is off-brand by construction.
3. **All five states are designed.** `empty` is a helpful message, not a blank
   region; `loading` prefers a skeleton over a spinner (it shows structure, so
   it reads as faster); `error` says what to do next.
4. **Labels are always visible.** No placeholder-only inputs.
5. **Validate on blur and on submit**, never on every keystroke; the message
   goes below the field and is specific.
6. **Mobile-first, and 320 px actually works.** Default styles are the small
   viewport; complexity is added at larger breakpoints, never removed at
   smaller ones.
7. **A11y minimums are non-negotiable:** 4.5:1 contrast for text (3:1 large),
   every interactive element reachable by Tab, a visible focus ring, semantic
   elements over `div`, and an `aria-label` wherever there is no visible text.
8. **Every action gets feedback.** Users read silence as failure.
9. **Prefer undo over a confirmation dialog** — confirmations get clicked
   through; an undo affordance actually protects the user.
10. **Tables:** numbers right-aligned, text left-aligned, a designed empty
    state, and a sticky header on anything long enough to scroll.
11. **No placeholder microcopy ships.** Lorem ipsum, `TODO`, and
    `[Your text here]` are unfinished output, not drafts.

Before proposing a direction, run the anti-slop scan named under
[Anti-slop discipline](#anti-slop-discipline) below.

## Positioning — reference inside the engine, executor outside it

Inside a `/implement-ticket` run, `fe-design` is a **universal reference
skill**: it carries stack-agnostic heuristics the UI directive set cites, and
it does not own the flow. The ownership table below applies **to that mode**.
Outside the engine the table has no dispatcher behind it — the ad-hoc loop
above is the owner instead.

| Concern | Owner (engine-mediated runs) |
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

**Inside a ticketed run**, do NOT use this skill to:

- Implement components — that is the apply-step's stack-dispatched skill
- Audit an existing UI — that is `existing-ui-audit`
- Drive the full UI flow — that is the `directives/ui/` orchestrator

Outside a ticketed run, the first and third lines invert: no dispatcher is
running, so implementation quality and the flow are yours. The second holds in
both modes — the audit is always `existing-ui-audit`; you invoke it, you do not
replace it.

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
- Do NOT use this skill as an executor INSIDE a ticketed run — there the executor is `directives/ui/design.ts` and this is the reference it cites. Outside one, the ad-hoc loop at the top of this file IS the executor; do NOT read the reference and then write the UI from priors.
