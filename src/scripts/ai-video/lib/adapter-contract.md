# Adapter Contract (v2)

> Single source of truth for every adapter under
> `scripts/ai-video/adapters/`. Phase 4 Step 1 finalizes any open
> point in this draft; **breaking changes bump the version pin
> and require every adapter to be rerun against the fixture set**
> (`scripts/ai-video/lib/fixtures/`).

## Scope

Every backend (OpenAI Images, Gemini Veo, Kling, Higgsfield, Sora,
…) ships as one executable shell entry under
`scripts/ai-video/adapters/<id>.sh`. The orchestrator never speaks
to a network API directly — it speaks to one of these scripts.

## Capability flag

Each adapter declares its audio capability via a top-of-file
comment and via the `capability` subcommand:

```
# capability: audio=native | audio=none
```

`audio=native` — the provider returns a muxed MP4 with synchronized
dialogue / ambient. `audio=none` — video-only output; the
orchestrator muxes the operator-supplied track at stitch time.

A per-model adapter (e.g. Higgsfield) MAY declare `audio=per-model`
and surface the capability via `capability --model <id>`.

## Subcommands

Every adapter implements four:

| Subcommand | Purpose | I/O |
|---|---|---|
| `submit` | Submit a render job to the backend | stdin JSON · stdout `{job_id}` |
| `poll <job_id>` | Poll job status | stdout `{status: queued\|running\|done\|failed, progress?}` |
| `fetch <job_id>` | Download artifacts after `status=done` | stdout `{video_path, audio_path?, audio_embedded}` |
| `dry-run` | Return a deterministic fixture path without network | stdout same shape as `fetch` |

`submit` + `poll` + `fetch` may be collapsed into a single
`run` for synchronous backends (OpenAI Images) — the wrapper exposes
the same stdout shape on stdout and an exit code on completion.

## Stdin JSON (consumed by `submit` / `run`)

```json
{
  "prompt": {
    "style": "...",
    "subject": "...",
    "environment": "...",
    "action": "...",
    "camera": "...",
    "lens": "...",
    "lighting": "...",
    "mood": "..."
  },
  "ref_images": ["/abs/path/frame.png", "..."],
  "duration": 4.5,
  "aspect": "16:9",
  "seed": 1234567,
  "audio": {
    "dialogue": ["speaker: \"line\"", "..."],
    "ambient": ["rain on metal", "..."],
    "language": "en",
    "enable_native_audio": true
  },
  "negative": ["centered framing", "..."]
}
```

`ref_images`, `duration`, `aspect`, `seed`, `audio`, `negative` are
optional. `prompt.*` blocks are mandatory. Unknown top-level keys
are logged to stderr and ignored.

## Stdout JSON (emitted by `fetch` / `run` / `dry-run`)

```json
{
  "video_path": "/abs/path/scene-0001.mp4",
  "audio_path": "/abs/path/scene-0001.wav",
  "audio_embedded": true,
  "cost_estimate": 0.12
}
```

Semantics:

- `cost_estimate` (optional, USD float) — the modeled cost of the
  equivalent **live** render for this scene, surfaced on `dry-run`
  (and echoed on `fetch` / `run` as the actual when known). The
  orchestrator sums it across scenes for the batch cost gate and the
  `--max-spend-usd` kill-switch. Omitted when the adapter cannot price
  the call — the gate then shows the scene as `unknown` and never treats
  a missing estimate as `0`.
- `audio_embedded: true` — `video_path` is a muxed MP4 with audio;
  `audio_path` is omitted or echoes the same path. Stitcher
  pass-through.
- `audio_embedded: false` with `audio_path` — separate track to mux
  at stitch time via `ffmpeg`.
- `audio_embedded: false` without `audio_path` — video-only;
  operator supplies the audio bed at stitch time.

## Trust boundary (v2)

