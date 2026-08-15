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
- **1.2's verify hook cannot be satisfied as written.** `grep -c
  'lint_scheduled_deprecations' Taskfile.yml` returns 0 for a conventionally
  named task: every sibling gate is defined in `taskfiles/ci-fast.yml` and
  referenced from `Taskfile.yml` by its hyphenated task name. Satisfying the
  literal would have meant naming the task with underscores, breaking the
  convention to please a grep. Registered the sibling way instead — definition
  in `taskfiles/ci-fast.yml`, `ci:` entry in `Taskfile.yml` (with the script
  name in a comment beside it), and a step in `consistency.yml`, because a gate
  registered only in the `ci:` list has zero remote reach.
- **1.2's "a release gets the refusal" needed a caller, or it was a claim.**
  `--release-major` with nothing invoking it is the defined-but-not-wired shape.
  It is called from `release.ts` at the point the target version resolves —
  covering the forced `--as major`, an explicit `--version`, and auto-detection
  from a `feat!:` commit alike — rather than from `task release:major`, which
  is only one of those three paths. **Consequence worth stating plainly: the
  next major cut is now blocked until the blocker below is answered**, which is
  the gate working as specified, not a side effect. The trigger is the target's
  `X.0.0` shape rather than target-vs-current, which also covers `--resume` —
  a fourth path where the two are equal and any comparison silently passes.

Three things this roadmap knowingly leaves open, none of them fixed here:

- **A standing ⚠️ nobody but the maintainer can clear.** While `code_graph` is
  overdue the gate prints its warning on every branch and every CI run. A
  notice that cannot be cleared is the same habituation mechanism that made the
  runbook checkbox fail, so it is bounded rather than waved through: the row is
  a hard refusal at the next major cut, which habituation does not survive.
- **The dashboard's "pending archival" criterion ignores blockers; the sweep
  does not.** So `agents/roadmaps-progress.md` prints an
  `archive_completed_roadmaps --all` instruction for this roadmap that cannot
  succeed while its blocker is open. That is a generator-side inconsistency
  older than this branch and is not repaired here.
- **The regenerated dashboard corrects a stale base, and the delta is not this
  roadmap's.** `-c-release-head-truth` moves 10 open / 0 done → 1 open / 9
  done. Verified rather than assumed: on `origin/main` the dashboard says 10
  open / 0 done while that roadmap's own file at the same commit has 0 open and
  7 done — the base was stale, and the mandated regeneration corrects it.

## Acceptance criteria

- [x] An overdue scheduled deprecation is reported by a check, not by a reader.
- [x] The check has a by-construction-overdue fixture, so green means it ran.
- [x] The code-graph row records that its commitment was missed and by how much.
- [x] `telegraph` is either scheduled or documented as a keep.
- [x] No public surface is removed by this roadmap.

## Blockers

### blocker: code-graph-removal-authorisation

- **Status:** open
- **Owner:** user
- **Blocks:** nothing in this roadmap — recorded so the overdue surface has an
  owner rather than only a report
- **Question:** the code-graph removal is one major overdue against a recorded
  honest null. Does it execute at the next major cut, or does the commitment
  change?
- **Recommendation:** (a), authorise the removal at the next major cut. The
  measurement behind it is closed and one-sided — `docs/CLAIMS.md`
  `code-graph-retrieval-null`, recall 0.365 against disciplined grep's 0.797 —
  the engine has shipped `enabled: false` as permanent since, and its parser
  pair already left `dependencies`, so (b) would be re-committing to a surface
  nothing consumes and nothing measures favourably.
- **If you do nothing:** the next major cut is **refused** by
  `lint_scheduled_deprecations --cutting`, so this is one of the few blockers
  that is not cheap to leave open. Minor and patch releases are unaffected;
  ~112 K of dormant runtime paths keep shipping inert in the meantime.
- **What to do:** pick exactly one.
  1. **(a) Authorise the removal.** Say so here (`Status: resolved`, decision
     recorded), then execute it in its OWN change at the next major:
     `git rm -r src/scripts/code_graph/ src/scripts/hooks/code_graph_nudge_hook.ts`,
     drop the `code-graph-nudge` entries from `src/scripts/hook_manifest.yaml`
     (`:180-181`, `:625`, `:633`, `:677`) together with the test that pins that
     list (`:192`), retire the `code-intelligence` skill's native arm, and move
     the row out of § Scheduled deprecations into a shipped-change section of
     `docs/MIGRATION.md`. Expected outcome:
     `./scripts-run src/scripts/lint_scheduled_deprecations --cutting <X.0.0>`
     exits 0.
  2. **(b) Revise the commitment.** Edit the `code_graph` row's `Removal due`
     cell in `docs/MIGRATION.md` to `**not pinned here**` (the form the
     `compatibility` and `telegraph-speak` rows already use) and state in the
     § Row status section why the engine stays despite the recorded null.
     Expected outcome: the same command exits 0, and the ⚠️ on every branch run
     stops.
- **Resolved when:** this entry reads `Status: resolved` with (a) or (b) named,
  AND `./scripts-run src/scripts/lint_scheduled_deprecations --cutting 13.0.0`
  exits 0.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-08-15 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | The check blocks a release on a surface the maintainer meant to keep | product | An overdue row can be a deliberate deferral rather than a slip, and a hard refusal at a major cut turns a judgement into an outage | 2.2 makes "documented keep" a first-class tracked state, so a deliberate deferral is expressible in the table the check reads rather than only in someone's memory | Phase 2 — Give the two loose surfaces a tracked state |
| 2 | The check ships green because it parses nothing | implementation | A table-parsing gate over a table whose format drifts silently reports success while scanning zero rows | 1.3 requires a by-construction-overdue fixture, so a green run proves the arithmetic executed rather than that the parse returned empty | Phase 1 — Make the dates checkable |
| 3 | Recording the slip reads as authorisation to remove | implementation | A row that says "overdue, owner named" is one step from being actioned by a later run that skips the release window | The removal is a blocker with a named owner and is explicitly excluded from the steps, and the scope section states the two rules that gate it | What is deliberately not executed here |
