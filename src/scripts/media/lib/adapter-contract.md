# Adapter Contract (v2)

> Single source of truth for every adapter under
> `scripts/ai-video/adapters/`. Phase 4 Step 1 finalizes any open
> point in this draft; **breaking changes bump the version pin
> and require every adapter to be rerun against the fixture set**
> (`scripts/media/lib/fixtures/`).

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

## Blueprint → provider translation

The 12-block Cinematic Scene Blueprint (`scene-expander`) is the
provider-agnostic intermediate representation. Adapters never see the
raw blueprint — they consume the adapter-contract JSON below. The
ONLY place provider-specific prompt grammar may be introduced is the
`motion-choreographer` skill's per-provider encoder table (named
moves for Veo, motion-intensity token for Kling, natural-language
moves for Sora, preset ids for Higgsfield). If an adapter needs a new
provider-specific prompt idiom, extend that encoder table — never the
blueprint vocabulary. The anti-leak test in
`tests/test_ai_video_blueprint_schema.py` enforces this boundary.

## Audio ownership — intent, translation, validation (issue #180)

Three layers, three owners — no layer may absorb another's job:

1. **Intent — the blueprint (scene-expander).** DIALOGUE / AMBIENT
   blocks are emitted whenever creatively warranted, provider-agnostic,
   regardless of which adapter will render. The parser mirrors dialogue
   into `requires.audio_native: true`.
2. **Translation — the encoder (motion-choreographer).** Encodes audio
   intent into the provider's grammar when `capability.audio = native`;
   prepares the stitch-time mux fallback when `audio = none`. The
   encoder is a translator, NEVER a validator — it does not decide
   whether dropping dialogue is acceptable.
3. **Validation — the orchestrator (`/video:scene`,
   `/video:from-script`, `/video:from-song`).** Before submit, when
   `requires.audio_native = true` meets `capability.audio = none`, the
   flow STOPS and surfaces the mismatch with numbered options: switch
   to an audio-native adapter · proceed without dialogue (ambient mux
   only) · drop audio intentionally · override and attempt anyway
   (operator-owned cost risk; verify the dry-run's `audio_embedded`
   first). A downgrade decision is recorded by the encoder as an
   `AUDIO DOWNGRADE` warning block in `motion-prompt.txt` and
   `adapter-notes.md` — silent dialogue loss is a contract violation.

`capability.audio` is a **contract commitment**, not a best-effort
hint: an adapter whose rendered output contradicts its declared
capability violates this contract (the capability ↔ dry-run coherence
test in `tests/test_ai_video_adapter_contract.py` is the build-time
guard; the orchestrator gate is the runtime guard — they are
complementary, not redundant).

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

### `model_id` — multiplexer model selection (additive, v2)

Multiplexer adapters (`fal`, `replicate`) reach many models through one
provider API. The optional top-level `model_id` stdin key selects the
model for **this job**, overriding the provider's XML `<default-model>`.
Single-model adapters ignore it (unknown-key rule above). Rules:

- `model_id` is **tainted input** — adapters validate it against a
  strict charset whitelist before it touches a URL, and reject parent
  traversal. It never appears in a filesystem path.
- `poll` / `fetch` are **stateless**: adapters MUST NOT persist poll
  state between calls. When the provider's status URL needs the model
  (fal), the adapter encodes it into the returned `job_id`
  (`<model_id>::<request_id>`) and re-validates both segments on every
  poll/fetch.
- Per-model capabilities (`min_duration`, `max_duration`, `audio_sync`,
  `aspect`, modeled cost) live in
  `scripts/ai-video/lib/model-capabilities/<adapter>.json` and are
  surfaced via `capability --model <id>`. Entries are
  `verified: false` until a real smoke trace exists for that model —
  consumers must surface the flag, never trust the numbers silently.

### Lip-sync adapters — `kind="lipsync"` stdin shape (additive, v2)

A lip-sync adapter (e.g. `syncso`) is a **post-process** render job: it
consumes a finished clip plus one audio line instead of prompt blocks.
Its `submit` stdin is:

```json
{
  "video_url": "https://…/scene-0007.mp4",
  "audio_url": "https://…/line-0003.wav",
  "model_id": "lipsync-2"
}
```

- Both URLs MUST be https and fetchable by the provider; a local path
  is rejected with exit 7 and the host-the-artifacts hint (the
  orchestrator hosts the clip + the WAV cut from the song first).
- **Local lip-sync variant** (`musetalk`): a local engine consumes
  `video_path` / `audio_path` instead — validated local files per the
  local-source rule below; a URL is rejected with the
  use-the-hosted-adapter hint. Synchronous local inference ships as the
  collapsed `run` subcommand and still honours `AIV_DRYRUN`.
- `poll` / `fetch` follow the normal v2 triple; the fetched clip embeds
  the driving audio (`audio_embedded: true`, capability `audio=native`)
  — dropping its track at mux would desync the mouth.
- **Sparse-budget discipline:** per-song limits live machine-readable
  in `model-capabilities/<id>.json` under `lipsync_budget`
  (`max_segments_per_song`, `max_segment_seconds`,
  `frontal_close_up_only`, `cost_gate`). The **orchestrator** enforces
  them before any submit — the adapter renders single segments and
  never sees the whole song.

### Local providers — local-source rule (additive, v2)

A **local** provider (e.g. `comfyui` — the engine runs on the operator's
machine/container, ADR-060) consumes local *input* paths instead of the
https-only rule written for hosted lip-sync inputs: the https rule exists
because a hosted provider must fetch the bytes over the network; a local
engine reads them from the shared volume. Local input paths are still
validated (`aiv_validate_artifact_path` against the project root when the
orchestrator scoped the call) before use. Everything else is unchanged —
the async `submit/poll/fetch` triple, the trust boundary on *returned*
artifacts, and the fixture-backed `dry-run`. A local render that has no
provider charge reports `cost_estimate: 0.0` (a **known** zero); an
*omitted* estimate still means unknown and is never treated as `0`.

### `<enabled>` — provider kill-switch (additive, v2)

A provider block in `agents/.ai-video.xml` MAY carry
`<enabled>false</enabled>`. Adapters check it
(`aiv_provider_enabled <id>`) before any network subcommand and refuse
with exit 6 when disabled — the operator can take a misbehaving
provider out of rotation without editing every procedure that names it.
A missing element means enabled (existing configs keep working).

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
the disk. Three rules, enforced by `scripts/media/lib/adapter-common.sh`:

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
  `scripts/media/lib/fixtures/<adapter-id>/`.
- Exit code 0.

Fixtures are committed and cover one happy path per adapter.
Phase 6 golden runs assert byte-identical stdout under
`AIV_DRYRUN=true`.

## Logging & redaction

- **stderr only** for log output. Stdout is reserved for the
  contract JSON.
- Every adapter MUST source `scripts/media/lib/redact.sh` and
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
