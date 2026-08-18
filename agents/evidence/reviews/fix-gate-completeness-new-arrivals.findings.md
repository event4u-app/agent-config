# Findings: fix-gate-completeness-new-arrivals
<!-- completion-review: v1 | reviewed: 2026-08-17 | scope: f90f591a10ff4c24b9dd4eca754f797daf5d87c3cc182a627ddadd8430c34f07 | diff: c9753b151dfd7a0aa95af08e59cff298c4220318 | reviewer: r2-fresh-subagent-fix-gate-completeness-new-arrivals | prompt_hash: db94f5eff687962dd4f01997695dd85561932b364bcb53fc1ee19e574da13fb0 -->
<!-- evidence-type: v1 | type: current-binding | declared: 2026-08-17 -->

<!-- context-manifest: v1
inputs:
  diff_sha: c9753b151dfd7a0aa95af08e59cff298c4220318
  scope_hash: f90f591a10ff4c24b9dd4eca754f797daf5d87c3cc182a627ddadd8430c34f07
  roadmap: none
  roadmap_hash: none
  ac_hash: none
excluded: [session-history, agents/runtime, implementation-context]
tools: [git-diff-branch-scoped, file-read-branch-paths]
dispatched: 2026-08-17T22:58:24Z
-->

Round 1 of this review (11 findings, all fixed) is archived beside this file as
`fix-gate-completeness-new-arrivals.round1-review.md` — it was blanked by a
`--force` re-dispatch and restored from `git show`.

## Reviewer verdict on the threshold change

> The symptom is real; the stated justification is factually false, and the
> change bypasses a pre-registered lock.

