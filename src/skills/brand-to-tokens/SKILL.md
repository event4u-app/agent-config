---
model_tier: inherit
name: brand-to-tokens
description: "Derive a DTCG .tokens.json source of truth from confirmed brand decisions, emit CSS vars + Tailwind via design-tokens, and export locked brand deck templates. Use to turn a brand identity into tokens."
domain: engineering
personas: []
workspaces:
  - engineering
packs:
  - brand
trust:
  level: professional
install:
  removable: true
execution:
  type: manual
---

# brand-to-tokens

> The brand→token derivation — the **first consumer demand** that closes the
> ADR-061 §8 deferral. Takes a confirmed [`brand-identity`](../brand-identity/SKILL.md)
> constraint set and produces a DTCG `.tokens.json` **source of truth**, then
> hands it to the [`design-tokens`](../design-tokens/SKILL.md) toolchain to emit
> CSS vars + Tailwind. The same `.tokens.json` is the export that pack-ai-image
> brand-asset generation and the greenfield scaffold seed consume (B → A;
> contract: [`brand-token-consumption`](../../../docs/contracts/brand-token-consumption.md)).

## When to use

- A confirmed brand identity (colour story, type story, spacing) needs to become
  a maintained token system.
- A consumer asks to "turn the brand into tokens / CSS variables / a theme."
- Before pack-ai-image brand-asset generation or a greenfield scaffold needs the
  `.tokens.json` export.

## Procedure

1. **Take the confirmed brand-identity constraint set** — colour story (roles +
   values), type story (heading/body classes), spacing/radius intent. If a
   consumer brand profile already registers values, those win
   ([`brand-source-of-truth`](../../rules/brand-source-of-truth.md)).
2. **Author `.tokens.json`** on the `design-tokens` 3-layer DTCG model
   (`$value` / `$type`): brand palette → `primitive.color.*`; brand roles
   (primary, accent, surface, destructive) → `semantic.color.*` referencing the
   primitives; per-widget needs → `component.*`. Add `dark.semantic.*` overrides.
   Type tokens come from [`typography-system`](../typography-system/SKILL.md)
   stage-2 (archetype → pairing-filter), added under the `typography` section.
3. **Generate** CSS vars + Tailwind through the toolchain:

   ```bash
   python3 <skills-root>/design-tokens/scripts/tokens.py generate \
     --config .tokens.json -o assets/design-tokens.css
   python3 <skills-root>/design-tokens/scripts/tokens.py generate \
     --config .tokens.json --format tailwind
   ```

4. **Validate** — `python3 <skills-root>/design-tokens/scripts/tokens.py
   validate --dir src/` until clean (exit 0 is the evidence); convert
   hardcoded values to `var(--token)`.
5. **Export the deck templates** — emit the locked-variable brand deck
   templates from [`templates/`](templates/) — `marp-brand-deck.md.example`
   (copy to `.md` to use) and `reveal-brand-deck.yaml` — substituting the brand
   variables from `.tokens.json`. No render engine is owned (decision 7); the
   templates feed the user's own deck tool.
6. **Publish `.tokens.json`** as the source of truth other surfaces read
   (pack-ai-image generation, greenfield scaffold) per the consumption contract.

## Output format

1. `.tokens.json` — DTCG 3-layer (primitive → semantic → component) + `dark.semantic` + `typography`, every value `{$value, $type}`.
2. Generated `design-tokens.css` + the Tailwind `theme.extend` snippet.
3. `validate` evidence — exit 0, or the `token_violation` findings handed to polish.
4. The exported brand deck templates (Marp + reveal) with brand variables locked from the tokens.

## Gotcha

- **`.tokens.json` is the single source — never hand-edit the generated CSS or a
  consumer-side copy.** pack-ai-image generation and the greenfield scaffold read
  this file; a hand-edited downstream copy silently drifts from the brand.
- **Derive, do not invent.** Every token traces to a brand-identity decision or
  the consumer's existing brand; a value with no brand provenance is off-brand
  ([`brand-consistency`](../../rules/brand-consistency.md) will flag it).
- Deck templates **lock** brand variables — never inline a raw hex/font in a
  template; reference the token so the deck stays on-brand when tokens change.

## Do NOT

- Do NOT generate marks or assets here — this skill emits tokens + templates;
  [`logo-generation`](../logo-generation/SKILL.md) / `brand-asset-generation`
  generate the marks from the tokens (B → A, never inverted).
- Do NOT hand-edit generated CSS — `.tokens.json` is the source.
- Do NOT let components reference primitives directly — semantic layer between.
- Do NOT own a slide-render engine — export validated templates only (decision 7).

## See also

- [`brand-identity`](../brand-identity/SKILL.md) — supplies the constraint set this skill derives tokens from.
- [`design-tokens`](../design-tokens/SKILL.md) — the DTCG toolchain that emits CSS/Tailwind from `.tokens.json`.
- [`typography-system`](../typography-system/SKILL.md) — brand-aware stage-2 supplies the type tokens.
- [`brand-token-consumption`](../../../docs/contracts/brand-token-consumption.md) — the read contract pack-ai-image and greenfield scaffold consume.
- [`brand-consistency`](../../rules/brand-consistency.md) — validates emitted artifacts against this token source of truth.
