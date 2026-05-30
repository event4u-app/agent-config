---
model_tier: inherit
name: song-to-script
description: "Turn an audio track into a timed `## Scene N` script: song sections → per-scene durations, auto mode adds mood + lip-sync lines. Triggers 'music video', 'from the song', 'cut to the beat'."
personas:
  - hollywood-director
domain: product
workspaces:
  - small-business
packs:
  - ai-video
lifecycle: experimental
trust:
  level: experimental
install:
  default: false
  removable: true
---

# song-to-script

> Turn a song into `<project>/script.md` — a sequence of `## Scene N`
> blocks whose `duration:` values sum to the track length and whose cut
> points land on real section boundaries. Consumed by
> [`/video:from-song`](../../commands/video/from-song.md), then handed
> to [`scene-expander`](../scene-expander/SKILL.md) and
> [`video-director`](../video-director/SKILL.md). Never invents timing —
> every boundary comes from the audio probe, and the probe's `method`
> tells this skill how musical (or not) those boundaries actually are.

## When to use

- A music-video run needs scenes cut to the song (`/video:from-song`).
- An existing script must be **re-timed** to a track after the edit
  drifted from the beat (the named second consumer — re-time without a
  full re-author).

Do NOT use when:

- The operator already supplies a `## Scene N` script with `duration:`
  values — feed it straight to `scene-expander`.
- There is no audio — use the operator brief with `scene-expander`
  directly.

## Inputs

- **Audio probe** — JSON from
  [`scripts/ai-video/lib/probe-audio.sh`](../../../../scripts/ai-video/lib/probe-audio.sh):
  `{duration, method, warning?, sections:[{start,end,energy,label}]}`.
  - `method: silence` — boundaries are real quiet gaps; trust them as cuts.
  - `method: rms` — boundaries are energy-delta inflections; usable but
    coarse.
  - `method: interval` — **the track is structurally flat** (brick-walled
    / sustained); sections are fixed-interval, NOT musical. When `method`
    is `interval` (or `warning` is set), the emitted script header states
    that timing is interval-based and the operator should pass
    `--scene-durations` for musical sync. Never present interval cuts as
    beat-synced.
- **Mode** — `brief` (operator text is the creative source) or `auto`
  (infer mood + action from energy).
- **Brief** (brief mode only) — free text: story, settings, look.
- **Character lock** (optional) — `<project>/character.json` if a human
  subject was locked. **Absent is normal** — abstract / landscape /
  visualiser videos have no locked subject; see Step 2.

## Procedure

### Step 1: Map sections → scenes

One `## Scene N` per probe section. `duration:` = `end - start`
(rounded to 0.5 s). Merge any section shorter than the provider's
`min-duration` into its neighbour; split any section longer than the
provider's `max-duration` into equal sub-scenes so no single clip
exceeds the backend limit (read both from the resolved provider tuning).

### Step 2: Assign mood + action

First decide the **subject mode**:

- **Character mode** — `character.json` exists: every scene's `action:`
  names the locked subject, never a fresh description.
- **Style mode** — no `character.json`: scenes describe setting, palette,
  and motion continuity (the recurring *look*), not a person. This is the
  valid abstract / landscape / visualiser path — do not invent a human
  subject to fill the slot.

Then assign per scene:

- **Brief mode** — distribute the brief's beats across scenes in order;
  energy only modulates pacing (low energy → slow push-in, high energy →
  fast cuts / motion). Do not add story the brief did not state.
- **Auto mode** — derive mood per section from `energy` and `label`:

  | label / energy | default scene intent |
  |---|---|
  | intro / low | establishing wide, slow camera, calm subject/scene |
  | build / rising | approach, tightening framing |
  | drop / peak | dynamic motion, weather/FX, fast push |
  | breakdown / dip | close-up / detail, quiet, single light source |
  | outro / fade | pull-back, resolve, hold |

### Step 3: Lyric / lip-sync lines (auto mode, vocal tracks)

If the probe flags vocal energy in a section and the operator provided
lyrics (or asked to lip-sync), place the matching lines in that scene's
`dialogue:` block so the video adapter can drive mouth motion. No
lyrics → leave `dialogue:` empty; the scene is performance/B-roll, not
lip-sync. **Never fabricate lyrics** — absent text means no dialogue.
Lip-sync requires a character subject; in style mode, `dialogue:` stays
empty.

### Step 4: Emit + reconcile

Write `<project>/script.md`. Report the delta, the section→scene map,
**and the probe `method`** (so the operator sees whether cuts are
silence-derived, energy-derived, or interval-fallback). If the sum cannot
be reconciled (e.g. provider max-duration forces more time than the song
has), **halt and surface the conflict** — do not pad silently.

### Step 5: Validate before handoff

Concrete checks (all must pass before the script is handed to
`scene-expander`):

- **Assert** `Σ(duration) == probe.duration` within ±1.0 s; report the
  exact delta. A larger delta → halt, do not pad.
- **Verify** every scene boundary equals a probe section boundary (or a
  `--scene-durations` value) — no invented cut points.
- **Confirm** no scene `duration:` exceeds the provider `max-duration`
  or falls below `min-duration`.
- **Ensure** every `## Scene N` carries all five keys (`duration` ·
  `mood` · `action` · `camera` · `dialogue`), and that `dialogue:` is
  empty in style mode.

## Output format

```markdown
# <project> — derived from <song-file> (<mode> mode · cuts: <method>)

## Scene 1
duration: 6.0
mood: establishing, cold, pre-storm
action: <subject from character.json, OR style description in style mode>
camera: slow push-in
dialogue:

## Scene 2
duration: 4.5
mood: build, rising tension
action: close on <subject / detail>, wind picking up
camera: handheld tighten
dialogue:
  - "<subject>: \"<lyric line for this section, if any>\""
```

`scene-expander` consumes this verbatim — keep the keys
(`duration` · `mood` · `action` · `camera` · `dialogue`) exact.

## Gotcha

- **`method: interval` is the brick-walled-master signal, not a bug.**
  A compressed modern master has near-constant RMS and no silence, so the
  probe degrades to fixed intervals. That is the honest floor — surface
  it and point the operator at `--scene-durations`; never dress interval
  cuts up as beat-synced.
- **A vocal section without supplied lyrics is B-roll, not lip-sync.**
  Detected vocal energy alone does not authorise `dialogue:` — only
  operator-supplied lyrics do.
- **Style mode is the default for a no-character run**, not an error
  path. Landscape / abstract / visualiser videos never get a fabricated
  human subject.

## Do NOT

- **Do NOT invent timing.** Every cut maps to a probe boundary or a
  `--scene-durations` value — never to taste.
- **Do NOT present `interval`-fallback cuts as beat-synced.** Always
  surface the probe `method`.
- **Do NOT emit a clip outside the provider's min/max duration** —
  split/merge in Step 1 instead.
- **Do NOT fabricate lyrics or story** beyond the brief / detected vocals.
- **Do NOT invent a human subject** in style mode; defer identity to
  `character.json` only when a lock exists.
- **Do NOT pad a unreconcilable timing sum** — halt and surface it.

## See also

- [`/video:from-song`](../../commands/video/from-song.md) — the command
  that drives this skill
- [`scene-expander`](../scene-expander/SKILL.md) — consumes the emitted
  script
- [`character-consistency`](../character-consistency/SKILL.md) — supplies
  the locked subject referenced in `action:` (character mode only)
