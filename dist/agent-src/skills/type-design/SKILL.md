---
model_tier: high
name: type-design
description: "Build an original font from lettering or a brief — measured spec, code-built outlines, gated build, rendered proof. Use to turn a wordmark into a font."
domain: product
personas:
  - design-director
workspaces:
  - engineering
packs:
  - frontend-design
trust:
  level: experimental
install:
  removable: true
scope:
  write: []
  verification_reason: "execution declares no handler, so this skill runs nothing of its own — every write is the calling agent's, under the rules that govern it. No command can prove a scope the skill never executes."
execution:
  type: manual
---

# type-design

Design an original font as a **constructed system**: measure parameters, let
code build every outline from measured parts, set spacing before kerning, and
build through gates that measure outlines, metrics, coverage and fidelity — with
a rendered proof the agent looked at. The model perceives, decides and judges;
code writes every coordinate.

The skill bundles no script and no font. It runs a pinned peer-side toolchain in
the consumer's environment ([`references/toolchain.md`](references/toolchain.md)).

## When to use

- "Turn this wordmark into a font", "the rest of the alphabet in this lettering".
- "Design an original display face for our brand" from a written brief.
- A logo or a lettering image exists and the person wants a typeable family.

## When NOT to use

- Choosing or pairing existing fonts, or building a type scale →
  `typography-system`.
- Making a logo or a single mark → `logo-generation`; tracing one icon or mark
  → `svg-authoring`; an icon font from an existing set → `iconography`.
- Reproducing a typeface someone else published — license it instead (§ Rights gate).

## The honest limit

A coherent **display or brand family** — one weight, Latin, shared stems,
overshoot and spacing — is in reach. **Text-grade optical refinement** (hinting,
optical compensation at small sizes, a multi-weight interpolated family) is a
type designer's work. Say so before the first build, and never label a result
beyond what the gates showed (§ Maturity).

## Rights gate — before any trace

1. **Own or commissioned lettering** proceeds.
2. **Lettering set in an existing typeface** — name the typeface and recommend
   licensing it instead of reconstructing it. Proceed only on a stated decision
   that the result is a different design.
3. **A third party's mark** stops until its owner's rights are stated.
4. **An origin the agent cannot establish** is treated as not owned, and asked
   about. Never assume a lettering image is the person's own.

Record the class (`own`, `commissioned`, `typeface-named`, `third-party`,
`unknown`) in the spec's source block.

## License — asked, never stamped

Ask which license the new font carries. Record the answer in `font-spec.yaml`
and in the font's name table (license description and URL). With no answer the
license is `unknown`, written as such in both places. **Never** choose one on
the person's behalf: a default license is a commitment made for someone else.

## No freehand outlines

The model never writes path data for a glyph by hand and never ships a freehand
SVG glyph. To change a shape, change a spec parameter or a construction rule and
let code rebuild. A glyph that cannot be expressed through the spec is a sign the
spec is missing a parameter — add it.

## Procedure

0. **Toolchain** — install the pinned set from
   [`references/toolchain.md`](references/toolchain.md) into an isolated
   environment in the consumer tree. Missing and not installable → stop and say
   which tool; never substitute a hand-written approximation.
1. **Spec first** — write `font-spec.yaml` per
   [`references/font-spec.md`](references/font-spec.md): units per em, vertical
   metrics, stems, contrast, stress angle, overshoot, aperture, terminals,
   spacing, the coverage tier, license and source blocks.
2. **Path A — from lettering** (raster or SVG, including a wordmark just made by
   `logo-generation` or `image-generation`):
   1. **Ingest** — parse the SVG, or threshold and deskew the raster.
   2. **Segment** — code splits the letters; the model labels a numbered
      **contact sheet** of the segments, never the raw image by eye.
   3. **Trace** with the fill rule declared and counters wound opposite to their
      outer contour (`svg-authoring` § Trace to measure, construct to deliver).
   4. **Measure** the spec from the traced letters, then **normalise** the
      present letters to it, and extend per step 4.
   5. A wordmark's one-off tweaks become **alternates or ligatures**, never the
      default forms. A **signature letter** the brief names is a **locked
      glyph**; its drift fails the fidelity gate.
   6. A source below 600 px cap height (or an SVG under 1,000 units) is reported
      as **low confidence** and cannot reach `validated-static` on fidelity —
      a stated default, not a measured one; the benchmark is what can move it.
