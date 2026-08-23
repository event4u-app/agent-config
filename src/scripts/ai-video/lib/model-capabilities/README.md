# Model-capabilities manifests

One JSON manifest per adapter whose capabilities differ per model —
the multiplexers (`fal.json`, `replicate.json`), the local engine
(`comfyui.json`), the lip-sync pair (`syncso.json`, `musetalk.json`) and
the direct video adapters (`higgsfield.json`, `kling.json`,
`gemini-veo.json`, `sora.json`). A multiplexer reaches many video models
through one uniform provider API; a direct adapter reaches one provider's
own model set. Either way the manifest is the single source of truth for
what each reachable model can do, consumed by:

- the adapter's `capability --model <id>` subcommand (audio routing for
  the stitcher: `audio_sync: true` → `audio=native`),
- the music-video pipeline's segment planner (variable-length plans must
  stay inside `min_duration..max_duration` or the plan is unbuildable),
- the batch cost gate (`cost_per_second_usd` × planned seconds feeds the
  preview estimate and the `--max-spend-usd` kill-switch),
- the continuity selection rule (`start_frame` / `end_frame` decide
  whether a model can open on a handed-off frame or close on a given one
  — `motion-choreographer` Step 0 reads them before it proposes a
  continuous take).

## Schema (v2)

```json
{
  "schema": 2,
  "adapter": "<adapter-id>",
  "models": {
    "<model_id>": {
      "label": "human-readable name",
      "min_duration": 5,
      "max_duration": 10,
      "audio_sync": false,
      "aspect": ["16:9", "9:16"],
      "cost_per_second_usd": 0.28,
      "verified": false,
      "input_notes": "per-model input schema differences, one line",
      "start_frame": null,
      "end_frame": null,
      "frame_lock": { "probed_at": null, "psnr_frame0": null }
    }
  }
}
```

**What v2 adds.** Three keys — `start_frame`, `end_frame`, `frame_lock` —
and one rule that is not a shape: **`null` means *unknown*, and unknown is
never treated as `true`.** Nothing else changed, so a v1 file becomes a v2
file once the three keys are present on every entry. The keys are a
catch-up rather than a new axis: the `ref_images[0] → image /
start_image` mapping row below, and `higgsfield.sh`'s hard requirement for
`ref_images[0]`, already asserted start-frame behaviour that v1 had no
field to express.

- `min_duration` / `max_duration` — clip length bounds in **seconds**.
  Equal values mean the model renders fixed-length clips only.
- `audio_sync` — `true` when the model returns a muxed MP4 with
  synchronized audio (`capability --model` then answers
  `audio=native`); `false` → video-only, the orchestrator muxes at
  stitch time.
- `aspect` — aspect ratios the model accepts.
- `cost_per_second_usd` — **modeled** estimate, never a provider quote.
  Feeds preview-mode cost tables; preview never calls a pricing API.
- `verified` — `false` until a maintainer captures a real-API smoke
  trace for **that model** (not just the adapter). Unverified entries
  are documented-best-effort: the adapter warns on stderr whenever an
  unverified model is submitted or looked up, and planning consumers
  MUST surface the flag rather than trust the numbers silently.
- `input_notes` — the per-model input schema difference in one line
  (see below).
- `start_frame` — `true` when the model accepts a first frame to open on
  (`ref_images[0]`), `false` when it cannot, `null` when nobody has
  probed it. A continuous take may only be chained through models that
  answer `true`.
- `end_frame` — the same three values for a *closing* frame (`end_image`
  in the stdin contract). An adapter handed `end_image` for a model that
  does not answer `true` **refuses by name** — it never drops the image;
  see [`adapter-contract.md`](../../../media/lib/adapter-contract.md)
  § `end_image`.
- `frame_lock` — the evidence behind those two answers: `probed_at` (ISO
  date of the live probe) and `psnr_frame0` (measured dB of the rendered
  frame 0 against the submitted still). Both `null` until a probe writes
  them; a dB value is a **measurement**, never an estimate, so it stays
  `null` rather than being filled in from documentation. A `true` on
  either frame key without a `probed_at` is a contract violation.
- `end_frame: true` beside `start_frame: false` is **incoherent** — a
  model that cannot open on a supplied frame cannot close on one either.
  The shared reader in
  [`adapter-common.sh`](../../../media/lib/adapter-common.sh) refuses such
  an entry instead of handing it to a planner.

## Per-model input schema differences

The contract stdin (`prompt.*` blocks, `duration`, `aspect`, `seed`,
`negative`, `ref_images`) is uniform; the **provider-side** `input`
shape is not. The multiplexer adapters map best-effort:

| Contract field | fal mapping | replicate mapping |
|---|---|---|
| `prompt.*` blocks | joined into one `prompt` string | joined into one `input.prompt` string |
| `duration` | `duration` (Kling wants the enum string `'5'`/`'10'`; Wan/Hunyuan derive it from `num_frames`) | `duration` (Kling enum; Wan/Hunyuan/LTX count frames) |
| `aspect` | `aspect_ratio` (Wan/Hunyuan use a `resolution` enum instead) | `aspect_ratio` (Veo uses `resolution`) |
| `negative[]` | `negative_prompt` (joined; Hunyuan has none) | `negative_prompt` (joined; Hunyuan has none) |
| `ref_images[0]` | `image_url` (image-to-video routes only) | `image` / `start_image` (model-dependent) |
| `seed` | `seed` | `seed` |

Field names per model are **ASSUMED** (documented-best-effort from the
provider docs) until the first live smoke trace; mismatches surface as
provider-side 4xx errors with the body echoed to stderr, never as
silent drops.

`ref_images[0]` is the **start** frame, and the row above maps only its
*field name*. Whether a given model honours it is the separate `start_frame`
answer in the schema above; the closing counterpart — `end_image` in the
stdin contract — is `end_frame`. A mapping row is not evidence that a model
accepts the field: only `frame_lock.probed_at` is.

## Verification workflow

1. Maintainer wires a live key and captures a smoke trace under
   `agents/reference/ai-video/smoke-traces/` (Hard-Floor spend —
   per `non-destructive-by-default`).
2. The trace names the exact `model_id`; flip that entry's
   `verified: false` → `true` in the same commit.
3. Promotion of the **adapter's** lifecycle tier
   (`experimental → stable`) follows
   `docs/contracts/provider-lifecycle.md` and stays maintainer-authored.
