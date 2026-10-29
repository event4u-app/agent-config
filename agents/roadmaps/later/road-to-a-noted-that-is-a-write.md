---
complexity: lightweight
status: later
tree_pin: 58d43073b7
execution:
  mode: phase-checkpoints
entry_condition:
  what: >
    road-to-a-correction-that-is-heard is archived (detector vocabulary and
    subject capture exist), a WIP slot is free under the cap of five, and
    OQ-28 (project-edit consent) is answered for Phase 3.
  when: >
    The run that archives road-to-a-correction-that-is-heard.
  who: >
    none for Phases 1-2 -- the maintainer moves this file to agents/roadmaps/;
    the owner for Phase 3 (OQ-28).
review_by: 2026-12-15
estate_growth_exempt: "+1 later_roadmaps: parked owner-gated half of round inbox-2026-10-bi topic T1; its executable half is the active road-to-a-correction-that-is-heard, closed in the same PR."
estate_offset_exempt: "Parked, not active. Owner search at 58d43073b7 (grep -rlF for persistence-claim, TurnSnapshot, CLAUDE.local.md, detectAgentsMdShadow over agents/roadmaps, later, stubs) returned nothing."
relates:
  - slug: road-to-a-correction-that-is-heard
    relation: depends
    note: "Needs its subject capture (1.3) for the subject-count index."
depends:
  - road-to-a-correction-that-is-heard
---
# Road to a "noted" that is a write

> **Source:** `agents/tmp.old/inbox-2026-10-bi/` (topic T1, supplied plan v3).
> **Arrivals:** 1 — `inbox-2026-10-bi` (2026-10-29).

## Goal

When the agent says "noted" or "from now on", a write to a carrier the next
session reads has happened in the same turn, and a repeated correction about
one subject is counted across differently worded complaints. Not started at the
pin because the detector needs the write paths the turn snapshot does not carry
(`self_repair_hook.ts` records Edit/Write as a bare tool name).

## Phase 1 — The turn snapshot knows what was written

- [ ] **1.1 Write paths in the turn snapshot.** Append `file_path` /
      `notebook_path` for Edit, Write, MultiEdit and NotebookEdit; measure the
      hook-bundle bytes first (tight headroom).
      verify: a transcript fixture with a Write yields `"Write <path>"`.
- [ ] **1.2 Subject-count index.** A derived `_subject-index.json` beside the
      target index in `self_repair_store.ts`.
      verify: three records with different fingerprints and one subject count 3.

## Phase 2 — "Noted" without a write is a defect

- [ ] **2.1 `persistence-claim` defect class.** Reply-opening claim
      (`notiert|gemerkt|für immer|ab jetzt|noted|I'll remember|from now on`) with
      no written path matching a carrier (`AGENTS.md`, `CLAUDE*.md`,
      `.editorconfig`, formatter configs, `.claude/rules/`, memory dirs);
      advisory, stop slot; issue-template dropdown updated.
      verify: corpus with fire, near-miss and must-not-fire rows ("noted, see the
      PR" plus a Write to `.editorconfig` stays silent).
- [ ] **2.2 Shadow detector.** Pure `detectAgentsMdShadow(root)` flags a
      `CLAUDE.md` / `.claude/CLAUDE.md` / `CLAUDE.local.md` that neither imports
      nor symlinks a non-empty `AGENTS.md`; surfaced by `/agents audit`.
      verify: five temp-dir layouts.
- [ ] **2.3 Carrier-rung classifier.** Pure `conventionRung(sentence)` →
      config | check | prose, unclassifiable = prose; classifies only, writes
      nothing.
      verify: a 30-sentence DE/EN corpus where a too-strong rung is the failing
      direction.

## Phase 3 — Proposing the config change (OQ-28)

- [ ] **3.1 Propose the convention as a project diff.** Only after OQ-28 lets
      the self-repair loop touch a user's project with consent; the proposal is
      a diff the user accepts, never a silent write.
      verify: a fixture where the proposal is emitted and no file changes
      without the accept.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-10-29 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | The claim detector fires on harmless prose | implementation | "Noted" in a summary of a written change reads as a hollow promise | Must-not-fire rows for a claim beside a matching write; advisory only | Phase 2 — "Noted" without a write is a defect |

## Acceptance Criteria

- [ ] AC-1 — A "noted" reply with no carrier write is queued as a defect; one
      with a matching write is not.
- [ ] AC-2 — Three differently worded corrections about one subject read as
      three arrivals of that subject.
