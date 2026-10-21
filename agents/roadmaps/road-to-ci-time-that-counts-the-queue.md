---
complexity: structural
status: ready
execution:
  mode: autonomous
estate_offset_exempt: "Round inbox-2026-10-w verified at 5dcfa13a6 that nothing in the tree reads job-level queue time from the Actions API (ci_time_ratio.ts:133,150 reads run-level createdAt/updatedAt; probe_turnaround.ts counts agent-side waits), while PR #2569's Tests run shows macOS jobs created at 17:32:30 starting between 17:38 and 18:05 — up to 33 minutes of queue that no record captures. ADR-223 trigger (a) has no instrument (its own line 88 says so) and trigger (b) fired on 2026-09-11 without a recorded revisit; docs/contracts/ci-cost-budget.md lapsed its keep-beta-until on 2026-10-06. later/road-to-merge-surface-zero blocker B2 waits on exactly this measurement. Parking it keeps every CI decision in this round estimated."
relates:
  - slug: road-to-merge-surface-zero
    relation: extends
    note: "later/. Its blocker B2 (merge queue) waits on measured per-PR CI wall-time; step 1.2 here produces it and 3.2 hands the reading over. Nothing here edits that plan."
  - slug: road-to-agent-throughput-recovery
    relation: disjoint
    note: "Measures agent turnaround (ci-wait from transcripts) and owns ci_settle. This file measures CI from the Actions API and never touches ci_settle."
  - slug: road-to-macos-where-the-platform-is-the-point
    relation: extends
    note: "Its macOS PR-tier decision is evidence-gated on the per-OS attribution produced in 1.3."
  - slug: road-to-a-required-check-that-does-not-rerun-the-gates
    relation: disjoint
    note: "Its per-gate timings feed the cost-contract pass in 2.1."
---
# Road to CI time that counts the queue

> **Source:** `agents/tmp.old/inbox-2026-10-w/` — one transcript and two supplied
> CI-speed plans, pinned at `main@95dbe28`; verified against `main@5dcfa13a6`.
> Both plans name the same root defect: the unit the owner feels — time from push
> to green, queue included — is measured by nothing, so a 10× drift of the
> required job (75 s budgeted, 10-12 min observed) went unseen.

## Goal

Time-to-green, split into queue and execution per job, OS and event, is a number
the repository produces on demand and on a schedule; ADR-223's per-OS trigger has
its missing instrument and a recorded reading; and the CI cost contract describes
today's workflows instead of August's.

## Context — verified at `5dcfa13a6`

- `src/scripts/ci_time_ratio.ts:133,150` uses `gh run list` `createdAt,updatedAt`
  — run span only, no per-job queue. Nothing reads job `started_at − created_at`.
