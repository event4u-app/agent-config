---
model_tier: inherit
name: video-from-song
pack: ai-video
tier: 2
visibility: internal
cluster: video
sub: from-song
description: Music-video from a song + reference images — accept or derive a timed scene script, optional character-lock, render, stitch, mux song as master track. Preview default; --mode commit gates the spend.
personas: [hollywood-director, ai-video-technical-director]
skills: [song-to-script, scene-expander, video-director, character-consistency, motion-choreographer, prompt-validator]
suggestion:
  eligible: true
  trigger_description: "make a music video from a song, turn a track into a video, lip-sync clip from images and audio, AI music video"
  trigger_context: "user supplies an audio file plus reference images and wants a final MP4 cut to the song"
workspaces:
  - agent-config-maintainer
packs:
  - meta
lifecycle: experimental
trust:
  level: experimental
install:
  default: false
  removable: true
---

# /video:from-song

`/video:from-song <images-dir> <song-file> [--mode preview|commit] [--brief "<description>"] [--auto-script] [--scene-durations <list>] [--character|--no-character] [--auto-pick] [--keep-native-audio] [--max-duration <min>] [--max-scenes <n>] [--max-spend-usd <usd>] [--image-provider <id>] [--video-provider <id>]`

Turns a **song** plus a **folder of reference images** into a finished
music-video. The scene script is either supplied by the operator
(`--brief`) or derived from the audio itself (`--auto-script`); if
neither flag is present the command asks. After the script exists this
command reuses the same render path as
[`/video:from-script`](from-script.md) and ends by muxing the song over
the cut as the **master audio track**.

Provider flags override the `<default-image-provider>` /
`<default-video-provider>` from
[`agents/.ai-video.xml`](../../../agents/templates/.ai-video.xml.example);
absent flags fall back to the XML defaults.

**Requires `pack-ai-video`.** The declared skills
(`song-to-script`, `scene-expander`, `video-director`,
`character-consistency`, `motion-choreographer`, `prompt-validator`)
ship in that pack; on a
global-only install Step 1's `validate-deps.sh` fails fast with the
missing-id list instead of an opaque mid-run error — install the pack
and re-run.

**Block-on-ambiguity:** a missing/empty images directory, an unreadable
audio file, contradictory mode flags (`--brief` *and* `--auto-script`),
contradictory character flags (`--character` *and* `--no-character`), or
a contradictory provider flag halts the run with a precise message — no
silent best-guess.

## Inputs

| Input | Required | Meaning |
|---|---|---|
| `<images-dir>` | yes | Folder of reference stills (`.png` / `.jpg`). When they contain a consistent human subject the on-screen identity is locked from them; otherwise the run is style-only (Step 6). |
| `<song-file>` | yes | Audio track (`.mp3` / `.wav` / `.m4a`) — or an `https://` song link (Suno / Udio / YouTube / any yt-dlp-supported page): the link is ingested to a local file first via `scripts/ai-video/lib/ingest-song.sh <url> <project>` (operator-installed `yt-dlp` + `ffmpeg`; rights note surfaced; size-capped; never a silent overwrite) and the pipeline continues on `<project>/song.m4a`. Defines total duration and, in `--auto-script` mode, the scene structure. |
| `--brief "<text>"` | one of brief/auto | Operator-written description of the video (mood, story, settings). |
| `--auto-script` | one of brief/auto | Derive the script from the song via the `song-to-script` skill. |
| `--scene-durations <list>` | no | Manual cut points (e.g. `0:00-0:15,0:15-0:30,…`). Overrides probe timing — the honest path when the track is flat (probe `method: interval`). |
| `--character` / `--no-character` | no | Force character-lock on/off. Default: auto-detect a subject in `<images-dir>`. |
| `--keep-native-audio` | no | Keep provider-generated audio instead of dropping it for the song (Step 8). |

## Steps

### 1. Validate dependencies

```bash
scripts/ai-video/lib/validate-deps.sh .agent-src.uncondensed/commands/video/from-song.md
```

Fails fast with the missing-id list if any declared persona / skill is
absent from `dist/agent-src/personas/` or `dist/agent-src/skills/`. No network
call has happened yet.

