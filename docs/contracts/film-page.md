---
stability: experimental
---

# Film page contract

A **film page** is an HTML page whose every visible state is a pure function of
time. `agent-config ui:render <page> --profile film` (implemented in
`src/cli/commands/uiRenderFilm.ts`) seeks it frame by frame, captures, proves,
checks and encodes it. The skill that authors such pages is
[`code-film`](../../src/skills/code-film/SKILL.md); the motion values it uses
live in its `references/film-motion.md`.

## The page

| Member | Required | Meaning |
|---|---|---|
| `window.__seek(t)` | one seek form | Sets **all** visible state for time `t` (seconds). May return a promise; the witness awaits it. |
| `window.render(t)` | — or this | Same meaning, for pages written against that name. |
| `window.__timelines` | — or this | An object of paused timelines, each with `seek(t)`, `totalTime(t)` or `time(t)` — the registry a timeline framework exposes. Every entry is paused and set to `t`; one unseekable entry and the form is not claimed. |
| Web Animations / SMIL / `<video>` | — or these | Held at `t` by pausing every animation and setting its current time. |
| `<video data-start="s">` | in the last two forms | Embedded footage is paused and set to `t − data-start` (clamped inside the clip); the frame is captured only after `seeked`. Encode footage all-intra (`-g 1`) so every seek lands on a keyframe. A `__seek`/`render` page owns its footage. |
| `window.__videoMeta` | recommended | `{ width, height, duration, fps }`, all positive numbers. Without it the run needs `--duration` and `--fps` (and `--width`/`--height`, default 1280×720). |

Forms are recognised in the order above, by shape, never by a renderer's name.
A page exposing none of them is `unassessed` — no frames are captured.

Rules, each of which the witness can catch:

- **No wall clock.** `Date.now`, `performance.now` and `requestAnimationFrame`
  loops never decide state. Caught by the reverse-order capture.
- **Seeded randomness only.** `Math.random` makes the two captures differ; the
  manifest names the frame.
- **No live CSS animation or transition** driving state in a seek-form page.
- **Local assets.** Scripts run with the network off: an offline browser
  context, and every request that is not a `file:` URL inside the project roots
  (or `data:`, `blob:`, `about:`) is aborted and listed in `network.blocked`.

## The run

| Flag | Effect |
|---|---|
| `--profile film` | Selects this witness. A URL target is refused: the network is off by design. |
| `--duration`, `--fps`, `--width`, `--height` | Declared format when the page sets no `__videoMeta`. |
| `--out <file.mp4>` | Encode the frames with ffmpeg (H.264, yuv420p) and check the file against the declared format. |
| `--audio <file>` | Mux the track into the encode and measure it with `src/scripts/media/lib/audio-qa.sh`. |
| `--hold <s>` | Longest unchanged stretch that is not dead time (default 3). |
| `--tiles <n>` | Frames in the contact sheet (default 12). |

Exit codes: `0` clean · `2` findings · `1` not assessed or internal error · `3`
no browser driver installed.

## The manifest

Written to `agents/runtime/state/render/<slug>/film-manifest.json`, next to the
captured `frames/` and `contact.png`.

| Field | Meaning |
|---|---|
| `form` | `seek`, `render`, `timelines`, `waapi` or `none`. |
| `meta` | The declared format and whether it came from the `page` or the `flags`. |
| `frames[]` | `{ index, t, sha256 }` per frame, from the forward capture. |
| `distinct_frames` | Count of distinct digests. |
| `determinism` | `{ deterministic, first_diverging_frame, scope: "this machine" }` — the second capture runs in reverse order on a fresh page. |
| `dead_time[]` | `{ from_s, to_s }` stretches of identical frames longer than the hold. |
| `network.blocked[]` | Every refused request. |
| `flash` | `{ max_flashes_per_second, max_red_flashes_per_second, window_start_s, limit: 3, method }`. More than three in any one-second window is a finding; no option lowers the limit. |
| `format` | Width, height, fps and duration read back from the encoded file with `ffprobe`. |
| `contact_sheet` | Path of the tiled preview. |
| `audio_qa` | The `audio-qa.sh` reading: integrated LUFS, true peak, loudness range, silence spans, mono-fold loss. |
| `video_qa` | The `video-qa.sh` reading of the encoded file: cuts, camera motion, luma jumps without a cut, freezes, blur/block; a probed filter that is missing reads `skipped: <filter> unavailable`. Recorded as data, never as a finding; `checks.video_qa` says whether it ran. |
| `encode` | `{ path, sha256 }` of the encoded file. |
| `checks` | Per check, `ran` or `skipped: <reason>`. A skipped check is never a pass. |
| `findings[]` | `{ check, detail }` — determinism, dead-time, flash, red-flash, format, seek, network, encode. |
| `verification` | `verified` — every applicable check ran and the encode's digest is the file on disk · `static-only` — frames captured, an ffmpeg-dependent check did not run · `unassessed` — nothing was seen. |
| `goal` | Always `unassessed`: whether the film is good has no witness here. |

## Limits, stated

- The flash floor reads the **full-frame mean** luminance. A flash confined to
  part of the frame is diluted and can pass; the review step still owns it.
- Determinism is proven per machine. Fonts and GPUs differ between machines.
- WebRTC is not intercepted by request routing; the offline context is the only
  barrier for it.
