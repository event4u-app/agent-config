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
estate_offset_exempt: "Parked follow-on of round inbox-2026-11-e; no owner. Owner search at 03581ff791 (grep -rIl -i for 'safe zone', 'launch film', 'approvals.json', 'FACTS.md', 'asset-licences' over agents/roadmaps/*.md, later, stubs) returned nothing."
relates:
  - slug: road-to-a-film-built-from-time
    relation: depends
    note: "Every gate here runs on that roadmap's film manifest."
  - slug: later/road-to-breadth-with-depth
    relation: disjoint
    note: "Owns /video reachability (4.1/4.2) and editing export profiles."
---
# Road to a film the project can ground

> **Source:** `agents/tmp.old/inbox-2026-11-e/` (topics t1, t2 — supplied plans v3).
> **Arrivals:** 1 — `inbox-2026-11-e` (2026-11-02).

## Goal

A code-rendered film whose text is readable, whose cuts sit on the grid, whose
approvals are digests, and whose every product claim and on-screen number is
grounded — plus the governance that has to reach the consumer before any of
that ships. Parked: each phase needs the film manifest of
`road-to-a-film-built-from-time` first.

## Phase 1 — Text and sync gates

- [ ] **1.1** Text sidecar `TEXTS(t)` read when present, else measured through a `fillText`/DOM hook.
- [ ] **1.2** Reading-time floor, platform safe zones per format, overlap, clipping; `0/0` checked with text present is a fail.
- [ ] **1.3** Cuts against the beat grid (locks ±0.15 s, snaps ±0.10 s); plan vs file duration via `ffprobe`.
- [ ] **1.4** Poster: best still frame burned in as frame 0 without changing frame count or sync.
- [ ] **1.5** Formats re-laid out, not cropped (16:9, 9:16, 1:1).

## Phase 2 — Audio without an ML install

- [ ] **2.1** Zero-dependency TS beat tracker with `method` reported and a tempo-change warning.
- [ ] **2.2** Probe ladder: precomputed cues → installed analyser → 2.1 → energy segmentation → `unavailable`.
- [ ] **2.3** TTS by form and an ASR round trip with language passed through (German is the main case).

## Phase 3 — Approvals, styles, grounding

- [ ] **3.1** Approvals as digest records; a stale board stops the export.
- [ ] **3.2** Style catalogue (`proven | studied | sketch`), three first-party seeds; anti-copy treatment with six declared axes before a demo is read.
- [ ] **3.3** `launch-film`: project → 15–25 s film; leak rule (no secrets or personal data; real data swapped for stand-ins).
- [ ] **3.4** Grounding mechanised: every on-screen string sourced in the project or declared framing; every number has a `FACTS.md` row.

## Phase 4 — Governance that reaches the consumer

- [ ] **4.1** Media policies ship to consumers (seeded template or read from `dist/`); absence refuses with the path. Today `agents/settings/` is not in the package `files`.
- [ ] **4.2** Policies `asset-licences` (music/SFX/fonts with credit lines) and `titles-and-marks`.
- [ ] **4.3** Installed renderers consumed by form, with a licence check that covers commercial thresholds, not only copyleft.

## Phase 5 — A benchmark that discriminates

- [ ] **5.1** Pre-registered three arms (no package, `code-film`, `code-film` + installed renderer) over tasks that discriminate (tempo change, German voice-over, launch film with trap fixtures); honest null valid; VLM judgement advisory only.
