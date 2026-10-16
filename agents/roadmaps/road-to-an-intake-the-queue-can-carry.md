---
complexity: structural
status: ready
execution:
  mode: phase-checkpoints
estate_offset_exempt: "Round inbox-2026-10-q measured at 9a943f30c that 28 of 29 active roadmaps carry estate_offset_exempt, 18 have no ticked step, four depends declarations are false, and the dashboard shows no age. No active roadmap owns the intake side of the estate: a grep over agents/roadmaps/{*,later,stubs} for exemption_shape, days since and park proposal returns nothing, and stubs/road-to-estate-triage-remaining-batches owns verdict rows for the existing estate, not what an addition must show. Archiving or parking costs more because the defect is the inflow itself and would keep arriving; merging into the triage stub would put a live inflow fix behind a parked batch plan. Phase 5 folds three active pairs, so this file is net negative once it runs."
relates:
  - slug: stubs/road-to-estate-triage-remaining-batches
    relation: disjoint
    note: "Parked stub. Owns terminal verdict rows for files already in the estate. This file owns what a new file must show before it lands and what age makes visible; it writes no verdict row. Handoff H3 records the arrival on the stub."
  - slug: road-to-a-hook-carrier-that-is-never-silent
    relation: extends
    note: "Active. Handoff H1 offers it one phase for the plugin channel's hooks/hooks.json, which that file does not mention; nothing here edits the carrier."
  - slug: road-to-sentences-the-tree-can-back
    relation: extends
    note: "Active. Handoff H2 offers it three one-sentence items in its own form."
  - slug: road-to-what-was-built-and-never-ran
    relation: extends
    note: "Active. Phase 5 proposes folding it into road-to-local-gates-wired-while-they-are-green; the fold is decided by the council with a burial check, and its Phase 4 withdrawal is carried, not dropped."
---
# Road to an intake the queue can carry

> **Source:** `agents/tmp.old/inbox-2026-10-q/` — one transcript of four owner
> turns and the supplied plans beside it, pinned to `main@9a943f30c`. Verified
> against `main@9a943f30c` on 2026-10-14; every count below was re-derived there.

## Goal

A finding that already has an owner lands as a step and an `Arrivals:` line on
that owner instead of as a new top-level file; an addition that does create a
file shows the owner search it ran; `depends:` says what really waits on what;
and the dashboard shows how long each active file has gone without a ticked
step, so a stalled file reaches a park decision instead of sitting. Done means:
no false `depends:` remains, the estate gate refuses an offset exemption that
quotes no owner search, the dashboard prints two ages per file and a renewable
park proposal, and a re-run of three past inbox rounds lands at most as many new
files as there were findings without an owner.

## Prerequisites

- None. Every phase changes tooling or data this repo already owns.

## Context — read at `main@9a943f30c`

- **The exemption is the rule.** 28 of 29 active roadmaps carry
  `estate_offset_exempt` (`grep -l '^estate_offset_exempt:' agents/roadmaps/road-to-*.md`).
  The shape check asks for a disposition word: its own header calls the
  single word "park" the cheapest string that passes
  (`src/scripts/_lib/exemption_shape.ts:1-15`). An earlier drawdown round ended
  at 32 → 32 active (`agents/roadmaps/archive/road-to-estate-drawdown.md:56-58`),
  and its remaining batches sit in `stubs/road-to-estate-triage-remaining-batches.md`,
  parked since 2026-08-21.
- **Re-arrival is the measured cost.** `road-to-an-installed-layer-that-is-thinned`
  records that its subject "has arrived in at least 22 consumed rounds" in its
  own frontmatter; deduplication happens only after arrival, inside
  `/analyze:inbox`.
