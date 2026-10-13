---
complexity: lightweight
status: ready
execution:
  mode: phase-checkpoints
relates:
  - slug: road-to-local-gates-wired-while-they-are-green
    relation: disjoint
    note: "Drains the gates the parity checker lists as undeclared local-only. The two roadmap lints in Phase 1 here have no task at all, so that list never names them."
  - slug: road-to-a-danger-gate-that-sees-what-governs
    relation: disjoint
    note: "Owns which triggers the merge classifier fires and where its verdict routes. Phase 2 here repairs only how the classifier reads the diff and resolves the base; whichever lands second rebases onto the other, and neither changes a trigger the other adds."
  - slug: road-to-run-continuation-observation
    relation: extends
    note: "Parked with a dated kill criterion: withdraw the concern if no qualifying run is recorded by the end of 2026-10-11. The date passed and the concern is still bound; Phase 4 executes the disposition that file pre-registered and archives it."
estate_offset_exempt: "Offset in Phase 4 by archiving later/road-to-run-continuation-observation, whose dated disposition this roadmap executes; until that step lands the active count is one higher, and no active roadmap owns the two unwired lints, the classifier's input contract or the three stale sentences."
---
# Road to what was built and never ran

> **Source:** `agents/tmp.old/inbox-2026-10-m/` (topic `s03`) — nineteen
> external reviews of the 16.4.0 release in one transcript, a supplied 49-row
> rescore that lists ten instruments reached only by tests or command prose,
> a comparative locks check and a status note. Every reading below was re-run
> at `main@17f028941` (16.5.0) on 2026-10-12; the classifier reading was
> reproduced in a scratch repository under `agents/runtime/tmp/`.

## Goal

Two roadmap lints that are written, tested and silent run where a pull
request is decided. The merge classifier reads every path in a diff,
including one git would quote, and does not classify against a base it failed
to refresh. Three sentences in gate code stop describing a state that is not
the tree's. A concern whose own record dated its withdrawal is withdrawn.

## Context — reproduced at `main@17f028941`

- **Two lints with no caller.** `lint_ticked_unmet_criteria` and
  `lint_blocker_citations` are named by no file under `Taskfile.yml`,
  `taskfiles/` or `.github/`. The first exits 1 with four hits, one of them
  `agents/roadmaps/archive/road-to-parked-blockers-that-get-asked.md:173` —
  the roadmap that introduced it, hit because it quotes the phrase in inline
  code; the scanner skips fenced code but not inline code
  (`src/scripts/lint_ticked_unmet_criteria.ts:53` skips fences, `:73` matches the joined text). The second is green at
  7 violations against a baseline of 10.
- **The classifier misses a quoted path.** `classify_merge_risk.ts:266` reads
  `git diff --name-status` without `-z`, and the parser (`:208-224`) takes
  git's quoted form verbatim. In a scratch repository, a range adding only
  `.github/workflows/ci-ö.yml` prints `verdict: routine` and exits 0, while
  the same range with `.github/workflows/plain.yml` prints `needs-council`
  with trigger `ci-workflow`. ADR-282's own `review_trigger` names a `routine`
  verdict on a surface a cited rule names as a reportable defect.
- **The classifier ignores a failed fetch.** `resolvePr` (`:239-250`) runs
  `git fetch` and discards its result, then diffs against
  `origin/<base>` as it stands.
- **Three sentences describe another tree.**
  `check_kernel_edit_ratified.ts:263` calls the kernel-write deny "the retired
  hook", while `hook_manifest.yaml:231` defines `block-kernel-rule-writes` and
  three host rows bind it (`:1565`, `:1607`, `:1654`).
  `report_required_checks_drift.ts:14` says it runs "by hand or on a
  schedule"; no workflow schedules it. `adr_cite_check ADR-118` prints
  `LIVE` and "referenced by" ADR-281 without saying that ADR-281's frontmatter
  supersedes ADR-118 § 3 rejection 2 in scope — the tool reads a successor
  only from the record's own `superseded_by` (`adr_cite_check.ts:545-546`).
- **A dated withdrawal did not execute.**
  `later/road-to-run-continuation-observation.md:49-56` withdraws the
  `run-continuation` concern "automatic on that date" if no qualifying run is
  recorded by the end of 2026-10-11. `hook_manifest.yaml:1297` still defines
  it and `:1582` still binds it to `stop`; the local event record's last line
  is from 2026-08-19.

## Phase 1 — Two lints run where a pull request is decided

