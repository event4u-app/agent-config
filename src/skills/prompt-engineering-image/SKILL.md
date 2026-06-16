---
model_tier: inherit
name: prompt-engineering-image
description: "Translate an image brief into provider-specific prompt grammar per model. Use when writing or refining an image-generation prompt for Ideogram, Flux, Gemini, GPT Image 2, or Recraft."
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

# prompt-engineering-image

Translate an image brief into a provider-specific prompt string. Each model
has distinct prompt grammar — this skill applies the right structure per adapter.

## When to use

- Writing or refining a prompt for any `pack-ai-image` provider.
- After `image-provider-routing` has selected the target provider.
- When a prompt is underperforming and needs provider-specific tuning.

## Per-provider prompt grammar

### Ideogram (text-in-image: logos, banners, typographic art)

- **Lead with the text literal** in quotes: `"BAKERY NAME" in bold serif on a cream background`.
- Follow with visual context: background, color palette, style (flat, vintage, art-deco).
- Avoid long scene descriptions — Ideogram renders text best with a focused layout brief.
- Key params: `model: V_2`, `aspect_ratio: ASPECT_1_1` (square logo) or `ASPECT_16_9`
  (banner), `magic_prompt_option: AUTO` (let Ideogram enrich).

### Flux (photoreal: product shots, portraits, scenes)

- **Descriptive noun phrase first**: subject → lighting → environment → camera.
- Example: `"Close-up product shot of a ceramic coffee mug, soft studio lighting,
  clean white background, 50 mm lens bokeh, ultra sharp"`.
- Style descriptors: cinematic, hyperrealistic, 8K, golden hour, DSLR.
- Negative prompts accepted: `--no cartoon, illustration, text`.
- Routes through fal/Replicate — model slug: `fal-ai/flux-pro` or `black-forest-labs/flux-pro`.

### Recraft (vector / SVG logos and icons)

- **Style param is mandatory**: `style: vector_illustration` (SVG output),
  `style: icon` (for simplified marks), `style: realistic_image` (raster fallback).
- Keep prompt minimal — recraft interprets shape semantics: `"minimalist leaf icon, single color"`.
- Avoid photographic language (lighting, bokeh, grain) — it has no effect on vector output.
- Key params: `model: recraftv3`, `response_format: url`.

### Gemini-image / GPT Image 2 (general art, edits, multimodal)

- **Natural language** works well — no special syntax required.
- Be explicit about style: `"watercolor illustration"`, `"flat design"`, `"oil painting"`.
- For GPT Image 2 image editing: include the edit instruction after describing the target:
  `"Remove the background and replace with a solid pastel blue"`.
- Gemini: submit via `generateContent` (Nano Banana family) or `imagen-4.0:predict` (Imagen 4).

## Procedure

1. **Receive the brief** — extract: subject, style, output format (raster/vector/banner),
   target provider (from `image-provider-routing` or explicitly stated).
2. **Structure the prompt blocks** — subject · style · composition · technical params.
3. **Apply provider grammar** from the section above for the target model.
4. **Tune for the job shape** — text-literal first for Ideogram; noun-phrase first for Flux;
   minimal + `style:` param for Recraft; natural language for Gemini/GPT.
5. **Inspect the adapter header** — open `src/scripts/ai-image/adapters/<provider>.sh`
   and confirm the param enums (aspect/style/model) the prompt relies on still match.
6. **Emit the prompt** in the Output format below.

## Output format

1. **Target provider** — name + adapter file reference.
2. **Prompt string** — the exact string to pass to the adapter, ready to copy.
3. **Key params** — any model-specific fields (aspect ratio, style, negative prompts).
4. **Variant** (optional) — one alternative phrasing when the brief is ambiguous.

## Gotcha

- **Per-provider param enums drift** — `aspect_ratio`, `style`, and `model` enum values
  are ASSUMED from the adapter header comments. Verify against live API docs before
  promotion; never hardcode these in production without a smoke trace.
- **Adapters are scaffold-tier** — prompts authored here are not live-validated.
  Actual rendering requires adapter promotion to `stable` per `provider-lifecycle-discipline`.
- Recraft: photographic descriptors (`bokeh`, `lighting`, `grain`) silently have no effect
  on vector output — strip them to avoid prompt budget waste.

**Good example:** Ideogram brief for a bakery logo — lead with the text literal:
`'"Le Four" in warm serif, vintage French patisserie style, cream and terracotta'.`

**Bad example:** Sending a photorealism-heavy Flux prompt to Recraft — the style
descriptors will be ignored and the vector output will be wrong.

## Do NOT

- Do NOT send photographic descriptors (`bokeh`, `lighting`, `grain`) to Recraft —
  they have no effect on vector output and waste the prompt budget.
- Do NOT hardcode ASSUMED param enums into a live run without a smoke trace —
  verify against the adapter header / provider docs first.
- Do NOT embed a real person's likeness, a trademarked brand mark, or a named living
  artist's style in a prompt without the rights check (`image-likeness-and-rights`).
- Do NOT write a prompt before the provider is chosen — route via `image-provider-routing` first.

## See also

- [`image-provider-routing`](../image-provider-routing/SKILL.md) — select the provider before writing the prompt.
- [`provider-lifecycle-discipline`](../../rules/provider-lifecycle-discipline.md) — lifecycle tier gates live runs.
- `src/scripts/ai-image/adapters/` — adapter header comments for param enums.
- [`image-likeness-and-rights`](../../rules/image-likeness-and-rights.md) — rights check before generating real-person likenesses or brand marks.
