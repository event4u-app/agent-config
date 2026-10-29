# Brief — trace the mascot

`mascot.png` is the original 48x48 raster of Bramble, a fictional bear mascot
drawn for this benchmark (generated programmatically; no third-party asset).
Produce `out/mascot.svg`: the same bear as pure vector shapes.

- `viewBox="0 0 48 48"` (same canvas as the raster).
- Keep the source colours: orange body `#f2a93b`, dark eyes `#3b2a1a`, cream belly `#fff4e0`.
- No embedded raster (`<image>`), no script, no external references.
