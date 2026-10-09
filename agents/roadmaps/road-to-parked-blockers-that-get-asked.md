---
complexity: lightweight
status: ready
execution:
  mode: phase-checkpoints
estate_offset_exempt: "Forty parked roadmaps carry open blockers that neither the blocker lint nor /roadmap:resolve-blockers will ever read, because both exclude later/ by a recorded decision; nothing can be archived or parked to make room for a question about what parking hides. Merging into the nearest owner was considered: stubs/road-to-blocker-parse-visibility owns the other half — whether the parser sees a blocker heading at all — and folding a scope decision into a parse-defect stub would bury the decision this file exists to put to the council."
estate_growth_exempt: "Grows active_roadmaps by one: the owner asked on 2026-10-06 for this round's roadmaps to land as ready in one change; no live roadmap owns blockers that sit outside every reader's glob. Grows open_blockers by two on 2026-10-07: the release-ordering owner question was already open as a blockquote and is now counted as the blocker it always was, and ac3-carry-needs-receiver-backlink records the one step of this file that waits on another roadmap's back-link."
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

- [x] **1.1 Every open blocker in `later/`, by who it waits on.** A `report_`
      script lists each `### blocker:` with `Status:** open` under
      `agents/roadmaps/later/`, its file, `Owner:`, and whether the owner is
      the owner or an agent-reachable condition, and separately every
      blockquote that names an owner question without a blocker entry. It
      exits 0.
      verify: `npx vitest run tests/scripts/report_parked_blockers.test.ts` -> 0
- [x] **1.2 The reading is a page.** Its output, the command and the 40/99
      count go to `agents/evidence/analysis/parked-blockers-2026-10.md` with
      `<!-- evidence-type: analysis -->`.
      verify: `grep -c 'evidence-type: analysis' agents/evidence/analysis/parked-blockers-2026-10.md` -> /^[1-9]/

## Phase 2 — Whether parked blockers are in scope

- [ ] **2.1 The scope follows the
      decision.** Under (a): `/roadmap:resolve-blockers` gains a `later/`
      bucket that lists only entries with `Owner:` owner and `Status:` open, and
      the lint's scope and its pinning test stay unchanged. Under (b): the lint
      glob adds `later/*-carried.md`, the pinning test flips for that pattern
      only, and the command follows the lint.
      verify: `npx vitest run tests/scripts/lint_roadmap_blockers.test.ts` -> 0

## Phase 3 — The prose question becomes a blocker

- [x] **3.1 Release ordering, rewritten in the contract's shape.** The
      blockquote at `later/road-to-release-finding-ordering.md:28-32` becomes a
      `### blocker:` entry with the five required fields, its three options
      carried as the `What to do` choice and the date it was posed kept. The
      blockquote is replaced, not duplicated.
      verify: `grep -c '^### blocker:' agents/roadmaps/later/road-to-release-finding-ordering.md` -> /^[1-9]/

## Phase 4 — A tick over "not met"

- [x] **4.1 A check that refuses the tick.** A lint reports any `- [x] AC-`
      line whose own criterion text contains `NOT met`. A fixture shows it red;
      run over the tree, the archived AC-3 is reported as a hit.
      verify: `npx vitest run tests/scripts/lint_ticked_unmet_criteria.test.ts` -> 0
