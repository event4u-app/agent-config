---
model_tier: inherit
name: design-system-capture
description: "Write and maintain DESIGN.md + PRODUCT.md — captures visual decisions and interaction patterns so design tasks stay consistent across sessions without re-scanning past work."
domain: engineering
personas:
  - frontend-engineer
workspaces:
  - engineering
packs:
  - frontend-design
token_budget_class: rich
execution:
  type: manual
---

# design-system-capture

> Solves "design amnesia" — the failure mode where every AI design task
> re-invents visual patterns (radius, shadows, motion, spacing) and
> interaction patterns (destructive-action handling, optimistic UI, filter
> persistence) because the agent has no cross-task memory of decisions
> already made.
>
> **Boundary:** `brand-to-tokens` extracts *primitives* (colors, font
> families → DTCG tokens). `existing-ui-audit` inventories *what exists*.
> **This skill captures *usage decisions*:** "we use 8px radius for
> elevated surfaces", "all destructive actions require typed confirmation".
> They are complementary, not redundant.
>
> Gated by `tokens.rich_skills` in `.agent-settings.yml` (default `on`).
> If `off`, skip rich context loading and work from brief alone.

## Why this skill is rich

DESIGN.md and PRODUCT.md serve as the project's design memory. To write
useful capture documents and to read/apply them effectively, the agent
needs full templates with worked examples showing what a well-structured
DESIGN.md and PRODUCT.md look like in practice. A condensed version that
says "write down your design decisions" produces documents too vague to
be useful. The worked examples teach agents both the *vocabulary*
(elevation, motion strategy, destructive-action policy) and the
*specificity level* that makes these documents actionable across tasks.

## When to use

- Starting a new consumer project (initial capture, run once early)
- After 2+ design tasks in the same project (update to capture what was decided)
- When a subsequent design task produces inconsistent results (audit and reconcile)
- Explicitly asked: "capture the design system", "write a DESIGN.md", "document our patterns"

## The two documents

### `DESIGN.md` — visual-system decisions

Captures the *visual usage decisions* (not token primitives) that agents
should apply consistently across all UI tasks in this project. Unlike
`.tokens.json` (which records what a color value IS), DESIGN.md records
*how and when to use it*.

**Format:**

```markdown
# DESIGN.md — [Project name] visual system

> AI-readable project design memory. Update after each design decision.
> Last updated: [date]

## Design philosophy
One sentence: [density/formality/complexity philosophy]
Example: "Information-dense dashboard; optimize for power users, not casual exploration."

## Visual system

### Elevation and radius
- Elevated surfaces (modals, sheets, dropdowns): [X]px radius, [shadow-spec]
- Inline elements (cards, chips): [X]px radius
- Buttons: [X]px radius

### Shadows
- Elevated: [box-shadow value]
- Floating (tooltips, popovers): [box-shadow value]
- None (flat cards): [confirm]

### Motion
- Overlays and modals: [spring / easing spec + duration]
- Micro-interactions (button feedback, toggles): [duration + easing]
- Page transitions: [strategy or "none"]

### Spacing
- Base unit: [X]px
- Card padding: [spec]
- Section gap: [spec]
- Tight grouping: [spec]

### Color usage
- Primary action: [token name]
- Destructive: [token name]
- Surface hierarchy: [primary bg → secondary bg → elevated bg]

## Stack and conventions
- CSS approach: [Tailwind / CSS modules / styled-components / etc.]
- Component primitives: [shadcn / Radix / Headless UI / custom]
- Icon system: [Phosphor / Heroicons / Lucide / etc.]
```

### `PRODUCT.md` — cross-feature interaction patterns

Captures *interaction decisions* that should be consistent across features.
Unlike a feature spec (which describes one feature), PRODUCT.md captures
patterns that apply everywhere.

**Format:**

```markdown
# PRODUCT.md — [Project name] interaction patterns

> AI-readable cross-feature pattern memory. Update when a new pattern is established.
> Last updated: [date]

## Destructive actions
Policy: [typed confirmation ("DELETE") / dialog with verb button / undo toast / etc.]
Example: "All destructive actions require the user to type 'DELETE' or the resource name."

## Mutation feedback
Policy: [optimistic UI + inline undo / loading spinner / success toast / etc.]
Undo window: [N seconds, or "not applicable"]
Example: "Optimistic UI for all mutations; inline undo toast for 5 seconds, then commit."

## Filter and sort persistence
Policy: [URL params / localStorage / session / not persisted]
Restore on load: [yes / no]

## Empty states
Approach: [illustration + CTA / text only / skeleton / etc.]
Example: "Illustration + primary CTA for empty lists; text-only for zero-search-results."

## Error handling
Approach: [inline field errors / toast / error boundary / etc.]
Network errors: [retry + message / fail fast / etc.]

## Navigation and routing
Pattern: [SPA / MPA / hybrid / etc.]
Active state: [how active nav items are marked]

## Mental model
One sentence: [how the product conceptualizes itself to the user]
Example: "Dashboard = control panel for power users, not an exploration space."
```

