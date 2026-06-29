# `design-system.json` — import contract

> Lazy-loaded by `design-system-capture` ONLY when importing an extracted design
> system. Not in the always-on skill body. The **consumer-side contract**: any
> external static-extraction tool (URL / git repo / local dir) emits this shape;
> the skill READS it to seed/merge `DESIGN.md`. We own the contract, not the
> crawler (council 2026-06-28).

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
  `radius` / `shadow` = the DTCG `.tokens.json` shape `design-tokens` /
  `brand-to-tokens` already author — reuse it; never a parallel token format.
- **Mark extraction-only metadata.** Observation, not a token decision, lives
  under `_meta` (`motion._meta.detected_libs`, `components[].observed`). Informs
  the human; never becomes a token.
- **`source` is mandatory** — `kind` + `ref` + `captured_at`. No provenance →
  reject (can't confirm what you can't trace).
- **`bundled_local`** is a flag, not an instruction: the package never
  downloads/bundles fonts (out of scope); it records that the source did.

## Trust posture (mandatory)

An import is **observed, not authoritative** (mirrors `source-discovery`:
evidence vs. authoritative). It seeds `DESIGN.md` as a **proposal the human
confirms per field** — never a silent write. A field conflicting with a
registered brand value (confirmed `.tokens.json` / brand token) is **flagged,
never auto-applied** (`brand-source-of-truth`). Precedence: registered brand
tokens > confirmed `DESIGN.md` > imported observation.

## Two sources, one shape

- **External target** (a site/repo you don't own) → external standalone tool
  emits `design-system.json`; hand it to `design-system-capture`.
- **Current repo** → prefer [`existing-ui-audit`](../../existing-ui-audit/SKILL.md):
  it inventories the codebase and emits the same shape, so the import path is
  identical either way.

Package **owns this contract**; does **not** ship the crawler, the Playwright
runtime, or a font-bundler.