Then confirm the **runtime helper scripts** exist and are executable —
`scripts/ai-video/lib/probe-audio.sh`, `scripts/ai-video/lib/load-config.sh`,
`scripts/ai-video/stitch.sh` — so a missing script fails here (with the
path), not mid-run at Step 2/9.

**Non-interactive contexts.** When stdin is not a TTY (CI, cron, headless
harness) the command cannot prompt: it requires `--brief` or
`--auto-script`, an explicit `--character`/`--no-character`, and
`--auto-pick`, and refuses live calls outright. Missing any → fail fast
with usage, never a deadlocked prompt.

### 2. Validate inputs + media-governance input gate

- `<images-dir>` exists and holds ≥1 `.png`/`.jpg`. Empty or missing →
  halt, list what was found.
- `<song-file>` given as an `https://` link → ingest it first:
  `scripts/ai-video/lib/ingest-song.sh <url> <project>` (exit 3 names
  the missing tool; exit 75 is a retryable download failure). The
  ingested local file replaces the URL for every later step — ground
  truth stays the real bytes, and the media-governance gate below runs
  on the ingested file (a platform link is *more* likely to be a
  recognisable commercial song — check `voice-cloning` deliberately).
- `<song-file>` exists and is a readable audio container (`ffprobe`
  returns an audio stream). Derive its length + structure now,
  **adapter-first with the probe as the floor** (fallback semantics per
  [`audio-adapter-contract.md § Fallback`](../../../scripts/ai-video/lib/audio-adapter-contract.md)):
  1. An `audio-analysis` provider is configured in `agents/.ai-video.xml`
     **and** `scripts/ai-video/audio-adapters/<id>.sh` exists → run
     ```bash
     echo '{"audio_path":"<song-file>"}' | scripts/ai-video/audio-adapters/<id>.sh analyze
     ```
     Real `{bpm, beats, downbeats, sections:[{start,end,label}]}` drives
     the cut; the report names the `source`. On a **transient** failure
     (exit 75) retry once, then fall back to the probe with ONE warning
     line. On a **config** failure (exit 3/6/7 — CLI missing, disabled,
     bad key) **halt with the actionable message** — a configured
     adapter never silently degrades.
  2. No audio-analysis provider configured → run the zero-dependency
     probe (the normal path, not a degradation):
     ```bash
     scripts/ai-video/lib/probe-audio.sh <song-file>
     ```
     Emits `{duration, method, warning?, sections:[…]}` (deterministic, no
     network). A `method: interval` result (flat / brick-walled track) is
     surfaced to the operator with the suggestion to pass
     `--scene-durations` for musical cuts — never presented as beat-synced.

  Either way `duration` becomes the target length of the final cut, and
  the report states which source produced the boundaries (`allin1` |
  probe `method`).
- **Media-governance input gate (mandatory).** Before any render,
  consult the project-local media policies per
  [`media-governance-routing`](../../rules/media-governance-routing.md):
  - reference stills or brief depict a **real person's likeness** →
    [`likeness`](../../../agents/settings/policies/media/likeness.md);
  - a **recognised public figure** →
    [`public-figures`](../../../agents/settings/policies/media/public-figures.md);
  - the track is a **recognisable commercial song / a real artist's
    voice** or the brief asks to clone one →
    [`voice-cloning`](../../../agents/settings/policies/media/voice-cloning.md).
  On a match: **refuse-and-surface** (one question per turn) — do not
  best-guess past a likeness / rights concern.

### 3. Cost + duration guard (theory of failure)

Refuse, with a precise message, **before** loading providers:

- a song longer than the configured cap (default 8 min) — a 45-minute
  track would launch a runaway paid render;
- a derived/briefed scene count above the cap (default 40 scenes).

The operator raises a cap explicitly (`--max-duration` / `--max-scenes`)
if they really mean it; the guard never silently proceeds.

### 4. Load config + resolve providers