- **Four `depends:` declarations are false.**
  `road-to-self-modification-that-a-council-must-pass` carries 13
  `blocked-by: road-to-authority-routing-mechanism#…` markers and no `relates:`
  row for that file. `road-to-an-installed-layer-that-is-thinned` depends on two
  archived files (`road-to-a-rule-carrier-that-works-outside-the-repo`,
  `road-to-rule-laws-that-can-stand`) while its gating criterion now points at
  `road-to-a-setup-that-decides-itself` 5.3 (`:338-343`).
  `road-to-a-hard-floor-the-shell-cannot-talk-past` 4.5 waits on
  `road-to-typed-grants-that-persist` 3.1 (`:264-266`) under `relation:
  extends`, and `road-to-a-danger-gate-that-sees-what-governs` defers to Phase 3
  of `road-to-authority-routing-mechanism` (`:330-335`) under `relation:
  extends`.
- **Nothing shows age.** `src/agent-src/scripts/update_roadmap_progress.ts`
  prints percentages per phase and nothing about days since landing or since
  the last tick; 18 of 29 tracked active files have no ticked step, 23 of them
  landed on or after 2026-10-11, and 552 of 670 checkboxes are open `[ ]`
  (572 unticked once deferred and cancelled are counted).
- **Where a relation rule lives.** `lint_blocker_citations` checks that a
  blocker's `path:line` citations still resolve
  (`src/scripts/lint_blocker_citations.ts:1-24`); whether a declared relation is
  legal is `_check_relates` in `src/scripts/lint_roadmap_complexity.ts:468`.

## Phase 1 — `depends:` says what waits on what

