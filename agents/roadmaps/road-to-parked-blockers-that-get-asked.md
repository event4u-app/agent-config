---
complexity: lightweight
status: ready
execution:
  mode: phase-checkpoints
estate_offset_exempt: "Forty parked roadmaps carry open blockers that neither the blocker lint nor /roadmap:resolve-blockers will ever read, because both exclude later/ by a recorded decision; nothing can be archived or parked to make room for a question about what parking hides. Merging into the nearest owner was considered: stubs/road-to-blocker-parse-visibility owns the other half — whether the parser sees a blocker heading at all — and folding a scope decision into a parse-defect stub would bury the decision this file exists to put to the council."
estate_growth_exempt: "Grows active_roadmaps by one: the owner asked on 2026-10-06 for this round's roadmaps to land as ready in one change; no live roadmap owns blockers that sit outside every reader's glob."
relates:
  - slug: road-to-blocker-parse-visibility
    relation: disjoint
    note: "Stub. Owns the heading-parse half — a blocker the parser cannot see. This file owns the scope half — a blocker in a directory no reader scans — and touches no parser."
---
# Road to parked blockers that get asked

> **Source:** an external review round (opaque id inbox-2026-10-e), consumed
> into `agents/tmp.old/inbox-2026-10-e/`. Every anchor below was re-read at
> `main` @ `a75bb3210` on 2026-10-06, and the counts were re-run there.

## Goal

An open owner question in a parked roadmap reaches the owner through the same
command every other open blocker does, or the council records why it should
not. A criterion that says of itself that it is not met is not ticked. A
`path:line` a blocker cites still points at a line that exists.

## Context

- Both readers of blockers exclude `later/` on purpose.
  `src/scripts/lint_roadmap_blockers.ts:32` and `:74-79`: "`later/`,
  `archive/` and `skipped/` stay OUT … a blocker left unresolved there is
  history rather than debt", pinned "in both directions" by
  `tests/scripts/lint_roadmap_blockers.test.ts:566-570`.
  `/roadmap:resolve-blockers` states the same scope
  (`src/domains/product-basic/roadmap/resolve-blockers/command.md:63`). This is
  a decision, so changing it is a decision-revisit, not an edit.
- The history is not all history. `grep -l 'Status:\*\* open'
  agents/roadmaps/later/*.md | wc -l` returns 40 of the 99 files in `later/`.
  No file has left `later/` since `/roadmap:triage-parked` landed (#2184,
  2026-10-03).
- Some of it is active work moved out of sight. #2167 ("100 % roadmaps archive
  — bare deferrals carried", commit `074eee688`) carried open steps into seven
  `later/*-carried.md` files, among them `road-to-a-stop-that-holds-carried.md`
  and `road-to-an-obligation-row-that-names-its-writer-carried.md`.
- An owner question exists only as prose.
  `agents/roadmaps/later/road-to-release-finding-ordering.md:28-32` is a
  blockquote headed "Owner question, posed 2026-10-01 at the fourth arrival"
  with three numbered options — not a `### blocker:` entry, so no reader could
  see it even if `later/` were in scope.
- A criterion is ticked over its own "not met".
  `agents/roadmaps/archive/road-to-a-kernel-that-guards-its-plumbing.md:725-739`
  is `- [x] AC-3` whose text says one half "is NOT met and was refused rather
  than missed". The same file explains the tick: flipping to `[~]` "reds that
  gate, which is a build failure in exchange for a glyph" (`:354-359`).
- No gate checks a blocker's line citation. `check_references` resolves names,
  not line numbers; the nearest precedent checks only that a knowledge card's
  `source=<path:line>` path exists (`src/scripts/check_knowledge_cards.ts:291-300`).

## Phase 1 — The census

- [ ] **1.1 Every open blocker in `later/`, by who it waits on.** A `report_`
      script lists each `### blocker:` with `Status:** open` under
      `agents/roadmaps/later/`, its file, `Owner:`, and whether the owner is
      the owner or an agent-reachable condition, and separately every
      blockquote that names an owner question without a blocker entry. It
      exits 0.
      verify: `npx vitest run tests/scripts/report_parked_blockers.test.ts` -> 0
- [ ] **1.2 The reading is a page.** Its output, the command and the 40/99
      count go to `agents/evidence/analysis/parked-blockers-2026-10.md` with
      `<!-- evidence-type: analysis -->`.
      verify: `grep -c 'evidence-type: analysis' agents/evidence/analysis/parked-blockers-2026-10.md` -> /^[1-9]/

## Phase 2 — Whether parked blockers are in scope

- [ ] <!-- blocked-by: later-blockers-in-scope --> **2.1 The scope follows the
      decision.** Under (a): `/roadmap:resolve-blockers` gains a `later/`
      bucket that lists only entries with `Owner:` owner and `Status:` open, and
      the lint's scope and its pinning test stay unchanged. Under (b): the lint
      glob adds `later/*-carried.md`, the pinning test flips for that pattern
      only, and the command follows the lint.
      verify: `npx vitest run tests/scripts/lint_roadmap_blockers.test.ts` -> 0