Source `scripts/ai-video/lib/load-config.sh`. Resolve image / video
provider: command flag → `agents/.ai-video.xml` default → fail with the
available-providers list. A **malformed XML** or a default/flag naming a
provider with no `scripts/ai-video/adapters/<id>.sh` → fail fast here
with `provider '<id>' not found in adapters/` and the available list;
never a cryptic shell error mid-run. Surface the resolved provider's **lifecycle
tier** per
[`provider-lifecycle-discipline`](../../rules/provider-lifecycle-discipline.md);
all shipped adapters are `experimental` today, so the refuse-and-surface
path fires before any live call. For a music-video the **song is the
master track**, so a video provider with `audio-native=false` (e.g.
`kling`) is fine; native-audio providers (`gemini-veo`, `sora`) still
work — their audio is dropped at mux time in Step 8 unless
`--keep-native-audio` or a lip-sync scene needs it.

### 5. Select script mode (block on ambiguity)

- `--brief` and `--auto-script` both present → halt: "Pick one source
  for the script."
- Exactly one present → use it.
- **Neither present → ask, then stop and wait:**

  ```
  > How should I build the scene script?
  >
  > 1. From a description — I'll write the scenes to your brief
  > 2. From the song — I'll derive scenes + timing from the audio
  ```

### 6. Build the timed scene script

Run the [`song-to-script`](../../skills/song-to-script/SKILL.md) skill
with the Step 2 probe result:

- **Brief mode** — the operator brief is the creative source; the audio
  sections drive only the **cut timing**.
- **Auto mode** — the skill infers mood/energy per section and writes
  both action and timing; vocal sections populate `dialogue:` for
  lip-sync **from the transcribed vocal map**, not from the brief.
- `--scene-durations` (if passed) overrides probe timing verbatim.

Output: `<project>/script.md` summing to the song length (reconciled in
Step 8). Present the script, the section→scene map, **and the probe
`method`**, then continue.

#### 6a. Vocal map + sign-off gate (lip-sync / singer-assigned runs)

```
TIMING AND SINGER COME FROM THE TRANSCRIBED AUDIO, NEVER A SKELETON OR
A GUESSED STRETCH. NO PAID RENDER UNTIL THE OPERATOR SIGNS OFF THE MAP.
```

Governed by [`media-sync-ground-truth`](../../rules/media-sync-ground-truth.md).
When the track has vocals **and** the run assigns singers / lip-sync:

1. `song-to-script` emits `<project>/vocal-map.json`
   (`[{start, end, text, singer}]`) built by **transcribing the real
   audio** — the configured `lyrics` adapter
   (`scripts/ai-video/audio-adapters/whisperx.sh`, word-level timing +
   diarization labels) or OpenAI `/v1/audio/transcriptions` / whisper.
   The probe gives duration; the transcript gives lyric timing +
   structure. Never derive lyric timing from the brief or a stretched
   story skeleton.
2. **Validator gate (mechanical, before the human gate).** Run
   ```bash
   scripts/ai-video/lib/validate-vocal-map.sh <project>/vocal-map.json \
     <project>/transcript.json --roster "<cast>"
   ```
   — it mechanically rejects re-timed lines, lyrics absent from the
   transcript, and missing singers (exit 7 with the offending line). A
   skeleton-derived map cannot reach the operator, let alone a render.
3. **Each vocal line maps to its OWN singer.** Never put one character's
   line on another character's scene. Ambiguous singer → mark `?` and ask;
   a `?` line never gets a lip-sync scene.
4. **Sign-off gate (mandatory).** The validated map feeds the unified
   storyboard/cost preview gate in Step 8 — `timestamp → line → singer →
   assigned shot/character` is part of that single preview; the operator
   approves map + prompts + cost **once, before any render**. A wrong
   map wastes the whole batch.
5. Pure-instrumental / style-mode runs skip 6a (no singers, no lip-sync).

### 7. Character lock — optional, auto-detected

Detect whether `<images-dir>` contains a consistent **human subject**.
**Consistent** = the same recognisable face recurs across the **majority**
of stills. The branch:

- **Consistent subject (or `--character`)** → run `character-consistency`
  once, seeding it with `<images-dir>`. Writes `<project>/character.json`
  (subject, palette, wardrobe, prop, seed) reused verbatim downstream;
  the stills are passed as `ref_images` so the locked identity matches.