- [x] **1.1 Repair the four false declarations.** Add `relation: depends` on
      `road-to-authority-routing-mechanism` to the self-modification file; drop
      the two archived targets from the installed-layer file and depend on
      `road-to-a-setup-that-decides-itself`; turn the hard-floor and danger-gate
      `extends` rows into `depends` where a step is gated on the other file.
      verify: `grep -c 'road-to-authority-routing-mechanism' agents/roadmaps/road-to-self-modification-that-a-council-must-pass.md` -> /^[1-9]/
      > **Landed 2026-10-16, re-read at `origin/main@fe7a22c6d`.** The 13
      > inline markers in the self-modification file are gone (removed with
      > #2325); its gate on `road-to-authority-routing-mechanism` survives as
      > the Phase 5 note, so the `depends` row is added on that note. The
      > installed-layer file depends on `road-to-a-setup-that-decides-itself`
      > and keeps its two archived predecessors as `extends`. The hard-floor
      > `typed-grants` row is now `depends` (4.5 waits on 3.1). The danger-gate
      > file is archived since #2375, so its row is moot and was not edited.
      > The 1.2 rule found two more archived `depends` rows, both on complete
      > files, and turned them into `extends`:
      > `road-to-skills-that-arrive-when-called`,
      > `road-to-tool-results-that-leave-a-handle`.
- [ ] **1.2 A rule that keeps them true.** *corrected-from-reproduction:* the
      supplied plans put this in `lint_blocker_citations`, which checks
      line-number citations, not relations; the rule belongs to
      `_check_relates`. A `blocked-by: road-to-X#…` marker requires a
      `relates:` row for X with `relation: depends`, and a `depends` row may not
      name a file under `archive/`. Test first: a fixture with the marker and no
      row is red before the change.
      verify: `npx vitest run tests/scripts/lint_roadmap_complexity.test.ts -t blocked-by-needs-depends --reporter=verbose` -> /✓.*blocked-by-needs-depends/
      > **Partly landed 2026-10-16; left open on purpose.** `_check_cross_file_waits`
      > in `lint_roadmap_complexity.ts` fails a `<!-- blocked-by: road-to-X#… -->`
      > marker without a `depends` row for X (seen red first). The archived
      > half reports as a **warning**, not a failure, because one active file —
      > `road-to-a-setup-that-decides-itself`, held by a parallel drain lane
      > this run — still depends on the complete, archived
      > `road-to-a-release-that-reads-its-settings-delta`. Closes when that row
      > becomes `extends` and the `warnings.push` for the archived half turns
      > into `problems.push`.

## Phase 2 — An addition shows the owner search it ran

- [ ] **2.1 The exemption quotes a search.** `exemption_shape.ts` accepts an
      `estate_offset_exempt` reason only when it quotes the owner search it ran —
      the command and its result (for example a grep over
      `agents/roadmaps/{*,later,stubs}` returning nothing for the defect's
      identifiers) — in addition to the disposition words it already requires.
      Existing files are grandfathered by the base-ref comparison the gate
      already uses; only additions are read. The change is a governance diff and
      carries its council ratification artefact.
      verify: `npx vitest run tests/scripts/exemption_shape.test.ts -t quotes-owner-search --reporter=verbose` -> /✓.*quotes-owner-search/
- [ ] **2.2 A finding with an owner lands on the owner.** `/analyze:inbox`
      Phase 5 and `/analyze:roadmap-repos` gain one rule: a verified finding
      whose subject an active, parked or stub roadmap already owns becomes a
      new step and an `Arrivals:` line on that owner; a new file is written only
      when 2.1's search comes back empty, and the search is quoted.
      verify: `grep -c 'Arrivals:' src/domains/analysis-workbench/analyze/roadmap-repos/command.md` -> /^[1-9]/

## Phase 3 — Age is visible, and a stall reaches a decision

- [x] **3.1 Two ages per file.** The dashboard prints, per active roadmap, days
      since the file landed and days since its last ticked step, both read from
      `git log`, never from a field an author writes.
      verify: `npx vitest run tests/scripts/update_roadmap_progress.test.ts -t prints-two-ages --reporter=verbose` -> /✓.*prints-two-ages/
- [x] **3.2 A stall is a proposal, never an action.** A file with no ticked step
      21 days after landing is listed as a park proposal; one line
      `renewed: <date> — <reason>` in its frontmatter clears the proposal for 21
      more days. Nothing is moved, archived or deleted by the tool.
      verify: `npx vitest run tests/scripts/update_roadmap_progress.test.ts -t park-proposal-renewable --reporter=verbose` -> /✓.*park-proposal-renewable/
      > **Landed 2026-10-16.** `src/agent-src/scripts/roadmap_age.ts` reads one
      > `git log -U0 -p --no-renames` over the active files: landing is the
      > newest add at the current path (a promotion from `later/` lands anew),
      > a tick is a commit adding more `[x]` lines than it removes. No git, or
      > a path git does not know, reads `—` and is never proposed. The key is
      > documented in `templates/roadmaps.md` rule 18.

## Phase 4 — A digest an outside session reads first

- [ ] **4.1 One generated, tracked digest.** `agents/roadmaps/OWNED.md`, one row
      per active and parked roadmap: slug, the owned defect in at most 20 words,
      status, and the paths it cites most. Generated, drift-checked, at most
      4,000 tokens, no external source names.
      verify: `./scripts-run src/scripts/generate_owned_digest --check` -> 0
- [ ] **4.2 The intake reads it before deep work.** `/analyze:inbox` Phase 2
      consults the digest for the `recurrence` column before the Phase 4c grep,
      so a re-arrived subject is visible in the triage table at the first look.
      verify: `grep -c 'OWNED.md' src/domains/analysis-workbench/analyze/inbox/command.md` -> /^[1-9]/

## Phase 5 — Three folds, each decided with a burial check

- [ ] **5.1 Put the three pairs to the council.**
      `road-to-an-installed-layer-that-is-thinned` →
      `road-to-a-setup-that-decides-itself` (its criterion already points
      there); `road-to-what-was-built-and-never-ran` →
      `road-to-local-gates-wired-while-they-are-green` (both own written gates
      that do not run where a PR is decided); `road-to-svg-witness-provenance` →
      `road-to-type-with-a-witness` (same witness mechanism). One batched
      question; each verdict is recorded with its dissent at the pair.
      verify: `ls agents/evidence/council/ | grep -c 'intake-folds'` -> /^[1-9]/
- [ ] **5.2 Fold what the council approves, losing nothing.** Each approved
      fold moves every open step into the target, archives the source with a
      pointer, and passes the burial check: open checkboxes before equal open
      checkboxes after, across both files.
      verify: `./scripts-run src/scripts/check_estate_count` -> 0

## Phase 6 — Read the effect once

- [ ] **6.1 Replay three past rounds.** Re-run the triage half of
      `/analyze:inbox` over the three most recent consumed rounds in
      `agents/tmp.old/` as a dry run and count new top-level files against
      findings without an owner. A report, not a gate.
      verify: `grep -c 'owner-less findings' agents/evidence/analysis/intake-replay-*.md` -> /^[1-9]/
- [ ] **6.2 Four weeks after Phase 2 lands,** record new top-level files per
      inbox round and the share of findings that landed as arrivals, beside the
      dashboard ages from Phase 3.
      verify: `grep -c 'arrival share' agents/evidence/analysis/intake-replay-*.md` -> /^[1-9]/

## Handoffs — found here, owned elsewhere

- **H1 → `road-to-a-hook-carrier-that-is-never-silent`, one new phase.** The
  plugin channel's `hooks/hooks.json` (tracked) registers ten events including
  `PreToolUse`; all ten commands end in `|| exit 0`, `${CLAUDE_PLUGIN_ROOT}`
  appears nowhere in `src/`, `docs/`, `hooks/` or `agents/roadmaps/`, and
  `dist/hooks/` is not tracked (`git ls-files dist` → `agent-src`, `install`,
  `router.json`). A plugin-only install therefore reaches no dispatcher and
  runs no hook, the three `fail_closed` guards included, while
  `.claude-plugin/marketplace.json:8` says existing installs "keep working
  hooks". That file mentions neither "plugin" nor "marketplace". The phase:
  try the plugin root first, make the no-dispatcher branch visible (stderr and
  a non-blocking exit, one session-start context line), keep blocking opt-in
  only, and reword the marketplace sentence. Which source ships a dispatcher
  inside the plugin was decided by the owner on 2026-10-14: none — the plugin
  stays dispatcher-less and says so. Landed as Phase 5 and D4 of that roadmap.
- **H2 → `road-to-sentences-the-tree-can-back`, three one-sentence items.**
  `src/scripts/check_kernel_edit_ratified.ts:156-158` calls `hooks/hooks.json`
  a build output that exists "only inside an installed consumer tree", but it is
  tracked at the repository root; the marketplace sentence above; and
  `src/config/preamble-payload-budget.json`, whose `revisit_if` (`:68`) has
  fired — ADR-227 resolved paths-scoping against itself, removing the only
  mechanism named for the 85k milestone (`:59`) — while the file cites ADR-227
  zero times. The item cites ADR-227 and marks the 85k milestone as without a
  mechanism; it records no miss for 2026-11-10 before that date, per the
  council's 2026-08-24 hold decision recorded in the same file (`:117`).
- **H3 → `stubs/road-to-estate-triage-remaining-batches` (Arrivals line).**
  Estate growth arrived again; the stub's verdict-row work is unchanged.

## Decisions

| ID | ownership | resolved by | decision | evidence | revisit if |
|---|---|---|---|---|---|
| D1 | reversible-technical | evidence | No numeric cap on active roadmaps and no automatic archive | A target was tried and ended 32 → 32 (`archive/road-to-estate-drawdown.md:56-58`); burial is the named risk of a number | the age signal of Phase 3 is ignored for two cycles |
| D2 | reversible-technical | evidence | The fourth fold the plans proposed (danger-gate into authority-routing Phase 3) is not proposed | The danger-gate file's own exemption records that merge as rejected: authority-routing Phases 2–3 are held by an owner blocker none of its steps needs | that owner blocker resolves |
| D3 | reversible-technical | evidence | The relation rule lives in `_check_relates`, not `lint_blocker_citations` | `lint_blocker_citations.ts:1-24` checks citation line numbers; `lint_roadmap_complexity.ts:468` checks relations | — |
| D4 | reversible-technical | agent | Park proposals are listed, never executed; 21 days; renewal is one line | Dropping or parking an item is a user disposition (`roadmap-progress-sync`); a listing costs nothing | proposals are renewed by reflex without a reason |
| D5 | reversible-technical | agent | No generated `touches:` hotspot field | No collision count was measured; `/roadmap:next` already screens worktrees held by a foreign branch | a measured merge-conflict rate between parallel drains |
| D6 | reversible-technical | agent | The digest budget is 4,000 tokens | One row per file at ≤ 20 words fits 130 files in that budget | the digest is truncated or unread in Phase 6 |
| D7 | reversible-technical | evidence | The 85k milestone is marked as without a mechanism now; no miss is recorded for 2026-11-10 before that date | The council's 2026-08-24 hold decision (`preamble-payload-budget.json:117`) keeps the date falsifiable and forbids recording a miss early; the fired `revisit_if` (`:68`) concerns the 85k mechanism, not the date | the 2026-11-10 measurement lands |
| D8 | reversible-technical | evidence | Verify lines naming a test this step writes stay as written | `closure_scan` lists them as `unfalsifiable-verify` because the test does not exist yet; each step writes it first, and the listing is non-blocking (`closure_scan.ts:41`) | a step lands without its named test |

## What this roadmap deliberately does not do

- **K1** Delete, archive or park any roadmap by tool.
- **K2** Add a verb or a scheduled workflow (ADR-041, ADR-118).
- **K3** Commit `dist/hooks` to git or block a session when no dispatcher is
  found by default — a blocking `PreToolUse` without a carrier blocks every tool
  call.
- **K4** Gate the payload budget on a date (ADR-274) or treat paths-scoping as a
  lever (ADR-227).
- **K5** Migrate roadmap ledgers from Markdown to JSON.
- **K6** Re-plan anything the hook-carrier or sentences roadmaps already own;
  H1 and H2 are offers in their form.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-10-14 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | The owner-search quote becomes boilerplate | product | Authors paste an empty grep that never searched the defect's identifiers. | 2.1 checks the quote names the command and its result; Phase 6 reads whether arrivals rose. | Phase 2 — An addition shows the owner search it ran |
| 2 | A fold buries open steps | implementation | Moving steps between files drops one. | 5.2's burial check compares open checkboxes before and after; the council decides each pair. | Phase 5 — Three folds, each decided with a burial check |
| 3 | Park proposals are read as orders | product | A listed file is parked without a decision. | Proposals are text only; K1; renewal is one line. | Phase 3 — Age is visible, and a stall reaches a decision |
| 4 | The digest goes stale or grows past its budget | implementation | A generated file drifts from the tree. | `--check` drift mode; budget asserted by the generator. | Phase 4 — A digest an outside session reads first |
| 5 | Tightening the exemption reds a legitimate addition | implementation | A file with a real reason but no quoted search is refused. | Only additions are read; the message names the expected shape. | Phase 2 — An addition shows the owner search it ran |

## Acceptance Criteria

- [ ] **AC-1** No `relates:` row names a file under `archive/` as `depends`, and
      every cross-file `blocked-by:` marker has a matching `depends` row.
- [ ] **AC-2** The estate gate refuses an added `estate_offset_exempt` that
      quotes no owner search, and accepts one that does.
- [ ] **AC-3** The dashboard shows two ages per active roadmap, read from git,
      and lists every file with no ticked step after 21 days unless renewed.
- [ ] **AC-4** No roadmap is moved, archived or deleted by any tool this file
      adds.
- [ ] **AC-5** Every fold that landed kept its open-step count, and each
      council verdict is recorded at its pair.
- [ ] **AC-6** A replay of three past rounds lands no more new top-level files
      than findings without an owner.

## Notes — how this file was derived

The owner's first turn asked for an analysis of the current state and three
challenge loops; one parallel session answered with a tree audit, and two later
consolidations carried it as their second track. This file takes that track's
intake half. Changes against the supplied plan, each found by reproduction:

- **Corrected:** the relation rule's home (D3); the fourth fold (D2); the
  milestone step that would have recorded a miss before its date
  against the council's recorded hold (H2).
- **Moved to owners:** the plugin channel (H1) and three sentences (H2),
  because the hook-carrier and sentences roadmaps own those subjects.
- **Declined:** a hotspot field (D5); the two-reviewers-per-release observation,
  which names no defect.
