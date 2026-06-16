---
model_tier: inherit
name: image-provider-routing
description: "Select the right image-generation provider from job shape — text-in-image to Ideogram, photoreal to Flux, vector/logo to Recraft, general to Gemini/GPT."
domain: product
personas: []
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

# image-provider-routing

Route an image generation job to the right provider based on job shape. Adapters
are scaffold-tier (dry-run only) — selection produces a plan; execution waits on
promotion per `provider-lifecycle-discipline`.

## When to use

- Choosing which image model fits a brief (logo, banner, photo, icon, general art).
- Before calling any `src/scripts/ai-image/adapters/*.sh` adapter.
- When the user asks "which image model should I use?" or "route this image job."

## Provider decision table

| Job shape | Provider | Why |
|---|---|---|
| Text-in-image (logo, banner, typographic art) | **Ideogram** | Best glyph rendering; raster models garble text |
| Photoreal (product shot, portrait, scene) | **Flux** | Photorealism specialist; routed via fal/Replicate |
| Vector / SVG logo or icon | **Recraft** | Produces genuine `<path>` SVG; raster cannot |
| General art / edit / multimodal | **Gemini-image** or **GPT Image 2** | Broad capability; natural-language prompts |
| Budget-conscious 4K upscale | Flux via Replicate | Cost-competitive at high resolution |

Decision order: text-in-image → Ideogram; must-be-vector → Recraft; photoreal → Flux;
everything else → Gemini-image (default) or GPT Image 2 (when OpenAI key available
and editing an existing image).

## Procedure

1. **Extract job shape** from the brief: does it need embedded text? vector output?
   photorealistic rendering? or general illustration?
2. **Apply table** — match the dominant shape to the provider row above.
3. **Check lifecycle tier** — all adapters are `experimental` (scaffold). Surface
   this before any live invocation.
4. **Confirm with the user** when shape is ambiguous (e.g., logo that could be
   vector OR raster typographic art → ask once).
5. **Emit the routing decision** in the Output format below.

## Output format

1. **Chosen provider** — name + one-line rationale citing the job-shape match.
2. **Lifecycle-tier caveat** — "adapter is experimental (scaffold tier); dry-run
   only until a smoke trace is captured per `provider-lifecycle-discipline`."
3. **Fallback** — if the primary adapter is unavailable or the smoke trace is
   missing, name the next best provider and what changes.

## Gotcha

- **Routing a text-in-image job to a photoreal model is the #1 failure** — send a
  logo/banner with embedded text to Flux and the text renders as garbled glyphs;
  it must go to Ideogram. Likewise a vector logo sent to Ideogram/Flux returns a
  raster PNG, not the editable `<path>` SVG a brand mark needs (→ Recraft).
- All four adapters (`ideogram.sh`, `flux.sh`, `recraft.sh`, `gemini-image.sh`) are
  **scaffold-tier** — dry-run plumbing only, no live generation yet. Routing
  produces a selection + plan; actual API calls require promotion to `stable`
  first (maintainer-captured smoke trace under `agents/reference/ai-image/smoke-traces/`).
  Surfacing a provider without its `experimental` tier caveat misleads the caller
  into expecting a rendered asset that won't come.

**Good example:** "Text logo for a bakery → Ideogram (text-in-image); lifecycle:
experimental — dry-run plan only."

**Bad example:** "Use Recraft for the product photo" — Recraft is the vector path;
photoreal jobs go to Flux.

## Do NOT

- Do NOT invoke an adapter without surfacing its lifecycle tier (all are `experimental`).
- Do NOT route a text-in-image job to Flux — Flux has no glyph renderer; text garbles.
- Do NOT route a vector/SVG job to Ideogram or Flux — neither outputs genuine `<path>` SVG.
- Do NOT skip `image-likeness-and-rights` when the brief names a real person or brand mark.
- Do NOT promote an adapter from `experimental` to `stable` — that is maintainer-only via smoke trace.

## See also

- [`prompt-engineering-image`](../prompt-engineering-image/SKILL.md) — translate the brief into provider-specific prompt grammar.
- [`provider-lifecycle-discipline`](../../rules/provider-lifecycle-discipline.md) — read lifecycle tier before any run.
- `src/scripts/ai-image/adapters/` — the four adapter files and their header comments.
- [`media-governance-routing`](../../rules/media-governance-routing.md) — rights / likeness policies before generation.
