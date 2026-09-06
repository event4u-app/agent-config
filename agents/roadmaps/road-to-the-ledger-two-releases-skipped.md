---
complexity: structural
status: ready
execution:
  mode: phase-checkpoints
relates:
  - slug: road-to-release-finding-ordering
    relation: disjoint
    note: >
      Same ledger, deliberately non-overlapping halves. That roadmap owns WHEN
      the consumer reads the ledger inside the pull-request workflow and is
      parked on a synthetic `release/*` branch no autonomous run may open. This
      one owns the fact that two shipped releases have no ledger at all and
      that the gate proving it has no caller on `main`.
estate_growth_exempt: "The mechanism this repairs already shipped and was archived: road-to-the-unwritten-ledger made an absent ledger red and wrote the 14.16.0 file, and the two releases that shipped after it — 14.17.0 and 14.18.0 — both carry no ledger. This is the second arrival of the same subject with a corrected lock in place, so it exists to stop a recurrence the estate already paid for, not to add a surface."
estate_offset_exempt: "Cannot be offset. Its natural offset is the parked sibling road-to-release-finding-ordering, which is blocked on a synthetic release/* pull request no autonomous run may open; archiving it to pay for this would close the demonstration half by accounting rather than by doing it."
---
# Road to the ledger two releases skipped

> **Source:** `agents/tmp.old/inbox-2026-09-q/` — an external multi-model review
> round on releases 14.17.0 and 14.18.0, verified against the tree at
> `99d14b2e7` on 2026-09-06. The reviewer observed the absent 14.16.0 ledger in
> the previous round; the current round's own claim that it is still missing is
> `already-fixed` (`c5073530e` wrote it). What survived verification is the
> half nobody claimed: the two releases *after* that fix have no ledger either.

> **Arrivals:** 2 — latest `inbox-2026-09-q` (2026-09-06); earlier:
> `agents/roadmaps/archive/road-to-the-unwritten-ledger.md`, which fixed the
> instance and left the recurrence open.

## Goal

Every shipped release either carries a findings ledger under
`agents/evidence/release-findings/`, or carries one that states in machine-readable
form that its self-review produced nothing — and the check that proves this runs
somewhere a human sees it after the tag, not only on a branch that no longer
exists. Today `agents/evidence/release-findings/` holds `9.14.0.json`,
`14.15.0.json` and `14.16.0.json`; `14.17.0.json` and `14.18.0.json` are absent,
`./scripts-run src/scripts/check_finding_dispositions --release 14.17.0` and the
same command for `14.18.0` both exit 1 against `main`, and the only caller of
that script is `.github/workflows/release-validation.yml`, gated on
`startsWith(github.head_ref, 'release/')`. The gate that ADR-level work built to
make "absence is not evidence of zero" true is therefore red on the trunk and
executed by nothing on the trunk. Out of scope by decision: the pre-merge
blocking barrier (`road-to-release-finding-ordering` owns it), any change to
what counts as a blocking finding, and any new gate script.

> **Correction found in execution, 2026-09-06 — step 1.2's recovery premise was
> false.** 1.2 assumed the `self-review-findings` artifact existed and was
> inside its 30-day retention window. No artifact was ever produced for either
> release: the self-review's model call returned HTTP 400 `prompt is too long`
> on both (235,472 tokens for 14.17.0, 413,191 for 14.18.0), the job went
> NEUTRAL, uploaded nothing, and posted no PR comment. So the recoverable state
> is **"the review did not run"**, not "the run produced none" — and writing the
> second is the fabricated-empty-ledger failure this roadmap's Risk Register
> ranks first. The ledgers record the first. Evidence:
> `agents/evidence/analysis/release-ledger-absence-2026-09-06.md`.

## Phase 1 — Say what is true about the two releases

- [x] **1.1 Record the two absent ledgers as a finding, with the exit codes.**
      Write `agents/evidence/analysis/release-ledger-absence-2026-09-06.md` naming
      the three ledgers that exist, the two that do not, the exit-1 reproduction
      for each absent version, and the single-caller fact for the gate. No repair
      in this step — the record is what the next reader needs before any of it is
      changed.
      verify: **done.** `agents/evidence/analysis/release-ledger-absence-2026-09-06.md`
      carries five numbered facts, each with the command that produced it: the `ls`
      (three ledgers, matching the directory at the time of writing), the two exit-1
      reproductions, the single-caller `grep` over `.github/workflows/`, the two
      NEUTRAL run logs, and the two empty `gh pr view` comment queries. Facts 4 and 5
      were not predicted by this roadmap and are why 1.2 below reads as it does.
