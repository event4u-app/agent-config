---
type: "auto"
tier: "2a"
description: "Audio-synced video (lip-sync, beat-cuts, music video) — derive timing + singer from the transcribed real audio, never a planning doc; sign off the vocal map before any paid render"
triggers:
  - keyword: "lip-sync"
  - keyword: "lip sync"
  - keyword: "lipsync"
  - keyword: "music video"
  - keyword: "beat-cut"
  - keyword: "/video:from-song"
  - keyword: "vocal map"
  - phrase: "cut to the beat"
  - phrase: "sing the"
  - phrase: "mit den lippen"
  - phrase: "lippen passend"
---

# Media Sync — Ground Truth Is the Audio

## The Iron Law

```
NEVER LIP-SYNC OR CUT A MUSIC VIDEO OFF A PLANNING DOC.
TRANSCRIBE THE REAL AUDIO FIRST. TIMING AND SINGER COME FROM THE
TRANSCRIPT, NEVER FROM A DREHBUCH SKELETON OR A GUESSED TIME-STRETCH.
WRONG-SINGER-ON-WRONG-LINE IS A RENDER-MONEY-BURNING FAILURE.
MAP → SIGN-OFF → RENDER. NO BLIND BATCHES.
```

When generating audio-synced video (lip-sync, beat-aligned cuts, music
videos), the source of truth for **timing** and **who-sings-what** is the
**actual audio artifact** — transcribed to timestamped lines with a
singer per segment. A creative skeleton (story / Drehbuch) encodes
*intent*, not the *delivered* audio; a guessed stretch factor makes it
worse. Lip-sync amplifies every mismatch — the wrong mouth on the wrong
words is instantly, glaringly wrong, and the render already cost money.

## What this requires

1. **Transcribe the real audio** → timestamped lines (OpenAI
   `/v1/audio/transcriptions` or whisper). The probe gives duration; the
   transcript gives structure. Build `<project>/vocal-map.json`:
   `[{start, end, text, singer}]`.
2. **Label singers onto the transcribed timeline**, never the reverse. A
   who-sings doc only *labels* lines; it never *defines* the timeline.
3. **Align cuts to real lyrical/musical phrases** — not arbitrary
   fixed-length windows.
4. **Each vocal line lip-syncs to its OWN singer.** Never cross-assign one
   character's mouth onto another's part.
5. **Sign-off gate** — surface the vocal map (timestamp → line → singer →
   shot) for explicit operator approval **before** any paid render.
6. **Lip-sync sparingly** — only where a frontal close-up of the correct
   singer supports it; model lip-sync on singing is imperfect, so use
   cinematic motion (dop) for the rest.

## Failure modes

- Using a stretched `story.md` as the singer/timing source → one character
  ends up mouthing another's lines (the canonical odins-beard failure).
- Chunking the song into fixed 5s windows that land off-phrase → jarring
  cuts + weird mouth motion.
- Firing a multi-clip render batch before the vocal map is approved →
  budget burned on output that must be thrown away.
- Trusting a guessed time-stretch factor to "match" the song length.

## See also

- [`/video:from-song`](../commands/video/from-song.md) — vocal-map + sign-off gate (Step 6) and lip-sync sub-step (Step 8).
- [`song-to-script`](../skills/song-to-script/SKILL.md) — builds the transcribed vocal map.
- [`media-governance-routing`](media-governance-routing.md) — sibling tier-2a media rule (likeness / disclosure).
- [`non-destructive-by-default`](non-destructive-by-default.md) — the paid-render confirmation floor the sign-off gate builds on.
