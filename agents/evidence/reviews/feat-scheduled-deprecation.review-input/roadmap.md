<!-- check-refs: skip -->
<!-- verbatim roadmap snapshot for the R2 reviewer; the live roadmap layer is excluded from check_references, and a snapshot must not fail a gate its source is exempt from -->
---
complexity: lightweight
status: ready
---

# Road to a deprecation table that cannot miss its own dates

**Goal.** The scheduled-deprecations table stops depending on somebody
remembering to read it: its due versions get checked by arithmetic against the
shipped version, and the one entry that already slipped past its own commitment
gets an owner instead of a note.

**Source:** a proposal roadmap that arrived in the inbox, pinned at `e44e87865`,
archived local-only at `agents/tmp.old/context-custodian/`. Triage, claim
verification, and the arithmetic correction:
`agents/evidence/analysis/inbox-harvest-2026-08-d-triage.md`.

## Context

Re-verified against the tree at `e3bd96158`.

- **The table's own largest entry slipped past its commitment.**
  `docs/MIGRATION.md:20` commits the code-graph removal to the major after the
  next one after 9.x — which resolves to **11.0**. `package.json:4` reads
  **12.0.0**. The removal is therefore **one major overdue**. The proposal's
  headline said two; its own body said one, and one is correct. The corrected
  figure is used throughout here.
- **The runtime paths still ship.** `src/scripts/code_graph/` holds 11 files,
  roughly 112 K on disk, and `code-graph-nudge` remains bound in
  `src/scripts/hook_manifest.yaml:180-181` (with further bindings at `:625`,
  `:633` and `:677`). A test pins the manifest list against the hook
  (`hook_manifest.yaml:192`), so removal is a coordinated change, not a delete.
- **The verdict behind the removal is recorded and unambiguous.**
  `docs/CLAIMS.md:387` carries `code-graph-retrieval-null`: recall 0.365 against
  disciplined grep's 0.797, a 43.2-point deficit, engine permanently disabled.
- **Nothing machine-checks the table.** A sweep of all 128 `src/scripts/lint_*`
  entries finds none that parses the scheduled-deprecation table or compares a
  due version against `package.json`. The row existed, was correct, and was
  missed anyway — so the defect is the absence of a check, not the absence of a
  row.
- **One dormant surface has a verdict and no row.** `telegraph` ships with
  `speak` defaulting false (`src/scripts/_lib/compile_time_toggles.ts:56-57`)
  after missing its kill criterion by 9.27 % against the terse baseline. It has
  **no entry in `docs/MIGRATION.md`** at all, so its dormancy is untracked in
  either direction — neither scheduled for removal nor recorded as a permanent
  keep.

## What is deliberately not executed here

**The code-graph removal itself.** Deleting a CLI leaf, a skill arm and a rule
route is a public-surface change: `downstream-changes` requires the user's word
before removing a public surface, and `scope-control` gates it independently.
It also lands at a major cut, not on an ordinary branch. It is carried as a
blocker below rather than as a step, so that the check in Phase 1 — which is the
actual defect-fix — is not held hostage to a release window.

## Phase 1 — Make the dates checkable

- [x] 1.1 Add `lint_scheduled_deprecations`: parse the `docs/MIGRATION.md`
      table, resolve each due version to a concrete number, and compare against
      the version in `package.json`. An overdue surface that still has runtime
      paths is reported by name, with the paths.
      <!-- verify: test -f src/scripts/lint_scheduled_deprecations.ts -->
- [x] 1.2 Register the check so it runs where it can be seen, and have it exit
      non-zero on an overdue surface only at a major cut — an ordinary branch
      gets the report, a release gets the refusal.
      <!-- verify: grep -c 'lint_scheduled_deprecations' Taskfile.yml -->
- [x] 1.3 Give the check a fixture that is overdue by construction, so a green
      run means the arithmetic ran rather than that the table was empty. A gate
      that scans nothing exits green, and that is the failure mode this whole
      roadmap is about.
      <!-- verify: grep -rc 'overdue' tests/scripts/lint_scheduled_deprecations.test.ts -->

## Phase 2 — Give the two loose surfaces a tracked state

- [x] 2.1 Add the code-graph row's current status to the table: overdue by one
      major, with the removal owner named. The row already exists; what it lacks
      is the fact that it was missed.
      <!-- verify: git show HEAD:docs/MIGRATION.md | grep -c 'code_graph' -->
- [x] 2.2 Give `telegraph` a tracked state — either a removal row with a due
      version, or a documented permanent-keep with the reason. Untracked
      dormancy is the one outcome this step removes.
      <!-- verify: grep -ci 'telegraph' docs/MIGRATION.md -->

## Execution notes (2026-08-15)

