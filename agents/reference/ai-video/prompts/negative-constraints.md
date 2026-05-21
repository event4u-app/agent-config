# Negative Constraints — what NOT to render

> The `NEGATIVES` block of the cinematic blueprint. Empty negatives
> = adapter free-fires. This file is the operator's vetted starter
> list per scene type.

## Why negatives matter

Adapters trained on the open web overfit to a small set of "looks":
generic Hollywood lens flare, soap-opera key+fill contrast, symmetric
composition, motion-blur on stills, text overlays from training-set
captions. A scene without explicit negatives drifts toward that mean.
Negatives pull the output back toward the blueprint's intent.

## Starter negatives by scene type

### Live-action / cinematic

```
no lens flare, no soap-opera lighting, no symmetric framing, no
generic cinematic look, no text overlay, no watermark, no extra
characters, no motion blur on static shots, no fish-eye distortion,
no chromatic aberration unless named in STYLE_REFERENCE
```

### Animation / Pixar-style

```
no realistic skin pores, no photoreal shading, no live-action lighting,
no plastic-doll look, no flat shading, no anime stylization, no text
overlay, no watermark, no extra characters, no background characters in
focus
```

### Documentary / handheld

```
no Steadicam smoothness, no crane shots, no symmetric framing, no
lens flare, no rack-focus pulls, no text overlay, no watermark
```

### Product / hero shot

```
no human hands, no extra props, no background clutter, no lens flare,
no text overlay, no watermark, no reflection of crew or equipment, no
dust motes, no chromatic aberration
```

## Negatives the adapters often need

These are not scene-specific — they're failure-mode counters that show
up across all five adapters often enough to live in every scene's
NEGATIVES block:

- `no text overlay, no watermark` — adapters frequently hallucinate
  caption-like text from training data.
- `no extra characters` — Pixar / Kling especially tend to add a
  background figure when the prompt has open space.
- `no fish-eye distortion` — Sora and Higgsfield occasionally pick
  ultra-wide lenses when LENS is unspecified.
- `no motion blur on static shots` — Veo and Kling sometimes add
  cinematic blur even when CAMERA_MOTION is `static`.

## Negatives as contract

Each scene's NEGATIVES is part of the per-scene contract that the
adapter must honor. If the rendered clip violates a NEGATIVE, that's a
prompt-engineering failure (negative wasn't strong enough or wasn't in
the right block), not a generation failure — and it's the operator's
signal to rewrite the scene rather than re-render at random.

## Anti-patterns

- **Negatives as wishlist.** "No bad lighting" is not a negative;
  adapters can't parse aesthetic judgments. Name the *visible feature*
  you don't want.
- **Negatives that contradict positives.** A blueprint with
  `LIGHTING: low-key, deep shadows` and `NEGATIVES: no shadows`
  produces flat output. The negative wins on most adapters, the
  positive wins on others — either way, intent collapses.
- **Empty NEGATIVES.** Even a one-item list helps. Default to the
  scene-type starter list above.

## Attribution

Failure-mode catalog assembled from operator-vetted runs across the five
adapters. Scene-type starter lists are this package's synthesis. The
"negatives as contract" framing is borrowed from prompt-engineering
practice in image-generation communities and adapted to video.
