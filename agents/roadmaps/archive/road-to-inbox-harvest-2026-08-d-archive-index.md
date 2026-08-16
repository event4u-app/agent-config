---
complexity: lightweight
status: ready
---

# Road to an archive index, so sweeps stop paying for history

**Goal.** "Has this idea already been tried, closed, or refuted?" becomes one
read instead of a walk over the whole archive — without deleting any history,
and without declaring the index a win before the saving is measured.

**Source:** a proposal roadmap that arrived in the inbox, pinned at `e44e87865`,
archived local-only at `agents/tmp.old/context-custodian/`. Triage and claim
verification: `agents/evidence/analysis/inbox-harvest-2026-08-d-triage.md`.

## Context

Counted against the tree at `e3bd96158`, not carried over from the proposal.

- **The archive holds 494 top-level roadmaps** (499 `.md` including three
  subdirectories, 501 files in total). The proposal said 497; the difference is
  a miscount rather than drift — `git diff --stat e44e87865..HEAD --
  agents/roadmaps/archive/` is empty, so nothing moved between its pin and now.
- **A partial index exists, and the precise defect is that it is partial.**
  `agents/roadmaps/archive/` carries `00-overview.md`,
  `00-overview-and-ordering.md` and `00-phase4-overview.md` — cluster-scoped
  prose, not a machine-readable index over the whole archive. There is no
  `INDEX.md` and no `index.json`. The claim is "no complete machine-readable
  index", never "no index".
- **Nothing enumerates the archive for a dedup question today.** The three
  scripts that touch the path — `lint_empty_roadmaps.ts`,
  `check_no_roadmap_refs.ts`, `lint_roadmap_family_cap.ts` — each do something
  else, and none builds or consults an index. So a sweep that must answer
  "already tried?" has no cheaper option than opening files.
- **Both halves it needs already ship.** `src/scripts/validate_frontmatter.ts`
  is a working frontmatter reader, and `src/scripts/compile_router.ts:301`
  carries the `--check` drift-gate pattern a generated artefact is kept honest
  with. Neither is forked here.

## Non-goals

- **No deletion.** Provenance is doctrine; the archive stays whole. The cost
  being removed is the cost of *consulting* history, not history itself.
- **No model-written summaries in the index.** A verdict that cannot be
  extracted deterministically is recorded as *not extractable*, so a reader can
  tell a missing verdict from an invented one.
- **No second frontmatter parser.**

## Phase 1 — Build the index, then prove it paid

- [x] 1.1 A deterministic extractor emits `INDEX.md` and `index.json` over the
      archive: slug, title, closing disposition, phase count, and the extracted
      verdict where the frontmatter carries one. It reuses
      `validate_frontmatter`'s reader rather than parsing again.
      <!-- verify: test -f src/scripts/build_archive_index.ts -->
- [x] 1.2 A `--check` mode fails when the committed index and a fresh
      regeneration differ, following the drift-gate shape `compile_router`
      already uses. A generated artefact nobody re-derives goes stale in one
      merge.
      <!-- verify: grep -c 'check' src/scripts/build_archive_index.ts -->
- [x] 1.3 Measure the saving before anything depends on it: take a real dedup
      question, count archive files opened with the index and without it.
      **Bar: at least 80 % fewer files opened.** Below the bar, the index is
      reverted and the reading is published as a null.
      <!-- verify: test -f agents/evidence/analysis/archive-index-saving.md -->

## Phase 2 — Point the consumers at it

- [x] 2.1 Once 1.3 clears its bar, state in the roadmap-authoring surface that a
      "already tried / closed / refuted?" check consults the index first and
      falls back to the archive only for what the index marks not extractable.
      <!-- verify: grep -c 'INDEX' src/skills/roadmap-writing/SKILL.md -->
- [x] 2.2 Register the index in the generated-artefact set so it regenerates
      with the rest rather than by memory.
      <!-- verify: grep -c 'archive_index' Taskfile.yml -->

## Acceptance criteria

- [x] `INDEX.md` and `index.json` cover every top-level archived roadmap.
- [x] A drift check fails on a stale index.
- [x] The before/after file-open measurement is published, and the index either
      cleared the 80 % bar or was reverted with the null recorded.
- [x] No archived file was deleted or rewritten.
- [x] Verdicts that cannot be extracted deterministically say so.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-08-15 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | The index becomes a second source of truth and starts disagreeing with the archive | product | A generated summary that readers trust more than the files will eventually be wrong about one of them, and the wrong answer to "already tried?" is a duplicated roadmap | 1.2 fails the build on any divergence between the committed index and a fresh regeneration, and 2.1 routes the reader back to the files for anything the index marks not extractable | Phase 1 — Build the index, then prove it paid |
| 2 | The saving is assumed rather than measured and the index is maintenance with no payload | implementation | An index feels obviously cheaper, which is exactly the reasoning this package has had to reverse before | 1.3 sets an 80 % bar and a revert path before any consumer depends on it, and 2.1 is sequenced after that reading rather than beside it | Phase 1 — Build the index, then prove it paid |
| 3 | Extraction produces a confident verdict for a roadmap whose closure was ambiguous | product | Many archived roadmaps closed by archival sweep rather than by a stated verdict, so a field can be present and mean little | The non-goals bar model-written summaries and require an explicit not-extractable marker, so an absent verdict stays visibly absent | Non-goals |
