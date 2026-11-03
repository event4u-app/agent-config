---
complexity: structural
status: ready
tree_pin: 62e7d03a43
execution:
  mode: phase-checkpoints
review_by: 2026-12-15
estate_growth_exempt: "+1 active_roadmaps, owner-directed 2026-11-03 in the /analyze:inbox invocation itself (\"danach arbeite die roadmaps ab mit /roadmap:process-full\"); closed and archived in the same PR, so the active estate returns to its prior count."
estate_offset_exempt: "Owner search at 62e7d03a43: grep -rlE 'c2pa|embed-provenance|disclosure.md|transparency.md|digitalSourceType|safe.?zone' over agents/roadmaps/*.md, agents/roadmaps/later and agents/roadmaps/stubs: 0 active and 0 stub owners; later hits are context only. Nothing absorbs this."
relates:
  - slug: road-to-a-verdict-that-shows-its-frame
    relation: disjoint
    note: "The analysis side reads provenance there (its Phase 1); this roadmap owns the production carriers and the policy text."
  - slug: stubs/road-to-host-primitive-lowering
    relation: disjoint
    note: "Skill-script path and allowed-tools pre-approval (owner-reserved there)."
  - slug: later/road-to-ai-media-labels-on-the-platform
    relation: disjoint
    note: "Visible burn-in label rule (owner E2), distribution register (owner), song origin, prose-catalog parity, profile merge, script-edge closure."
---
# Road to AI media that says so where it lands

> **Source:** `agents/tmp.old/inbox-2026-11-p/` (topic t3: owner transcript, two
> supplied plans and a repo-format draft about an external video-channel skill
> set and platform disclosure rules, referenced as S1).
> **Arrivals:** 1 — `inbox-2026-11-p` (2026-11-03).

## Goal

The suite's promise about labelling AI media is true where it is made. The only
mechanism today, `embed-provenance.sh`, writes a container comment that a stream
copy erases (reproduced: `ffmpeg -map_metadata -1 -c copy`), a second tag the
mp4 muxer silently drops, an "AI-generated" wording even for edited material,
and a sidecar written before the final bytes exist and without their hash. Its
Python tests were deleted in the TypeScript migration and never ported. Four of
five video commands and every image command never call it. Done means: one
`finish` step with a fixed carrier order and a hash of the final file, wired into
every render end, policies that describe what the carriers really guarantee, and
two principles written down — provenance is reported, never removed; no quality
loop may take lower detectability as an objective.

## Phase 0 — Red first

- [ ] **0.1 `tests/scripts/ai_video_provenance.test.ts`.** Ports the deleted
      suite and adds rows: strip removes the comment; `ai_generated` key absent
      after mux; edited wording; `digitalSourceType` for edited input; sidecar
      lacks the artifact hash. The c2patool row skips with a stated reason when
      the tool is absent.
      verify: each row red at the pin for its named reason.
- [ ] **0.2 Reverse-direction fixture for `lint_media_policy_linkage.ts`**
      (command emits a deliverable medium → listed in both policy trigger lists).
      verify: red at the pin.

## Phase 1 — One labelling model in the policies

- [ ] **1.1 Four carriers** in `agents/settings/policies/media/disclosure.md` and
      `transparency.md`: `visible`, `embedded`, `sidecar`, `platform-field`;
      "non-removable" applies to `visible` only.
- [ ] **1.2 One vocabulary table** `generated`/`modified` ↔
      `ai_generated`/`ai_edited` ↔ `trainedAlgorithmicMedia` /
      `compositeWithTrainedAlgorithmicMedia`, shared by label, sidecar and C2PA.
- [ ] **1.3 Two principles as policy text:** provenance and disclosure are
      reported, never removed, on production and analysis side; no quality,
      polish or optimisation loop takes detectability as an objective (mirrors
      the text-side rule in `humanizer`).
- [ ] **1.4 Trigger lists rebuilt from the tree**; `/image:*` no longer
      "future"; the README cites the `.ts` lint.
      verify (1.1–1.4): `lint_media_policy_linkage` green; grep for each table.
- [ ] **1.5 Second lint direction** in `src/scripts/lint_media_policy_linkage.ts`.
      verify: 0.2 green after Phase 2.

## Phase 2 — One finish step for every render end

- [ ] **2.1 `embed-provenance.sh finish`**: container tags → sidecar with the
      sha256 of the final bytes → C2PA last. A visible-label slot is reserved and
      reported `not-applied (rule pending)` until the owner's burn-in rule lands.
- [ ] **2.2 Only keys that survive the muxer** (or `-movflags
      use_metadata_tags`); the comment wording follows the assertion.
- [ ] **2.3 `digitalSourceType` follows the assertion.**
- [ ] **2.4 Wire `finish`** into `from-script`, `stitch`, `from-song` (replacing
      its step 9.4) and `/image:create` (sidecar for png/jpg).
- [ ] **2.5 Re-cut means re-finish**; `transparency.md` states that an external
      re-encode loses embedded carriers and the signature.
      verify (2.1–2.5): 0.1 green; sidecar hash equals the final file; 0.2 green.

## Decisions

| # | Decision | Route | Outcome |
|---|---|---|---|
| D1 | Execute in the same run although 8 > 5 active | owner | Decided by the invocation (2026-11-03). |
| D2 | Visible burn-in rule and label form (E2) | owner | Open; slot reserved, reported not-applied. Legal premise not verifiable offline. |
| D3 | Distribution register per platform | owner | Open; parked on later/. |
| D4 | C2PA signing in CI with a test certificate | council (reversible) | Default taken: CI tests the sidecar path; the c2patool path runs only when present. |
| D5 | Media-intelligence pack, new `media:*` verbs, publishing APIs | agent | Declined — overtaken by `/analyze:post` + `media:bundle`. |
| D6 | Self-voice parity | owner (prior) | Closed — owner already decided; no new evidence. |

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-11-03 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | Policy text overpromises again | compliance | "Non-removable" stays attached to a removable carrier | Carrier table; tests reproduce the strip | Phase 1 — One labelling model in the policies |
| 2 | Wiring breaks a render end | implementation | A command calls `finish` with wrong args | Lint second direction plus the provenance test | Phase 2 — One finish step for every render end |

## Acceptance Criteria

- [ ] AC-1 — `ai_video_provenance.test.ts` is green and covers strip, muxer drop, wording and hash.
- [ ] AC-2 — Every deliverable-emitting media command is in both trigger lists and calls `finish`.
- [ ] AC-3 — Both policies state the two principles and the carrier table.
