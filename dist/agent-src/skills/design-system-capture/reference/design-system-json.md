# `design-system.json` — import contract

> Lazy-loaded by `design-system-capture` ONLY when importing an extracted design
> system. Not part of the always-on skill body. This is the **consumer-side
> contract**: any external static-extraction tool (URL / git repo / local dir
> crawler) emits this shape; the skill READS it to seed/merge `DESIGN.md`. We
> own the contract, not the crawler (council 2026-06-28).

## Shape

```json
{
  "source": { "kind": "url|repo|dir", "ref": "https://example.com", "captured_at": "<ISO-8601>" },
  "colors": {
    "light": { "<role>": "<value>" },
    "dark":  { "<role>": "<value>" }
  },
  "typography": {
    "families": [{ "role": "body|display|mono", "name": "<font>", "bundled_local": false }],
    "scale": [{ "step": "xs|sm|base|lg|…", "size": "<rem/px>", "lineHeight": "<n>" }]
  },
  "spacing": { "base": "<px>", "scale": ["<px>", "…"] },
  "radius":  { "<role>": "<px>" },
  "shadow":  { "<role>": "<box-shadow>" },
  "motion":  { "durations": { "<role>": "<ms>" }, "easings": { "<role>": "<cubic-bezier>" },
               "_meta": { "detected_libs": ["gsap", "lottie"] } },
  "components": [{ "name": "<Name>", "observed": { "classes": ["…"], "props": ["…"] } }]
}
```

## Field rules

- **Map to DTCG where it maps cleanly.** `colors` / `typography` / `spacing` /
  `radius` / `shadow` correspond to the DTCG `.tokens.json` shape that
  `design-tokens` / `brand-to-tokens` already author — reuse it; do **not**
  invent a parallel token format.
- **Mark extraction-only metadata.** Anything that is *observation*, not a
  token decision, lives under a `_meta` key (e.g. `motion._meta.detected_libs`,
  `components[].observed`). It informs the human; it never becomes a token.
- **`source` is mandatory** — `kind` + `ref` + `captured_at`. An artifact with
  no provenance is rejected (you cannot confirm what you cannot trace).
- **`bundled_local`** on a font family is a flag, not an instruction: the
  package never downloads or bundles fonts (out of scope) — it records that the
  source did.

## Trust posture (mandatory)

An imported artifact is **observed, not authoritative** (mirrors
`source-discovery`: evidence vs. authoritative). It seeds `DESIGN.md` as a
**proposal the human confirms per field** — never a silent write. A field that
conflicts with a registered brand value (a confirmed `.tokens.json` / brand
token) is **flagged, never auto-applied** (`brand-source-of-truth`: consumer
brand wins). Precedence on import: registered brand tokens > confirmed
`DESIGN.md` > imported observation.

## Two sources, one shape

- **External target** (a site/repo you do not own) → an external standalone
  tool emits `design-system.json`; hand it to `design-system-capture`.
- **Current repo** → prefer [`existing-ui-audit`](../../existing-ui-audit/SKILL.md):
  it already inventories the codebase's components/tokens and can emit the same
  `design-system.json` shape, so the import path is identical either way.

The package **owns this contract**; it does **not** ship the crawler, the
Playwright runtime, or a font-bundler.