- **No face at all (or `--no-character`)** → **skip the lock**, tell the
  operator, and run **style-only continuity**: the reference stills set
  palette / setting / look, and `song-to-script` runs in style mode
  (abstract / landscape / visualiser videos are first-class — a face is
  never required). Zero-face input is **not** an error.
- **Ambiguous** (faces in only some stills, or several *distinct* faces
  with no clear lead) → **block and ask** which subject to lock or whether
  to go style-only. Never silently pick a mode on a coin-flip; the
  `--character`/`--no-character` flags pre-answer this for non-interactive
  runs.

### 8. Render scenes (reuse from-script path) — ONE batch cost gate

For each scene in `<project>/script.md`, run Steps 3–7 of
[`/video:from-script`](from-script.md) verbatim: `scene-expander` →
blueprint → `video-director` eight-block image prompt → operator pick →
`motion-choreographer` → video adapter.

**Lip-sync sub-step (scenes with a `dialogue:` line + a singer).** A scene
whose approved vocal-map entry assigns a singer routes to the
audio-driven path instead of plain motion. Preferred path: render the
scene normally, cut that line's WAV from the song at the map's
`[start,end]`, host clip + WAV, and run the **lip-sync post-process
adapter** (`scripts/ai-video/adapters/syncso.sh`, contract v2
`kind="lipsync"`; offline alternative:
`scripts/ai-video/adapters/musetalk.sh`, MIT, local files — no hosting
step, same sparse budget); fallback where the video provider has a native
`speak` capability (e.g. Higgsfield `/v1/speak/higgsfield`): the
**correct singer's** still + that WAV. Either way the right character
lip-syncs their own line, and the clip lands at its real song position
so the muxed master track stays aligned to the lips. Non-vocal /
non-assigned scenes use the standard motion (dop) path. Never lip-sync
a singer onto a line the vocal map attributes to someone else.

**Sparse-lip-sync budget (enforced, not advisory).** Read
`lipsync_budget` from
`scripts/ai-video/lib/model-capabilities/syncso.json` and enforce it
**before** any lip-sync submit:

- more assigned lip-sync scenes than `max_segments_per_song` → halt the
  plan with the count and the budget; the operator either drops
  segments or raises the budget *in the manifest* (a visible diff) —
  never an inline override;
- a line longer than `max_segment_seconds` → halt, name the line;
- `frontal_close_up_only: true` → a lip-sync scene whose `camera:` is
  not a frontal close-up is rejected by `prompt-validator` (Step 4
  physics class) — re-frame the shot or drop the lip-sync;
- `cost_gate: true` → lip-sync segments appear as their own line items
  in the unified preview's cost table.

Everything outside the budget stays cinematic motion (DoP) — model
lip-sync on singing degrades fast off frontal close-ups; sparseness is
the quality strategy, not a cost hack.

**Prompt-validator gate (mechanical, before anything is shown).** Once
every scene's prompt exists, run the
[`prompt-validator`](../../skills/prompt-validator/SKILL.md) skill over
the **whole batch** — style / character / physics / lip-sync-ownership
contradictions block with a specific error (scene + conflicting values).
A blocked batch never reaches the preview below; fix the prompts and
re-validate. Re-run it after any operator hand-edit to a scene.

**ONE unified storyboard/cost preview (not per-step, not two gates).**
The former separate vocal-map sign-off and batch cost confirmation are
**one preview**, shown once per run:

| Preview section | Content |
|---|---|
| Shot list | scene № · duration · section label · per-shot prompt summary (style/subject/action/camera) |
| Vocal map | `timestamp → line → singer → assigned shot` for every lip-sync line (validated per Step 6a) |
| Providers | image+video adapter, models, lifecycle tiers |
| Cost | per-scene `cost_estimate` + total (modeled, from dry-run) |

