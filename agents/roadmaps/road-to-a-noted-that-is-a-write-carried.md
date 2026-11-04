---
complexity: lightweight
status: ready
tree_pin: 5f54e84843
execution:
  mode: phase-checkpoints
review_by: 2026-12-15
relates:
  - slug: road-to-a-noted-that-is-a-write
    relation: extends
    note: "Carries its step 1.3; the subject index it feeds (`_subject-index.json`) landed there."
---
# Road to a "noted" that is a write — carried

> **Source:** `agents/roadmaps/archive/road-to-a-noted-that-is-a-write.md` step 1.3,
> carried on 2026-11-04 by AI council verdict (recorded at the item).

## Goal

A correction the host's own auto-memory already recorded counts as an earlier
arrival of that subject in the self-repair subject index, read through a boundary
that is decided and tested rather than assumed.

## Phase 1 — The host memory as a recurrence source

- [ ] **1.1 Decide the read boundary, then read.** Owner answer OQ-33
      (2026-10-29) permits a read-only read with no consent prompt. Open
      question from the ratification review of 2026-11-04: every project's
      memory directory, or only the current project's. Threat-model the choice
      (`threat-modeling`), then add the reader (never a write; a per-file size
      cap; frontmatter `type: feedback` only), give the `host-memory` row of
      `src/config/source-registry.json` its reader, and add `host_memory` to
      the subject index for subjects the store already knows.
      verify: `npx vitest run tests/scripts/host_memory_reader.test.ts` -> 0 — a
      read-only (`0o555`) fixture whose bytes and mtimes are unchanged after the
      read, and a fixture memory of another project that the chosen boundary
      reads or skips as decided.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-11-04 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | Reader reaches another project's memory | implementation | A boundary wider than decided reads corrections recorded for unrelated projects | Boundary chosen under threat-modeling first; a fixture of another project pins the decided read-or-skip | Phase 1 — The host memory as a recurrence source |
| 2 | Reader mutates the host's memory | implementation | Any write, rename or touch under the host directory corrupts state the host owns | Read-only `0o555` fixture whose bytes and mtimes are asserted unchanged | Phase 1 — The host memory as a recurrence source |

## Acceptance Criteria

- [ ] AC-1 — A subject the host memory recorded as feedback reads one more
      arrival in `_subject-index.json`; nothing is written under the host's
      memory directory.
