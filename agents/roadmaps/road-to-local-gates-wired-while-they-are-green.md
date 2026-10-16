---
complexity: lightweight
status: ready
execution:
  mode: phase-checkpoints
estate_offset_exempt: "Continues archive/road-to-gates-a-pull-request-can-hear, which is closed; reopening it would make its closed acceptance criteria read open. The 2026-08-13 decision in docs/contracts/ci-green-floor.md left the batch drain explicitly open and no active or parked roadmap carries it. Adds no gate and raises no baseline; every batch lowers one."
relates:
  - slug: road-to-gates-a-pull-request-can-hear
    relation: extends
    note: "Archived. Moved five named gates to where a pull request is decided. This does the same for the local-only gates that are green today, in the batches the 2026-08-13 decision left open, from a complete reading instead of a sample."
  - slug: road-to-kernel-clause-1-restore
    relation: disjoint
    note: "Stub. Owns the kernel edit only the owner may make, which keeps `check_rule_invariants` red. Nothing here edits a kernel rule, its golden, or the guard that protects them."
  - slug: road-to-trigger-eval-freshness-has-no-writer
    relation: disjoint
    note: "Parked. Owns why `check_trigger_evals` reads a field nothing writes. That gate is red for that reason and is not wired here."
  - slug: road-to-a-trunk-whose-own-gates-are-green-carried
    relation: disjoint
    note: "Parked on the owner's call about one user-type value, which keeps `audit_user_type_axis` red. Not touched here."
---
# Road to local gates wired while they are green

> **Source:** `agents/tmp.old/inbox-2026-10-k/` — an external harvest round
> that ran every gate the parity checker lists as undeclared local-only once,
> serially, with its task's arguments, in a fresh checkout at `f76e83e47`, and
> re-ran the red rows in a second pass. Re-read on `main` @ `d41121927` on
> 2026-10-11: the parity count, the eleven unowned reds and the owner column
> were checked again; the 139 green readings were not re-run. Class: external
> harvest proposal, verified against this tree.

## Goal

The local-only gates that pass today run where a pull request is decided, so
they cannot turn red unheard. They are wired in small batches, never while
red and never if their verdict depends on the calendar, and each batch lowers
the parity ratchet. The reds that no live file owns are fixed one at a time
and wired with their fix. The reds that already have a live owner are listed
with it and left alone.

## Context

- The standing decision. `docs/contracts/ci-green-floor.md` § The local-only
  backlog — decided 2026-08-13 (`:228`) accepts the backlog with a shrink-only
  ratchet and keeps one path open: "wiring ten or twenty gates a change, each
  red fixed as it appears, is a legitimate way to shrink the ratchet … What is
  declined here is the *sweep*, not the drain" (`:262-266`). A declaration
  under `local_only:` is legitimate only with a structural reason of the shape
  the existing two establish, "never by growing the declaration list to move a
  number" (`:270-274`).
- The ratchet has not moved since the round's reading. On `d41121927`
  `check_ci_local_parity` reports `ci-parity:local-only: 163 violation(s),
  baseline 165`, the same pair the round recorded at `f76e83e47`.
- The round's complete reading: of the 163, 161 have a task command; **139
  exit 0, 22 non-zero**, one of them (`probe_projection_fidelity`) only because
  a fresh checkout has no generated tool directories — 21 of 161, 13 %, the
  sample's rate with names. Serial wall time for the 139 was 279 s, one gate
  (`audit_command_surface`) 138 s of it; the 131 fastest take 116 s together
  against ~225 s of recorded headroom (`ci-green-floor.md:247`).
