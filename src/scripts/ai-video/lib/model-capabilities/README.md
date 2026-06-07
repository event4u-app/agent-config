# Model-capabilities manifests

One JSON manifest per **multiplexer adapter** (`fal.json`,
`replicate.json`). A multiplexer reaches many video models through one
uniform provider API; the manifest is the single source of truth for
what each reachable model can do, consumed by:

- the adapter's `capability --model <id>` subcommand (audio routing for
  the stitcher: `audio_sync: true` → `audio=native`),
- the music-video pipeline's segment planner (variable-length plans must
  stay inside `min_duration..max_duration` or the plan is unbuildable),
- the batch cost gate (`cost_per_second_usd` × planned seconds feeds the
  preview estimate and the `--max-spend-usd` kill-switch).

## Schema (v1)

```json
{
  "schema": 1,
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
      "input_notes": "per-model input schema differences, one line"
    }
  }
}
```

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

## Verification workflow

1. Maintainer wires a live key and captures a smoke trace under
   `agents/reference/ai-video/smoke-traces/` (Hard-Floor spend —
   per `non-destructive-by-default`).
2. The trace names the exact `model_id`; flip that entry's
   `verified: false` → `true` in the same commit.
3. Promotion of the **adapter's** lifecycle tier
   (`experimental → stable`) follows
   `docs/contracts/provider-lifecycle.md` and stays maintainer-authored.
