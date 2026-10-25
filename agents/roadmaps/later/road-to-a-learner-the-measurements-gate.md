---
complexity: structural
status: later
execution:
  mode: phase-checkpoints
owner: maintainer
entry_condition:
  what: road-to-a-policy-the-measurements-write is archived, so the policy table, the claim review dates and the measured release section exist for this file to read
  when: after that roadmap's PR merges; Phase 1 runs then, Phases 4-5 need one release of shadow records
  who: the maintainer, whose subscription runs the Phase 1 measurements on his own machine
review_by: 2026-12-15
estate_growth_exempt: "later_roadmaps +1: the owner's 2026-10-23 demands (run the open measurements, measurements ride with every PR, AC learns locally) need measurement windows, subscription runs, a ratified gate and a release of shadow data; the 2026-10-24 directive sends such work to later/ rather than the active estate, and no existing later/ roadmap owns a dispatch-policy learner."
estate_offset_exempt: "Owner search: grep -rlF -e local-policy -e dispatch-policy -e policy:digest -e learning.local_policy over agents/roadmaps/*.md, later/ and stubs/ returned only road-to-a-policy-the-measurements-write, which this round also adds. Parked by the 2026-10-24 directive: everything here needs a measurement window, a paid or subscription run, a ratified gate or a release of shadow data, none of which a run can produce."
relates:
  - slug: road-to-a-policy-the-measurements-write
    relation: extends
    note: "Reads its table, its review dates and its release section; nothing here starts before it is archived."
  - slug: road-to-a-cold-start-paid-once-carried
    relation: disjoint
    note: "later/. Owns the reuse-guard flip; the window claims it waits on are measured here (1.3), the flip stays there."
  - slug: road-to-experience-loop-owner-decisions
    relation: extends
    note: "later/. Its 9.6 question is answered by the owner turn of 2026-10-23 (decision A5 here); the state-store bound of resident-process-governance still governs Phase 5's apply step."
depends:
  - road-to-a-policy-the-measurements-write
---
# Road to a learner the measurements gate

> **Source:** `agents/tmp.old/inbox-2026-10-ar/` — the part of the owner's 2026-10-23 demands
> that cannot close inside one run. Parked by the owner directive of 2026-10-24
> (`agents/evidence/owner-directives/2026-10-24-throughput-over-ceremony.md`).

## Goal

The open dispatch measurements are run or dated; a PR that moves a policy row without a
measurement pinned to its own head fails CI; every spawn leaves an outcome the head
declared; and on each project AC records, in shadow, what a local policy would choose —
applying it only for rows whose local window clears the release claim's own bars, once
the learner's own claim `local-policy-net-win` is backed. Nothing is uploaded, nothing
tracked is written by the learner, and floors never move.

## Phase 1 — Run the open measurements (owner demand 1)

- [ ] **1.1 Instruction-skip quality:** paired tasks with a planted constraint in a
      fixture `CLAUDE.md`, skip-with-carrier vs keep; bar: constraint honoured equally,
      verify rate within 5 pp. Pre-register the claim first.
      verify: the claim is `backed` or `resolved-null`; the policy rows cite it.
- [ ] **1.2 Council rows:** `council-vs-solo-baseline` (pre-registered) and a
      `min_rounds` 2-vs-1 pair; light-seat (`--safe-mode`) verdict agreement.
      verify: three claims decided or dated; the council rows cite them.
- [ ] **1.3 Windows:** read `warm-worker-cold-start-relief`, `resume-non-inferiority`,
      `rate-limit-stops-per-drain`, `fresh-spawns-per-drain` at their `review_by`.
      verify: each claim names its window and read date.
- [ ] **1.4 Tier rerun above the cap:** reopen the 60-pair cap (decision A2 of the
      archived tier roadmap) or record why not; the bound needs about 93 pairs at one
      lite failure.
      verify: both tier claims decided or carry the dated reason.
- [ ] **1.5 Egress (e) and the canary root cause:** the paired-quality endpoint needs 5
      discordant pairs; `AnthropicFetchRouter.routeAsync` must keep the HTTP status so a
      dead key and an empty balance differ.
      verify: (e) decided; one scheduled canary run with non-zero input on every suite.
- [ ] **1.6 Free hands and free jury** on the public-artifact corpus, once a keyless
      route is configured on the maintainer's machine.
      verify: the four claims decided or dated.

## Phase 2 — One bench kit (M4 of the source)

- [ ] **2.1 Generalise `internal/bench/pinned_tree.ts` and `price_freshness`** into a
      shared kit every dispatch bench uses; port advisor-pairing to the pinned tree.
      verify: the kit's self-test reds a dirty tree, a stale price row and a corpus
      answer that disagrees with its archive.

## Phase 3 — Measurements ride with the PR (owner demand 3)

