# `font-spec.yaml` — the parameters every outline is built from

The spec is the only place a shape decision lives. Code reads it and builds the
outlines; the model changes it and lets code rebuild. A value the run measured
carries `measured: true` and the glyphs it came from; a value the brief set
carries `measured: false`.

```yaml
family: "Acme Display"
style: "Regular"
units_per_em: 1000

vertical:                    # font units, baseline = 0
  baseline: 0
  x_height: 520
  cap_height: 700
  ascender: 760
  descender: -220

stems:                       # font units, measured by ray-cast (gates § 3)
  lowercase_vertical: 92     # n h m u l i
  lowercase_horizontal: 80   # e bar, t crossbar
  capital_vertical: 100      # H I L
  capital_horizontal: 86     # H bar, E arms

contrast: 0.86               # thinnest / thickest stroke on o and O
stress_angle: 0              # degrees from vertical; negative leans left
overshoot:                   # share of x-height / cap height, 0.01–0.03
  round: 0.015
  pointed: 0.010
aperture: 0.42               # opening of c e s a, share of the bowl width
terminal: "flat"             # flat | angled | round | ball
serif: "none"                # none | slab | bracketed | hairline

spacing:                     # sidebearings in font units, per edge class
  straight: 62
  round: 38
  diagonal: 8

coverage: "latin-basic"      # wordmark | latin-basic | latin-de

license:
  id: "unknown"              # the answer the person gave, or unknown
  url: ""
  name_table: true           # written into the name table at build

source:
  path: "brand/wordmark.png" # path A; omitted for path B
  rights: "own"              # own | commissioned | typeface-named | third-party | unknown
  digest: "sha256:…"         # of the source file, so a later run knows it is the same image
  resolution_confidence: "ok"   # ok | low
  locked_glyphs: ["g"]       # signature letters; drift fails gates § 6
```

## Fields

- **`units_per_em`** — 1000 unless the build target asks for 2048.
- **`vertical`** — baseline, x-height, cap height, ascender, descender. The
  vertical metrics tables are derived from these (gates § 2), never set apart
  from them.
- **`stems`** — lowercase and capitals, vertical and horizontal. Every straight
  stroke a construction rule draws takes its width from here.
- **`contrast`** and **`stress angle`** — the ratio of thin to thick on the
  round letters and the axis it rotates around. A monoline face is `1.0` at
  stress angle `0`.
- **`overshoot`** — how far round and pointed letters cross the baseline and the
  x-height or cap height, as a share of that height.
- **`aperture`**, **`terminal`**, **`serif`** — the open letters' opening, how
  strokes end, and what sits at their ends.
- **`spacing`** — sidebearings per edge class, set on H, n, O and o before any
  other glyph (gates § 4).
- **`license`** — never filled by default (`SKILL.md` § License).
- **`source`** — path A only: the file, its rights class from the rights gate,
  its digest, whether its resolution is enough for fidelity, and the locked
  glyphs.

## Coverage tiers

Defined by this skill, not copied from an external glyph-set definition. The
tier is written into the spec and into the QA report, and nothing claims a tier
it does not cover.

| Tier | Glyphs |
|---|---|
| `wordmark` | the letters present in the source, plus their alternates and ligatures, plus `space` and `.notdef` |
| `latin-basic` | A–Z, a–z, 0–9, `space`, `.notdef`, and `. , : ; ! ? ' " - – — ( ) / & @ # % *` |
| `latin-de` | `latin-basic` plus ä ö ü Ä Ö Ü, both forms of sharp s (ß and ẞ), and the German quotation marks „ “ ‚ ‘ |

The coverage gate (gates § 1) lists every glyph the tier names and fails on any
that is absent.