3. **Path B — from a brief**: brief → spec with numbers → build `n o H O` →
   render the proof sheet → the person asking **approves the four control
   glyphs** before anything else is built. A rejection changes the spec, and
   the four are rebuilt.
4. **Construction order** — `n o H O` first, then the **derivation chains**:
   n → h m u r · o → c e b d p q · H → E F I L T · O → C D G Q. Then the
   diagonals (A K M N V W X Y k v w x y), then the free shapes (a g s S f t z and
   the figures), then composites for diacritics through anchors — the German set
   (ä ö ü Ä Ö Ü ß ẞ „ “ ‚ ‘) included when the tier asks for it.
5. **Spacing before kerning** — sidebearings from edge classes first, kerning
   classes only afterwards ([`references/gates.md`](references/gates.md) § 4).
6. **Build and gate** — UFO source → compiled `ttf` and `woff2`. Run every gate
   in [`references/gates.md`](references/gates.md); each prints a threshold and
   a failure message to act on.
7. **Rendered proof** — generate a host page whose specimens are SVG `<text>`
   elements set in the new family (waterfall 12 to 72 px, `HHOHH nnonn`, every
   letter between n and n and between o and o, the kerning strings, the wordmark
   text), with the built `woff2` beside it, and run the witness:
   ```bash
   agent-config ui:render proof/index.html --profile asset
   ```
   The new family must read `loaded` — never `error`, `unloaded`, `timeout` or
   `synthesised`. Open the
   PNG and state what you saw.
8. **Fidelity (path A)** — the wordmark text set in the new font against the
   source by silhouette IoU (gates § 6); produce the diff overlay and look at it.
9. **Fallback** — emit the metric-matched fallback `@font-face` (gates § 7).
10. **Repair budget** — a failing gate gets at most **three** repair rounds.
    After that the QA report names the gate and the label stays below
    `validated-static`.

## Outputs — in the consumer tree

UFO source, `font-spec.yaml`, built `woff2` and `ttf`, the proof page with its
PNG, and the QA report — at the location `design-system-capture` conventions
give the project's design-system assets, **never inside the package**. Record
the family there as a custom family with its source and license.

### Maturity — exactly one label

| Label | Means |
|---|---|
| `concept` | spec and control glyphs exist; the tier is not covered |
| `prototype` | the tier is covered and the font builds; at least one gate is open |
| `validated-static` | every gate in `references/gates.md` that applies to the path is green (gate 6 applies to path A only), the witness read `loaded`, and the proof was looked at |

Never a claim the run cannot show.

## Output format

1. **QA report** — coverage tier, maturity label, the license (or `unknown`),
   the rights class, and each gate with its measured value, threshold and
   result.
2. **Witness reading** — the face state the asset profile reported for the new
   family, the PNG path, and one sentence on what the agent saw in it.
3. **Fidelity (path A)** — per-glyph and per-word IoU, the locked glyph's IoU,
   the registration they were measured against, and the overlay path.
4. **Files** — every output path, read back from disk, with byte size.

## Gotcha

- **A plausible font is not a system.** Glyphs that each look fine and share no
  stems, overshoot or spacing pass a glance and fail the consistency gate —
  run it, do not eyeball it.
- **Same-direction counters paint solid.** Under `fill-rule: nonzero`, the default, an
  `o` whose inner contour winds like its outer one fills its counter.
- **Kerning cannot rescue spacing.** Kerning pairs on unspaced glyphs grow
  without bound and still look uneven; set sidebearings first.
- **The witness reads the face, not the look.** A fallback face that resembles
  the new one reads `error` there — trust the state, not the screenshot.

## Do NOT

- Do NOT trace lettering whose rights class is `unknown`, or `third-party` until
  the owner's rights are stated and it is recorded as `commissioned`.
- Do NOT write or ship glyph path data by hand.
- Do NOT stamp a license the person did not give.
- Do NOT claim a coverage tier the font does not cover, or `validated-static`
  with a gate open.
- Do NOT write outputs into the package, or add a font binary to it.

## See also

Named rather than linked: some of these neighbours ship in other packs.

- `typography-system` — choosing and pairing fonts; consumes a custom family.
- `svg-authoring` — trace-to-measure and the counter rule this skill reuses.
- `logo-generation`, `brand-identity` — where a wordmark is born and handed here.
- `design-system-capture` — where the finished family is recorded.
- `supply-chain-intake` — the gate every toolchain pin passed.