The artifact paths an adapter emits on `fetch` / `run`, and the bytes it
downloads, are **untrusted provider output**. A buggy or hostile backend
must not be able to make the orchestrator read `/etc/passwd`, follow a
symlink out of the project, inject into the `ffmpeg` concat list, or fill
the disk. Three rules, enforced by `scripts/ai-video/lib/adapter-common.sh`:

1. **Project-scoped artifacts.** Live `fetch` writes downloads into the
   scene-scoped output dir (`aiv_scene_dir <project> <scene_id>` →
   `<project>/scenes/<scene_id>/`) and returns a path under it. The
   orchestrator passes every consumed path through
   `aiv_validate_artifact_path <project_root> <path>`, which canonicalizes
   the path and **rejects** anything that escapes the root, is a symlink,
   carries a parent-traversal (`..`), or contains injection / control
   characters (`'`, `` ` ``, `$(`, newline). The consumer (`stitch.sh`)
   re-validates before handing a path to `ffmpeg`.
2. **Size cap.** Downloads go through `aiv_fetch_url <url> <dest>
   [max_bytes]`, which caps a single artifact at `aiv_max_artifact_bytes`
   (default 512 MiB, override `AIV_MAX_ARTIFACT_BYTES`) and times out
   (`AIV_FETCH_TIMEOUT`, default 120 s). A runaway stream fails closed.
3. **Opaque paths only.** `video_path` / `audio_path` SHOULD be returned
   relative to the scene dir (or absolute under it). An absolute path
   outside the project root is a contract violation and is rejected — it
   is never consumed.

Dry-run fixtures are committed, trusted inputs and are exempt (no network,
no provider-controlled path).

## Error contract

Adapter failure: **non-zero exit code** AND a JSON file at
`<project>/scenes/<scene_id>/error.json`:

```json
{
  "adapter": "gemini-veo",
  "subcommand": "fetch",
  "job_id": "...",
  "exit_code": 7,
  "stderr_tail": "...",
  "retryable": true,
  "user_action": "regenerate-prompt | retry | skip | abort"
}
```

`retryable: false` means a prompt or input change is required —
the orchestrator MUST NOT auto-retry. `retryable: true` does **not**
authorize auto-retry either; the orchestrator surfaces a single
numbered-options block (retry · regenerate prompt · skip · abort)
per `non-destructive-by-default` and waits.

## Dry-run

`AIV_DRYRUN=true` (set by command default; see Phase 5 Step 6) OR
the explicit `dry-run` subcommand:

- No network call.
- Stdout JSON points at a deterministic fixture under
  `scripts/ai-video/lib/fixtures/<adapter-id>/`.
- Exit code 0.

Fixtures are committed and cover one happy path per adapter.
Phase 6 golden runs assert byte-identical stdout under
`AIV_DRYRUN=true`.

## Logging & redaction

- **stderr only** for log output. Stdout is reserved for the
  contract JSON.
- Every adapter MUST source `scripts/ai-video/lib/redact.sh` and
  pipe network responses through `aiv_redact_stream` before any
  `>&2` write. API keys, bearer tokens, and operator-registered
  secrets are masked.

## Strict-mode shell

Every adapter:

```bash
#!/usr/bin/env bash
set -euo pipefail
. "$(dirname "$0")/../lib/redact.sh"
. "$(dirname "$0")/../lib/load-config.sh"
```

`shellcheck` clean (Phase 4 Step 9).

## Versioning

This contract is `v2`. Backward-incompatible changes (renamed
field, removed subcommand, changed stdout shape) bump the version and
require an `adapter-contract` migration note plus a rerun of every
adapter against the fixture set.

**v1 → v2 migration.** Additive, no stdout-field change — the
`{video_path, audio_path?, audio_embedded}` shape is unchanged, so
committed fixtures stay valid. v2 adds the **Trust boundary** section
above: live `fetch` MUST write into the scene-scoped dir and route every
consumed artifact path through `aiv_validate_artifact_path` and every
download through `aiv_fetch_url`. Existing dry-run-only adapters need no
change; the obligation lands when their live `submit/poll/fetch` is wired.
