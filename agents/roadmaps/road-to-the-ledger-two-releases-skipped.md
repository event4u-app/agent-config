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

## Phase 1 — Say what is true about the two releases

- [ ] **1.1 Record the two absent ledgers as a finding, with the exit codes.**
      Write `agents/evidence/analysis/release-ledger-absence-2026-09-06.md` naming
      the three ledgers that exist, the two that do not, the exit-1 reproduction
      for each absent version, and the single-caller fact for the gate. No repair
      in this step — the record is what the next reader needs before any of it is
      changed.
      verify: the file exists and each of its five factual lines carries the command
      that produced it; `ls agents/evidence/release-findings/` in the file matches
      the directory.
- [ ] **1.2 Recover the self-review output for 14.17.0 and 14.18.0, or record that it is gone.**
      The `self-review-findings` artifact is uploaded per PR with `retention-days: 30`
      (`.github/workflows/self-review-gate.yml`), so both releases are inside the window
      at the time of writing. Either ingest via
      `check_finding_dispositions --ingest <findings.json> --release <version>`, or write
      the ledger with an explicit empty finding set and a note saying the run produced none.
      verify: `agents/evidence/release-findings/14.17.0.json` and `14.18.0.json` both exist,
      and `./scripts-run src/scripts/check_finding_dispositions --release 14.17.0` and
      `--release 14.18.0` both exit 0.

## Phase 2 — The gate gets a caller where a missing ledger is visible

- [ ] **2.1 Run the disposition check against the released version on `main`.** Add a
      job or step that executes `check_finding_dispositions --release <package version>`
      after the release merge lands, not only on the `release/*` pull request. The
      script needs no new flag — the bare `--release` path already resolves a shipped
      version and already exits 1 on an absent ledger.
      verify: a branch whose `agents/evidence/release-findings/<current version>.json`
      is deleted reddens the new caller, and restoring the file greens it.
- [ ] **2.2 Register the check in `src/config/gate-coverage.yml` with a CI-identical `argv`.**
      It is currently in neither `gate-coverage.yml` nor `release-gate-locality.yml`, so
      nothing notices if the caller is removed again.
      verify: `./scripts-run src/scripts/check_gate_coverage` passes with the new row and
      fails when the row's `argv` and the workflow's invocation disagree.

## Phase 3 — Absence can never again mean silence

- [ ] **3.1 Make an empty finding set a written state, not a missing file.** A release
      whose self-review genuinely reported nothing gets a ledger with an empty `findings`
      array and a reason field, so `no file` is only ever a defect and never a legitimate
      outcome.
      verify: `check_finding_dispositions` distinguishes an empty-but-present ledger
      (exit 0) from an absent one (exit 1), and a test pins both directions.
- [ ] **3.2 Move `road-to-release-finding-ordering`'s review date and nothing else.**
      That roadmap keeps the pre-merge half; this one has changed what is true about the
      ledger's population, so its review date is stale.
      verify: `agents/roadmaps/later/road-to-release-finding-ordering.md` carries a review
      date after this roadmap's completion date and no other edit.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-09-06 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | The recovered findings are written to satisfy the gate rather than recovered | implementation | Phase 1.2 can be discharged by writing an empty ledger for both versions and calling the gate green, which reproduces exactly the silence this roadmap exists to end — an absent ledger and a fabricated empty one are indistinguishable to every check in the tree. | 1.2 requires either an ingest from the uploaded artifact or an explicit note recording that recovery failed and why; 3.1 gives the empty case its own reason field so a fabricated empty ledger has to state a falsifiable claim rather than an absence. | Phase 1 — Say what is true about the two releases |
| 2 | The new caller runs on a path that never fires | implementation | A post-merge job added under the same `paths:` filter as `release-validation.yml` would only fire when one of eight listed files changes, so a release merge that touched none of them would skip the check exactly as today. | 2.1's verify requires the caller to redden on a deleted ledger, which is a change to `agents/evidence/release-findings/**` — 2.2's gate-coverage row then pins the argv so a later narrowing of the trigger is a gate failure rather than a silent skip. | Phase 2 — The gate gets a caller where a missing ledger is visible |
| 3 | The ledger becomes a formality nobody reads | product | Two releases already shipped without anyone noticing, which is evidence that the ledger's value depends on someone consuming it; making it merely mandatory produces a file per release and no behaviour change. | 3.1 forces the empty case to carry a reason rather than a shrug, and the Phase 1 record states the recurrence explicitly so a third arrival is a documented pattern rather than a fresh surprise. | Phase 3 — Absence can never again mean silence |

## Acceptance Criteria

- [ ] AC-1 — `agents/evidence/release-findings/` carries a file for every version in `CHANGELOG.md` since 14.15.0, and `check_finding_dispositions` exits 0 for each of them.
- [ ] AC-2 — Deleting the current version's ledger on a branch reddens a check that runs outside the `release/*` pull-request condition.
- [ ] AC-3 — `src/config/gate-coverage.yml` carries a row for `check_finding_dispositions` whose `argv` matches its CI invocation exactly, and a deliberate mismatch fails `check_gate_coverage`.
- [ ] AC-4 — A present-but-empty ledger and an absent ledger produce different exit codes, pinned by a test that was red before this change.
- [ ] AC-5 — No new gate script and no new hook concern exists in the tree as a result of this roadmap.
