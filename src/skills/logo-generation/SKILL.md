---
model_tier: inherit
name: logo-generation
description: "Generate a logo or brand mark — structured prompt, provider routing, and a true-vector path. Use for logo or brand mark generation."
domain: product
personas:
  - design-director
workspaces:
  - small-business
packs:
  - ai-image
trust:
  level: experimental
install:
  removable: true
scope:
  write: []
  verification_reason: "execution declares no handler, so this skill runs nothing of its own — every write is the calling agent's, under the rules that govern it. No command can prove a scope the skill never executes."
execution:
  type: manual
---

# logo-generation

Generate a logo or brand mark end-to-end: capture the brand brief, choose raster
vs. true-vector path, inject brand tokens when available, route to the right
provider, author a provider-specific prompt, dry-run the adapter, and apply rights
governance. All adapters are scaffold-tier (dry-run) until promoted to `stable`.

## When to use

- User asks to generate, create, or design a logo or brand mark.
- End-to-end logo production (path selection + routing + prompting + governance).
- When a simple geometric mark can be authored directly as SVG without a raster
  model.

## Procedure

1. **Capture the brand brief** — extract: business name, style intent (wordmark /
   icon mark / combination), colour palette, do/don't constraints (e.g. "no gradients",
   "must be legible at 16 px").
   **Critique mode** — when the user supplies a mark and asks what is wrong with
   it, skip generation: render it (step 5's witness), then return a scorecard
   (legibility at 16/32 px, distinctiveness on the shelf, reproduction in one
   colour, fit to the brief), the top three fixes in priority order, and an
   equity note — what the current mark has earned that a fix must not throw
   away. Stop there.
1b. **Diverge before converging** — propose at least three concepts of
   **different mark types** (e.g. wordmark, lettermark, pictorial, abstract,
   emblem), each with a one-line idea that says what it means, not how it
   looks. Three takes on one idea are one concept. The user picks before any
   concept is refined.
2. **Choose the path** — raster concept (text-in-mark → Ideogram for legible type)
   vs. **true vector** (a vector-native provider for editable marks, or a
   hand-authored one for simple geometric marks — authored under
   [`svg-authoring`](../svg-authoring/SKILL.md), never free-hand). Raster output
   is a concept only — not a shippable logo asset.
3. **Ask the resolver before choosing colour or type** — run
   `./agent-config brand:status --json` and pull the palette, typeface and
   spacing from the `sources[]` it reports as valid. Never test for a token
   file yourself and never use a remembered value: a file the resolver marks
   `invalid` or `shadowed` is not the brand. When it reports `bare`, or
   nothing valid for the axis in hand, use the brief's palette and type
   choices and **label those values `corpus-sourced` in the output**, so a
   gap-fill is never read as a brand decision.
4. **Route + prompt** via [`image-provider-routing`](../image-provider-routing/SKILL.md)
   and [`prompt-engineering-image`](../prompt-engineering-image/SKILL.md) — apply
   provider-specific grammar (text-literal first for Ideogram, `style: vector` param
   for a vector-native provider, direct SVG authoring for simple geometric shapes).
5. **Dry-run + validate** — invoke the adapter (scaffold-tier; returns a dry-run
   plan). If the vector path is taken, the vector verdict comes from
   `lint_svg_asset`'s vector-honesty family plus the render witness, not from
   counting `<path>` elements: a raster embedded beside one dummy path passes
   that count and is not a vector, and a mark built from `rect`/`circle` fails
   it and is one. See [`svg-authoring`](../svg-authoring/SKILL.md).
   **The legibility witness** — every vector candidate is rendered with
   `agent-config ui:render <mark.svg> --profile asset --class mark`, which
   captures it at 16 and 32 px and at 1×/2×, on light and dark. Legibility is
   never claimed without that capture; no capture, no claim, and say so.
   **Shelf test** — when the user supplies competitor or category marks, render
   them beside the candidate at the same sizes and backgrounds and compare. Use
   only the marks the user supplied; nothing is bundled or fetched, and the
   rights check below still applies to every one of them.
5b. **Stop before the export kit** — once a direction is chosen and witnessed,
   stop and confirm before producing the kit (step 7). A favicon or app-icon
   brief stops here too: the kit is a separate, confirmed step.
6. **Rights check** — never reproduce a mark that resembles an existing trademarked
   logo. Run [`image-likeness-and-rights`](../../rules/image-likeness-and-rights.md)
   when the brief names a brand, references a known mark style, or targets a
   regulated sector.
7. **Export kit (after confirmation)** —
   `npx tsx node_modules/@event4u/agent-config/src/scripts/logo_export_kit.ts <mark.svg> --name "<Name>" --out <dir>`
   writes the SVG, PNG at 1× and 2×, the favicon set with `site.webmanifest`,
   and light and dark lockups — the same bytes every run from the same input.

## Output format

0. **Concepts** (generation) — three or more, of different mark types, one-line
   idea each; or, in critique mode, the scorecard, top-3 fixes and equity note.
1. **Chosen path** — raster concept or true vector, with rationale.
2. **Prompt or SVG** — the prompt string ready to copy (raster/vector provider), or
   the authored SVG markup (LLM-authored geometric mark path).
3. **Governance note** — rights check outcome and the adapter dry-run caveat:
   "adapter is experimental (scaffold-tier) — dry-run plan only; no rendered asset
   until promotion per `provider-lifecycle-discipline`."

## Gotcha

- **Raster models cannot emit usable editable logos** — general-purpose image
  models garble text and produce no `<path>` geometry. A PNG concept is useful
  for direction-setting, but it is not a logo asset. Use the vector path for any
  mark that must scale, be modified, or be handed to a designer.
- **Scaffold-tier adapters produce plans, not pixels** — all adapters are
  `experimental` (dry-run only). Claiming a rendered asset exists while no adapter
  is `stable` misleads the caller.

**Good example:** Brief for a wordmark → route to a vector-native provider with
`style: vector`, run `lint_svg_asset` over the output and confirm it carries no
embedded raster, note "experimental — dry-run plan only."

**Bad example:** Routing a logo brief to a photoreal raster model and delivering the
PNG as the final logo file.

## Do NOT

- Do NOT ship a raster PNG as a "logo" when an editable vector mark is needed —
  surface the vector path and the raster-model limitation explicitly.
- Do NOT generate a mark resembling an existing trademarked logo — run
  `image-likeness-and-rights` when the brief references a known brand or mark.
- Do NOT claim a live render at scaffold tier — the dry-run caveat is mandatory
  every time.

## See also

- [`image-generation`](../image-generation/SKILL.md) — general-purpose image generation (non-logo briefs).
- [`image-provider-routing`](../image-provider-routing/SKILL.md) — select the right provider before writing the prompt.
- [`prompt-engineering-image`](../prompt-engineering-image/SKILL.md) — translate the brief into provider-specific prompt grammar.
- [`image-likeness-and-rights`](../../rules/image-likeness-and-rights.md) — rights check before generating brand marks or likenesses.
- `type-design` — "make this a font": the rest of the alphabet in a wordmark's lettering. Named, not linked — it ships in another pack.
