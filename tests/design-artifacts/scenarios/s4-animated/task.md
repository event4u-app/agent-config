# Scenario 4 — an animated variant with a reduced-motion fallback

**Task text handed to the owner, verbatim:**

> Animate the rising-arrow mark so the arrow draws on once over 900 ms. We need
> it both inline in the app and as a standalone file we drop into an `<img>` on
> the marketing page. It has to honour prefers-reduced-motion in both places.

**Declared by the owner before writing:** asset class `animated`; two deliveries,
`inline` and `img`.

**What decides the outcome:**

- `frame_seek` at t = 0, mid and end yields three different frames.
- Under emulated `reduce`, the inline delivery yields equal frames.
- The `img` delivery records `reduced_motion: not_witnessable` — an image
  document was measured unreachable by media emulation — and its host carries a
  `<picture>` route selecting the static file instead.
- DQ4 and the motion family of `lint_svg_asset` both report 0.
