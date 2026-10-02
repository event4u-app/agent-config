---
complexity: lightweight
status: later
execution:
  mode: phase-checkpoints
parent_roadmap: road-to-a-release-record-that-says-what-it-reviewed
entry_condition:
  what: the owner resolves blocker(s) review-ceiling-is-spend, container-e2e-promotion
  when: whenever the owner takes the next step
  who: owner
estate_growth_exempt: >-
  Owner-chosen archive of road-to-a-release-record-that-says-what-it-reviewed: its deferred steps wait on owner
  blocker(s) review-ceiling-is-spend, container-e2e-promotion and are parked here instead of left active. The parent
  is archived in the same change, so the active count drops by one.
---
# Road to a release record that says what it reviewed — carried

> **Source:** carried by the archival sweep on 2026-10-02 from
> [`road-to-a-release-record-that-says-what-it-reviewed`](../archive/road-to-a-release-record-that-says-what-it-reviewed.md), which closed every other step.
> Each step below was `[~]` there and is restated verbatim as open work, so
> archiving the parent buried nothing. Blockers the steps name moved with them.

## Goal

Every step road-to-a-release-record-that-says-what-it-reviewed deferred is either done here or explicitly disposed
of — a step that still cannot run is re-deferred with its reason, never
left to read as finished.

## Phase 1 — Deferred steps carried from road-to-a-release-record-that-says-what-it-reviewed

- [ ] <!-- blocked-by: review-ceiling-is-spend | asked: no — non-interactive inbox run; the question is carried in the round disposition Owner decisions block --> **2.2 Decide what the post-cut
      delta gets.** Either review the commits after the ledger's recorded head
      when `self-review-gate.yml` finds an existing ledger, or keep the skip and
      say in the workflow notice that the post-cut delta is unreviewed. Raising
      `MAX_REVIEW_CHUNKS` is not on the table as the primary fix — the source
      names that explicitly, and the contradiction check of 16.1 is the
      cheaper shape.
      verify: `grep -n 'post-cut' .github/workflows/self-review-gate.yml` -> /post-cut/
- [ ] <!-- blocked-by: container-e2e-promotion | asked: no — non-interactive inbox run; the question is carried in the round disposition Owner decisions block --> **4.2 Wire or declare the
      container test.** Either add `tests/fixtures/installer-e2e.Dockerfile` as a
      release-validation job, or state in ADR-087's follow-up that it stays
      manual. The upgrade-preserve scenario the source asks for already runs
      in-process (`tests/scripts/install.preserve.roundtrip.test.ts`) and is not
      duplicated in the container.
      verify: `grep -rn 'installer-e2e' .github/workflows docs/decisions/ADR-087-installer-e2e-test-strategy.md` -> /installer-e2e/

## Blockers

### blocker: review-ceiling-is-spend
- **Status:** open
- **Probed:** 2026-10-01 — `grep -n 'post-cut\|delta\|unreviewed'
  .github/workflows/self-review-gate.yml` returns nothing, exit 1. The workflow
  neither runs a delta review nor prints an unreviewed-delta notice, so the
  resolved-when condition does not hold and this stays owner-reserved.
- **Owner:** owner
- **Blocks:** 2.2
- **What to do:** pick exactly one — (a) authorize a delta review of the
  commits after the ledger head when a ledger already exists (one more paid
  request per cut), or (b) keep the skip and have the workflow notice name the
  post-cut delta as unreviewed.
- **Resolved when:** `.github/workflows/self-review-gate.yml` either runs a
  delta review or prints the unreviewed-delta notice.
- **Recommendation:** (b) — it is free, it is honest, and 16.1's contradiction
  check shows a mechanical check beats more model requests.
- **If you do nothing:** every commit after a cut stays unreviewed and nothing
  in the record says so.

### blocker: container-e2e-promotion
- **Status:** open
- **Probed:** 2026-10-01 — `grep -rn 'installer-e2e' .github/workflows
  docs/decisions/ADR-087-installer-e2e-test-strategy.md` exits 0, and the hits
  are a FALSE POSITIVE on the literal string: all nine are inside ADR-087 naming
  the fixture files, `.github/workflows` contributes none, and ADR-087 line 77
  says in full *"The wiring into the required CI gate is a follow-up decision,
  kept out of scope here."* The ADR therefore does not carry the follow-up
  decision — it defers it by name — so neither limb of the resolved-when holds
  and this stays owner-reserved.
- **Owner:** owner
- **Blocks:** 4.2
- **What to do:** pick exactly one — (a) promote the container install test to a
  release-validation job (CI minutes, a Docker build per release), or (b) record
  in ADR-087 that it stays manual and opt-in.
- **Resolved when:** a workflow names `installer-e2e`, or ADR-087 carries the
  follow-up decision.
- **Recommendation:** (a) — the source's history of install regressions that
  reached a release is the class this test exists for.
- **If you do nothing:** the test stays unwired and a reviewer keeps reporting
  it as running in CI when it does not.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-10-02 | reviewer: archive-sweep/auto-carry -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | Carried steps stay blocked indefinitely | implementation | A step deferred once for elapsed time or a decision can sit here as long as it sat in the parent | It now counts as open work in the dashboard instead of as 100 %, and its blocker is listed where the estate gates count it | Phase 1 — Deferred steps carried from road-to-a-release-record-that-says-what-it-reviewed |

## Acceptance Criteria

- [ ] AC-5 — <!-- blocked-by: review-ceiling-is-spend | asked: no — non-interactive inbox run; the question is carried in the round disposition Owner decisions block --> The post-cut delta is
      either reviewed or named as unreviewed in the workflow output.
