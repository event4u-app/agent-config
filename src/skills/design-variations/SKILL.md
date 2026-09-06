---
model_tier: inherit
name: design-variations
description: "Produce 3+ substantively distinct hi-fi design variations — basic to bold, one file with tweak controls — when the user asks for options, alternatives, or \"show me a few takes\". Extends fe-design."
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
scope:
  write: []
  verification_reason: "execution declares no handler, so this skill runs nothing of its own — every write is the calling agent's, under the rules that govern it. No command can prove a scope the skill never executes."
execution:
  type: manual
---

# Design Variations

Produce multiple substantively distinct design variations so the user can
reject what they don't want and combine what they do. One design is one bet;
three variations surface preferences the user didn't know they had.

## When to use

- The user asks for options, alternatives, "different takes", "show me a few"
  on hi-fi UI work (screen, component, flow, visual treatment).
- After a `wireframe` round settled the structure and the user wants styled
  directions on top of it.

**When NOT to use:** structure/flow exploration before any styling decision →
[`wireframe`](../wireframe/SKILL.md) (lo-fi, disposable). Selecting ONE
grounded direction without generating alternatives →
[`design-intelligence`](../design-intelligence/SKILL.md). Reviewing an
existing design → [`design-review`](../design-review/SKILL.md).

## Procedure

1. **Baseline.** Confirm what is varied (screen / component / flow / visual
   treatment), the existing design context (DESIGN.md, brand tokens, UI kit —
   run [`existing-ui-audit`](../existing-ui-audit/SKILL.md) when the output
   lands in a real codebase, per the `ui-audit-gate` rule), the count
   (default 3, ceiling 6), and the user's priority axis.
2. **Pick 2–4 axes** to vary across: visual treatment (tone, density, shadow,
   radius, type weight), layout (centered/asymmetric, single/multi-column,
   full-bleed/inset), interaction model (single page vs multi-step, modal vs
   inline), hierarchy (what is primary), tone (minimal/formal/playful/
   editorial), component style. Map axes onto the project's Taste Dials
   (Variance/Motion/Density) where DESIGN.md defines them.
3. **Spec each variation BEFORE building** — one line per variation naming
   its distinct palette family, type pairing, and layout skeleton. Left
   unspecified, variations converge on one default look; variety must be
   designed, not hoped for. Ground palette/type picks via
   [`design-intelligence`](../design-intelligence/SKILL.md) and emit values
   as tokens per [`design-tokens`](../design-tokens/SKILL.md).
4. **Build basic → bold.** Variation 1 = by-the-book (matches existing
   patterns); variation 2 = refined (same structure, one or two dimensions
   pushed — often the actual pick); variation 3 = novel (genuinely different
   layout/metaphor/aesthetic, deliberately off-distribution). Cover both
   ends — an all-safe set wastes the round, an all-wild set ignores the brief.
5. **Substantive, not cosmetic.** Two variations that differ only in button
   color or shadow opacity are one variation — drop and replace. Litmus: the
   user can articulate the difference between any two variations in one
   sentence.
6. **Present in a single file** with tweak controls — never `v1.html` /
   `v2.html` / `v3.html`. Structure-sharing variants toggle via CSS custom
   properties + a small floating "Tweaks" panel (3–8 controls: color picker,
   font/variant dropdown, density slider, section toggles, copy inputs);
   persist chosen values in `localStorage`. Structurally distinct variants
   render side-by-side with labels. Even unasked, expose 1–2 tweak axes by
   default.
7. **Caption each variation** (1–2 sentences naming the axis it flexes) and
   **close with a recommendation** — a designer offers an opinion; the user
   decides.
8. **Quality gate.** Novel ≠ sloppy: run `lint_design_slop` over the emitted
   file (every variation individually passes; a DESIGN.md-declared direction
   suppresses its flags) and honor the outward-artifact hygiene floor (Q13 in
   [`design-antipatterns.md`](../../../docs/guidelines/design-antipatterns.md)) —
   no workspace paths, skill/tool names, or generator traces in the markup.
   Final pass before delivery → [`design-review`](../design-review/SKILL.md).

## Output format

1. **One HTML/JSX file** containing all variations — side-by-side sections or
   custom-property-driven variants with a floating Tweaks panel (3–8 controls,
   `localStorage`-persisted); no per-variation file scatter.
2. **Variation spec block** (comment or intro): per variation one line —
   axis flexed, palette family, type pairing, layout skeleton.
3. **Captions + one recommendation** naming the suggested pick and why, with
   the trade-off of the runner-up.
4. **Clean slop scan** — `lint_design_slop` output for the file (flags
   resolved or DESIGN.md-justified), no Q13 violations.

## Do NOT

- Do NOT produce variations that differ only cosmetically (color swap, shadow
  tweak) — replace with a substantive alternative.
- Do NOT scatter `v1/v2/v3` files — one file, toggleable.
- Do NOT let variations drift into one house style — spec palette/type/layout
  per variation before building.
- Do NOT skip the recommendation — presenting options without an opinion
  pushes the decision cost back onto the user.
- Do NOT invent brand values — consumer brand tokens win
  (`brand-source-of-truth`); the corpus fills gaps only.
- Do NOT embed system internals (paths, skill/tool names, generator traces)
  in the emitted markup — Q13.

## Gotcha

- The "novel" variation is where slop concentrates: off-distribution choices
  still pass the antipatterns catalog — deliberate ≠ default. Declare the
  direction in the spec block so `lint_design_slop` gating reads intent.
- Tweak panels leak into delivery: the panel must be removable (single
  `<script>`/`<aside>` block, clearly marked) so the chosen variant ships
  without exploration chrome.
- More than 6 variations degrades choice quality — the user can't hold them
  in mind; split into two rounds on different axes instead.

## See also

- [`wireframe`](../wireframe/SKILL.md) — lo-fi structure exploration before this.
- [`design-intelligence`](../design-intelligence/SKILL.md) — grounded direction/palette/type selection.
- [`design-tokens`](../design-tokens/SKILL.md) — token emission for variation values.
- [`fe-design`](../fe-design/SKILL.md) — production heuristics the by-the-book variation follows.
- [`design-review`](../design-review/SKILL.md) — final gate before delivery.
- [`docs/guidelines/design-antipatterns.md`](../../../docs/guidelines/design-antipatterns.md) — catalog + Q13 outward-artifact hygiene.