- [ ] **3.1 `check_policy_change_measured`:** a PR changing a row's `value` or `claim`
      must add a kit report pinned to one of its own commits and move the cited claim's
      status in the same PR. Report mode one release, then enforcing. Needs a
      gate-coverage row and a council ratification.
      verify: a fixture PR changing a tier row without a report reds in enforcing mode.
- [ ] **3.2 End report mode for `review_by`:** the release cut refuses an overdue row
      without a dated reason.
      verify: a fixture overdue row refuses the cut.

## Phase 4 — A spawn leaves an outcome (M5, M8 of the source)

- [ ] **4.1 Escalation link:** a slice re-dispatched at a higher tier within the same
      task marks its first record `outcome: escalated`.
      verify: a fixture pair yields one escalated record.
- [ ] **4.2 Head-declared verify:** the delegation policy's verify step writes
      `--verified pass|fail|skipped` through the existing orchestration CLI on spawns,
      not only unpaid asks; missing stays `none`.
      verify: a fixture session writes `pass` and `none`.
- [ ] **4.3 Retention:** audit, exposure and spawn-guard streams keep 90 days, pruned on
      write (decision A7).
      verify: `vitest run` on a fixture stream with one 91-day-old line and one
      1-day-old line keeps exactly the newer one after the next append.

## Phase 5 — The local policy: shadow, then apply (owner demand 4)

- [ ] **5.1 Pre-register `local-policy-net-win`** before anything applies: tokens per
      verified task lower, verify-fail within 5 pp, shadow choice vs release choice.
      verify: the claim row precedes 5.4.
- [ ] **5.2 Shadow:** compute, from the last 30 days of records, what each `learnable`
      row would choose inside its admitted range; record `would_choose` beside the
      release value; act on the release value. Deleting the file changes nothing AC does,
      so it is not a state store under `docs/contracts/resident-process-governance.md:80`.
      verify: shadow lines exist for every learnable row after a week.
- [ ] **5.3 Visible:** `doctor` lists local deviations; `policy:digest` prints them with
      counts as the next release's first bench candidates; one reset command.
      verify: a fixture deviation prints in both places; reset restores the table.
- [ ] **5.4 Apply, per row,** only where ADR-118 § 1 holds and `local-policy-net-win` is
      backed; auto-revert on the escalation kill; never a floor, never a tracked file.
      The apply step makes the local file a state store, so it needs the
      resident-process-governance carve-out first (governance edit, ratified).
      verify: a seeded breach reverts an applied row; a row without `automation_basis`
      never applies.

## Kill register

| # | Not done | Why |
|---|---|---|
| K1 | Remote telemetry or a central learner | ADR-118 § 3; not asked for |
| K2 | Bandits, ML routers | ADR-118 § 3.1; a table plus bars is enough until it is not |
| K3 | Learning floors, egress, chair rules, free-route ceilings | `local: fixed` in the table |
| K4 | Paid or subscription runs in CI | spend stays on the maintainer's machine |

## Decisions

| ID | ownership | resolved by | decision | evidence | revisit if |
|---|---|---|---|---|---|
| A5 | product-owned | owner | AC may consume local experience at runtime, bounded by Phase 5 | owner turn 2026-10-23: "ac soll lokal lernen im laufe der zeit. damit soll sich das nutzungsverhalten verbessern und auch optimieren." | the owner narrows or withdraws it |
| A6 | reversible-technical | agent | The learner opt-out is a settings key `learning.local_policy: shadow \| apply \| off` | the draft's blocker rested on a 2026-10-12 directive "against new settings keys"; that directive asks the opposite, a setting to switch the retro off (`agents/evidence/owner-directives/2026-10-12-retro-inbox-2026-10-o.md`, directive e) | a settings-class ADR forbids it |
| A7 | reversible-technical | agent | Audit, exposure and spawn-guard streams get 90-day retention, reversing the janitor's exclusion of cumulative streams (`src/scripts/janitor.ts:66-76`) | a learner needs bounded windows; the streams hold counts, not content, so pruning loses no evidence a claim cites | a backed claim cites a window older than 90 days |

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-10-25 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | The learner optimises cost on a weak quality signal | product | `verified` is mostly `none`, so rows drift cheaper on noise. | Phase 4 before Phase 5; 5.1 measures the learner itself. | Phase 5 — The local policy: shadow, then apply (owner demand 4) |
| 2 | Measurements never finish | product | Windows stay empty. | Each claim carries `review_by`; the release section lists the overdue ones. | Phase 1 — Run the open measurements (owner demand 1) |

## Acceptance Criteria

- [ ] AC-1 — Every Phase 1 claim is `backed`, `resolved-null` or carries a dated reason.
- [ ] AC-2 — A row change without its measurement fails CI.
- [ ] AC-3 — Spawn records carry an outcome other than `none` where one exists.
- [ ] AC-4 — The local policy ran one release in shadow and `local-policy-net-win` is decided before any row applies.
