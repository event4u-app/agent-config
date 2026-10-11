# Scenario 1 (b) — conversion report

Deliverable: `delivered/mark.svg` — **2,734 bytes**,
`sha256:b98cced74a348aa3283ab72fbd3bd8bd2b3b3b41d68a02f488c43092081c368b`.
Delivery `inline`, asset class `mark`.

## Declared registration

The raster is Chromium's render of `../../fixtures/svg-assets/conversion/reference.svg`
drawn into a canvas and read back with `getImageData`. Nothing is decoded from a PNG.

| | |
|---|---|
| Render scale | **4** device px per source user unit (full render 960 × 640) |
| Crop offset | **(79, 79)** device px in that render |
| Crop size | **322 × 322** device px |
| Coordinate frame | the crop's own device-pixel frame; pixel (0,0) spans (0,0)–(1,1) |
| viewBox (fitted at the end) | `1 1 320 320` |

The crop was found from the pixels, not from the reference's markup: the
unpremultiplied chroma `b − r` was taken over the whole render, pixels at ≥ 60 %
of the maximum seeded an 8-connected flood over pixels at ≥ 12 %, and the crop is
that component's bounding box padded by one device pixel. The wordmark and the
strapline never enter it — **0 painted pixels inside the crop fall outside the
mark component**, which is the assertion that the delivered file is the mark only.

Descriptive facts recovered from the raster alone (pixel masks, not polygon
vertices): outer content box **(20, 20) 80 × 80** source units; hole centroid
**(60.000, 59.998)** source units, equivalent radius **17.993** units, boundary
radius range 70.91–71.98 crop px.

## How the geometry was derived

1. Alpha field of the crop, read straight off the transparent-ground render.
2. Marching squares at iso 0.5 with linear edge interpolation — sub-pixel, not a
   pixel-stair boundary. Raw: **1,280** outer vertices, **576** hole vertices.
3. Closed 3-point moving average, then Ramer–Douglas–Peucker at ε = **0.10**
   device px → **72** outer and **66** hole vertices.
4. The hole is a second subpath under `fill-rule="evenodd"`, so it is a real
   cut-out. Probed on the re-opened file: over the **14,034** hole pixels more
   than 4 px from the rim, **max alpha = 0**.
5. Colour is fitted, not picked: per-channel least-squares planes over the
   **78,428** solid interior samples, collapsed onto their common principal
   direction. Linear RMSE **0.409**/255. A radial fit over the same samples gave
   RMSE **2.824**/255 — 590 % worse, not the > 3 % improvement that would have
   justified keeping it, so it was dropped by the number.

## Per-pass score table

Both readings are taken over **non-background pixels** (any pixel where the
reference or the candidate carries paint: 83,133 px), by re-rendering the
candidate in the same Chromium at the same scale and comparing against the
mark-only crop of the reference. Mean colour error is the mean per-channel
absolute difference of the over-white composite; a pixel counts as "off" when its
**worst** channel differs by more than 40/255.

| Pass | Change | Mean colour error | Share off by > 40 | Silhouette IoU |
|---|---|---|---|---|
| 1 | marching squares @ 0.5, smooth k=1, RDP ε=0.10, LSQ linear gradient | **0.316** | **0.00000** (0 of 83,133) | **0.99949** |

**Passes used: 1 of the 5 permitted.** The tolerance was met on the first scored
pass, so by step 7 of the procedure the run stops there. No second pass was taken.

### Sub-pixel offset sweep (a reading, not a correction)

The whole outline was translated by (dx, dy) and re-scored. The declared
registration is the minimum in all three metrics, so **no offset was applied to
the delivered file**.

| dx \ dy | −0.4 | −0.2 | 0 | +0.2 | +0.4 |
|---|---|---|---|---|---|
| **−0.4** | 0.99406 | 0.99722 | 0.99752 | 0.99712 | 0.99393 |
| **−0.2** | 0.99495 | 0.99834 | 0.99880 | 0.99820 | 0.99476 |
| **0** | 0.99521 | 0.99886 | **0.99949** | 0.99880 | 0.99495 |
| **+0.2** | 0.99495 | 0.99857 | 0.99897 | 0.99836 | 0.99483 |
| **+0.4** | 0.99425 | 0.99733 | 0.99765 | 0.99735 | 0.99406 |

(IoU; mean colour error and off-share move the same way — 0.316 at the centre,
1.18 at the worst corner.)

### Controls — the score is shown able to fail

A reading that cannot go red is not a reading. Each control is a deliberately
damaged candidate scored by the same code.

| Control | Mean colour error | Share off by > 40 | IoU | Verdict |
|---|---|---|---|---|
| delivered file | 0.316 | 0.00000 | 0.99949 | within tolerance |
| outline shifted 1 px | 1.559 | 0.01555 | 0.98883 | off-share fails |
| outline shifted 2 px in both axes | 4.160 | 0.03638 | 0.96824 | all three fail |
| RDP ε = 1.5 instead of 0.10 | 1.240 | 0.01258 | 0.99210 | off-share fails |
| RDP ε = 4 | 1.781 | 0.01732 | 0.98750 | off-share fails |
| hole subpath removed (solid mark) | 19.264 | 0.16517 | 0.83530 | all three fail |
| hole painted near-white instead of cut | 19.264 | 0.16517 | 0.83530 | all three fail; hole alpha 1.0 |

A measurement bug was found and fixed by these controls: the first sweep reused
one output filename and Chromium served a cached raster, so every row reported
the first candidate's score. Each render now gets its own URL, and the fix is
pinned by a check that the same configuration scores identically twice, a
different one differs, and the first configuration then reproduces.