**The R2 completion review returned 11 findings (2 high, 3 medium, 6 low) and
one of them was a construction defect this implementation had shipped.** It is
recorded here because the fix changed the gate's central comparison, not a
detail: the overdue test measured the due major against the **shipped**
version, so at the cut to N — where `package.json` still reads N-1 — a row
committed to N resolved as one major *early* and passed. The refusal could
therefore only ever fire on a row that was already a major late, which is
exactly the `code_graph` lateness this roadmap exists to prevent; the gate
would have reproduced its own subject. Neither the fixture nor the self-test
covered `due == target`, which is why it survived to review. The comparand is
now the TARGET, passed in via `--cutting <X.Y.Z>`, and the case is pinned at
both layers — a mutation back to the shipped-major semantics fails one unit
test and one self-test case.

Three departures from the text as written, recorded rather than taken quietly.

- **2.2 took a third shape the step did not offer, and the reason is a record
  that already existed.** The step said "either a removal row with a due
  version, or a documented permanent-keep". ADR `telegraph/0002` § Decision
  part 3 is titled *"Deletion — AUTHORIZED IN PRINCIPLE, NOT EXECUTED"* and
  names its own pre-condition (a `prose_only` bench, ~$0.80). So a due version
  would invent a commitment that ADR declined to make, and a permanent keep
  would contradict its authorisation. The row therefore uses the **not-pinned**
  form the `compatibility` row already carries — a tracked state with a
  maintainer-owned date, which the gate resolves as tracked rather than as
  overdue or as a parse failure. Untracked dormancy, which is what the step
  exists to remove, is gone either way.
- **1.2's verify hook could not be satisfied by the obvious route, and the
  workaround happens to satisfy it anyway.** `grep -c
  'lint_scheduled_deprecations' Taskfile.yml` returns 0 for a conventionally
  named task: every sibling gate is defined in `taskfiles/ci-fast.yml` and
  referenced from `Taskfile.yml` by its hyphenated task name. Satisfying the
  literal would have meant naming the task with underscores, breaking the
  convention to please a grep. Registered the sibling way instead — definition
  in `taskfiles/ci-fast.yml`, `ci:` entry in `Taskfile.yml` (with the script
  name in a comment beside it), and a step in `consistency.yml`, because a gate
  registered only in the `ci:` list has zero remote reach. **The comment carries
  the literal, so the hook does return non-zero** — recorded as a coincidence
  rather than a satisfaction: a grep that passes because of a comment is
  measuring the comment, and the next reader should know the hook does not
  actually check registration.
- **1.2's "a release gets the refusal" needed a caller, or it was a claim.**
  `--release-major` with nothing invoking it is the defined-but-not-wired shape.
  It is called from `release.ts` at the point the target version resolves —
  covering the forced `--as major`, an explicit `--version`, and auto-detection
  from a `feat!:` commit alike — rather than from `task release:major`, which
  is only one of those three paths. **The consequence this note used to state —
  "the next major cut is now blocked" — is no longer true, and the reason is the
  best possible one:** while this branch was in review the maintainer answered
  the blocker below and withdrew the `code_graph` commitment with its reason
  recorded, so nothing is overdue and nothing refuses a cut. The gate went from
  reporting a real miss to reporting none, which is what a closed commitment
  looks like. It also grew a third tracked state in the same breath — a
  withdrawn commitment — because the table gained that shape the day after the
  gate shipped, and a gate that forces the table into its own grammar has the
  dependency backwards. The trigger is the target's
  `X.0.0` shape rather than target-vs-current, which also covers `--resume` —
  a fourth path where the two are equal and any comparison silently passes.

Three things this roadmap knowingly leaves open, none of them fixed here:

- **A standing ⚠️ nobody but the maintainer can clear — no longer live, kept
  because the shape recurs.** While `code_graph` was overdue the gate printed
  its warning on every branch and CI run, and a notice nobody can clear is the
  same habituation mechanism that made the runbook checkbox fail. The
  maintainer's withdrawal cleared it, so the tree is quiet today. The bound
  stays worth stating for the next overdue row: the warning is backed by a hard
  refusal at the cut, which habituation does not survive.
- **The dashboard's "pending archival" criterion ignores blockers; the sweep
  does not — no longer obstructing here, kept because the shape recurs.** With
  the blocker now `Status: resolved` on the trunk, this roadmap is genuinely
  archivable and the printed instruction does succeed. The inconsistency itself
  is unrepaired: So `agents/roadmaps-progress.md` prints an
  `archive_completed_roadmaps --all` instruction for this roadmap that cannot
  succeed while its blocker is open. That is a generator-side inconsistency
  older than this branch and is not repaired here.
