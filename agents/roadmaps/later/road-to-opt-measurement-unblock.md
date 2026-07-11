---
status: later
complexity: lightweight
---

# Road to opt measurement unblock — one judge run cascade-unblocks the token program

> **Parked in `later/` by maintainer decision (2026-07-12).**
> Blocked until: the pre-existing active roadmap portfolio (the
> roadmaps that were active before the 2026-07-11 `road-to-opt-*`
> cluster landed) is worked down, OR the maintainer explicitly and
> exclusively requests execution of this roadmap. Do NOT pick this
> file up as part of another task or an autonomous sweep.

> Part of the `road-to-opt-*` cluster (2026-07-11 sweep). The single
> highest-leverage finding: five roadmaps (~40 % of the active portfolio —
> token-saving, token-proof-and-story, request-scoped-rule-load, and the
> parked HUMAN-MEASUREMENT + discipline-tiering follow-ups) funnel through
> ONE failed gate: the 2026-07-09 judge run was inconclusive (p = 0.196,
> 33 % judge inconsistency, 69 % length confound). A second bottleneck —
> the archive's single most-deferred item — is the cross-model parity
> eval, whose two named blockers have partially resolved.

## Goal

Execute the judge rerun with a length-neutral design, close the
non-Claude replication that gates the `discipline_profile: auto` default
flip, and re-scope the cross-model parity eval whose corpus blocker no
longer holds — turning the portfolio's measurement debt into verdicts.

## Prerequisites

- PR #885 (golden-set consumer corpus, council-labelled) merged — the
  labelling debt this gate previously carried is closed there; verify
  live state before Phase 1 (`gh pr view 885 --json state,mergedAt`).
- Paid-run authorization: standing maintainer authorization for
  spend-to-unblock exists (estimate + scope per run still disclosed
  before each billable call).
- After #885 merges: move `agents/tmp/golden-set-labelling-worksheet.md`
  → `agents/tmp.old/` in the main checkout (processed; labels landed via
  council per the amended criterion).

## Phase 1 — length-neutral judge rerun (the cascade key)

- [ ] Design the rerun against the three recorded failure modes of the
      2026-07-09 attempt: (a) length confound — enforce length-matched
      pairs or a length-partialed scoring rubric; (b) judge
      inconsistency — stronger judge tier + the blind second-judge /
      Cohen's-κ pass (built by `road-to-opt-retrieval-and-memory`
      Phase 3; reuse, don't duplicate); (c) underpowered comparison —
      fix the sample size from the golden corpus before the first
      billable call.
- [ ] Render the cost estimate (`council:estimate`-class disclosure) and
      confirm the run budget in-session before executing.
- [ ] Execute the paired judge run; write the verdict artifact under
      `internal/bench/reports/` with κ and confound diagnostics inline.
- [ ] Disposition step: on a trustworthy verdict (either direction),
      update the token-program tracking table in
      `road-to-token-proof-and-story.md` and unblock/close the dependent
      gates; on a second inconclusive, record WHY with the diagnostics
      and stop — no third run without a design change.

**Exit criteria:** verdict artifact exists with κ ≥ agreed floor and no
length confound flag; the token-program table cites it.

## Phase 2 — non-Claude lift replication (discipline_profile auto flip gate)

The `discipline_profile: auto` default has never shipped because lift
was measured on one vendor only. The codex host adapter is built and
unit-tested; the run is blocked on auth + spend.

- [ ] Restore non-Claude host auth (codex or the cheapest available
      non-Anthropic host with a built adapter); verify with a 1-task
      smoke before the paired run.
- [ ] Run the paired vanilla-vs-`essential` discipline benchmark on the
      non-Claude host per the parked design in
      `agents/tmp.old/road-to-alternatives/road-to-non-claude-lift-replication.md`.
- [ ] Disposition: replicated lift → ship the `auto` default flip
      (settings template + install bundle regen + docs); null/negative →
      record the honest null and keep the current default, citing the
      2026-07-10 flow-learnings two-host precedent (claude ceilings +
      codex capability=0 for those families).

**Exit criteria:** a recorded verdict either ships the flip or closes it
with evidence; no placeholder default remains unexplained.

## Phase 3 — cross-model e2e parity eval: re-scope the keystone

The archive's most-deferred item (4+ roadmaps). Original blockers: no
delegable-task corpus (NOW EXISTS — `internal/bench/orchestration/corpus/`)
and a harness that cannot execute model-emitted subagent calls (still
true — re-scope, don't assume).

- [ ] Write the re-scoped design doc: smallest harness capability that
      lets ≥ 2 vendors execute the SAME delegable corpus end-to-end
      (candidate: council-transport-backed execution of the existing
      corpus tasks rather than a full in-host harness).
- [ ] Decide build-vs-defer on that design with the maintainer (cost
      estimate attached). If deferred again, park with the concrete
      missing capability named — not the generic "harness doesn't exist".
- [ ] If built: run the parity eval; feed the per-host finding-count
      distributions into `finding_floor` calibration and promote
      `finding_floor` from inert mechanism to enforcing CI gate (its
      recorded deferral reason was exactly this missing calibration
      input).

**Exit criteria:** design doc + explicit build/defer decision recorded;
if built, `finding_floor` calibration data exists and the gate is armed.

## Further candidates (demand-gated; NOT scheduled)

- `agent-config audit` readiness funnel (archive: competitive-borrow
  P2.1) — substrate now exists (`project/health` + `project-analyzer`),
  effort dropped to M; trigger stays ≥ 3 real "is my repo ready" asks.
- Selective install `--skill` / `--division` flags (P2.2, 3× recurring
  ask) — trigger stays ≥ 3 install-scope requests.
- Python doc-generators → TS port (competitive-borrow Decision 2 reason
  fully inverted by the completed migration) — S effort; fold into the
  next touch of those generators.

## Acceptance criteria

- Every phase ends in a RECORDED verdict (ship / null / defer-with-named-
  blocker) — the anti-pattern this roadmap exists to kill is "gate
  pending" with no diagnosis.
- All billable runs disclose estimates before execution; human/repo-admin
  gates stay human.
- No re-labelling of the golden corpus (council labels are final per the
  2026-07-11 amendment).