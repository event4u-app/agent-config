# Scenario 1 (b) — a raster converted to a real vector

**Task text handed to the owner, verbatim:**

> Here is a PNG of our brand sheet. Turn the logo in it into a real vector
> graphic — the mark only, without the app name or the strapline — usable at any
> size.

**Inputs:** a raster rendered by Chromium from
`../fixtures/svg-assets/conversion/reference.svg`. The raster is NOT committed:
it is produced at test time from the committed reference, so the ground-truth
geometry of every region is known and no third-party brand image enters the
tree. The owner sees the raster, never the reference.

**Declared by the owner before writing:** delivery `inline`, asset class `mark`,
and the registration — the crop offset and scale of the source region, in that
crop's own pixel frame.

**Why this is a separate sub-case from 1 (a):** they fail differently. A brief
has no ground truth to disagree with. A raster does, and the recorded failure is
a session that drew the mark from a look, reported that the outlines "coincide
within a few pixels", and measured 0.883 silhouette IoU. The same session, once
every pass was scored, reached 0.984 and was accepted.

**What decides the outcome:**

- 0 `<image>` and 0 `<foreignObject>` — a raster wrapped in a vector file is not
  a conversion.
- No wordmark and no strapline region: the task excluded them.
- The hole inside the mark is a hole — alpha 0 on a dark background, not
  near-white paint that only looks right on white.
- The two readings against the reference meet the declared tolerance, reported
  as numbers with the pass count — never "matches" and never "100 %".
- At most five scored passes. A run that needs more fails: the budget is part of
  the procedure, not a soft target.