- [x] **1.2 Recover the self-review output for 14.17.0 and 14.18.0, or record that it is gone.**
      The `self-review-findings` artifact is uploaded per PR with `retention-days: 30`
      (`.github/workflows/self-review-gate.yml`), so both releases are inside the window
      at the time of writing. Either ingest via
      `check_finding_dispositions --ingest <findings.json> --release <version>`, or write
      the ledger with an explicit empty finding set and a note saying the run produced none.
      verify: **done, via the second branch, because the first was unavailable.** There
      was nothing to ingest — no artifact and no machine block for either release (see
      the correction under Goal). Both ledgers now exist and both commands exit 0. Each
      records `reviewers: []`, which derives `review_independence: unknown`,
      `acceptance_status: provisional` and `assurance: unreviewed`
      (`src/scripts/_lib/review_independence.ts:62-98`) — the vocabulary already
      distinguishes "not reviewed" from "reviewed, nothing found", and these are the
      former. `no_findings_reason` on each names the workflow run, the HTTP 400 and
      what would falsify it. `check_review_schema` green over 5 ledgers.

## Phase 2 — The gate gets a caller where a missing ledger is visible

- [x] **2.1 Run the disposition check against the released version on `main`.** Add a
      job or step that executes `check_finding_dispositions --release <package version>`
      after the release merge lands, not only on the `release/*` pull request. The
      script needs no new flag — the bare `--release` path already resolves a shipped
      version and already exits 1 on an absent ledger.
      verify: **done.** New step `Shipped version carries a findings ledger` in
      `.github/workflows/consistency.yml` runs `./scripts-run src/scripts/check_finding_dispositions`
      bare. That workflow triggers on `pull_request` and on `push: main` under a paths
      filter including `agents/**`, so a deleted ledger re-triggers it by construction —
      the Risk-2 mitigation. Sensitivity reproduced locally with the identical command:
      `rm agents/evidence/release-findings/14.18.0.json` → exit 1 (`14.18.0 has shipped
      and carries no findings ledger`); file restored → exit 0. Timing stated in the
      step comment rather than assumed: it does NOT redden the release merge, where the
      tag does not yet exist and `unreleased` is the correct answer — it reddens on the
      first push to main after publication.
- [x] **2.2 Register the check in `src/config/gate-coverage.yml` with a CI-identical `argv`.**
      It is currently in neither `gate-coverage.yml` nor `release-gate-locality.yml`, so
      nothing notices if the caller is removed again.
      verify: **done, and the second half needed building.** The row is
      `src/config/gate-coverage.yml:690` (`argv: []`, `min_scanned: 0`, `status:
      enforced`, `no_canary_reason`). `check_gate_coverage` passed with it. The
      disagreement half was enforced by nothing: rule 2 of that manifest
      ("CI-IDENTICAL INVOCATION") was an instruction to the author, and the guard never
      read a workflow. An opt-in `ci_invocation:` field now pins a row to a workflow
      file and requires an invocation there whose argument list equals `argv`. Two
      sensitivity probes, both red: argv changed to `["--release","14.16.0"]` → `argv
      [--release 14.16.0] matches no invocation there`; the consistency step deleted →
      exit 1, `the workflow does not call this gate`. Both restored, green. The floor
      is 0 and cannot honestly be higher — the row's value is `ci_invocation`, not the
      count, and its `note` says so.

## Phase 3 — Absence can never again mean silence

- [x] **3.1 Make an empty finding set a written state, not a missing file.** A release
      whose self-review genuinely reported nothing gets a ledger with an empty `findings`
      array and a reason field, so `no file` is only ever a defect and never a legitimate
      outcome.
      verify: **done.** The absent-vs-present split already existed; what did not was
      any requirement that the present-and-empty case say anything. `findings: []`
      passed while asserting nothing, so the cheapest way to satisfy the gate was to
      create an empty file. `empty_ledger_problem` now returns 1 for a ledger that
      exists, records nothing, and carries no `no_findings_reason`; the field is typed
      in `src/scripts/schemas/review-findings.schema.json` (conditional enforcement
      lives in the script because the repo's Draft-07 subset validator resolves no
      `if`/`then`). Pinned in `tests/scripts/check_finding_dispositions.test.ts`:
      empty+reason → 0, empty+no reason → 1, populated → 0, whitespace-only reason →
      problem, plus the pre-existing released/unreleased discriminator in both
      directions. Sensitivity proven, not assumed — neutralising the predicate turned 3
      of the 32 tests red, restoring it turned them green.