- Re-read on `d41121927`, the twenty-one reds split three ways.
  - **One is now green**: `check_trigger_eval_presence` exits 0 (the round
    recorded four grandfathered skills). The round's step for it is dropped as
    already fixed.
  - **Ten red with no live owner**, each re-run here and still red:
    `check_public_links`, `generate_ownership_matrix --check`,
    `check_augment_description_cap`, `check_token_quality_golden`,
    `lint_subagent_determinism`, `generate_cookbook --check`,
    `generate_role_experiences_catalog --check`, `check_council_layout`,
    `lint_readme_jargon`, `lint_readme_serial_comma`. **Corrected from
    reproduction:** `check_knowledge_cards` joins them — the round listed
    `road-to-parked-blockers-that-get-asked` as its owner, and that roadmap is
    now archived with the gate still red, so eleven have no live owner.
  - **Owned elsewhere, left alone**: `check_trigger_evals`
    (`later/road-to-trigger-eval-freshness-has-no-writer`),
    `lint_eval_freshness` (`road-to-corpus-refresh-cadence-shape`),
    `lint_rule_enforcement_declaration`
    (`later/road-to-rule-triggers-and-links-that-hold`),
    `check_gate_completeness` (`stubs/road-to-the-ledger-ratchet-that-drifted`),
    `check_rule_invariants` (`stubs/road-to-kernel-clause-1-restore`),
    `audit_user_type_axis` (`later/road-to-a-trunk-whose-own-gates-are-green-carried`),
    `lint_agents_layout` (`stubs/road-to-agents-layout-memory-quarantine`),
    and the two roadmap-shape lints whose finding sits in a named active
    roadmap.
- Some green gates must not join a required job. At least six print an
  `as-of:` line and read the wall clock (`check_knowledge_pages`,
  `check_reach_staleness`, `check_trigger_evals`, `lint_hook_manifest`,
  `lint_one_off_age`, `lint_symptom_intake`), and every gate that calls
  `checkRatchet` turns red when its baseline has not moved for
  `STALE_AFTER_DAYS = 56` (`src/scripts/_lib/gate_baseline.ts:41`). Others read
  the developer's branch (`sync_pr_branch`, `check_branch_freshness`).
- One gate the coverage file marks `enforced` has no caller at all:
  `check_council_pin_staleness` (`src/config/gate-coverage.yml:1041-1045`)
  appears in no task and no workflow, and the three dated council pins it
  would read age past its 100-day cadence at the end of November. It reads the
  calendar, so its caller is a scheduled one.
- `check_structural_breaking` runs from `taskfiles/ci-fast.yml:1026` only
  (`docs/contracts/STABILITY.md:220-221` says "run in `task ci-fast`"), so a
  structural break without its annotation is caught only on a contributor's
  machine. It is one of the green gates the drain wires. `corrected-from-reproduction`:
  the round said two documents claim it runs in CI; that sentence was not found.

## Phase 1 — The reading, recorded

- [x] **1.1 The table is evidence.** The round's reading — per gate: entry,
      command, exit code, seconds, first finding line — is re-taken on the
      branch base and written to
      `agents/evidence/analysis/local-only-gates-complete-reading.md` with its
      `evidence-type` marker, the method, the two gates with no task command,
      the checkout artefact as its own row, and the date it was read.
      verify: `grep -c 'audit_command_surface' agents/evidence/analysis/local-only-gates-complete-reading.md` -> /^[1-9]/
- [x] **1.2 Each green gate gets a class.** In the same page every green gate
      is marked `wire`, `calendar` (reads the clock or a ratchet age),
      `machine` (reads the developer's checkout or branch) or `slow` (over ten
      seconds). A `machine` gate is declared under `local_only:` in
      `src/config/ci-local-parity.yml` only when its reason has the structural
      shape the decision names; otherwise it stays in the backlog with its
      class written down.
      verify: `npx vitest run tests/scripts/ci_local_parity_classes.test.ts` -> 0

## Phase 2 — The drain, in batches