Confirmed by the reviewer and re-verified by the implementer against
`agents/roadmaps/archive/road-to-hook-latency-repair.md`: the 150 ms
`pre_tool_use` cap was **not** left pointing at the bundle path by oversight. It
was deliberately re-pointed at `--via-cli` — Goal ("now binding on the real
invocation path"), pre-registered success criterion ("measured via `--via-cli`"),
Locks ("no budget relaxation"), and commit `832480ac9` ("budget unchanged", red
at 165 ms before the Phase-2 levers turned it green at cli p95 84 ms).

## Findings

| # | Sev | File:Line | Finding | Status | Reason/Ref |
|---|-----|-----------|---------|--------|------------|
| 1 | high | `src/config/hook-latency-budget.json:12-24`, `src/scripts/bench_hook_latency.ts:284-296` | The premise is false: 150 ms was pre-registered *against `--via-cli`*, under a Locks line reading "no budget relaxation". This is a relaxation documented as an oversight fix. | fixed | Reverted whole: `3952d49bf`. Premise re-verified against the archived roadmap by the implementer before reverting. |
| 2 | high | `src/config/hook-latency-budget.json:29` vs `:16-24` | Self-contradiction in one file: `honest_null_consequence` prescribes default-off + published known cost for a miss; the new block answers a miss by raising the cap. | fixed | Falls with the revert — the contradicting block no longer exists. |
| 3 | high | `docs/CLAIMS.md:367` → `docs/proof.md:73`, `docs/evaluator.md:25` | Public claim `status: backed` still reads "Budgets unchanged (pre_tool_use p95 <= 150 ms)" while the gated path enforces 200. `check_claims` only resolves the pointer, so CI cannot catch the drift. | fixed | Falls with the revert — the published claim and the enforced cap agree again at 150. |
| 4 | high | `src/scripts/check_pr_ci_current.ts:416-421` | Ledger marks every row `complete` **before** `decide()` runs, but `decide` returns on `unobservable`/`behind`/`diverged`/`ahead`/stale-head before reading any row. On `--pre-push`, local-ahead is the normal state. | fixed | `decide` now runs first; `rowsWereEvaluated` gates complete-vs-out-of-scope. Verified live on `--pre-push`: `scanned=0 planned=32 skipped=32` where it printed `scanned=32 skipped=0`. |
| 5 | medium | `src/scripts/bench_hook_latency.ts:295`, `src/config/hook-latency-budget.json:14` | Only `pre_tool_use` gets a cli cap; the other five keep the bundle-registered 250, though measured cli p95 reaches 164. The change's own argument is left unapplied to 5 of 6 events. | fixed | Falls with the revert — no per-path cap exists on any event. |
| 6 | medium | `src/config/hook-latency-budget.json:19-21` | The evidence shows the distribution straddles 150; it does not show 150 was wrong *for this path*. The competing hypothesis — the consumer path regressed since the repair closed at cli p95 84 ms — is untested and unmentioned. | **CONFIRMED** | Measured, see § The measurement. The wrapper costs 2 ms; the dispatcher regressed 81 → 146 ms. The reverted change would have raised the cap to accommodate a real regression — exactly what the lock exists to stop. The repair belongs in the dispatcher; scoping it is maintainer-owned. |
| 7 | medium | `src/scripts/bench_hook_latency.ts:303,317-321`; `docs/hook-latency.json` | The regression net has been inert on the gated path since 2026-08-03 — no top-level `invocation_path`, so `priorPath='bundle'` mismatches `cli` and CI prints "regression net skipped" every run. | OPEN | Confirmed as the cause of finding 6 going unseen: `invocation_path` is absent from `docs/hook-latency.json` (verified in the file). Still gated on 6 — recording a cli baseline today would write an 80 % regression into the reference as if it were the norm. Arm it after the dispatcher repair, not before. |
| 8 | medium | `src/config/gate-violation-baselines.json:39` | The note says `check_pr_ci_current` "took a reasoned exemption" and "two adopted a real ledger" — but this diff *withdraws* that exemption and all three adopted ledgers. | fixed | Note rewritten to what landed, including why the exemption was withdrawn. |
| 9 | medium | `src/scripts/check_gate_coverage.ts:216-222` | `ledgerOutcomeFor`'s `default:` returns `'complete'` with no `never` exhaustiveness guard; the new test enumerates a hardcoded verdict list. | fixed | `ok` handled explicitly; `default` is a `never` guard that throws. Pinned by a test that calls it with an unlisted verdict. |
| 10 | medium | `src/scripts/check_gate_coverage.ts:209-212` | `crashed` maps to `dead_scan_root` ("the root … no longer exists"); a gate that threw has no dead root. Same mis-mapping class round 1 rejected for `unavailable`→`missing_credentials`. | fixed | Vocabulary extended rather than approximated: new `check_did_not_run` reason. `estate_invalid` keeps `dead_scan_root`, which is accurate for it. |
| 11 | medium | `src/scripts/check_pr_ci_current.ts:418` | `plan()` throws `LedgerUsageError` on a duplicate target; duplicate check names occur (cancelled re-run beside a live one, two workflows sharing a job name). Throw → exit 2, in a gate promising "degrades rather than blocks". | fixed | Plan deduplicated, matching its sibling in the same diff. |
| 12 | medium | `src/scripts/build_archive_index.ts:337` | `no_applicable_files` ("resolved to zero files the check applies to") is the wrong audit sentence for "enumerated but produced no entry". | fixed | Now `check_did_not_run` — the file IS one the check applies to; the entry build produced no reading for it. |
| 13 | medium | `tests/scripts/check_gate_coverage.test.ts` | Neither new ledger adoption is tested. The whole justification for withdrawing the exemption is the dropped-row path, and nothing pins `droppedRows`, the mapping, or finding 4. | fixed | Three new cases pin `rowsWereEvaluated` (incl. the pre-push normal state), two pin the `crashed`/`estate_invalid` split and the exhaustiveness throw. |
| 14 | low | `src/scripts/build_archive_index.ts:336` | `archiveFiles(dir)` is walked a *second* time after `buildIndex` already walked it, so the plan comes from a later enumeration than the results; nothing checks `produced ⊄ planned`. | fixed | One walk feeds both, via a new `buildIndexFrom(dir, names)`; `buildIndex` delegates so its signature is unchanged. A produced-but-unplanned entry now throws. |
| 15 | low | `src/scripts/build_archive_index.ts:337-341` | The skip branch is unreachable — `buildIndex` maps 1:1 over `archiveFiles`, and a read error throws before the ledger. Verified `planned=506 skipped=0`. | fixed | Reachable by construction now that the builder consumes the planned list: a future per-file `continue` drops out of `entries` while staying in the plan. |
| 16 | low | `src/scripts/bench_hook_latency.ts:33-41` | The Gate-semantics header still names the budget key `p95_ci` as the binding cap, false under `--via-cli` once a path-aware cap exists; only the inline comment was updated. | fixed | Falls with the revert — the header is accurate again. |
| 17 | low | `src/scripts/check_gate_coverage.ts:191-192` | The `classify` docstring is orphaned above `ledgerOutcomeFor`; `classify` has lost its documentation. | fixed | Docstring returned to `classify`. |
| 18 | low | `src/config/hook-latency-budget.json:23` | Nested `review_by: 2026-11-18` is invisible to `lint_budget_ownership.ts:169`, which reads only top-level `review_by`. | fixed | Falls with the revert. |
| 19 | low | `src/config/hook-latency-budget.json:20` | "stays well below the 250 ms any_hook_event ceiling so a pathology is still caught" — `bench_hook_latency.ts:295` selects one budget object, so 250 is never applied to `pre_tool_use`. | fixed | Falls with the revert. |
| 20 | low | `src/scripts/build_archive_index.ts:352`, `src/scripts/check_pr_ci_current.ts:421` | `ledger.report()` writes unconditionally, so `--quiet` no longer means quiet in two gates. Intentional per `gate_ledger.ts:266-278`, but it changes two contracts unnoted. | fixed | Noted where the contract lives — `reportRowLedger`'s docstring states the gate is one line louder under `--quiet` and why. |

## Ordering disclosure — one fix predates this artefact

Finding 1's repair is the revert of `c9753b151`, landed as `3952d49bf` **before**
this file was committed. That inverts the artefact-before-fix ordering, and it is
recorded here rather than concealed: the reverted commit crossed a recorded lock
on a live branch, and leaving a lock violation in place while prose was written
was the worse of the two options. Every other row was OPEN when this file landed.

## The measurement

Route (c) was run. Source: GitHub Actions run **32103306843**, job 95607853943,
Static Checks, `ubuntu-latest` — all three numbers from ONE job on ONE runner, so
the comparison between them carries no hardware term.

`pre_tool_use` p95, by path and provenance (a list rather than a table on
purpose — this artefact's own linter reads every pipe row as a findings row):

- **bundle, 81 ms** — `docs/hook-latency.json`, recorded 2026-07-27.
- **bundle, 146 ms** — run 32103306843, diagnostic step, warm.
- **cli, 148 ms** — run 32103306843, diagnostic step, warm.
- **cli, 150 ms** — run 32103306843, the gate itself, cold; passed by 0 ms.

Replicated on a second run, because n=1 is the error round 2 caught in the first
place. Run **32119695614**: bundle 141 ms, cli 142 ms, gate leg 145 ms. The
wrapper exclusion now rests on three measurements across two runners (2 ms, 1 ms,
and 4 ms locally); the bundle-vs-record gap rests on two (146 and 141 against 81).

Two readings, and the first is the one that matters:

1. **The wrapper is not the cost.** cli minus bundle is **2 ms** on the same
   runner in the same run (a local run on unrelated hardware measured 4 ms, so
   the shape replicates). The premise of the reverted change — that the bundle
   number "never described this path" — is refuted by direct measurement, not
   only by the archived roadmap.
2. **The dispatcher regressed.** The bundle path itself moved 81 → 146 ms,
   **+80 %**. That is a cross-runner comparison and therefore the weaker of the
   two, but it is now the only surviving explanation, and it is corroborated by
   shape: all six events sit at 135–157 ms on *both* paths, where the recorded
   bundle set sat at 81–89 ms across the board.

Consequence for the gate: every event now hugs the 150 ms bar, so the gate
passes or fails on noise — which is why `main` flips between green and red
(151 ms in run 32008629786, 152 ms in 32052289206, 117 ms in 32060724505). The
flapping is a symptom of the regression, not a reason to move the bar.

**What this closes and what it does not.** It closes the question the reverted
change guessed at, and it retires routes (a) and (b) as answers to *this*
symptom: there is no honest-null to declare and no target to re-open, because the
budget was never the problem. It does not identify what inside the dispatcher got
slower — that needs a bisect over the window 2026-07-27 → today, and it is work
this branch does not carry.

## What would make the threshold change defensible

The reviewer's own answer — not a different number, a different route, because
the lock it crosses is recorded:

- **(a)** treat the miss as the pre-committed honest-null: hooks default-off plus
  a published known cost.
- **(b)** re-open the target through the decision-revisit route, citing the
  roadmap.
- **(c)** establish that the consumer path did **not** regress (a bundle
  measurement on the same runner; the CI bundle baseline is 81 ms) and re-arm the
  regression net with a `--via-cli` CI baseline — which the five CI runs already
  in hand could have supplied.

Route selection is maintainer-owned and is not taken by the implementer.
