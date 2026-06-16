---
model_tier: inherit
name: image-generation
description: "Generate an image from a brief — provider-agnostic blueprint then provider-specific translation, with ref-image/seed reuse for consistency. Use when generating/creating an image."
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

# image-generation

Generate an image end-to-end: capture the brief, route to the right provider, author
a provider-specific prompt, reuse seeds for consistency, invoke the adapter, and apply
governance. All adapters are scaffold-tier (dry-run) until promoted to `stable`.

## When to use

- User asks to generate, create, or produce an image from a brief.
- End-to-end image production (routing + prompting + adapter invocation + governance).
- When a consistent series of images needs seed/ref-image reuse across renders.

## Procedure

1. **Capture the brief** — extract: subject, output format (raster/vector/banner/icon),
   style intent, any existing ref images or seed values for consistency.
2. **Route the provider** via [`image-provider-routing`](../image-provider-routing/SKILL.md) —
   match job shape (text-in-image → Ideogram, photoreal → Flux, vector → Recraft,
   general → Gemini/GPT Image 2).
3. **Author the prompt** via [`prompt-engineering-image`](../prompt-engineering-image/SKILL.md) —
   apply provider-specific grammar (text-literal first for Ideogram, noun-phrase for Flux,
   `style:` param for Recraft, natural language for Gemini/GPT).
4. **Reuse ref-image / seed for consistency** — if the brief is part of a series, carry
   the seed value or ref-image path forward. Seed reuse is the primary consistency lever;
   re-describing the subject each time is not.
5. **Invoke the adapter (dry-run today)** — run `src/scripts/ai-image/adapters/<provider>.sh`
   with the assembled params. Validate the returned artifact path or dry-run confirmation.
   All adapters are `experimental` (scaffold-tier); no live generation occurs until a
   maintainer promotes the adapter via `provider-lifecycle-discipline`.
6. **Apply governance** — run the rights check (`image-likeness-and-rights`) when the
   brief names a real person, brand mark, or living artist's style. Attach the AI-disclosure
   footer per `media-governance-routing` before delivering the output.

## Output format

1. **Blueprint** — provider choice + routing rationale + prompt string ready to copy.
2. **Provider + prompt** — adapter file reference, key params (aspect ratio, style,
   negative prompts), and any seed/ref-image value carried forward.
3. **Artifact path / dry-run note** — the path returned by the adapter, or an explicit
   note: "adapter is experimental (scaffold-tier) — dry-run plan only; no rendered
   asset until promotion per `provider-lifecycle-discipline`."

## Gotcha

- **Scaffold-tier adapters produce plans, not pixels** — all four adapters (`ideogram.sh`,
  `flux.sh`, `recraft.sh`, `gemini-image.sh`) are **scaffold-tier** (dry-run only). This
  skill produces the blueprint + dry-run confirmation; actual renders require a maintainer
  to capture a smoke trace and promote the adapter to `stable`. Claiming a rendered asset
  exists when no adapter is stable misleads the caller.
- **Seed reuse is the consistency lever** — re-describing the subject more precisely
  in each prompt does not lock character or style; carrying the seed value or ref-image
  path forward does. Drop the seed and character drift is inevitable across a series.

**Good example:** Brief for a product-shot series → route to Flux (photoreal), author
noun-phrase prompt, carry `seed: 42` across all five renders, invoke adapter, note
"experimental — dry-run plan only."

**Bad example:** Invoking the adapter and telling the user "here is your rendered image"
while all adapters are still scaffold-tier.

## Do NOT

- Do NOT claim a rendered asset is produced while adapters are scaffold-tier — surface
  the dry-run caveat explicitly every time.
- Do NOT skip `image-likeness-and-rights` when the brief names a real person, a brand
  mark, or a named living artist's style.
- Do NOT bypass `image-provider-routing` — selecting the wrong provider for the job
  shape (e.g. Flux for a text-in-image logo) produces garbled output.
- Do NOT ignore seed/ref-image values when consistency across a series is required —
  seed reuse is the only reliable consistency mechanism.

## See also

- [`image-provider-routing`](../image-provider-routing/SKILL.md) — select the right provider before writing the prompt.
- [`prompt-engineering-image`](../prompt-engineering-image/SKILL.md) — translate the brief into provider-specific prompt grammar.
- [`image-likeness-and-rights`](../../rules/image-likeness-and-rights.md) — rights check before generating real-person likenesses or brand marks.
- [`provider-lifecycle-discipline`](../../rules/provider-lifecycle-discipline.md) — lifecycle tier gates; read before any adapter invocation.