## Procedure

### Step 1 — Assess what exists

1. Check if `DESIGN.md` and `PRODUCT.md` already exist in the project root.
2. If they exist: read both → skip to Step 3 (Update).
3. If they don't exist: run `existing-ui-audit` (if not already done for this session) to inventory existing components, tokens, and conventions → proceed to Step 2.

### Step 2 — Create (first run)

1. **Extract visual decisions from the audit** (`state.ui_audit`): dominant
   radius values, shadow patterns, spacing conventions, motion patterns.
   Fill the DESIGN.md template above with the observed values. Mark
   un-observed sections as `TBD`.
2. **Extract interaction decisions from the codebase**: scan for delete
   confirmation patterns, toast/feedback patterns, filter/URL persistence.
   Fill the PRODUCT.md template. Mark un-observed sections as `TBD`.
3. Write `DESIGN.md` and `PRODUCT.md` to the project root.
4. Surface a one-paragraph summary: what was captured, what is still TBD,
   and what action the user should take (review and correct the TBDs).

### Step 3 — Update (subsequent runs)

1. Read existing `DESIGN.md` and `PRODUCT.md`.
2. Identify any decisions made in recent tasks that aren't yet captured
   (e.g., a modal was built with 12px radius — add that to DESIGN.md).
3. Correct any TBDs that are now resolved.
4. Update the "Last updated" date.
5. Output a diff summary: what changed and why.

## How the design skills consume these documents

When `DESIGN.md` or `PRODUCT.md` is present in the project root:

- **`design-intelligence`** and **`fe-design`**: read DESIGN.md at the
  start of any design task — use the captured decisions as project
  constraints that override corpus suggestions.
- **`ui-component-architect`**: read DESIGN.md for radius/shadow/motion
  conventions before proposing any new component.
- **`existing-ui-audit`**: when a full audit is impractical (large project),
  read DESIGN.md as a proxy for "what this project's conventions are".

The boundary from `brand-to-tokens`:
- `.tokens.json` carries primitive values (gray-700 = #374151)
- DESIGN.md carries usage decisions (elevated surfaces use 8px radius,
  not 4px or 12px)
Both are consumed together; DESIGN.md takes precedence for usage questions.

## Gotcha

- **Over-writing instead of diff-updating** — the most common failure.
  Always read existing `DESIGN.md`/`PRODUCT.md` before writing; carry
  all existing decisions forward and only add/correct. Losing prior
  captured history is worse than capturing nothing.
- **Copying tokens into DESIGN.md** — DESIGN.md is NOT a copy of
  `.tokens.json`. It captures *usage decisions* ("8px radius on elevated
  surfaces"), not primitive values ("gray-700 = #374151"). The
  distinction is what makes DESIGN.md actionable.
- **Capturing feature-specific behavior** — PRODUCT.md is for patterns
  that repeat across 2+ features. A delete-confirmation pattern in one
  form does NOT belong in PRODUCT.md until it appears in at least two
  independent features.

## Do NOT

- Do NOT overwrite DESIGN.md/PRODUCT.md without first reading and diffing
  the existing content — accumulated history is the value.
- Do NOT make DESIGN.md a copy of `.tokens.json` — it captures decisions,
  not token definitions.
- Do NOT capture feature-specific behavior in PRODUCT.md — only patterns
  that repeat across multiple features.
- Do NOT mark a decision as captured without evidence from the actual codebase.

## Output format

On create:
1. Write `DESIGN.md` to the project root with the extracted visual decisions.
2. Write `PRODUCT.md` to the project root with the extracted interaction patterns.
3. Surface a one-paragraph summary of what was captured and what is TBD.
4. List any questions where the existing code is ambiguous.

On update:
1. Update both files with new decisions.
2. Output a short diff: "Added: destructive-action policy. Updated: motion strategy (was TBD, now spring)."