- [x] **4.2 The pressure that made the tick.** The progress check stops
      counting `[~]` in a file under `archive/` toward the Iron-Law-3 failure
      that `:354-359` describes, so an honest deferral can stand in an
      archived roadmap; the archived AC-3 then becomes `[~]` with a one-line
      dated note.
      verify: `npx vitest run tests/scripts/roadmap_progress_archived_deferral.test.ts` -> 0

      Done 2026-10-07: the `relates:` row this needed was already present on
      `road-to-a-ratification-fence-that-follows-its-imports` (its step 4.2
      landed the back-link); this change flips the archived AC-3 to `[~]`
      with `<!-- deferred-resolution: carried-to=road-to-a-ratification-fence-that-follows-its-imports -->`
      and a dated note. `lint_deferral_integrity` stays at its 243 baseline
      (the new `[~]` is annotated, not counted) and reports "every annotated
      carry resolves"; `lint_ticked_unmet_criteria` no longer lists this AC-3.

      **Measured 2026-10-07 — the progress half needed no change, the flip
      meets a different gate.** `update_roadmap_progress` already excludes
      `archive/` from `collect()`, so an archived `[~]` never reaches
      `pending_iron_law_3`; the pressure `:354-359` records was real while that
      roadmap was active. The verify test now pins it (seen red with
      `archive` removed from the excluded set). Flipping AC-3 to `[~]` today
      reds `lint_deferral_integrity` instead: an archived `[~]` with no
      `deferred-resolution:` annotation is its `unannotated` class, ratcheted
      at 243, and the flip makes 244. The honest form is a carry —
      `carried-to=road-to-a-ratification-fence-that-follows-its-imports`,
      whose step 4.1 is the spawn-path receiver — and a carry needs that file
      to link back. That file belongs to another roadmap; see the blocker.

## Phase 5 — Citations a blocker can trust

- [x] **5.1 Every `path:line` in a blocker resolves.** A lint reads the
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

- [x] AC-1 — One command lists every open blocker under `later/`, split by
      owner-wait and agent-wait.
- [ ] AC-2 — The council's verdict on the `later/` exclusion is recorded, and
      the readers' scope matches it.
- [x] AC-3 — The release-ordering owner question is a `### blocker:` entry
      that `lint_roadmap_blockers` validates when its file is in scope.
- [x] AC-4 — A `[x]` criterion whose text contains `NOT met` is reported.
- [x] AC-5 — A blocker citing a line beyond the end of its file fails the
      citation lint, and the baseline only shrinks.

## Decisions