## Final readings against the declared tolerance

| Reading | Measured | Tolerance | |
|---|---|---|---|
| Silhouette IoU | **0.99949** | ≥ 0.984 | within |
| Mean colour error | **0.316**/255 | ≤ 7.8 | within |
| Share off by > 40/255 | **0.00000** (0 px) | ≤ 0.012 | within |

Measured on one scored pass, at the registration declared above. This is a
reading at a stated scale against a stated reference, not an identity claim.

### Robustness at scales the geometry was not derived at

| Scale | Mean colour error | Share off by > 40 | IoU |
|---|---|---|---|
| 2× | 0.500 | 0.00177 | 0.99826 |
| 4× (the registration scale) | 0.316 | 0.00000 | 0.99949 |
| 8× | 0.204 | 0.00067 | 0.99942 |

A first 2× probe read 0.98093 / 0.03576 / 2.398. That was the probe's own fault —
it placed the candidate at a half-pixel destination offset, so Chromium resampled
it. With integer alignment the row above is the honest number. A 16× probe was
attempted and abandoned: 39 M array elements over CDP exhausts Node's heap. That
is a transport limit, not a reading.

## Worst region, and the cause of the residual

Per-region breakdown of the final pass:

| Region | Pixels | Mean colour error | Off by > 40 |
|---|---|---|---|
| body (reference alpha 1) | 82,140 | 0.271 | 0 |
| outer edge (antialiased rim) | 460 | 3.609 | 0 |
| **hole edge (antialiased rim)** | **530** | **4.361** | 0 |
| hole interior | 3 | 5.218 | 0 |
| outside | 0 | — | — |

The **hole edge** is the worst region with a meaningful pixel count. The
hole-interior row reads higher per pixel but is 3 pixels at the classification
boundary between rim and interior and carries no weight.

The residual has two causes and neither is a drawing error:

- **At the rims (3.6 and 4.4 per channel):** the outline is a 72- and 66-vertex
  polyline, so each chord sits up to ε = 0.10 device px inside the true arc. The
  renderer's coverage for a rim pixel differs by that fraction of a pixel, which
  is ~0.1 × 226 ≈ 23/255 at most and 4/255 on average. This is the price of the
  polyline representation; it is bounded by ε and the controls show it scaling
  with it.
- **In the body (0.271 per channel):** the two-stop gradient was refitted from
  the solid interior only, so its stop colours are the ramp extrapolated to the
  sample extent (22.5 → 299.5 in the crop frame, stops `#2254da` → `#5b9ff8`)
  rather than the source's own stop positions. The fit RMSE is 0.409/255 and the
  stop hexes are quantised to 8 bits — the body residual is below one 8-bit step
  and cannot be removed without sub-byte colour.

## Static witness and re-open

```
npx tsx src/scripts/lint_svg_asset.ts \
  --file tests/design-artifacts/scenarios/s1b-conversion/delivered/mark.svg \
  --delivery inline
✅  lint_svg_asset: clean — 1 file(s) checked, no violations.   exit 0
```

The delivered file was then re-read **from its final path** in a fresh browser
context (`file://`, every non-`file:` request aborted; 0 were attempted) and
re-rendered from there, not from the text that was written. Natural size 320 × 320;
the re-render reproduces 0.99949 / 0.316 / 0.00000 and max alpha 0 across the hole.

Content census: 0 `<image>`, 0 `<foreignObject>`, 0 `<text>`, 0 `<script>`, no
`on*` handler, no external reference. One `<path>` with an explicit
`fill="url(#conv-mark-fill)"`; both ids namespaced `conv-`.

## Provenance

No geometry was copied from the reference's markup. The reference was read for
orientation and used for two permitted purposes — rendering the raster and
scoring against it. No coordinate, radius or stop colour from that file appears
in the pipeline or in the deliverable; the fitted stops (`#2254da`, `#5b9ff8`)
differ from the source's precisely because they are a fit over a different
gradient-line extent. That the trace independently recovered a hole centroid of
(60.000, 59.998) and a radius of 17.993 source units is evidence the derivation
works, not evidence of a copy.

## One finding outside this deliverable, reported rather than fixed

The sibling harness `tests/design-artifacts/svg_scenarios.test.ts` (another
agent's live work, read-only for this run) scores s1b with `compareGeometry`
passing **no registration** for the candidate. With none, `rasterise` draws the
candidate as `drawImage(img, 0, 0, frame.w, frame.h)` — the whole viewBox
stretched into the **baseline's** `0 0 240 160` frame — and compares it against
the **full lockup**, wordmark and strapline included.

Measured, not predicted, against the delivered file:

| Candidate | Verdict | IoU | Max boundary |
|---|---|---|---|
| `delivered/mark.svg` | `fail` | 0.1768 | 52.50 units |
| `reference.svg` vs itself (control) | `pass` | 1.0000 | 0.00 units |

The control shows the comparator itself is sound. The 0.1768 is the framing:
a 320 × 320 mark-only file stretched into a 240 × 160 frame and set against a
baseline carrying two regions the task excluded. **Any** correct mark-only
deliverable reads this way, so the assertion cannot currently be satisfied by
producing a better conversion.

Two fixes are available to whoever owns that file — pass the candidate a
`registration` for the mark's box in the baseline frame, or give s1b a mark-only
baseline. Neither was applied here: that file is outside this run's write scope.
Note also that the test asserts only `verdict !== 'unverified'`, which a `fail`
satisfies, so the mismatch would pass the suite while reading 0.18.
