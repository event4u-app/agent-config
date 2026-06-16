---
model_tier: inherit
name: brand-asset-generation
description: "Generate brand assets — banners, social cards, CIP elements — with brand-token injection + provider routing. Use when generating a banner / social image / branded asset."
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

# brand-asset-generation

Generate brand assets (banner, social card, CIP element) via structured prompting,
brand-token injection, and provider routing. Rides on the existing pack-ai-image
adapters — not a second image-gen stack.

## When to use

- User asks to generate a banner, social card, header image, or CIP (corporate identity) element.
- Branded asset production where palette, typography, or voice must stay consistent.
- When brand tokens are available and should drive the visual output.
- When a brief alone (no tokens) still needs a governance-aware image output.

## Procedure

1. **Identify asset type and spec** — determine format (banner, social card, CIP element),
   output dimensions (e.g. 1200×630 for Open Graph, 1080×1080 for square social),
   and target channel (web, print, social platform).
2. **Inject brand tokens when present** — if `pack-brand` is installed, load `.tokens.json`
   (colors, typography, voice). Feed hex values, font names, and tone keywords directly
   into the prompt. Without tokens, derive palette and type from the brief itself;
   raw generation works — output is brief-driven, not token-driven.
3. **Route and prompt** — delegate provider selection to
   [`image-provider-routing`](../image-provider-routing/SKILL.md) (text-in-image →
   Ideogram, photoreal product shot → Flux, etc.). Author the provider-specific prompt
   with the asset spec, injected tokens, and any negative constraints.
4. **Dry-run and validate** — invoke the adapter (scaffold-tier; see Gotcha). Confirm
   the returned dry-run plan matches the spec: dimensions, style intent, brand token usage.
5. **Rights and AI-disclosure governance** — run [`image-likeness-and-rights`](../../rules/image-likeness-and-rights.md)
   if the asset depicts a real person or brand mark. Attach the AI-generation disclosure
   footer per `media-governance-routing` before delivering output.

## Output format

1. **Asset spec** — type, dimensions, channel, and routing rationale (which provider and why).
2. **Prompt** — final provider-specific prompt string with injected brand tokens (or brief-derived
   palette/type if no tokens). Include key params: aspect ratio, style keywords, negative prompts.
3. **Adapter invocation / dry-run note** — the dry-run plan returned by the adapter, or an
   explicit note: "adapter is experimental (scaffold-tier) — dry-run plan only; no rendered
   asset until promotion per `provider-lifecycle-discipline`."
4. **Governance confirmation** — rights check result and AI-disclosure footer.

## Gotcha

- **Without a brand token layer the output is generic** — feed the brief's exact palette
  (hex codes) and typography (font names or style descriptors) into the prompt. Vague
  color terms ("blue", "modern") produce inconsistent results. Brand tokens from `pack-brand`
  (Phase B of the brand pipeline) eliminate this gap; until that pack ships, rely on
  brief-supplied values.
- **Brand tokens come from `pack-brand` (Phase B)** — this skill consumes tokens; it does
  not author them. If `.tokens.json` is absent, proceed brief-driven and note the gap.
- **Adapters are scaffold-tier (dry-run only)** — all pack-ai-image adapters are `experimental`.
  This skill produces a blueprint and dry-run confirmation; actual renders require a
  maintainer to capture a smoke trace and promote the adapter to `stable`.

## Do NOT

- Do NOT invent brand colors or voice — use tokens from `.tokens.json` or explicit values
  from the brief. Guessing palette values produces off-brand output.
- Do NOT omit the AI-generation disclosure — every delivered asset requires the disclosure
  footer per `media-governance-routing`, regardless of how generic the output appears.
- Do NOT claim a rendered asset is produced while adapters are scaffold-tier — surface
  the dry-run caveat explicitly every time.

## See also

- [`logo-generation`](../logo-generation/SKILL.md) — logo-specific generation with vector and mark constraints.
- [`image-generation`](../image-generation/SKILL.md) — general-purpose image generation end-to-end.
- [`image-provider-routing`](../image-provider-routing/SKILL.md) — select the right provider before writing the prompt.
- [`image-likeness-and-rights`](../../rules/image-likeness-and-rights.md) — rights check before generating real-person likenesses or brand marks.