| ID | ownership | resolved by | decision | evidence | revisit if |
|---|---|---|---|---|---|
| D1 | reversible-technical | evidence | Census before scope | The 40 is a file count; how many wait on the owner is not yet known | — |
| D2 | reversible-technical | agent | 3.1 edits a `later/` file in place rather than un-parking it | Un-parking is the triage command's decision, not this file's | The council picks (b) and the file is carried |
| D3 | reversible-technical | agent | Line citations get a baseline, not a hard fail | Line numbers move with every edit above them; an existing miss is drift, not a new defect | The baseline reaches zero |
| D4 | reversible-technical | agent | The 4.1 and 5.1 lints ship as runnable checks with tests, not wired into `task ci` or a workflow | No step asks for wiring; registering a gate touches `src/config/gate-coverage.yml` and a workflow, which needs a ratification record by a reviewer other than this session | A follow-up asks for either check to block a merge |
| D5 | reversible-technical | evidence | 4.2's progress half needed no code change, only a pinning test | `update_roadmap_progress` excludes `archive/` from `collect()`; the live pressure on the AC-3 flip is `lint_deferral_integrity`'s unannotated ratchet | The progress check starts reading `archive/` |
| D6 | reversible-technical | council:2026-10-08 resolve-blockers-batch | `later-blockers-in-scope` (b′): `lint_roadmap_blockers` validates `later/*-carried.md` and its pinning test flips for that pattern; `/roadmap:resolve-blockers` keeps its scope, so validation never activates a parked question. 2.1 adds a regression test proving the widened lint puts nothing in front of the owner before the roadmap resumes (a seat's condition). | Round 1 (2026-10-07) split (b) vs keep-exclusion; the (b) seat's condition — 7 of 7 carried files lint-clean — was measured true. Round 2 (2026-10-08, input changed: narrowed option (b′) and the owner's delegation of council-decidable questions), anthropic + openai, 2/2 present, both (b′), both "not owner-reserved", $0.00. The first round-2 attempt lost the openai seat to a local transport error (ENOBUFS); one transport retry produced both seats. | carried blockers turn out time-sensitive, so waiting for resumption causes harm — then full (b) |

## Blockers

### blocker: later-blockers-in-scope
- **Status:** resolved 2026-10-08 — option (b′): widen only the `lint_roadmap_blockers` glob to `later/*-carried.md` and flip its pinning test; `/roadmap:resolve-blockers` scope unchanged (council round 2, 2026-10-08, anthropic + openai, 2/2, $0.00, both (b′), owner-reserved: no; D6). Round 1, kept for the record: the council ran 2026-10-07 (anthropic + openai, 2 of 2 present, $0 metered) and SPLIT: (a) rejected by both seats; anthropic for (b) on the condition the seven carried files pass the lint, which was then measured true (7 of 7, 0 hard findings); openai for keeping the exclusion unchanged with report-only observability. A split escalates to the owner. Record: `agents/evidence/analysis/parked-blockers-2026-10-council.md`.
- **Owner:** owner — escalated from council on a split verdict
- **Blocks:** step 2.1, AC-2
- **What to do:** pick exactly one — (b) widen the glob in `src/scripts/lint_roadmap_blockers.ts` to `later/*-carried.md`, flip its pinning test for that pattern, and let `/roadmap:resolve-blockers` follow; (b′) widen only the lint glob and leave `/roadmap:resolve-blockers` scoped as today, so carried files are validated but nothing is put to you before their roadmap resumes; or (c) keep the exclusion unchanged and rely on `report_parked_blockers` for visibility. Option (a) is off the table: both seats rejected it.
- **Resolved when:** the owner's choice is recorded in this entry and the readers' scope matches it, or the owner directs another council round with a stated question.
- **Recommendation:** (b′) — it is the one reading both seats can hold: anthropic's condition for validating the carried files is met, and openai's invariant (validation does not imply activation) is kept because nothing new reaches you.
- **If you do nothing:** the 51 owner-wait entries the census lists stay unasked, the report keeps showing them, and nothing reds.

### blocker: ac3-carry-needs-receiver-backlink
- **Status:** resolved — 2026-10-07. The `relates:` row was already present;
  this change adds the `[~]` flip and the `deferred-resolution:` annotation
  to `agents/roadmaps/archive/road-to-a-kernel-that-guards-its-plumbing.md`'s
  AC-3. `lint_deferral_integrity` confirms the carry resolves and stays at
  its 243 baseline.
- **Owner:** implementer
- **Blocks:** step 4.2
- **What to do:** add a `relates:` row naming `road-to-a-kernel-that-guards-its-plumbing` to `agents/roadmaps/archive/road-to-a-ratification-fence-that-follows-its-imports.md` (its step 4.1 is the receiver), then flip the archived AC-3 to `[~]` with `<!-- deferred-resolution: carried-to=road-to-a-ratification-fence-that-follows-its-imports -->` and a dated one-line note.
- **Resolved when:** the archived AC-3 reads `[~]`, `./scripts-run src/scripts/lint_deferral_integrity` exits 0 at its baseline of 243, and `./scripts-run src/scripts/lint_ticked_unmet_criteria` no longer lists it.
- **Recommendation:** do it in the change that lands that roadmap's step 4.2, which already writes a line under the same AC-3 — one edit to the archived file instead of two racing ones.
- **If you do nothing:** AC-3 stays ticked over its own "NOT met" and stays listed by the 4.1 lint.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-10-06 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | The owner is flooded with parked questions | product | Forty files could become forty questions at once. | Option (a) lists only `Owner:` owner entries; the census sizes it before 2.1. | Phase 2 — Whether parked blockers are in scope |
| 2 | Relaxing the archive deferral check hides a real deferral | implementation | Archived `[~]` stops counting toward a failure. | 4.2 is scoped to `archive/`; active roadmaps keep the Iron-Law-3 check. | Phase 4 — A tick over "not met" |
| 3 | The citation lint is noisy | implementation | Many blockers cite lines that have since moved. | Shrink-only baseline (D3); only `## Blockers` sections are read. | Phase 5 — Citations a blocker can trust |
| 4 | The census misreads an owner field | implementation | `Owner:` values are free text. | The report prints the raw value beside its classification. | Phase 1 — The census |