- [x] **2.1 The first twenty.** The twenty fastest `wire`-class gates run as
      steps of the consistency workflow with the arguments their tasks pass.
      The parity baseline is lowered by twenty in the same change and the
      job's duration is recorded in the cost-budget page.
      verify: `npx vitest run tests/scripts/ci_local_parity_classes.test.ts -t baseline-at-most-143 --reporter=verbose` -> /✓.*baseline-at-most-143/
      <br>**Closed 2026-10-13 with one deviation, recorded here rather than
      only in a YAML comment.** The twenty are steps of
      `Standing payload delta + budget gate` in
      `.github/workflows/standing-payload-delta.yml`, NOT of `consistency.yml`
      as written above: that file hosts the ratification gate, so any step
      added to it makes the whole diff ratification-gated. The ruleset was read
      rather than assumed — `repos/event4u-app/agent-config/rulesets`
      (`main protection`) lists exactly two required contexts, and this is the
      other one — so the step's obligation is met in the way it meant it: the
      gates run in a REQUIRED job, on a workflow carrying no `paths:` filter,
      and only the file name differs from the line above.
      <br>An earlier revision of this closure note described a different
      placement, a new job on `rule-backstops.yml`, and it is corrected rather
      than quietly rewritten because the reason it was wrong is the reusable
      part: that job is not a required context, so a red in it is visible and
      merges anyway, and it inherits a `paths:` filter that three of these
      gates' inputs do not match. An independent completion review found both.
      <br>The other two obligations are met literally: the baseline moved
      165 -> 130 on CI's own reading (run 38373476139 printed 129 and named it;
      the extra one came back when a writing gate was removed from the
      schedule, a correction to a number that never reached the trunk), and the
      job's duration is in `docs/contracts/ci-cost-budget.md` measured in CI
      with its sample size. The batch is twenty rather than the 119 the reading
      found wirable, on a 2/2 council verdict of 2026-10-13 that one pull
      request carrying all 119 is the sweep the 2026-08-13 decision declines.
- [ ] **2.2 The rest of the class, twenty at a time.** Each further batch is
      one change: wire, lower the baseline, record the duration. A gate found
      red at wiring time is skipped, listed in the evidence page, and handled
      by Phase 3. A batch that would take the job past its ceiling goes into a
      second job of the same workflow.
      verify: `npx vitest run tests/scripts/ci_local_parity_classes.test.ts -t every-wire-class-gate-has-a-workflow-caller --reporter=verbose` -> /✓.*every-wire-class-gate-has-a-workflow-caller/
      <br>**Split 2026-10-14, because the step as written is larger than the
      bound it sits under.** At `144c0b20b` the parity checker lists 124
      undeclared local-only gates, **105** of them `wire`-class with no caller —
      five times the twenty a change the 2026-10-13 council set. "Twenty at a
      time" already said so; the batches are now numbered so that each is a
      step a change can close. Order: the 105 by name, twenty a batch, a gate
      skipped only for a reason written in the evidence page's 2026-10-14
      step-2.2 section. 2.2 closes when the last batch does, and AC-2 with it.
- [x] **2.2a The first twenty.** `audit_mcp_tools` through
      `check_score_contract`, four skipped with their reasons; steps
      `Drain 2.2a-1` and `Drain 2.2a-2` of the host job. Open until the
      enforcing environment's reading lowers the baseline from 124 and the
      host job's duration with the batch is recorded — neither can be taken
      on this branch's local reading, which is 104.
      verify: `npx vitest run tests/scripts/ci_local_parity_classes.test.ts -t "first batch, exactly" --reporter=verbose` -> /✓.*first batch, exactly/
- [x] **2.2b–2.2e The next eighty, twenty a batch,** by the same rule, each
      with its own exact-set case in `every-wire-class-gate-has-a-workflow-caller`.
      Four of them are writer-shaped and get the `git status` check first:
      `rebuild_hook_bundle`, `report_imperative_density`, both `second_brain_*`.
      verify: `npx vitest run tests/scripts/ci_local_parity_classes.test.ts -t every-wire-class-gate-has-a-workflow-caller --reporter=verbose` -> /✓.*every-wire-class-gate-has-a-workflow-caller/
      <br>**Progress, one pull request per batch.** 2.2b (`check_skill_requires`
      through `lint_changelog_rollback`, none skipped) is wired as steps
      `Drain 2.2b-1` and `Drain 2.2b-2`; the evidence page's 2026-10-15 section
      holds its reading and a re-run of all 85 remaining candidates, which found
      `lint_marketplace_install_completeness` red since the first reading.
      2.2c (`lint_command_flow_coverage` through `lint_model_tier_coverage`, one
      skipped: `lint_marketplace_install_completeness`, still red) is wired as
      `Drain 2.2c-1` and `Drain 2.2c-2`; the same change lowers the parity
      baseline 104 -> 84 on CI's reading of main after 2.2b (run 38849726162).
      Left: 2.2d and 2.2e, forty gates from `lint_namespace`.
      2.2d (`lint_namespace` through `lint_skill_originality`, none skipped) is
      wired as `Drain 2.2d-1` and `Drain 2.2d-2`; two of its gates default their
      base to the local `main` and run with `--baseline origin/main`. Left: 2.2e,
      twenty gates from `lint_skill_router_head`.
      **Closed 2026-10-16 with 2.2e**, nineteen gates, which empties the window:
      `Drain 2.2e-1` and `Drain 2.2e-2`, none skipped, the four writer-shaped
      gates checked first and clean. The batch test marks 2.2e `final`, the one
      batch allowed fewer than twenty. 79 of the "next eighty" are wired; the
      eightieth, `lint_marketplace_install_completeness`, is red and goes to 2.2f
      with 2.2a's four.
