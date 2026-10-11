---
model_tier: inherit
name: svg-authoring
description: "Hand-author or edit an SVG — icon, mark, illustration, diagram, animation, raster-to-vector — checked and rendered."
domain: product
personas:
  - design-director
workspaces:
  - engineering
packs:
  - frontend-design
  - ai-image
  - ai-video
  - engineering-base
trust:
  level: professional
install:
  removable: true
scope:
  write: []
  verification_reason: "execution declares no handler, so this skill runs nothing of its own — every write is the calling agent's, under the rules that govern it. No command can prove a scope the skill never executes."
execution:
  type: manual
---

# svg-authoring

> The one owner for SVG an agent writes by hand. Six lanes produce one — a
> missing icon glyph, a geometric mark, an illustration, a diagram, an animated
> asset, a wireframe canvas — and until this skill existed none of them had a
> procedure or a check beyond the agent's own belief that the file looked right.

## When to use

- A glyph the incumbent icon set does not have (`iconography` first — the set wins).
- A simple geometric mark, when `logo-generation` takes the true-vector path.
- An illustration or a diagram authored as SVG rather than generated.
- An animated asset: SMIL, CSS or WAAPI inside an `.svg` or an inline graphic.
- A **surgical edit** to an existing SVG — "change only the hat", "remove the face".
- A **raster converted to a vector** — "turn the logo in this PNG into a real vector".

## When NOT to use

- The icon exists in the set → `iconography`, and stop there.
- A photoreal or illustrative raster → `image-generation`.
- A full brand pipeline → `logo-generation` (which routes back here for the mark).
- Motion design for video → `motion-choreographer`.

## Procedure

1. **Read the delivery mode first — it decides everything after it.** `inline`
   in a host page, a standalone `document` opened directly, `img`, a CSS
   background, or a deck. It decides what can animate, what can execute, and how
   the graphic gets its accessible name. An **undeclared** mode is treated as
   `inline`, the strictest.
2. **Classify the asset** — `icon`, `mark`, `illustration`, `diagram`,
   `animated`. The class picks the fill-ratio threshold and the geometry
   tolerance; there is no global threshold, because a 24-grid icon's designed
   padding reads as an under-filled viewBox against one.
3. **Plan before attributes** — concept, then layout, then attributes.
   Primitives before detail: a mark built from `rect`/`circle`/`polygon` is a
   true vector and is often the right answer, not a lesser one.
4. **Write with the invariants.**
   - ids namespaced to the graphic — a bare `id="title"` names the second
     inline graphic on the page after the first.
   - `<title>` (plus `role="img"`) when the graphic means something;
     `aria-hidden="true"` when it is decorative. Exactly one accessible name —
     `aria-label` **and** `<title>` is two, and which wins is renderer-dependent.
   - colour from the project's tokens or `currentColor`, never a loose hex.
   - an explicit `font-family` with a fallback the target actually ships; a
     `<text>` with none resolves to the platform serif.
   - no `<script>`, no `on*`, no `javascript:`, no `foreignObject`, no external
     `href` or `url()`, no internal DTD subset or `<!ENTITY` (a bare public
     DOCTYPE is fine).
5. **Run the static check** — `lint_svg_asset`, with the delivery mode declared:
   ```bash
   ./scripts-run src/scripts/lint_svg_asset --file path/to/asset.svg --delivery inline
   ```
6. **Run the witness** — the asset profile, which opens the file in a real engine:
   ```bash
   agent-config ui:render path/to/asset.svg --profile asset --class icon
   ```
7. **Look at the render.** Looking stays mandatory for *meaning*; it is never the
   pass for *geometry*. Fix what both the checks and the look found.
8. **Stop** at a clean witness or after three render passes, whichever comes first.
9. **Report** the renderer and the checks that actually ran — `verified`,
   `static-only` or `unverified` — and name only output files read back from disk.

## Status — what each word is allowed to mean

| Status | Allowed only when |
|---|---|
| `verified` | a render manifest from the asset profile exists **whose recorded file digest equals the delivered file's digest on disk**. A manifest from an earlier pass does not count. |
| `static-only` | the static check ran and no render did. A parser pass (`xmllint --noout`) is this, never `verified` — a file can parse and still be the wrong picture. |
| `unverified` | no browser resolved. Never a pass; never silently upgraded. |

## Editing an existing SVG — the baseline replaces the look

Declare the ids the edit is allowed to touch, then let the readout decide:

```bash
./scripts-run src/scripts/lint_svg_asset --file after.svg --baseline before.svg --allow hat,hat-band
```

Every element outside the allowed set that changed is reported with the attribute
that changed, after number and whitespace canonicalisation. **No pixel diff
decides this** — anti-aliasing and font metrics would make it a per-machine
verdict.

This applies **between the owner's own passes** too. A part the user already
accepted joins the baseline and may not move by hand. A conversion pass that
re-derives that part from the source instead **re-measures** it and re-checks
the accepted property — a hole that was accepted as a hole stays a hole through
a full re-trace.