- `gh api repos/…/actions/runs/39644704455/jobs` (PR #2569 Tests) shows every
  ubuntu job starting within 2-63 s of creation and macOS jobs waiting 5.7 to
  33 minutes; the run's longest job is ~12.5 min, its span ~40 min.
- ADR-223 (`docs/decisions/ADR-223-no-required-check-demotion-on-cost-grounds.md:10-18`):
  trigger (a) per-OS failure attribution — no instrument (:88); trigger (b)
  "required list stops being a single entry" — met since 2026-09-11
  (`branch-protection-policy.md:55`), never revisited. `adr_cite_check` reports
  "trigger state indeterminate".
- `docs/contracts/ci-cost-budget.md`: `keep-beta-until: 2026-10-06` lapsed (:3);
  ":56 7 job keys → 24 jobs" (now 8 → 26); no `svg-witness-tests` row; the
  collector-lifecycle row is a local estimate (:71) against its own rule (:35-37).
- `src/scripts/ci_status.ts:35-46` requires a `Python Version Sweep` workflow for
  the `feature` shape; no workflow of that name exists.

## Phase 1 — The instrument

- [ ] **1.1 `ci_time_to_green` script.** Reads the Actions runs + jobs API (via
      `gh api`) for a time window or a PR head SHA and writes
      `agents/reports/ci-time-to-green.json` plus a markdown table: per job queue
      (`started_at − created_at`) and execution; per run span; per head SHA
      time-to-required-green and time-to-all-green; split by OS and event. Pure
      computation lives in a function tested on recorded fixtures; network is only
      in the CLI shell.
      verify: unit tests over a recorded jobs fixture assert queue/exec seconds,
      OS split and the required-vs-all distinction.
- [ ] **1.2 First reading.** Run it over the last 7 days and commit the summary as
      `agents/evidence/analysis/ci-time-to-green-2026-10.md` with p50/p90 per OS
      and event, and PR #2569 reproduced as a named row.
      verify: `grep -c "39644704455" agents/evidence/analysis/ci-time-to-green-2026-10.md` -> /^[1-9]/
- [ ] **1.3 Per-OS failure attribution — ADR-223 trigger (a)'s instrument.** A
      `ci_os_attribution` script walks ≥ 500 recent `Tests` runs and counts runs
      where a macOS job failed while its ubuntu twin passed (and vice versa),
      naming the jobs. Result committed to
      `agents/evidence/analysis/ci-os-attribution-2026-10.md`.
      verify: unit tests cover twin pairing (matrix name → twin) and the four
      outcome cells on a fixture; the evidence file states the sample size.

## Phase 2 — The contract describes today

- [ ] **2.1 Re-run the cost-contract pass.** `ci-cost-budget.md` rows re-measured
      from CI (Phase 1 reading + the required job's per-gate timings), the
      `svg-witness-tests` row added, the job-count sentence corrected, the
      collector-lifecycle row taken from CI, and a separate, labelled
      time-to-green (incl. queue) table next to the per-job rows — two units,
      never compared. `keep-beta-until` moved to a date tied to the scheduled
      report in 3.1.
      verify: `grep -c "keep-beta-until: 2026-10-06" docs/contracts/ci-cost-budget.md` -> /^0$/
- [ ] **2.2 ADR-223 revisit record.** An addendum records that trigger (b) fired
      on 2026-09-11, what 1.3 measured for trigger (a), and the outcome of this
      round: placement changes only, the required set untouched.
      verify: `./scripts-run src/scripts/adr_cite_check ADR-223` no longer
      reports the trigger state as indeterminate, or the addendum names why it
      still is.
- [ ] **2.3 `ci_status` shape sets name workflows that exist.** Drop or replace
      `Python Version Sweep` and assert in a test that every name in
      `REQUIRED_CHECKS_BY_SHAPE` is the `name:` of a workflow under
      `.github/workflows/`.
      verify: the new test fails on the current set and passes after the fix.

## Phase 3 — It stays measured

- [ ] **3.1 Weekly scheduled report.** A workflow runs `ci_time_to_green` weekly
      and on `workflow_dispatch`, writes the table to the job summary, uploads the
      JSON, and emits a `::warning` when p50 or p90 regresses > 25 % against the
      previous committed reading. It opens no issues and posts nothing.
      verify: `grep -n "schedule" .github/workflows/ci-time-to-green.yml` -> 0
- [ ] **3.2 Hand the reading to the parked merge-queue blocker.** Record on
      `later/road-to-merge-surface-zero` B2 that the per-PR wall-time
      measurement it waits for now exists, with the evidence path.
      verify: `grep -n "ci-time-to-green-2026-10" agents/roadmaps/later/road-to-merge-surface-zero.md` -> 0

## Decisions

| ID | ownership | resolved by | decision | evidence | revisit if |
|---|---|---|---|---|---|
| C1 | deterministic | evidence | Not a decision: the frontmatter reason describes a measurement | `closure_scan` keyword match on "merge queue" prose | the line gains an imperative |
| C2 | deterministic | evidence | Not a decision: `relates` slug of a parked file | same | same |
| C3 | deterministic | evidence | Not a decision: `relates` note; this file performs no merge or ruleset write | same | same |
| C4 | deterministic | agent | Verify tightened to a grep with an expectation | step 1.2 | the evidence path changes |
| C5 | deterministic | evidence | Recording a reading on a parked roadmap is authoring, not a merge or settings write | step 3.2 edits one markdown line | the step is widened to enable anything |
| D1 | reversible-technical | agent | The weekly report warns in the job summary and opens no issues | owner rule against unsolicited GitHub posts (`no-pr-progress-comments`) | the owner asks for issue-based alerts |

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-10-21 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | One busy day read as a baseline | product | A 7-day window with a merge storm or a GitHub capacity incident is published as the normal | 1.2 reports p50/p90 and the window, and the weekly report (3.1) compares like windows | Phase 1 — The instrument |
| 2 | Attribution counts flakes as platform signal | product | A flaky macOS test reads as "macOS catches what ubuntu misses" | 1.3 names the jobs and test runs per cell, so a reader can separate a repeat offender from a one-off | Phase 1 — The instrument |
| 3 | API rate limit truncates the sample | implementation | 500 runs × jobs pages exceed the hourly API budget and the script silently reports fewer runs | The script states the sample it actually read and refuses to print a rate if below the requested floor | Phase 1 — The instrument |

## Acceptance Criteria

- [ ] AC-1 — Queue and execution time per job, OS and event are reproducible from
      one command, and a committed reading exists.
- [ ] AC-2 — ADR-223 carries a recorded revisit with a measured trigger (a)
      reading.
- [ ] AC-3 — `ci-cost-budget.md` lists every `tests.yml` job and is not past its
      own review date.