`--mode preview` (default) stops here: the whole run stays strictly
offline (`AIV_DRYRUN=true`, fixture renders, modeled costs labeled as
modeled — never a pricing API call); the resolved mode is echoed as the
first line of the report, and a defaulted run says `mode: preview
(default — no spend; pass --mode commit to render live)`. `--mode
commit` is the spend path: the same single preview is the confirmation
prompt — the operator approves shots + vocal map + cost with **one**
explicit confirmation (a literal yes) in this turn (mirrors
[`non-destructive-by-default`](../../rules/non-destructive-by-default.md));
only after that confirmation does the run set `AIV_DRYRUN=false`. There
is no second ask — approving the preview IS the vocal-map sign-off and
the cost confirmation.
The total comes from each scene's dry-run `cost_estimate` (adapter
contract v2); a scene the adapter cannot price shows as `unknown` and is
never silently counted as `0`. **`--max-spend-usd` kill-switch:** when
set, if the summed estimate exceeds the cap the batch is **hard-blocked
before the first live call** — operator confirmation does not override
the cap; raise `--max-spend-usd` explicitly to proceed. If any scene is
`unknown`, surface that the total is a lower bound and the cap cannot be
fully guaranteed.
Once confirmed, the run proceeds through every scene + stitch + mux
without re-prompting **for cost**. The one remaining interactive surface
is `from-script`'s per-scene **operator-pick** (best-of-N still
selection) — a creative choice, not a spend gate; `--auto-pick` collapses
it to best-of-1 so the batch is fully unattended (required in
non-interactive contexts).

