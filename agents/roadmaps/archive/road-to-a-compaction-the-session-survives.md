---
complexity: lightweight
status: ready
tree_pin: ceea998a0d
execution:
  mode: phase-checkpoints
estate_offset_exempt: "Owner search before writing: grep -rlE 'PostCompact|post_compact|compact_summary|isCompactSummary' across agents/roadmaps/*.md, later/ and stubs/ returned nothing. The one file owning the subject, stubs/road-to-compaction-survival-census, holds its work behind a manual compaction this file's evidence shows is not needed for the presence half; it gains an Arrivals line and a pointer here rather than being promoted wholesale, because its Phase 1 build still waits on adherence numbers. Active because the invocation carried --process (round inbox-2026-11-zb); the active cap is 25 (owner directive 2026-11-07), 8 in use."
relates:
  - slug: stubs/road-to-compaction-survival-census
    relation: extends
    note: "Delivers the presence half of its cf01 from host transcripts (auto compactions), leaving the adherence half and the Phase 1 build with the stub."
  - slug: later/road-to-state-and-pins-across-compaction
    relation: enables
    note: "Its checkpoint, session-pin and recall work starts from the identity reading and the presence baseline landed here."
  - slug: later/road-to-tool-results-that-leave-a-handle
    relation: informs
    note: "Four evidence imports from the same round are recorded on that file, not planned here."
---
# Road to a compaction the session survives

> **Source:** `agents/tmp.old/inbox-2026-11-zb/` — a transcript asking for a deep
> analysis of an external context-compression reference and a roadmap revised in
> three loops, plus two assistant-drafted plans. Tree facts verified at
> `main@ceea998a0d` on 2026-11-08.

## Goal

The two compaction questions the tree parked behind "needs a live session and a
human" are answered from records the host already writes, with a tracked,
re-runnable instrument, and the one shipped consumer surface for users who
compact (the compact-instructions template) is reachable from the docs.

## Context

- `rule-inject` and `language-mirror` key their post-compaction restore by
  session id (`src/scripts/hooks/rule_inject_hook.ts:1007–1029`,
  `src/scripts/language_mirror_hook.ts:208`), while the council record
  `agents/evidence/council/compact-resume-2026-10.md:34–36` calls id reuse "not
  measured". If the host changed the id, both would run empty without a signal.
- The host writes each compaction into the session JSONL as a
  `compact_boundary` record followed by an `isCompactSummary` record carrying the
  summary text. A read-only scan answers both identity and summary presence for
  every automatic compaction already on disk.
- `src/templates/compact-instructions.md` ships in the package and nothing links
  to it (`grep -rn compact-instructions docs src README.md` → only the file).

## Phase 1 — Identity and presence from host records

- [x] **1.1** `src/scripts/compaction_census.ts`: aggregate-only census of host
      transcripts — compaction triggers, session id across the boundary, token
      medians, host version range, and presence of deterministic probes in the
      host-written summary. No path, id or text in the output; roots
      deduplicated by real path.
      `verify: npx vitest run tests/scripts/compaction_census.test.ts`
- [x] **1.2** Tests seen red: the identity comparison inverted fails the suite,
      restored it passes (6 cases: kept/changed id, no summary → unobserved,
      per-probe presence, trigger/median/version, malformed lines, no leak of
      id or text).
- [x] **1.3** Run on the maintainer corpus and record the reading:
      `agents/evidence/analysis/compaction-identity-and-presence-2026-11-08.md`
      — 274 automatic compactions, id kept 274/274, presence baseline per probe,
      labelled a lower bound on presence only.
      `verify: test -f agents/evidence/analysis/compaction-identity-and-presence-2026-11-08.md`
- [x] **1.4** Record on `stubs/road-to-compaction-survival-census` that the
      presence half of cf01 has a baseline from automatic compactions, and that
      what remains is the adherence half plus a manual-compaction observation.

## Phase 2 — The template users who compact can find

- [x] **2.1** Link `src/templates/compact-instructions.md` from
      `docs/contracts/continuity-record-slot.md`, where `/clear` and recycling are
      described, as the path for a session that compacts instead.
      `verify: grep -q compact-instructions docs/contracts/continuity-record-slot.md`

## Decisions

| ID | Class | Resolved by | Decision | Evidence | Revisit-if |
|---|---|---|---|---|---|
| R1 | reversible-technical | run (tree evidence) | The passive sonde the source proposed (new telemetry concern, ≥ 10 pairs) is not built: host transcripts already hold 274 observations. | evidence file above | a manual `/compact` is observed with a changed id |
| R2 | reversible-technical | run | Declined: no `PostCompact` alias and no live witness concern. The offline census answers presence from records the host already writes, and an alias needs an observed minimum host version this run could not probe. | — | the census cannot be run on a consumer machine where the numbers matter, or a restore needs `compact_summary` at hook time |
| R3 | reversible-technical | run | The template is linked, not surfaced by `doctor` (source's 5.6): a doctor heuristic for "this project compacts" is a new detector for a one-line pointer. | — | a user reports not finding it after the link exists |

## Risk Register

| Risk | Mitigation |
|---|---|
| Presence read as survival | Every surface carrying the numbers says "lower bound on presence"; adherence stays in the stub. |
| A private corpus leaks through the evidence | The census emits counts only; a test asserts no id or text reaches the output. |
| One maintainer's corpus generalised | The evidence names its scope; the instrument is tracked so another machine can re-run it. |

## Acceptance Criteria

- `compaction_census` and its tests are on `main`, green.
- The evidence file states the identity reading, its one residual (manual
  `/compact` unobserved) and the presence baseline with its lower-bound label.
- `compact-instructions.md` is linked from at least one doc.