## Converting a raster to a vector — its own branch

Drawing it from a look fails, and it fails the same way every time: the outlines
"coincide within a few pixels" by eye and read 0.883 silhouette IoU when
measured. The procedure below reached 0.984 with the same tools.

1. **Crop the source region and make that crop the coordinate system.** Write
   every vector coordinate in the crop's pixel units; fit the viewBox to the
   content at the end, not at the start.
2. **Derive geometry from the pixels, never by eye.** One traced silhouette that
   clips everything, then named regions split along an edge map; smooth,
   resample and simplify each contour. The outer edge comes from one contour and
   the holes come from the source.
3. **Fit colour, do not pick it.** Least-squares per region against that region's
   own pixels; swap a linear gradient for a radial one only when the residual
   actually drops.
4. **Classify near-white inside the mark as hole or paint from the source**, and
   check it on a dark background **before** the first report. Near-white paint
   where the source shows a hole is invisible on white and obvious on black.
5. **Keep text, wordmark and slogan out** unless they were asked for.
6. **Score every pass and every candidate change**, and keep a change only when
   the score improves — a tried-and-worse idea is dropped by the number, not by
   taste. Use the two readings the geometry comparison produces: silhouette IoU
   over saturated regions, and mean colour error plus the share of pixels off by
   more than 40/255 — broken down per region, so the worst region is named.
7. **Stop** at the declared tolerance or at the user's pass budget, whichever
   comes first.
8. **Report the per-pass numbers, the cause of the remaining residual, and the
   file size.** Fidelity costs bytes — one accepted conversion went 5.3 KB →
   49.5 KB and nothing measured it.

Any tracing tool the host has may do the deriving, and a host with none can
write one. **The measurement is the procedure, not the tool.**

## Deliver, re-open, re-render

The last step reads every delivered file back **from its final path** in a fresh
browser context (`file://`, every other request aborted) and re-renders it from
there — not from the source text the agent wrote. Report path, byte size and
digest. An `img` delivery is additionally loaded through a host `<img>` and must
report a non-zero natural width.

**A file that does not re-open is not delivered.**

## Output format

1. **Delivery mode and asset class** — declared, not assumed.
2. **The file** — path, byte size, digest.
3. **Checks that ran** — the static check's finding count, the witness's
   readings, and the status word from the table above.
4. **For a conversion** — the per-pass score table and the residual's cause.
5. **What was looked at** — honestly, or nothing.

## Gotcha

- **A `<path>` is not evidence of a vector.** A raster embedded beside one dummy
  path passes a presence-of-`<path>` check and is not a vector; a mark built
  from `rect`/`circle` fails that check and is one.
- **CSS cannot stop SMIL.** `svg * { animation: none !important }` under an
  emulated `reduce` leaves an `<animate>` running. Route the animation itself.
- **An `<img>`-delivered SVG never sees the OS motion preference.** The host
  needs a `<picture>` with a `media="(prefers-reduced-motion: reduce)"` source
  pointing at a static file.
- **`screenshot({ animations: 'disabled' })` does not freeze SMIL.** Use
  `pauseAnimations()` + `setCurrentTime()`.
- **`transform-origin` without `transform-box` pivots against the view box**, not
  the element — per element, so a correct sibling proves nothing about it.
- **`keySplines` outside [0,1] stops the animation outright** rather than
  clamping it.

## Do NOT

- Do NOT report `verified` on a look, a parser pass, or a render of an earlier
  draft.
- Do NOT say "matches" or "100 %" about a conversion without the two numbers and
  the registration they were measured against.
- Do NOT rename ids or simplify paths as a side effect of a surgical edit.
- Do NOT restate motion, ARIA or render-security mechanism here — point at the
  authority and let it own the rule.
- Do NOT add a rasteriser, a tracing dependency, or an optimiser to the write path.

## See also

- [`iconography`](../iconography/SKILL.md) — the set comes first; this skill is
  for the glyph it lacks.
- [`logo-generation`](../logo-generation/SKILL.md) — the brand pipeline that
  routes a geometric mark here.
- [`image-provider-routing`](../image-provider-routing/SKILL.md) — illustrative
  vector art goes to a provider, not here.
- [`fe-design`](../fe-design/SKILL.md) § Motion — the motion authority. Reduced
  motion, duration and easing are its rules, cited here and never restated.
- [`frontend-render-security`](../frontend-render-security/SKILL.md) — the sinks
  an SVG can carry into a host origin.
- [`design-intelligence`](../design-intelligence/SKILL.md) — diagram layout; its
  geometric pre-checks are witnessed by the asset profile now.
- [`canvas-design`](../canvas-design/SKILL.md), [`wireframe`](../wireframe/SKILL.md)
  — the two lanes that use SVG as an execution surface.
- [`design-fidelity`](../../rules/design-fidelity.md) — a provided artifact is
  the spec; the baseline readout above is its surgical-edit witness.
- `docs/contracts/design-artifact-verification.md` — `frame_seek` and the other
  primitives the witness depends on.