- **A `-c-release-head-truth` delta was recorded here and no longer exists —
  corrected rather than left standing.** The first regeneration on this branch
  did move that roadmap from 10 open / 0 done, because the dashboard committed
  on `origin/main` was stale against that roadmap's own file at the same
  commit. Then `main` moved: it closed and **archived** `-c-release-head-truth`
  outright, and the merge brought that in, so the roadmap is absent from the
  dashboard entirely and the delta this note claimed to have verified is not in
  the shipped diff. What the diff now carries is one changed open-roadmaps row
  — this roadmap's — and an Overall move of **+9** over an unchanged
  denominator — not the 10 an earlier draft of this bullet asserted, because
  the base row already read 9 open / 1 done rather than 10 / 0. Corrected
  because a paragraph whose subject is an outlived claim cannot carry an
  unchecked number of its own. The original reading was true when written and stopped
  being true at the merge; a "verified" claim that outlives its evidence is
  worse than no claim, which is why it is rewritten instead of deleted.

## Acceptance criteria

- [x] An overdue scheduled deprecation is reported by a check, not by a reader.
- [x] The check has a by-construction-overdue fixture, so green means it ran.
- [x] The code-graph row records that its commitment was missed and by how much.
- [x] `telegraph` has a tracked state. **Criterion reworded from "either scheduled or documented as a keep":** the implementation took a third state — a not-pinned row — and argued why under 2.2 in the execution notes, so leaving the original text would have ticked a box asserting an outcome the change explicitly declined to produce. Untracked dormancy, which is what the criterion existed to remove, is gone.
- [x] No public surface is removed by this roadmap.

## Blockers

### blocker: code-graph-removal-authorisation

- **Status:** resolved

- **Resolution:** 2026-08-15 — option (b), commitment revised. The
  maintainer took the measured framing: the payload this deprecation existed
  for (the ~51 MB parser pair) already shipped to `devDependencies`, so source
  removal frees 0.4 % while costing a breaking change across four
  consumer-visible surfaces plus a Rung-0 re-plumb. `docs/MIGRATION.md` now
  carries the withdrawal **with its reason**, and the row stays in the table
  rather than being deleted — a recorded withdrawal is not the folklore this
  table exists to prevent; an unrecorded one would be. New commitment: removal
  on a concrete reason, not on a date.
- **Owner:** user
- **Blocks:** nothing in this roadmap — recorded so the overdue surface has an
  owner rather than only a report
- **Question:** the code-graph removal is one major overdue against a recorded
  honest null. Does it execute at the next major cut, or does the commitment
  change? **The blast radius is now measured, and it reframes the choice:**
  - **The payload this deprecation was about has already shipped.** The ~51 MB
    `web-tree-sitter` / `tree-sitter-wasms` pair moved to `devDependencies`
    ahead of schedule, so no consumer install carries it today. What removal
    would still free is 112 K of source against a 27 M tree — 0.4 %.
  - **It is a breaking change.** Consumer-visible surfaces: the
    `agent-config code-graph <verb>` CLI, the `code-intelligence` skill
    (`official` in the catalogue), the `external-code-graph-interop` rule, and
    the `hooks.code_graph.enabled` settings key.
  - **One surface is not deletable, it is re-plumbing.** `auto_dispatch.ts`
    routes the `definition` / `references` lookup classes to
    `primitive: 'code-graph-query'`, and `judgment_ladder.ts` calls that live at
    Rung 0. Removing the engine without touching it leaves Rung 0 pointing at a
    primitive that resolves to nothing.
  - **There is no cheap middle.** `detect.ts` handles the `consumer` / `scip` /
    `native` source kinds in one type union, so stripping "just the native
    engine" while keeping consumer-index interop is a redesign, not a deletion.
  So the honest framing is **"keep a stated promise" versus "this particular
  removal buys nothing measurable"** — not "ship a meaningful cleanup".
- **What to do:** pick exactly one — (a) authorise the removal at the next major
  cut, accepting the re-plumbing of Rung 0 and the four consumer surfaces as
  part of it; (b) revise the table's commitment for this surface, recording that
  the dependency-weight win already landed and the source removal is a rounding
  error; or (c) split it — retire the consumer-visible surfaces (CLI verb,
  skill, rule, settings key) at the next major and keep the internals until a
  reason to delete them appears.
- **Resolved when:** the user states which of (a), (b) or (c) holds.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-08-15 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | The check blocks a release on a surface the maintainer meant to keep | product | An overdue row can be a deliberate deferral rather than a slip, and a hard refusal at a major cut turns a judgement into an outage | 2.2 makes "documented keep" a first-class tracked state, so a deliberate deferral is expressible in the table the check reads rather than only in someone's memory | Phase 2 — Give the two loose surfaces a tracked state |
| 2 | The check ships green because it parses nothing | implementation | A table-parsing gate over a table whose format drifts silently reports success while scanning zero rows | 1.3 requires a by-construction-overdue fixture, so a green run proves the arithmetic executed rather than that the parse returned empty | Phase 1 — Make the dates checkable |
| 3 | Recording the slip reads as authorisation to remove | implementation | A row that says "overdue, owner named" is one step from being actioned by a later run that skips the release window | The removal is a blocker with a named owner and is explicitly excluded from the steps, and the scope section states the two rules that gate it | What is deliberately not executed here |