- [x] **1.1 Inline code is not a finding, red first.** A case named
      `inline-code-not-met-is-quoted` plants a ticked criterion whose only
      `NOT met` sits in backticks; it fails today, then the scanner masks
      inline code spans the way it already skips fences, and a ticked
      criterion with a bare `NOT met` still fails.
      verify: `npx vitest run tests/scripts/lint_ticked_unmet_criteria.test.ts --reporter=verbose` -> /✓.*inline-code-not-met-is-quoted/
- [ ] **1.2 The other three hits are read, one at a time.** Each of
      `road-to-blocking-severities-where-a-refusal-can-land.md:175`,
      `road-to-governed-harness-evolution.md:2614` and `:2769` is either a
      quotation (left, and the detector's miss recorded in a test) or a real
      contradiction, whose tick becomes `[~]` with one line naming the unmet
      half. No criterion text is reworded to clear the lint.
      verify: `./scripts-run src/scripts/lint_ticked_unmet_criteria` -> 0
- [ ] **1.3 Both lints join `ci-fast` with the arguments CI runs.** One task
      each, registered the way the parity checker reads, and the gate-coverage
      row each owes. `lint_blocker_citations`' baseline is lowered from 10 to 7
      only on a CI reading of the wired task, never on a local one.
      verify: `grep -c -E 'lint_ticked_unmet_criteria|lint_blocker_citations' taskfiles/ci-fast.yml` -> /^[2-9]/

*Exit: 1.1 to 1.3 are green on the pull request's own CI run.*

## Phase 2 — The classifier reads the diff it classifies

- [ ] **2.1 A quoted path is read, red first.** A case named
      `non-ascii-workflow-is-not-routine` builds a temporary repository whose
      range adds only a workflow file with a non-ASCII name and asserts
      `needs-council`; it fails today. Then the diff is read with
      `--name-status -z` and parsed on NUL, renames and copies included, and
      the existing near-miss cases stay green.
      `corrected-from-reproduction`: the review read the defect as robustness
      that "fails conservatively"; the reproduction shows it fails open.
      verify: `npx vitest run tests/scripts/classify_merge_risk.test.ts --reporter=verbose` -> /✓.*non-ascii-workflow-is-not-routine/
- [ ] **2.2 A failed fetch fails closed.** `resolvePr` returns null when the
      fetch exits non-zero, so the run reads `needs-council` with the
      `diff-unreadable` trigger instead of diffing a stale base.
      verify: `npx vitest run tests/scripts/classify_merge_risk.test.ts -t fetch-failure-fails-closed --reporter=verbose` -> /✓.*fetch-failure-fails-closed/

*Exit: 2.1 and 2.2 are green. This change edits the merge-authority surface, so
the classifier classes it non-routine and it lands by the owner's act.*

## Phase 3 — Three sentences say what the tree says

- [ ] **3.1 The kernel-write deny is named as bound.** The comment at
      `check_kernel_edit_ratified.ts:263` names `block-kernel-rule-writes` and
      its manifest row instead of a retired hook, with its ratification record
      in the same change.
      verify: `grep -c 'retired hook' src/scripts/check_kernel_edit_ratified.ts` -> /^0$/
- [ ] **3.2 The drift report says how it runs.** `report_required_checks_drift.ts:14`
      drops "or on a schedule"; a scheduled job is a non-goal here.
      verify: `grep -c 'on a schedule' src/scripts/report_required_checks_drift.ts` -> /^0$/
- [ ] **3.3 A scoped supersession reaches the cited record.**
      `adr_cite_check` prints, for a record another ADR's `supersedes:`
      names, a `superseded in scope by` line with that ADR and the first
      sentence of its `supersedes_scope`, and keeps the verdict `LIVE`.
      `corrected-from-reproduction`: the review asked for `superseded_by` on
      ADR-118 and ADR-268; that field would mark the whole record dead, and the
      gap is in the reader.
      verify: `npx vitest run tests/scripts/adr_cite_check.test.ts -t scoped-successor --reporter=verbose` -> /✓.*scoped-successor/

## Phase 4 — The dated withdrawal lands

- [ ] **4.1 Read the record before acting.** Run the resume trigger's own
      reader, `./scripts-run src/scripts/interruption_report --root
      <main-checkout>`, and record in the parked file whether a qualifying run
      exists. One exists: stop this phase and record it there instead.
      verify: `grep -c 'qualifying run' agents/roadmaps/later/road-to-run-continuation-observation.md` -> /^[1-9]/
- [ ] **4.2 Withdraw the concern, keep its history.** Remove the manifest
      definition and every host binding of `run-continuation`, its script and
      its registry entry, and update every caller the name sweep finds; keep
      the decision history and the observation record, as the kill criterion
      says. The ratification record the dispatcher's import closure requires
      lands with it.
      verify: `grep -c 'run-continuation' src/scripts/hook_manifest.yaml` -> /^0$/
- [ ] **4.3 Archive the parked roadmap with its disposition.** The parked
      file records the withdrawal date and commit and moves to `archive/`,
      which is this roadmap's estate offset.
      verify: `test -f agents/roadmaps/archive/road-to-run-continuation-observation.md` -> 0

*Exit: 4.1 recorded; 4.2 and 4.3 green with the ratification record present.*

## Decisions

| ID | ownership | resolved by | decision | evidence | revisit if |
|---|---|---|---|---|---|
| D1 | reversible-technical | evidence | The ticked-unmet lint keeps scanning `archive/` | its header says an archived roadmap "is exactly where a contradictory tick outlives the session that made it" (`lint_ticked_unmet_criteria.ts:20-22`) | the archive hits are all quotations once 1.1 lands |
| D2 | deterministic | evidence | A quoted or unreadable path, or a failed fetch, never classifies `routine` | ADR-282 fails closed on an unreadable diff and names a `routine` miss on a cited surface as a defect | — |
| D3 | reversible-technical | evidence | ADR-118 and ADR-268 gain no `superseded_by` | ADR-281 supersedes one sentence of each in scope; the whole-record field would make the rest read dead | the contract adds a field for a scoped successor |
| D4 | deterministic | evidence | Phase 4 executes the withdrawal without a new decision | the kill criterion was set by a converged two-seat council and says the withdrawal needs "no further decision on the merits" | 4.1 finds a qualifying run |
| D5 | deterministic | evidence | Closure scan at authoring: 6 hits, none open. Step 1.2's two outcomes are a per-hit rule decided by the hit's own text, not an unpicked design. The name-filter hit at 3.3 is the test title the step creates, and its `✓` expectation cannot print on a skipped run. Four typed-op hits are the word "merge" in prose about the merge gate; no step merges, pushes or changes a ruleset, and each phase that edits a gated surface lands by the owner's act | `./scripts-run src/scripts/closure_scan` on this file, 2026-10-12 | a step is added that performs a typed operation |

## What this roadmap deliberately does not do

- It adds no gate beyond wiring two that exist, raises no baseline and adds
  no trigger to the merge classifier.
- It adds no scheduled workflow for the drift report.
- It does not wire the instruments the rescore names that already have an
  owner: the ratification and modification-review modules
  (`road-to-self-modification-that-a-council-must-pass`), the classifier's
  command callers (`road-to-a-danger-gate-that-sees-what-governs`) and the
  standing-delivery check, which measures one developer's install by design.
- It does not build a successor to the withdrawn concern.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-10-12 | reviewer: claude-opus -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | A newly wired lint reds every pull request | implementation | The ticked-unmet lint is red on the trunk today; wiring it red would block unrelated work | 1.1 and 1.2 make it green before 1.3 wires it, and 1.3 names the CI reading | Phase 1 — Two lints run where a pull request is decided |
| 2 | Masking inline code hides a real contradiction | implementation | An author who writes the unmet half inside backticks escapes the lint | 1.1 keeps a bare-phrase case red and records the trade in the test | Phase 1 — Two lints run where a pull request is decided |
| 3 | The NUL parse changes a rename's reading | implementation | `-z` emits rename pairs as separate fields, and a wrong split misreads old and new paths | 2.1 keeps every existing rename and near-miss case green | Phase 2 — The classifier reads the diff it classifies |
| 4 | Withdrawal leaves a dangling reference | implementation | Ten files outside the hook name the concern; one missed reference breaks a reader or a test | 4.2 sweeps the name and updates every caller in the same change | Phase 4 — The dated withdrawal lands |
| 5 | Withdrawal removes a mechanism the owner still wants | product | The kill criterion is a past decision and the owner may have changed his mind | 4.1 reads the record first, and the change lands by the owner's act through its ratification | Phase 4 — The dated withdrawal lands |

## Acceptance Criteria

- [ ] AC-1 — Both roadmap lints run in `ci-fast`, both are green on the
      pull request that wires them, and a planted inline-code quotation is not
      a finding while a bare one is.
- [ ] AC-2 — A range adding only a non-ASCII workflow path classifies
      `needs-council`, a failed fetch classifies `needs-council`, and the case
      for the first was seen red before the parser changed.
- [ ] AC-3 — No sentence in `check_kernel_edit_ratified.ts` or
      `report_required_checks_drift.ts` describes a hook or a schedule the tree
      does not have, and `adr_cite_check ADR-118` names ADR-281's scoped
      supersession.
- [ ] AC-4 — `run-continuation` is bound on no host, its decision history is
      kept, and the parked roadmap is archived with the withdrawal recorded —
      or 4.1 recorded a qualifying run and Phase 4 stopped.
