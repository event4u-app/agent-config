---
status: ready
complexity: lightweight
---

# Road to opt measurement unblock — one judge run cascade-unblocks the token program

> **Un-parked 2026-07-11 on the maintainer's explicit exclusive request.**
> This roadmap's value is billable **verdicts** — judge / benchmark runs that,
> under automation, are interactive `/dev/tty` gates and money-moving Hard-Floor
> actions. The autonomously-completable work is the **design prep** those runs
> need: the length-neutral rerun design (Phase 1 step 1) and the re-scoped
> cross-model parity-eval design doc (Phase 3 step 1). Every paid execution, host
> auth, and build-vs-defer decision is surfaced, not auto-fired. Prereqs
> re-verified live: PR #885 MERGED; the delegable corpus
> `internal/bench/orchestration/corpus/` EXISTS.

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

- [x] Design the rerun against the three recorded failure modes of the
      2026-07-09 attempt: (a) length confound — enforce length-matched
      pairs or a length-partialed scoring rubric; (b) judge
      inconsistency — stronger judge tier + the blind second-judge /
      Cohen's-κ pass (built by `road-to-opt-retrieval-and-memory`
      Phase 3; reuse, don't duplicate); (c) underpowered comparison —
      fix the sample size from the golden corpus before the first
      billable call.
      <!-- done: docs/design/length-neutral-judge-rerun.md — (a) ±15% length-matched pairs AND a length-partialed rubric with a Spearman-ρ confound flag; (b) strongest judge tier + blind second judge reported via the EXISTING cohensKappa/judgeKappa in check_quality_regression.ts (reuse, not rebuild), κ ≥ 0.60 floor; (c) pre-registered n for 80% power at ≥10pp, fixed before the first call, sign-test/McNemar. Report schema + disposition specified. -->
- [x] Render the cost estimate (`council:estimate`-class disclosure) and
      confirm the run budget in-session before executing.
      <!-- done (2026-07-12): estimate disclosed in-session (~$40-45 expected, judges probed for $0.02, 1-task smoke $0.36) against the maintainer's confirmed EUR 250 cap; hard --max-usd 250 guard enforced in the runner. -->
- [x] Execute the paired judge run; write the verdict artifact under
      `internal/bench/reports/` with κ and confound diagnostics inline.
      <!-- done (2026-07-12): bench_quality_rerun.ts executed live — n=90 pre-registered, ±15% token-band pairing (25 surviving / 65 dropped), double blind judges claude-opus-4-8 + gpt-4o both orders, kappa + Spearman diagnostics inline; artifact internal/bench/reports/quality-rerun-length-neutral.json; actual $34.80 (cap $250). -->
- [x] Disposition step: on a trustworthy verdict (either direction),
      update the token-program tracking table in
      `road-to-token-proof-and-story.md` and unblock/close the dependent
      gates; on a second inconclusive, record WHY with the diagnostics
      and stop — no third run without a design change.
      <!-- done (2026-07-12): SECOND INCONCLUSIVE (kappa=0.46 < 0.60 floor; rho=0.45 flagged; 7 agreed decisive) -> per the pre-registered design: WHY recorded (docs/benchmark.md § Length-neutral judge RERUN — the signal is structurally length-dominated and judge-noise-dominated in BOTH designs) and STOP, no third run without a categorically different method. Token-program table updated: gate CLOSED-BY-DIAGNOSIS in road-to-token-proof-and-story.md. -->
      <!-- verify: test -f docs/design/length-neutral-judge-rerun.md -->

**Exit criteria:** verdict artifact exists with κ ≥ agreed floor and no
length confound flag; the token-program table cites it.

## Phase 2 — non-Claude lift replication (discipline_profile auto flip gate)

The `discipline_profile: auto` default has never shipped because lift
was measured on one vendor only. The codex host adapter is built and
unit-tested; the run is blocked on auth + spend.

- [x] Restore non-Claude host auth (codex or the cheapest available
      non-Anthropic host with a built adapter); verify with a 1-task
      smoke before the paired run.
      <!-- done (2026-07-12): codex CLI installed + logged in (ChatGPT); 1-task LIVE smoke green on --host codex (bench_ab_v2_run --limit 1 --arms vanilla, report written). Arm-mapping corrected against the parked design: the codex 'essential' arm is rules-kernel-dc (package-rdp is claude-host-only). -->
