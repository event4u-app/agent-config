---
complexity: structural
status: draft
tree_pin: 03581ff791
execution:
  mode: phase-checkpoints
review_by: 2027-01-15
entry_condition:
  what: "road-to-a-film-built-from-time is archived (its film manifest and audio floor exist) and a WIP slot among the five active roadmaps is free"
  when: "when the next active roadmap completes"
  who: owner
estate_offset_exempt: "Parked follow-on of round inbox-2026-11-e; no owner. Owner search at 03581ff791 (grep -rIl -i for 'cue sheet', 'cue-sheet', 'openverse', 'sound design', 'loudnorm' over agents/roadmaps/*.md, later, stubs) returned nothing."
relates:
  - slug: road-to-a-film-built-from-time
    relation: depends
    note: "Uses its audio-qa floor (4.1) and film manifest."
---
# Road to a sound that lands on its frame

> **Source:** `agents/tmp.old/inbox-2026-11-e/` (topic t3, supplied plan v3).
> **Arrivals:** 1 — `inbox-2026-11-e` (2026-11-02).

## Goal

Every video the package builds leaves with a cue sheet derived from what it
already knows about its own timeline, a sound per cue from a declared source
ladder or a reported silence, a measured mix, a credits sidecar for every
non-generated sound, and a listen list — because the agent cannot hear.
Nothing ever overwrites the master track or the song.

Parked because it depends on the audio floor of `road-to-a-film-built-from-time`
and on two external adapters (an open audio library, a CPU sound synthesiser)
whose terms need a live check.

## Phase 1 — Stop dropping intent silently

- [ ] **1.1** Under `audio: none`, the encoder emits `AUDIO DOWNGRADE` for every ambient layer and SYNC CUE no later stage fills (`motion-choreographer/SKILL.md:131-139`).
- [ ] **1.2** `stitch.sh` and the from-song master mux append `audio-qa` JSON to the run report; handoff mode records `audio: dropped`. The song stays untouched.
- [ ] **1.3** Opt-in `--loudness <preset>` two-pass linear `loudnorm` on the final mix only; presets in one table (`youtube`, `social` labelled observed practice, `broadcast`).

## Phase 2 — The cue sheet

- [ ] **2.1** Schema `cue-sheet.v1`: `{t, kind, role, origin, confidence, …}`, `origin ∈ plan|timeline|beat|picture|operator`; unresolved times are listed, never guessed.
- [ ] **2.2** Producers in priority order: plan (SYNC CUES, manifest durations) → timeline readers → beat → picture (confidence ≤ 0.5).
- [ ] **2.3** Beat grid checked against the low band before it becomes cut candidates; a grid landing on nothing is `usable: false`.
- [ ] **2.4** Density defaults in one table marked *starting default*.

## Phase 3 — Source ladder

- [ ] **3.1** Audio contract v2: classes `sfx-source` and `sfx-synth`, offline deterministic `dry-run`.
- [ ] **3.2** Adapters: operator library, an open CC library (anonymous, throttle-aware, licence re-checked on fetch), an operator-installed synthesiser (pinned, wrapped).
- [ ] **3.3** Licence policy closed to `cc0 | pdm | by`; `credits.json` per output.
- [ ] **3.4** Ladder order is data; a cue no rung fills stays quiet and is listed.

## Phase 4 — Mix, critique, proof

- [ ] **4.1** `mix-sfx.sh` writes a stem and a new MP4; never `final.mp4`.
- [ ] **4.2** Rule `you-cannot-hear` (pack-scoped): measured vs text-matched, plus a listen list of at most five moments.
- [ ] **4.3** Pre-registered blind A/B over six films; honest null recorded.
- [ ] **4.4** A sound rung for `analyze:post` (onset density, LUFS, voice/music presence), local only.

## Kill register

K1 bundled ML or Python dependencies · K2 video-to-audio models as default (NC weights, EU exclusion) · K3 cloud hearing by default · K4 caption-model scores as QA for sync or loudness · K6 NC/ND/SA licences · K7 overwriting a master.
