---
model_tier: inherit
name: logo-generation
description: "Generate a logo or brand mark — structured prompt + provider routing, with a true-vector path via a vector-native provider or LLM-authored SVG for simple marks. Use for logo or brand mark generation."
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
2. **Choose the path** — raster concept (text-in-mark → Ideogram for legible type)
   vs. **true vector** (vector-native provider emitting `<path>` SVG for editable
   marks, or LLM-authored SVG for simple geometric marks). Raster output is a
   concept only — not a shippable logo asset.
3. **Inject brand tokens when a brand layer is present** (`pack-brand`) — pull the
   registered palette, typeface, and spacing tokens. When no brand layer exists,
   use the brief's palette and type choices directly.
4. **Route + prompt** via [`image-provider-routing`](../image-provider-routing/SKILL.md)
   and [`prompt-engineering-image`](../prompt-engineering-image/SKILL.md) — apply
   provider-specific grammar (text-literal first for Ideogram, `style: vector` param
   for a vector-native provider, direct SVG authoring for simple geometric shapes).
5. **Dry-run + validate** — invoke the adapter (scaffold-tier; returns a dry-run
   plan). If the vector path is taken, validate that the output contains `<path>`
   elements before treating it as an editable mark.
6. **Rights check** — never reproduce a mark that resembles an existing trademarked
   logo. Run [`image-likeness-and-rights`](../../rules/image-likeness-and-rights.md)
   when the brief names a brand, references a known mark style, or targets a
   regulated sector.

## Output format

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
`style: vector`, validate `<path>` elements in output, note "experimental —
dry-run plan only."

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