## Phase 3 — The prose question becomes a blocker

- [ ] **3.1 Release ordering, rewritten in the contract's shape.** The
      blockquote at `later/road-to-release-finding-ordering.md:28-32` becomes a
      `### blocker:` entry with the five required fields, its three options
      carried as the `What to do` choice and the date it was posed kept. The
      blockquote is replaced, not duplicated.
      verify: `grep -c '^### blocker:' agents/roadmaps/later/road-to-release-finding-ordering.md` -> /^[1-9]/

## Phase 4 — A tick over "not met"

- [ ] **4.1 A check that refuses the tick.** A lint reports any `- [x] AC-`
      line whose own criterion text contains `NOT met`. A fixture shows it red;
      run over the tree, the archived AC-3 is reported as a hit.
      verify: `npx vitest run tests/scripts/lint_ticked_unmet_criteria.test.ts` -> 0
- [ ] **4.2 The pressure that made the tick.** The progress check stops
      counting `[~]` in a file under `archive/` toward the Iron-Law-3 failure
      that `:354-359` describes, so an honest deferral can stand in an
      archived roadmap; the archived AC-3 then becomes `[~]` with a one-line
      dated note.
      verify: `npx vitest run tests/scripts/roadmap_progress_archived_deferral.test.ts` -> 0

## Phase 5 — Citations a blocker can trust

- [ ] **5.1 Every `path:line` in a blocker resolves.** A lint reads the
      `## Blockers` section of every active roadmap and stub and checks each
      `path:line` or `path:line-line`: the file exists and the last line is
      within its length. Existing misses go into a shrink-only baseline.
      verify: `npx vitest run tests/scripts/lint_blocker_citations.test.ts` -> 0

## What this roadmap deliberately does not do

- No widening of the lint to all of `later/`, `archive/` or `skipped/` by
  agent judgement; Phase 2 waits for the council.
- No change to how blocker headings are parsed — the stub in `relates`.
- No re-deciding of any parked blocker; Phase 3 changes the shape of one
  question, not its answer.
- No content check of a cited line, only that it exists.

## Acceptance Criteria

- [ ] AC-1 — One command lists every open blocker under `later/`, split by
      owner-wait and agent-wait.
- [ ] AC-2 — The council's verdict on the `later/` exclusion is recorded, and
      the readers' scope matches it.
- [ ] AC-3 — The release-ordering owner question is a `### blocker:` entry
      that `lint_roadmap_blockers` validates when its file is in scope.
- [ ] AC-4 — A `[x]` criterion whose text contains `NOT met` is reported.
- [ ] AC-5 — A blocker citing a line beyond the end of its file fails the
      citation lint, and the baseline only shrinks.

## Decisions

| ID | ownership | resolved by | decision | evidence | revisit if |
|---|---|---|---|---|---|
| D1 | reversible-technical | evidence | Census before scope | The 40 is a file count; how many wait on the owner is not yet known | — |
| D2 | reversible-technical | agent | 3.1 edits a `later/` file in place rather than un-parking it | Un-parking is the triage command's decision, not this file's | The council picks (b) and the file is carried |
| D3 | reversible-technical | agent | Line citations get a baseline, not a hard fail | Line numbers move with every edit above them; an existing miss is drift, not a new defect | The baseline reaches zero |

## Blockers

### blocker: later-blockers-in-scope
- **Status:** open
- **Owner:** council
- **Blocks:** step 2.1, AC-2
- **What to do:** pick exactly one — (a) extend `src/domains/product-basic/roadmap/resolve-blockers/command.md` with a `later/` bucket for `Owner:` owner entries only and leave `src/scripts/lint_roadmap_blockers.ts` unchanged, or (b) widen the glob in `src/scripts/lint_roadmap_blockers.ts` to `later/*-carried.md` and flip its pinning test for that pattern.
- **Resolved when:** a council verdict on the decision-revisit of the "history rather than debt" exclusion is recorded beside `agents/evidence/analysis/parked-blockers-2026-10.md`, naming (a) or (b).
- **Recommendation:** (a) — it puts owner questions in front of the owner without making forty files' structure a build failure, and the census in Phase 1 says how large the bucket is first.
- **If you do nothing:** the owner questions in `later/` stay unasked; nothing reds.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-10-06 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | The owner is flooded with parked questions | product | Forty files could become forty questions at once. | Option (a) lists only `Owner:` owner entries; the census sizes it before 2.1. | Phase 2 — Whether parked blockers are in scope |
| 2 | Relaxing the archive deferral check hides a real deferral | implementation | Archived `[~]` stops counting toward a failure. | 4.2 is scoped to `archive/`; active roadmaps keep the Iron-Law-3 check. | Phase 4 — A tick over "not met" |
| 3 | The citation lint is noisy | implementation | Many blockers cite lines that have since moved. | Shrink-only baseline (D3); only `## Blockers` sections are read. | Phase 5 — Citations a blocker can trust |
| 4 | The census misreads an owner field | implementation | `Owner:` values are free text. | The report prints the raw value beside its classification. | Phase 1 — The census |