- [x] **2.2f The residue** — what 2.2b–2.2e leave, plus the four 2.2a skipped
      if their reasons are resolved; a gate whose reason stands stays in the
      backlog with it written down, never declared to move the number.
      verify: `npx vitest run tests/scripts/ci_local_parity_classes.test.ts -t every-wire-class-gate-has-a-workflow-caller --reporter=verbose` -> /✓.*every-wire-class-gate-has-a-workflow-caller/
      **Closed 2026-10-16.** Five reasons re-checked against the tree. Two no
      longer held and both gates are wired as `Drain 2.2f`:
      `lint_marketplace_install_completeness` (a false positive — it read the
      prose the no-dispatcher branch echoes as a command, fixed with its test)
      and `check_reply_consistency` (its task now names `src`; a planted tag reds
      it). Three still hold and stay in the backlog with the reason written in
      the evidence page's 2026-10-16 step-2.2f section:
      `check_hook_bundle_freshness`, `check_release_trunk_sync`,
      `check_quality_regression`. Nothing was declared. Step 2.2 and AC-2 stay
      open on those three.
- [x] **2.3 Calendar gates get a scheduled caller, not a required one.** The
      `calendar`-class gates and `check_council_pin_staleness` run in the
      scheduled workflow that already runs the gate canary, which is not a
      required check; `slow` gates join them.
      verify: `npx vitest run tests/scripts/ci_local_parity_classes.test.ts -t calendar-gates-scheduled-not-required --reporter=verbose` -> /✓.*calendar-gates-scheduled-not-required/
      <br>**Closed 2026-10-13 on the calendar half; the `slow` half is
      deliberately NOT done, and that is a deviation rather than an oversight.**
      All thirteen `calendar`-class gates and `check_council_pin_staleness` run
      in the scheduled job, which is what this step is for. The one
      `slow`-class gate — the evidence page counts exactly one,
      `audit_command_surface` — is excluded: it writes
      `agents/reports/command-surface.{json,md}`, both tracked, unconditionally
      at the end of every run, so it is a generator rather than a checker and a
      scheduled run would mutate its tree to compute an answer it discards. It
      joined that job first and was taken back out when an independent review
      measured the write. It stays in the local-only backlog with its class
      recorded; wiring it needs a `--check`-shaped mode it does not have, and a
      test pins that it appears in neither job. A later batch that gives it one
      closes this half.

## Phase 3 — The reds nobody owns

- [x] **3.1 Generated files that are stale.** The ownership matrix, the
      cookbook and the role-experiences catalogue are regenerated, and their
      three `--check` gates are wired in the same change.
      verify: `npx vitest run tests/scripts/ci_local_parity_classes.test.ts -t generated-docs-checks-wired --reporter=verbose` -> /✓.*generated-docs-checks-wired/
