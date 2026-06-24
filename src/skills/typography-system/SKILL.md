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
token_budget_class: rich
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

A **two-stage Method**: stage 1 (below) is the **style path** — a mood/idiom
constraint drives the pairing. Stage 2 is the **brand-aware path** — when a
brand layer exists, the brand archetype filters the pairing first. The skill
degrades gracefully: with no brand layer, only stage 1 runs.

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

## Stage 2 — brand-aware path (when a brand layer exists)

When a brand archetype is known (a confirmed `brand-strategy` /
`brand-identity` constraint set, or a consumer brand profile), filter the
pairing by the archetype **before** the mood match — the brand constrains the
style, not the other way around.

1. **Resolve the archetype** from the active brand layer (e.g. `Ruler`,
   `Lover`, `Magician`).
2. **Query the brand `typography` Grounding domain** for the archetype →
   pairing-filter (Heading Class, Body Class, Mood, plus confidence +
   evidence gap):

   ```bash
   python3 <skills-root>/corpus-grounding/scripts/ground.py search \
     --manifest <skills-root>/brand/data/manifest.json \
     "<archetype + sector>" --domain typography --json
   ```

3. **Filter `font-pairings-reference.csv` by that pairing-filter** — keep only
   pairings whose Heading/Body classes satisfy the archetype filter (e.g. a
   `Ruler` / law-firm brief keeps serif-containing pairings; a `Magician` /
   SaaS brief keeps geometric-sans pairings). Then apply the stage-1 mood match
   within the filtered set.
4. **Surface the corpus `confidence` + `evidence_gap`** for the archetype row,
   then emit DTCG type tokens exactly as stage 1 (steps 4–5 above).
5. **Trigger-eval invariant:** a "law-firm redesign" brief MUST route to a
   serif-containing pairing (the archetype filter is `Ruler` → serif). This is
   the recorded brand-aware regression test (recorded in Phase D).

Consumer brand tokens outrank the corpus filter
([`brand-source-of-truth`](../../rules/brand-source-of-truth.md)) — if the
brand already registers fonts, use them and skip the filter.

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
- [`brand`](../brand/SKILL.md) — supplies the archetype → pairing-filter
  Grounding (`typography` domain) consumed by stage 2.

## Why this skill is rich

Typography is one of the highest-leverage design decisions and one of the
most commonly mis-applied by AI agents (defaulting to Inter + arbitrary sizes).
The skill carries 73 curated font pairings (heading + body + mono combinations
with Google Fonts URLs and Tailwind config), 6 worked-through modular-scale
examples across different use-cases (marketing, dashboard, docs, e-commerce,
SaaS, editorial), and per-pairing line-height + weight guidance. Condensing
to "use a 1.25 modular scale" loses the worked examples that teach agents
the difference between a 14/17.5/21.8/27.2 rounded scale and an invented
arbitrary scale. Without the worked examples, agents produce: 16, 20, 24, 28
(arbitrary) instead of a properly grounded typographic system.
