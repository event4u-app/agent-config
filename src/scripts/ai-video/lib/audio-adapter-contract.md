# Audio Adapter Contract (v1)

> Single source of truth for every adapter under
> `scripts/ai-video/audio-adapters/`. Sibling of the video/image
> [`adapter-contract.md`](adapter-contract.md) (v2) — deliberately a
> **separate contract**, not a `kind` extension of v2: audio analysis is
> a synchronous filter (stdin path → stdout JSON), while v2 is an async
> render queue (submit/poll/fetch). Mixing the two shapes in one
> contract was rejected by AI-council design review (claude-sonnet-4-5 +
> gpt-4o, 2026-06-07): a filter forced through submit/poll/fetch
> triples the orchestrator's error states for no benefit. **Lip-sync is
> NOT covered here** — it is an async hosted render job and ships as a
> regular v2 adapter under `scripts/ai-video/adapters/` (see
> [`model-capabilities/syncso.json`](model-capabilities/syncso.json)).

## Scope

Two adapter classes, one executable shell entry each under
`scripts/ai-video/audio-adapters/<id>.sh`:

| Class | Input | Output (stdout JSON) |
|---|---|---|
| `audio-analysis` | song file | `{bpm, beats, downbeats, sections}` |
| `lyrics` | vocal stem / song file | word-level timestamps + per-line speaker |

The orchestrator (`/video:from-song`) never bundles or imports ML
dependencies — an adapter either wraps an **operator-installed local
CLI** (allin1, whisperx) or calls a **hosted API**. The suite ships the
wrapper, never the model ("skill suite, not an app" — council
2026-06-06).

## Subcommands

Every audio adapter implements three:

| Subcommand | Purpose | I/O |
|---|---|---|
| `analyze` | Run the analysis | stdin JSON · stdout result JSON |
| `capability` | Declare class + provided fields | stdout JSON |
| `dry-run` | Deterministic fixture, no network/exec | stdout same shape as `analyze` |

`analyze` is **synchronous** — it blocks until the result is ready.
Hosted backends poll internally. **Async threshold (council 2026-06-07):
if a backend's p95 runtime exceeds ~50% of the orchestrator step
timeout (`AIV_AUDIO_TIMEOUT`, default 600 s), the adapter must move to
the v2 async triple instead — do not stretch this contract.**

## Stdin JSON (consumed by `analyze`)

```json
{
  "audio_path": "/abs/path/song.wav",
  "stem": "vocals",
  "language": "en"
}
```

- `audio_path` — mandatory; absolute path to a readable audio file.
  Validated before any exec: must exist, must contain an audio stream.
- `stem` — optional hint (`vocals` | `mix`); adapters that separate
  stems internally (allin1) may ignore it.
- `language` — optional ISO hint for lyrics adapters.
- Unknown top-level keys are logged to stderr and ignored (v2 rule).

## Stdout JSON — `audio-analysis` class

```json
{
  "schema": 1,
  "source": "allin1",
  "bpm": 120.0,
  "beats": [0.52, 1.02, 1.52],
  "downbeats": [0.52, 2.52],
  "sections": [
    {"start": 0.0, "end": 12.5, "label": "intro", "energy": 0.41}
  ]
}
```

- `bpm` — number; `beats` / `downbeats` — ascending seconds.
- `sections[].label` — canonical set `intro | verse | chorus | bridge |
  inst | outro | start | end` plus the probe's `build | drop |
  breakdown`; free-form labels are allowed but consumers only act on
  the canonical set.
- `sections[].energy` — optional 0..1; present keeps the shape a strict
  superset of `probe-audio.sh` output so consumers need one code path.
- `source` — the backing tool/API id; consumers surface it in reports.

## Stdout JSON — `lyrics` class

```json
{
  "schema": 1,
  "source": "whisperx",
  "language": "en",
  "lines": [
    {"start": 1.20, "end": 3.40, "text": "hello world",
     "speaker": "SPEAKER_00"}
  ],
  "words": [
    {"start": 1.20, "end": 1.45, "word": "hello", "speaker": "SPEAKER_00"}
  ]
}
```

- `lines[].speaker` — the **raw diarization label** (`SPEAKER_00`, …),
  or `"?"` when diarization is unavailable or a line mixes speakers.
  The adapter NEVER invents a name. Mapping labels → cast names is the
  `song-to-script` skill's job (operator roster); unmatched stays `"?"`
  per [`media-sync-ground-truth`](../../../rules/media-sync-ground-truth.md).
- `words` — optional; present when the backend aligns word-level.
- Timing is **verbatim transcript output** — consumers must not re-time
  lines. `scripts/ai-video/lib/validate-vocal-map.sh` enforces this
  downstream (every vocal-map entry must match a transcript line).

## `capability` output

```json
{"kind": "audio-analysis", "provides": ["bpm", "beats", "downbeats", "sections"], "backend": "local-cli"}
```

`kind` ∈ `audio-analysis | lyrics`. `backend` ∈ `local-cli | hosted`.

## Configuration — `agents/.ai-video.xml`

Audio adapters reuse the existing provider registry (council Q3 —
the feature boundary is AI video, not audio vs video):

```xml
<provider id="allin1" kind="audio-analysis">
  <lifecycle>experimental</lifecycle>
  <enabled>true</enabled>
  <dry-run>true</dry-run>