- [x] **3.2 One change per remaining gate.** For each of
      `check_public_links`, `check_augment_description_cap`,
      `check_token_quality_golden`, `lint_subagent_determinism`,
      `check_council_layout`, `lint_readme_jargon`,
      `lint_readme_serial_comma` and `check_knowledge_cards`: the findings are
      fixed in the tree and the gate is wired in that change. None reads a
      baseline, so fixing is the only move.
      verify: `npx vitest run tests/scripts/ci_local_parity_classes.test.ts -t unowned-gates-wired --reporter=verbose` -> /✓.*unowned-gates-wired/
      <br>**Closed 2026-10-14.** `check_knowledge_cards` and
      `lint_subagent_determinism` landed with batch 1; the other six landed in
      one pull request as one commit each — fix, wiring step and a case in
      `unowned-gates-wired` that was seen red before its step existed. All six
      are steps of `Standing payload delta + budget gate`, behind a batch-2
      marker. Two of the six were fixed by correcting the checker rather than
      the tree, and say so: `check_token_quality_golden` read a routed rule
      with no triggers as never firing, which is backwards for the four rules
      the 2026-08-20 council made unconditional; `check_council_layout` gained
      a narrow allowlist of three tracked evidence homes on a 2/2 council of
      2026-10-14 (record under `agents/evidence/council/layout-allowlist-20261014.md`),
      and the seven analyses it flagged moved into one of them. Per-gate detail
      is in the evidence page's 2026-10-14 section. The parity baseline was
      NOT lowered with it: the local reading is 124 against 130, and this
      baseline moves only on the enforcing environment's reading.

## Step 2.2a — closure record

Closed 2026-10-14, on both readings the step named. The baseline: run
38622341909, job `Sync + Generate Tools Consistency` (job 116053446442), step
`CI <-> local gate parity`, at PR #2354's final head `b09ed6995`, printed
`ci-parity:local-only: 104 violation(s), baseline 124` and asked for 104. The
baseline in `src/config/gate-violation-baselines.json` is lowered 124 -> 104 on
that reading; the local run on `origin/main` at `4b8ec8c1f` agrees at 104 and is
corroboration only. Twenty gates left the set and nothing was declared:
`local_only:` still holds seven entries. The duration: on the three
`Standing Payload Delta` runs of #2354 the host job took 70 s, 74 s and 72 s and
the two 2.2a steps together 9 s, 12 s and 12 s, recorded in
`docs/contracts/ci-cost-budget.md` — about a quarter of the 300 s ceiling and
below the ~240 s point at which the overflow job becomes due. The four gates
2.2a skipped stay in the count for 2.2f.

## What this roadmap deliberately does not do

- No sweep. No gate is wired while it is red, and none is baselined to make
  it green.
- No change to the reds a live file owns. Their rows stay in the evidence page
  with the slug.
- No keep-going mode for the local pipeline, no owner register, no new report
  script, and no reading of `enforced` as "has a caller" — the coverage
  file's own definition is a scanned floor, and the 2026-08-13 decision
  declined the rest.
- No new required check. The steps join the job that is already required, and
  only gates that were green when wired.
- No edit to a kernel rule or its golden.
- No full-pipeline run as a step.

## Acceptance Criteria

- [x] AC-1 — A dated page lists every undeclared local-only gate with exit
      code, seconds and class, at the commit it was read.
- [ ] AC-2 — Every `wire`-class gate has a pull-request caller, and the
      parity baseline is lower by that count.
- [x] AC-3 — No gate whose verdict depends on the date is a step of a
      required job, and `check_council_pin_staleness` has a scheduled caller.
- [x] AC-4 — The eleven reds with no live owner are green and wired.
- [x] AC-5 — The consistency job's recorded duration is under the ceiling the
      cost-budget page sets.
      <br>**Closed 2026-10-13 against the job the drain actually joined, which
      is not the one this line names** — the same deviation recorded at step
      2.1, and flagged here rather than flipped quietly. The twenty gates are
      steps of `Standing payload delta + budget gate`, the repository's other
      required context, because `consistency.yml` hosts the ratification gate.
      Measured in CI on this branch: the host job ran 21 s and 27 s before the
      steps landed and 56 s and 60 s after, against the 300 s per-job ceiling
      in `docs/contracts/ci-cost-budget.md` — about a fifth of it. The
      consistency job itself is untouched by this change and its recorded 75 s
      is unchanged, so the criterion holds for both readings of which job it
      means.

## Decisions