- [x] **3.2 Move `road-to-release-finding-ordering`'s review date and nothing else.**
      That roadmap keeps the pre-merge half; this one has changed what is true about the
      ledger's population, so its review date is stale.
      verify: **done.** `review_by: 2026-10-03` → `2026-09-20`, after this roadmap's
      completion date of 2026-09-06. Moved IN rather than out: the 29-day interval was
      set against two occurrences and two more landed inside its first two days, so the
      prediction was falsified while it ran — offset against the fact that the silence
      is now closed on the trunk, which changes what the next review has to answer.
      "No other edit" read as its own file's recorded standard rather than literally:
      that file states that moving a date without recording the occurrence "would have
      been a preference rather than a finding", so the two occurrences and the reasoning
      are recorded alongside. `status: later` untouched, phases untouched, AC-2 still
      owed.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-09-06 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | The recovered findings are written to satisfy the gate rather than recovered | implementation | Phase 1.2 can be discharged by writing an empty ledger for both versions and calling the gate green, which reproduces exactly the silence this roadmap exists to end — an absent ledger and a fabricated empty one are indistinguishable to every check in the tree. | 1.2 requires either an ingest from the uploaded artifact or an explicit note recording that recovery failed and why; 3.1 gives the empty case its own reason field so a fabricated empty ledger has to state a falsifiable claim rather than an absence. | Phase 1 — Say what is true about the two releases |
| 2 | The new caller runs on a path that never fires | implementation | A post-merge job added under the same `paths:` filter as `release-validation.yml` would only fire when one of eight listed files changes, so a release merge that touched none of them would skip the check exactly as today. | 2.1's verify requires the caller to redden on a deleted ledger, which is a change to `agents/evidence/release-findings/**` — 2.2's gate-coverage row then pins the argv so a later narrowing of the trigger is a gate failure rather than a silent skip. | Phase 2 — The gate gets a caller where a missing ledger is visible |
| 3 | The ledger becomes a formality nobody reads | product | Two releases already shipped without anyone noticing, which is evidence that the ledger's value depends on someone consuming it; making it merely mandatory produces a file per release and no behaviour change. | 3.1 forces the empty case to carry a reason rather than a shrug, and the Phase 1 record states the recurrence explicitly so a third arrival is a documented pattern rather than a fresh surprise. | Phase 3 — Absence can never again mean silence |

## Acceptance Criteria

- [x] AC-1 — `agents/evidence/release-findings/` carries a file for every version in `CHANGELOG.md` since 14.15.0, and `check_finding_dispositions` exits 0 for each of them.
- [x] AC-2 — Deleting the current version's ledger on a branch reddens a check that runs outside the `release/*` pull-request condition.
- [x] AC-3 — `src/config/gate-coverage.yml` carries a row for `check_finding_dispositions` whose `argv` matches its CI invocation exactly, and a deliberate mismatch fails `check_gate_coverage`.
- [x] AC-4 — A present-but-empty ledger and an absent ledger produce different exit codes, pinned by a test that was red before this change.
- [x] AC-5 — No new gate script and no new hook concern exists in the tree as a result of this roadmap.

### Acceptance evidence

Reproduced against this branch on 2026-09-06.

- **AC-1.** Versions since 14.15.0, read from `CHANGELOG.md` and the two archives
  its era headers point at: 14.15.0 and 14.16.0
  (`docs/archive/CHANGELOG-pre-14.17.0.md:74,16`), 14.17.0
  (`docs/archive/CHANGELOG-pre-14.18.0.md:16`), 14.18.0 (`CHANGELOG.md:486`).
  Four ledgers, four exit-0 runs of
  `./scripts-run src/scripts/check_finding_dispositions --release <v>`.
- **AC-2.** `.github/workflows/consistency.yml` — step `Shipped version carries a
  findings ledger`, in a workflow with no `release/*` condition anywhere, firing on
  `pull_request` and `push: main`. Deletion probe reproduced with the identical
  command: exit 1 deleted, exit 0 restored.
- **AC-3.** `src/config/gate-coverage.yml:690` carries the row; `argv: []` matches
  the workflow's bare invocation exactly, and the new `ci_invocation` field makes
  that a checked claim. Both mismatch directions probed red and restored — see 2.2.
- **AC-4.** `tests/scripts/check_finding_dispositions.test.ts` — the
  `empty_ledger_problem` and `exit codes` blocks. Red before the change: neutralising
  the predicate failed 3 of 32; restoring it passed 32 of 32.
- **AC-5.** Honest null, and stated as one: `git status` on this branch adds no file
  under `src/scripts/` and no hook concern. The three code files touched
  (`check_finding_dispositions.ts`, `check_gate_coverage.ts`,
  `schemas/review-findings.schema.json`) all pre-date this roadmap; both new
  behaviours are extensions of existing gates.