</provider>
```

- Local-CLI adapters need no `<api-key>`; hosted ones use the same
  `<api-key>` / `<endpoint>` elements as v2 providers.
- The `<enabled>false</enabled>` kill-switch refuses `analyze` exactly
  like v2 refuses `submit` (exit 6).
- Every provider block carries a `<lifecycle>` tag per
  `provider-lifecycle-discipline`; every adapter carries the matching
  `Lifecycle:` header comment.

## Fallback semantics — `probe-audio.sh` (council Q4, option c)

`probe-audio.sh` (zero-dependency energy/silence segmentation) remains
the floor; the audio-analysis adapter is the upgrade path, **never a
hard requirement**. The orchestrator resolves in this order:

1. **No audio-analysis provider configured** (no block in the XML, or
   adapter script absent) → run `probe-audio.sh`. Normal path, no
   warning beyond the existing probe `method` report line.
2. **Provider configured + healthy** → `analyze` result drives timing;
   the report names the `source`.
3. **Provider configured + transient failure** (network timeout, HTTP
   5xx/429 — exit 75) → retry once, then fall back to `probe-audio.sh`
   with ONE warning line in the report (not per-call log flood).
4. **Provider configured + config failure** (missing key, missing local
   CLI, HTTP 401/403, malformed output — exits 3/6/7) → **hard-fail**
   with an actionable message ("install X / fix key / set
   `<enabled>false</enabled>` to opt out"). A configured adapter that
   silently degrades hides config errors from the operator.

## Exit codes (aligned with v2)

| Code | Meaning |
|---|---|
| 0 | result JSON on stdout |
| 2 | usage error / unknown subcommand (fail-closed dispatch) |
| 3 | required tool / fixture missing |
| 4 | live call refused under `AIV_DRYRUN=true` (hosted backends) |
| 6 | provider disabled or key missing |
| 7 | invalid input (bad `audio_path`, malformed stdin) |
| 10 | trust-boundary violation |
| 75 | transient backend failure (caller may retry / fall back) |

`AIV_DRYRUN=true` (the default) refuses **hosted** `analyze` calls with
exit 4. Local-CLI execution has no spend and MAY run under dry-run
default, but MUST exit 3 with the install hint when the CLI is absent.

## Trust boundary

Identical to v2 — explicit here because council review flagged the gap:

- Any URL returned by a hosted backend is fetched via `aiv_fetch_url`
  (size cap + timeout), never raw curl.
- Any file path emitted in the result JSON is validated via
  `aiv_validate_artifact_path` against the project root.
- Keys never appear in argv; stderr is piped through
  `aiv_redact_stream`.
- Backend-returned text (lyrics) is data, never eval'd or interpolated
  into shell.

## Dry-run fixtures

`scripts/ai-video/lib/fixtures/<adapter-id>/analysis.json` — same
directory convention as v2 (`fixtures/<id>/result.json`). The fixture
is the contract-shaped output for a deterministic reference track;
tests pin its shape. CI never needs ffmpeg, allin1, whisperx, or a key.

## See also

- [`adapter-contract.md`](adapter-contract.md) — v2 render contract
  (lip-sync adapters live there).
- [`probe-audio.sh`](probe-audio.sh) — the zero-dependency fallback.
- [`validate-vocal-map.sh`](validate-vocal-map.sh) — downstream
  ground-truth enforcement for lyric timing.
- [`../../skills/song-to-script/SKILL.md`](../../skills/song-to-script/SKILL.md)
  — the consumer.