- [x] Run the paired vanilla-vs-`essential` discipline benchmark on the
      non-Claude host per the parked design in
      `agents/tmp.old/road-to-alternatives/road-to-non-claude-lift-replication.md`.
      <!-- done (2026-07-12): bench_ab_v2_run --host codex --arms vanilla,rules-kernel-dc --seeds 3 --model gpt-5.5. First fire misfired (model pin omitted → 180/180 API-rejected, $0); re-fired with the pin, checkpoint-resumed after an external stop at 130/180. Final: 180 runs, 78 valid (100 rejected by the ChatGPT-account usage limit, balanced 50/52 across arms — no arm bias; 2 timeouts). Raw report local-only per .gitignore (internal/bench/reports/ab-v2/2026-07-12T15-32-13Z-ab-v2-paired.json); stats in docs/benchmark.md. -->
- [x] Disposition: replicated lift → ship the `auto` default flip
      (settings template + install bundle regen + docs); null/negative →
      record the honest null and keep the current default, citing the
      2026-07-10 flow-learnings two-host precedent (claude ceilings +
      codex capability=0 for those families).
      <!-- done (2026-07-12): HONEST NULL — on gpt-5.5/codex (n=37 valid pairs) capability 92%→89% (McNemar p=1.0) and discipline 1.000→0.892 (Δ=−0.108, Wilcoxon p=0.0225 on 7 non-zero pairs, directionally NEGATIVE). No replicated lift → discipline_profile default stays vendor-granular (no auto flip), consistent with the 2026-07-10 two-host precedent and the gpt-5-mini replication failure. Limitation published: usage-limit truncation (78/180 valid, balanced across arms). Re-open path: full uncapped 180-run replication. Section in docs/benchmark.md. -->

**Exit criteria:** a recorded verdict either ships the flip or closes it
with evidence; no placeholder default remains unexplained.

## Phase 3 — cross-model e2e parity eval: re-scope the keystone

The archive's most-deferred item (4+ roadmaps). Original blockers: no
delegable-task corpus (NOW EXISTS — `internal/bench/orchestration/corpus/`)
and a harness that cannot execute model-emitted subagent calls (still
true — re-scope, don't assume).

- [x] Write the re-scoped design doc: smallest harness capability that
      lets ≥ 2 vendors execute the SAME delegable corpus end-to-end
      (candidate: council-transport-backed execution of the existing
      corpus tasks rather than a full in-host harness).
      <!-- done: docs/design/cross-model-parity-eval.md — re-scopes to council-transport dispatch (consult over ≥2 ExternalAIClient vendors) of a task-adapter over internal/bench/orchestration/corpus/, measuring per-host finding output (NOT running model-emitted subagent calls — the still-open blocker is designed around, not assumed away). Feeds finding_floor calibration (cross-host lower-envelope) to promote it from inert to an enforcing gate. Build-vs-defer cost inputs specified. -->
- [x] Decide build-vs-defer on that design with the maintainer (cost
      estimate attached). If deferred again, park with the concrete
      missing capability named — not the generic "harness doesn't exist".
      <!-- done 2026-07-12: maintainer decided BUILD + count-pass, ceiling $8 (in-session numbered-options answer "Bauen + Count-Pass (~$3–8)"). -->
- [x] If built: run the parity eval; feed the per-host finding-count
      distributions into `finding_floor` calibration and promote
      `finding_floor` from inert mechanism to enforcing CI gate (its
      recorded deferral reason was exactly this missing calibration
      input).
      <!-- done 2026-07-12: bench_parity_count.ts LIVE pass (5 tasks × 2 vendors × 3 repeats, $0.16 of the $8 ceiling) → internal/bench/reports/parity-count.json. Floors calibrated via cross-host lower envelope (orch-01: 5, orch-02: 3, orch-03: 1, pv-01: 2; pv-02 control excluded, 0/0 clean). finding_floor comment flipped to ENFORCING in run_skill_evals.ts; claim cross-model-parity-count backed in docs/CLAIMS.md; section in docs/benchmark.md. Unit tests tests/scripts/bench_parity_count.test.ts (5 pass). -->
      <!-- GATED: billable multi-vendor run, depends on the build decision. -->
      <!-- verify: test -f docs/design/cross-model-parity-eval.md -->

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