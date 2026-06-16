---
model_tier: inherit
name: typography-system
description: "Derive a type system from a style constraint — query curated font pairings, set scale/line-height/weights, emit DTCG tokens via design-tokens. Use when choosing fonts or building a typographic scale."
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
execution:
  type: manual
---

# typography-system

Turn a style constraint into a full typographic system: pick a verified font
pairing, derive a modular scale, and emit DTCG `$type: "typography"` tokens
through the `design-tokens` toolchain.

## When to use

- Choosing heading/body fonts for a new product or rebrand.
- Building or overhauling a typographic scale (sizes, line-height, weights).
- Any request to "set the typography" or "pick fonts" for a design system.
- Before calling `design-tokens` for a new project — typography tokens belong
  in `tokens.json` alongside color tokens, not hand-coded in CSS.

## Procedure

1. **Take a style/idiom constraint** from the `design-intelligence` idiom
   corpus — a mood keyword (e.g. `elegant`, `modern`, `playful`) or a
   named idiom that carries typographic intent.
2. **Query `font-pairings-reference.csv`** (Reference layer) — filter by the
   `Mood/Style Keywords` column; surface the top 1–2 matching pairings with
   their Heading Font, Body Font, Best For, and Google Fonts URL.
3. **Derive the type scale** — pick a modular ratio (1.25 Minor Third or 1.333
   Perfect Fourth for most products); compute sizes for `xs / sm / base / lg /
   xl / 2xl / 3xl`; set `line-height` (1.5 for body, 1.2 for display);
   assign weights (400 body, 600–700 heading).
4. **Emit DTCG `$type: "typography"` tokens** through `design-tokens`
   (`scripts/tokens.py`) — add a `typography` section to `tokens.json` with
   `$type: "typography"` and `$value` objects carrying `fontFamily`,
   `fontSize`, `fontWeight`, `lineHeight`.
5. **Verify** — confirm both chosen fonts exist on Google Fonts (check the
   `Google Fonts URL` column in the CSV); run
   `python3 <skills-root>/design-tokens/scripts/tokens.py validate --dir src/`
   to confirm no hardcoded font-size or font-family values remain outside the
   token file; exit code 0 is the evidence.

Stage 2 (brand archetype → pairing-filter) is added in Phase B.4; this skill
degrades gracefully without a brand layer.

## Output format

1. **Chosen pairing + rationale** — heading font, body font, the CSV row's
   `Best For` field, and the one-line mood match that drove the selection.
2. **DTCG type-token block** — the `typography` section ready to paste into
   `tokens.json` (DTCG `$type: "typography"`, `$value` with `fontFamily`,
   `fontSize`, `fontWeight`, `lineHeight` per level).
3. **CSS/Tailwind import line** — the `@import url(…)` from the CSV's
   `CSS Import` column, and the Tailwind `fontFamily` config snippet from
   `Tailwind Config`.

## Gotcha

- **Stale CSV URL → silent system-font fallback.** `font-pairings-reference.csv`
  is Reference data on a freshness contract — never substitute a live Google
  Fonts API call. If a font was retired or renamed, the `@import` URL 404s at
  build time and the browser silently falls back to the system font, shipping
  broken visual design with no obvious error. Always verify the URL resolves
  (Step 5) before emitting the import line; if it 404s, surface the error and
  ask the user to pick an alternative pairing from the CSV.

## Do NOT

- Do NOT hardcode font sizes outside the token scale (e.g. `font-size: 18px`
  inline) — every size belongs in `tokens.json` under the `typography` layer.
- Do NOT bypass `design-tokens` and write raw CSS custom properties for fonts
  — `tokens.json` is the single source; hand-crafted `--font-*` vars drift.
- Do NOT treat `font-pairings-reference.csv` as decision logic — it is
  Reference data; the agent picks based on the style constraint, not by
  iterating the CSV as a rules engine.
- Do NOT skip step 5 (validate) before claiming the type system is complete —
  unchecked hardcoded values in component files are the canonical failure mode.

## See also

- [`design-tokens`](../design-tokens/SKILL.md) — toolchain that generates CSS
  vars and the Tailwind snippet from `tokens.json`.
- [`design-intelligence`](../design-intelligence/SKILL.md) — idiom corpus that
  supplies the style constraint consumed in Step 1.
- [`iconography`](../iconography/SKILL.md) — companion visual-identity skill
  (icon set selection, sizing scale).
- [`fe-design`](../fe-design/SKILL.md) — broader frontend design skill that
  consumes the token system produced here.
