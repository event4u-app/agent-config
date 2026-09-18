---
complexity: lightweight
status: draft
execution:
  mode: phase-checkpoints
owner: maintainer
relates: []
estate_growth_exempt: >-
  A calendar-triggered red that blocks every pull request in the repository from 2026-09-18,
  including ones that touch none of the four skills. `check_corpus_staleness` measures
  2026-06-07 + 103 days against a 100-day bound for `refresh_cadence: quarterly`, so the
  tree went red without any commit. Verified red at `origin/main` in a clean probe worktree,
  and this branch's diff touches none of the four skills. Recorded rather than fixed because
  an honest fix re-checks four upstream sources; bumping `last_checked` without doing that is
  manufacturing the evidence the field exists to carry.
estate_offset_exempt: >-
  No offset is available. No active roadmap owns corpus refresh, and the four skills belong to
  four unrelated subject areas, so there is no sibling to archive in exchange. Parking this
  instead of recording it would leave a repository-wide CI stop with no owner.
---
# Road to corpus refresh 2026 Q3

> **Source:** `check_corpus_staleness` on PR #2058, 2026-09-18 — a red this branch did not
> cause, spotted while settling its own CI and dispositioned rather than handed back
> (`fix-what-you-see`).

## Goal

The four quarterly corpora whose `upstream.last_checked` crossed the 100-day bound on
2026-09-18 are re-checked against their real upstream sources, and `last_checked` is updated in
both `data/manifest.json` and `ATTRIBUTION.md` — updated because someone looked, never to clear
a red. When this is done, `check_corpus_staleness` is green because the corpora are fresh, not
because the field was moved.

## Phase 1 — Re-check the four corpora

Each step is one skill. They are independent and can land separately; none may be closed by
editing a date alone.

- [ ] **1.1 Re-check `accessibility-auditor` against its upstream.** Confirm the WCAG criteria
      set the corpus carries still matches the published source, record what changed, then
      update `last_checked` in `data/manifest.json` and `ATTRIBUTION.md` together.
      verify: `./scripts-run src/scripts/check_corpus_staleness` no longer names
      `accessibility-auditor`, and the diff shows either a content change or an explicit note
      that the upstream is unchanged at the checked revision.
- [ ] **1.2 Re-check `api-design` against its upstream.** Same contract as 1.1.
      verify: the gate no longer names `api-design`, with the same diff evidence.
- [ ] **1.3 Re-check `database` against its upstream.** Same contract as 1.1.
      verify: the gate no longer names `database`, with the same diff evidence.
- [ ] **1.4 Re-check `threat-modeling` against its upstream.** Same contract as 1.1.
      verify: the gate no longer names `threat-modeling`, with the same diff evidence.

## Phase 2 — Decide whether the bound is the right shape

- [~] **2.1 Ask whether four corpora sharing one `last_checked` date is a cadence or a batch.**
      All four read 2026-06-07, so they were stamped together and will expire together, every
      quarter, mid-PR. Whether that is intended — a deliberate quarterly sweep — or an artefact
      of one bulk edit is a maintainer question, not an agent call. Human-gated, not started.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-09-18 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | The date is bumped without a real re-check | implementation | The cheapest way to make this gate green is to edit four dates, which produces a green gate over stale corpora and destroys the only signal the field carries | Every step's `verify:` demands diff evidence of a content change or an explicit unchanged-at-revision note, never the date alone | Phase 1 — Re-check the four corpora |
| 2 | The four expire together again next quarter | product | A shared stamp date means a shared expiry, so the same four-way red returns in ~100 days whatever this roadmap does | Phase 2 puts the cadence-versus-batch question to the maintainer rather than re-stamping and moving on | Phase 2 — Decide whether the bound is the right shape |

## Acceptance Criteria

- [ ] AC-1 — `check_corpus_staleness` is green, and each of the four skills' diffs shows a
      content change or a recorded unchanged-at-revision finding.
- [ ] AC-2 — The cadence-versus-batch question in Phase 2 is answered by the maintainer, or is
      still open and visibly `[~]`.