| ID | ownership | resolved by | decision | evidence | revisit if |
|---|---|---|---|---|---|
| D1 | reversible-technical | evidence | Drain what is green; do not sweep | The 2026-08-13 decision declines the sweep and leaves the batch drain open; 139 of 161 were green | The red share at wiring time rises well above the measured 13 % |
| D2 | reversible-technical | evidence | Calendar gates never join a required job | Two of the reds were red from elapsed time alone; six gates print an `as-of:` line | Those gates gain a pinned clock in CI |
| D3 | reversible-technical | agent | A recorded reading, not a permanent runner | After the drain the workflow reports each gate | The undeclared set grows again by more than a batch |
| D4 | reversible-technical | agent | Owned reds are listed and left | Each has a blocker or a step in the file that names it | An owning file is archived with its gate still red — which already fired once, for `check_knowledge_cards` |
| D5 | reversible-technical | evidence | **REOPENED 2026-10-13 — the revisit condition fired and the step is back.** Originally: the round's step for `check_trigger_eval_presence` is dropped. | Originally: it exits 0 on `d41121927`. **At the branch base `257e87de0` it exits 1**, because `form-handler` and `judge-security-auditor` gained a trigger corpus on 2026-10-12 without their grandfather entries being removed in the same change — so the gate was red on the trunk for a day with nothing remote to report it, which is itself an argument for this drain. The two entries are removed and it is wired. | Fired, and discharged. Reopens again only if the gate turns red for a NEW reason; the grandfather-entry-left-behind cause is now covered by wiring it. |

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-10-14 | reviewer: claude -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | A wired gate reds unrelated pull requests, and now BLOCKS them | implementation | RAISED at the v2 review. Batch 1 landed as steps of `Standing payload delta + budget gate`, a required context, which is what the roadmap's non-goals ask for and is strictly more dangerous than the first attempt: a gate that was green can depend on state the reading did not exercise, and in a required job that stalls every open pull request rather than showing a red somebody scrolls past. | Unchanged in kind and now carrying evidence: batches of twenty, so a bad gate is one revert of a contiguous step block; 1.2 keeps clock- and machine-dependent gates out; each of the twenty was run with the workflow's own argv at the base, on the merged tree and on the final tree, and the host job has passed CI on this branch. The residue is a gate whose first failure needs a condition none of those runs produced. | Phase 2 — The drain, in batches |
| 2 | The required job outgrows its ceiling | implementation | MEASURED at the v2 review, replacing an estimate. The host job runs 56-60 s with the drain against 21-27 s without, on a 300 s per-job ceiling — about a fifth of it. The 11.5 s serial sum of the twenty gates is a floor and not the cost: ~22 s is per-step `tsx` startup, so cost grows with the number of STEPS as much as with gates. | 2.1 and 2.2 record the duration per batch; 2.2 names a second job of the same workflow as the overflow. A later batch should prefer adding gates to existing steps over adding steps. RE-READ at the v3 review (the 2.2 split): 2.2a adds twenty invocations in two steps, roughly 20-25 s by the batch-1 measurement; its CI duration is recorded before 2.2a closes, and the overflow job is due once a batch would take the job past about 240 s. | Phase 2 — The drain, in batches |
| 3 | The reading is one machine's and a week old | implementation | DISCHARGED for batch 1 at the v2 review. 1.1 re-took the reading on the branch base, and the twenty have since run green in CI on the host job, which is the only reading that was ever authoritative. It stands for batches 2+, whose gates have been read on one machine and not yet in CI. At the v3 review 2.2a's twenty were re-read on the branch base with their workflow argv and a clean `git status`; its first CI run is the reading that closes it. | 1.1's re-reading per batch; wiring is the real test, gate by gate. | Phase 1 — The reading, recorded |
| 4 | Fixing eight gates touches shared files | implementation | README prose and rule descriptions are edited by other live roadmaps. | 3.2 is one change per gate, each small enough to rebase. | Phase 3 — The reds nobody owns |
| 5 | A gate that WRITES is mistaken for one that checks | implementation | ADDED at the v2 review, from a defect that reached a workflow before an independent review caught it: `audit_command_surface` takes a `--check-new` flag, is not named `generate_*`, and writes two tracked files unconditionally at the end of every run. The name-shaped guard in `tests/scripts/ci_local_parity_classes.test.ts` was green over it. | The guard now names caught writers explicitly and states in its own comment that it is a floor, not a proof — deciding "does this script write a tracked file" in general needs the call graph. Before wiring, a later batch runs each candidate on a clean worktree and checks `git status`. | Phase 2 — The drain, in batches |
