---
complexity: structural
status: later
parent_roadmap: road-to-binding-findings
review_by: 2026-10-03
relates:
  - slug: road-to-the-unwritten-ledger
    relation: disjoint
    note: >
      Same ledger, same gate, deliberately non-overlapping halves. That roadmap
      wrote the missing 14.16.0 ledger and closed the post-tag read — an absent
      ledger for a released version no longer exits 0. This one still owns WHEN
      the consumer reads inside the pull-request workflow, which needs a
      synthetic release/* pull request no autonomous run may open. It also
      recorded the second occurrence below and moved this review_by; it did not
      touch this roadmap status or its AC-2 demonstration, which is still owed.
estate_growth_exempt: "Adds one later/ roadmap to receive the release-findings ORDERING guarantee, which road-to-binding-findings could not close: demonstrating it end to end requires creating a synthetic release/* pull request, and release/* is named in non-destructive-by-default's Hard-Floor table, which no autonomous run lifts. The four authorization defects and the ledger ingestion in that roadmap are independently verified and close there; holding them open behind an administrative and Hard-Floor dependency would be worse than partitioning. It also receives the three non-blocking findings dispositioned accepted_risk, so each carries a named receiver rather than an expiring note. That roadmap archives in the same change, so the active count falls by one."
---
# Road to the release-finding ordering guarantee

> **Parked, not abandoned.** Created 2026-09-03 from `road-to-binding-findings`,
> on a 2/2 AI-council verdict to partition rather than either weaken the
> acceptance criterion or hold four verified fixes hostage to it.
>
> **Resume when** a maintainer can create a synthetic `release/*` pull request,
> which is the one step an autonomous run may not take.

## The defect, measured to the second

A release pull request reported nine self-review findings, two of them
high-severity security, and the disposition gate showed **green**:

| Event | Time (UTC) |
|---|---|
| job `Blocking review findings dispositioned` completed | `2026-09-03T12:51:54Z` |
| the machine-readable findings comment was posted | `12:53:25Z` |
| the pull request merged | `12:58:10Z` |

The consumer reads findings from the pull request's comments. It read them
**91 seconds before the block it reads existed**, hit the `allowEmpty` pass with
an absent ledger and zero reported findings, and printed green.

`renderReview` appends that machine block unconditionally on the
findings-present path, independent of `--enforce`. So this is an **ordering**
defect between two workflow files, not an enforcement setting — which is why
turning enforcement on would not have caught it.

The ledger half is closed: `agents/evidence/release-findings/14.15.0.json` now
carries all nine findings with complete dispositions, ingested from the original
`self-review-findings` artifact (run `33757633620`, sha256
`826c002033733060932dd3113199c462079597f563aac4d01a0c61203134ff07`). What
remains is making the ordering **impossible**, and demonstrating that it is.

### Second occurrence — 14.16.0, one day later

Recorded 2026-09-04 by `road-to-the-unwritten-ledger`. The date above was set
when this defect had **one** measured occurrence. It now has two, and the second
arrived inside a single release cycle:

| | first occurrence | second occurrence |
|---|---|---|
| release | 14.15.0, shipped 2026-09-03 | 14.16.0, shipped 2026-09-04T03:40:10Z |
| shape | the consumer read the comments 91 seconds before the block existed | the ledger was never written at all |
| what the gate printed | green, via `allowEmpty` with an absent ledger | green, via `allowEmpty` with an absent ledger |
| findings left unrecorded | nine, two high-severity security | ten, one `high (Blocking)` security |

The second occurrence is the same fail-open reached by a different road. There
was no ordering race in 14.16.0 — `agents/evidence/release-findings/14.16.0.json`
simply did not exist, while PR #1836 had merged reporting ten findings. The gate
read the absence as zero. Measured before the fix:

```
$ npx tsx src/scripts/check_finding_dispositions.ts --release 14.16.0
✅  no recorded findings for 14.16.0 (ledger absent)   exit 0
```

**Why the date moved: 2026-12-03 → 2026-10-03.** A review date is a prediction
about how long a parked item can wait without costing anything. That prediction
was 91 days, made with one occurrence on record; the observed recurrence interval
turned out to be **one day**. Ninety-one days is not a defensible interval
against a one-day recurrence, so it is cut to 29. The date moves and nothing
else does — `status: later` is unchanged, and AC-2 below is still owed, because
the sibling closed the post-tag read and not the in-workflow ordering this
roadmap exists for. Recording the occurrence without moving the date would have
left a falsified prediction standing; moving the date without recording the
occurrence would have been a preference rather than a finding.

## Why an autonomous run cannot finish it

The demonstration the acceptance criterion asks for — a release pull request
whose review reports a planted high-severity finding cannot show green while
that finding is absent from the ledger — needs a synthetic branch named
`release/*`, because the consumer job's own `if` requires it. `release/*` is
named in [`non-destructive-by-default`](../../../src/rules/non-destructive-by-default.md)'s
Hard-Floor table, and nothing lifts that: not autonomy, not a roadmap step, not
a standing instruction.

The two council seats split on a second obstacle and the split is recorded
rather than resolved, because it does not change the disposition. One held that
a synthetic `release/*` branch inherits the required-check configuration and so
the red state cannot be shown without admin rights to remove it. The other held
that required-ness gates *merging*, not the visibility of a red check, so the
demonstration needs only the authority to open a qualifying pull request and run
Actions. The second reading is the better one on the mechanics; the first is
still the reason to have a human present, and the Hard Floor decides it either
way.

## Phase 1 — the ordering mechanism

The producer and consumer live in **different workflow files**, so `needs:` is
not expressible between them — the roadmap's own second option was impossible
as written. Four candidates, with their costs:

- [ ] **1.1 Decide the mechanism, and record why the other three lost.**
      **(a) Merge the jobs** into the producer's workflow with `needs:`.
      Ordering becomes free; the required-check NAME changes, so branch
      protection must be re-pointed by a repo admin, and the consumer
      workflow's own path filter — which includes
      `agents/evidence/release-findings/**` specifically for this job — is left
      orphaned.
      **(b) Cross-workflow artifact download** with `run-id` and a token,
      resolving the producer run by head SHA. No check-name change; needs a new
      pinned third-party action, and it must tolerate a legitimately absent
      artifact without reintroducing the fail-open path.
      **(c) `workflow_run` trigger.** Executes the default-branch copy of the
      workflow and attaches no check to the pull request, so the check run must
      be created through the API and the workflow needs `checks: write`, which
      it does not have today.
      **(d) In-process** — call the disposition check straight after the
      findings are written. Ordering is guaranteed by sequence, and it destroys
      the "deterministic, never fail-open" property the consumer job's own
      comment asserts, because the producer job is `continue-on-error: true`.
      Both seats chose **(b)**; it is recorded here as a decision to take with
      the evidence rather than as one already taken.
      verify: the decision names the mechanism, the three rejected options and
      the cost that rejected each; the required-check name is stated as changed
      or unchanged.
- [ ] **1.2 Make the wait terminal-state-aware, which is the half both seats
      added.** A missing artifact has three causes that a naive `allowEmpty`
      cannot tell apart: the producer is still running, the producer completed
      with no findings, or the producer legitimately skipped (it is
      `continue-on-error: true` and no-ops without an API key, and its upload is
      `if-no-files-found: ignore`). Treating all three as "no findings" is the
      fail-open path being fixed, one level down.
      verify: each of the three states is distinguished, and the keyless-release
      case has an explicit written policy rather than falling through.
- [ ] **1.3 Emit a completion manifest the consumer can wait ON.** The
      artifact's absence cannot be the signal, because absence is ambiguous per
      1.2. A manifest that is always produced — carrying the run id, the head
      SHA and a findings count that may be zero — makes "the producer finished
      and found nothing" a positive fact.
      verify: the manifest exists on a keyless run, on a zero-findings run and
      on a findings run, and the consumer distinguishes all three.

## Phase 2 — the demonstration, and the fixture path it needs

- [ ] **2.1 Add a fail-closed fixture-injection flag.** There is no way to plant
      a finding today: findings come from a live model call, so a demonstration
      would need real spend with a non-deterministic result. A
      `--findings-in <file>` flag makes the demonstration deterministic, and it
      must **fail closed if it is ever invoked on a real release**: a mandatory
      companion flag that cross-checks the branch name and refuses to run on an
      actual `release/X.Y.Z`. Fixture mode entering a real release pipeline
      would be a worse defect than the one being demonstrated.
      verify: the flag refuses on a real `release/X.Y.Z` branch, a test asserts
      the refusal, and the refusal is not bypassable by argument order.
- [ ] **2.2 Demonstrate it once, end to end, with a human present.** Touch a
      path that triggers both workflows on a synthetic `release/*` branch; run
      the producer with the fixture finding; confirm its terminal manifest;
      confirm the unchanged `finding-dispositions` check is RED while the
      finding lacks a disposition; add the disposition; confirm the same check
      goes green.
      verify: the job timings show the read happened after the finding existed,
      and both the red and the green state are recorded with their run ids.
- [ ] **2.3 Cover the three states 1.2 names, not only the happy path.** The
      producer still running, the manifest missing, the producer failing, and
      the keyless run. Those four are where the fail-open risk actually lives;
      a demonstration of the findings path alone would leave them unmeasured.
      verify: each state has a recorded outcome, and none of them is green with
      an undispositioned blocking finding.

## Phase 3 — the three non-blocking findings carried here

Each is dispositioned `accepted_risk` in
`agents/evidence/release-findings/14.15.0.json` with its reason, and named here
so the disposition points somewhere rather than expiring.

- [ ] **3.1 `9b91a14e9d35` — MCP tool descriptions are absent from the
      attack-surface inventory** of `src/skills/agent-security-review/SKILL.md`,
      while the ADR its council cited names tool poisoning. Real, and no phase
      of the parent roadmap touched that skill.
      verify: the inventory names tool descriptions as a surface, or states why
      they are out of scope for that skill.
- [ ] **3.2 `0687468c0d65` — no measurement that target-bound grants are safer
      than the 30-minute window.** The argument for the change was structural,
      not empirical, and the ADR does not claim otherwise. Closing this is a
      measurement design: it needs a corpus of real authorization turns and a
      definition of "safer" that separates a refused-but-intended merge from an
      authorized-but-unintended one.
      verify: either the measurement exists with its corpus and definition, or
      the ADR states that its basis is structural.
- [ ] **3.3 `26c9fdbcedc2` — a deferred note in an ADR's evidence table.**
      Low/style. Editing an accepted decision record for presentational reasons
      is a worse trade than the archaeology it saves, which is why it was
      accepted rather than fixed.
      verify: the note is resolved, or the decision to leave it stands with a
      stated reason.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-09-03 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | The fixture flag reaches a real release | implementation | A `--findings-in` path that can be invoked on an actual `release/X.Y.Z` would let a planted finding set stand in for a real review — a worse defect than the ordering hole it exists to demonstrate | 2.1 requires a fail-closed branch-name cross-check with its own test, and requires the refusal to survive argument reordering | Phase 2 — the demonstration, and the fixture path it needs |
| 2 | The new wait reintroduces fail-open | implementation | A missing artifact has three causes and `allowEmpty` cannot tell them apart; a cross-workflow download that tolerates absence silently rebuilds the hole one level down | 1.2 makes the three states distinguishable a prerequisite, and 1.3 replaces absence-as-signal with an always-produced manifest | Phase 1 — the ordering mechanism |
| 3 | The required-check name changes and nobody re-points branch protection | product | Option (a) renames the required check, and a required check that no longer exists is a check that passes by not running | 1.1 requires the decision to state whether the name changes, and both council seats chose the option that does not change it | Phase 1 — the ordering mechanism |
| 4 | The demonstration is treated as done because the code is written | product | Phase 1 is verifiable by an autonomous run and Phase 2 is not, so the mechanism could land and be reported as the guarantee | AC-2 below names the demonstration separately from the mechanism, and the parent roadmap's own AC-2 is carried here rather than marked met | Phase 2 — the demonstration, and the fixture path it needs |

## Acceptance Criteria

- [ ] AC-1 — The disposition check cannot read findings before they exist: the
      mechanism is chosen with its three rejected alternatives and their costs
      recorded, and the required-check name is stated as changed or unchanged.
- [ ] AC-2 — A release pull request whose self-review reports a high-severity
      security or claim finding cannot show a green `finding-dispositions` check
      while that finding is absent from the ledger, demonstrated once end to end
      on a synthetic branch, with the job timings recorded.
- [ ] AC-3 — Producer-still-running, manifest-missing, producer-failed and
      keyless-run each have a recorded outcome, and none is green with an
      undispositioned blocking finding.
- [ ] AC-4 — Fixture injection refuses on a real `release/X.Y.Z` branch, with a
      test.
- [ ] AC-5 — The three carried findings each reach one of: resolved, or a stated
      decision to leave them with a reason.