**Mid-batch failure + abort.** A per-scene adapter failure (rate-limit
`429`, provider content-policy refusal, network drop) **halts the batch**,
writes the completed-scene state to `<project>/`, and surfaces which
scene failed and why — it does not skip ahead or burn the rest of the
budget. `SIGINT` (Ctrl-C) writes state and exits clean. Re-running the
command resumes from the completed scenes (the "one project per
invocation" resume path), so a failed or aborted run is recoverable
without re-paying for finished scenes.

**Resume mechanics (ADR-059 — filesystem-as-state, no checkpoint file).**
Before rendering, run the mechanical scan:

```bash
scripts/ai-video/lib/resume-scan.sh scan <project> --plan <project>/plan.json
```

where `plan.json` holds each scene's current `input_sha256`
(`resume-scan.sh hash < scenes/<id>/prompt.json` — same canonicalization
the render path stamps). `green` scenes are skipped verbatim; `stale`
(prompt edited, provider/model switched, hash tampered) and `missing`
scenes re-render; `failed` scenes surface their `error.json` reason.
After each live scene completes, write `scenes/<id>/cost.json`
(`{charged_usd, adapter, model}`, atomic `tmp`+`mv`) — the scan sums it
as `spent_usd` and the batch loop re-checks `--max-spend-usd` against it
before **every** live submit, not only at the upfront gate. Per-scene
kill-switch (ADR-059 §6): max one surfaced auto-retry on
`retryable: true`, content-policy refusals always halt. Rollback is
deletion (`rm -rf scenes/<id>/` → re-render); `--clean`
(`resume-scan.sh clean <project>`) removes failed-scene residue only —
green artifacts are never auto-deleted.

### 9. Stitch + master-audio mux + duration reconciliation

1. Build `<project>/manifest.json` with every scene as **video-only**
   (`audio_embedded: false`) so the concat is silent — unless
   `--keep-native-audio`, or a scene is flagged `character: talking`
   (lip-sync), where dropping audio would desync mouth motion: keep that
   scene's native audio and surface the mixed-audio decision rather than
   silently dubbing.
2. Concatenate:
   ```bash
   scripts/ai-video/stitch.sh <project>/manifest.json <project>/cut.mp4
   ```
3. **Reconcile duration explicitly** — compare the silent cut length to
   the song:
   - cut == song (±1.0 s) → mux straight through;
   - cut **shorter** → offer `--loop-last` (hold the final scene) or
     `--retime` (re-derive Step 6 timing); default = trim audio to the
     cut with a short audio fade-out on the tail;
   - cut **longer** → default = hard-trim video to the song length.

   Never pad silently — **and never trim silently either**: whichever
   default fires, report it concretely ("trimmed scene 12 from 18.0 s to
   3.4 s to match the 3:45 song" / "faded the song tail by 0.6 s"), so the
   operator sees exactly what the reconciliation did. Then mux the song as the master track:
   ```bash
   ffmpeg -loglevel error -y -i <project>/cut.mp4 -i <song-file> \
     -map 0:v:0 -map 1:a:0 -c:v copy -c:a aac -shortest <project>/final.mp4
   ```
4. **Mandatory AI-generation disclosure (non-removable).** Embed the
   disclosure metadata into `final.mp4` per
   [`disclosure`](../../../agents/settings/policies/media/disclosure.md)
   and, where the container supports it, a provenance tag per
   [`transparency`](../../../agents/settings/policies/media/transparency.md).
   The run **cannot complete** without the disclosure — it is not a flag.
   Mechanically:

   ```bash
   jq -n --arg p "<project>/final.mp4" --arg prov "<video-provider>" \
     --arg m "<model>" --arg h "<sha256-of-REDACTED-prompt>" \
     '{artifact_path:$p, provider:$prov, model:$m, prompt_sha256:$h}' \
     | scripts/ai-video/lib/embed-provenance.sh embed
   ```

   writes the always-on sidecar `final.mp4.provenance.json`, tags the
   container metadata (ffmpeg stream copy), and embeds a real C2PA
   manifest when the operator has `c2patool` + signing configured —
   sidecar-only otherwise (reported, never silent). The report cites
   the emitted `provenance_path` + `c2pa` surface.

### 10. Report

First line: the resolved **mode** (`mode: commit` or `mode: preview
(default — no spend; pass --mode commit to render live)`). Then:
project slug, final MP4 path, song length vs. cut length, probe
`method`, scenes rendered, scenes skipped, script mode (`brief` | `auto`),
subject mode (`character` | `style`), provider + lifecycle tier,
**media-governance gate result** (pass / refused-and-surfaced — the audit
record), **reconciliation action** taken (Step 9.3), disclosure
confirmed, actual cost (commit) or summed modeled `cost_estimate`
labeled *modeled* (preview). No commit. No push.

## Rules

- **No commit, no push, no PR.** Pipeline produces artefacts; the
  operator chooses what to ship.
- **Preview is the default.** `--mode commit` is the only spend path;
  one batch confirmation gates all live calls — never a per-step
  interrogation, never a silent live run. Preview is strictly offline
  (`AIV_DRYRUN=true`); its costs are modeled, never quotes. The report
  always opens with the resolved mode line.
- **Media governance is a hard gate.** Input likeness / public-figure /
  voice checks block before render; the output MP4 always carries a
  non-removable AI-generation disclosure.
- **The song is the master audio track.** Provider-native audio is
  dropped at mux unless `--keep-native-audio` or a lip-sync scene needs
  it (surface the conflict, never silently dub).
- **Cost + duration are guarded.** Over-cap songs / scene counts are
  refused before any provider loads.
- **Character lock is optional.** A no-face image folder produces a
  style-only video; never abort for a missing subject.
- **Block on ambiguity** — never silently best-guess the script source,
  scene timing, provider, or character mode.
- **Honest cut framing.** A flat track's `interval` cuts are never
  presented as beat-synced; point the operator at `--scene-durations`.
- **One project per invocation.** Re-running on the same project resumes
  from existing artefacts (skips completed scenes); a failed or aborted
  batch is recoverable this way without re-paying for finished scenes.
- **Kill-switch.** Ships `lifecycle: experimental` · `install.default:
  false`. Disable = remove the command + `song-to-script` skill (then
  regenerate the projected tool trees); the `/video` orchestrator
  degrades gracefully on an absent sub-command.

## Policies

- [`likeness`](../../../agents/settings/policies/media/likeness.md) ·
  [`public-figures`](../../../agents/settings/policies/media/public-figures.md) ·
  [`voice-cloning`](../../../agents/settings/policies/media/voice-cloning.md) —
  input gate (Step 2).
- [`disclosure`](../../../agents/settings/policies/media/disclosure.md) ·
  [`transparency`](../../../agents/settings/policies/media/transparency.md) —
  mandatory output disclosure (Step 9.4).

## See also

- [`/video:from-script`](from-script.md) — same render path from a
  hand-written script
- [`/video:scene`](scene.md) — single-scene iteration
- [`/video:stitch`](stitch.md) — re-stitch after operator edits
- [`song-to-script`](../../skills/song-to-script/SKILL.md) — audio →
  timed scene script
- [`scripts/ai-video/lib/adapter-contract.md`](../../../scripts/ai-video/lib/adapter-contract.md)
