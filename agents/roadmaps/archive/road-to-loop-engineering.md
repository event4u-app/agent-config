---
complexity: lightweight
execution:
  mode: autonomous
---

# Road to Loop-Engineering Discipline

> Lock the loop-engineering verdict into the package: close exactly one measured loop (periodic live trigger-eval pass-rate), record every rejection with revisit-ifs in an ADR, add zero new loop surfaces.

## Goal

Ship (a) an ADR that records the disposition of all 8 identified open measure→adjust loops plus 5 written loop anti-pattern rejections with revisit-if conditions, and (b) a rotating live trigger-eval pass-rate run inside the existing weekly canary workflow whose floor breach is surfaced to the maintainer — with no new loop surface, no new rule, and no new contract added.

## Context

"Loop engineering" (June 2026 naming wave) was researched (5 provided articles + independent web sweep) and ground-truthed against this repo before authoring:

**Research verdict.** The technique is mostly a rebranding of ReAct + eval-driven development + bounded autonomous agents. Two contributions survive scrutiny: the design vocabulary (verification-signal quality, budget shape, maker/checker topology, on-disk state) and a precise failure-mode taxonomy (verification collapse, comprehension debt, cognitive surrender, reward hacking measured at ~15% of runs in SE tasks, cost blowup on stuck retries, context rot on long runs). Practitioner consensus: loop value equals verification-signal quality; hard caps everywhere; maker ≠ checker; start closed/human-gated; loops that change the agent config itself must be eval-driven with keep/revert.

**Repo ground truth.** The package already implements the serious end of the canon: bounded verify-fix loops (`verify-repair-loop` max_attempts=3, N=3 validation budget, context-hygiene 15/25 abort), maker/checker (`judge-*` cluster, `verify-budget`), human-gated self-improvement (5-stage pipeline, ≥2 independent evidence), and measurement infra (bench:ab, trigger evals, golden sets, orchestration telemetry). An inventory found 8 loops where "measure" exists but "adjust" is not wired — see disposition table below. Ground-truth correction the council pass did not yet know: loop #3 (trigger evals) is already ~80% closed — `task ci` runs `check-trigger-evals` (structure + 90-day freshness forcing periodic live re-runs) and `check-trigger-eval-presence` (shrink-only grandfather ratchet, frozen at 221); a weekly canary workflow with a secrets-gated live tier exists (`.github/workflows/cross-model-canary.yml`). What is genuinely open: the weekly live tier smokes a single skill; the pass-rate across the 51 existing `evals/triggers.json` suites is never measured on cadence, so trigger-accuracy regressions between manual 90-day refreshes stay invisible.

**Why so small.** The maintainer constraint (single maintainer, token frugality, no daemon per ADR-088) inverts the loop-closure default: when human review + `git revert` is cheaper than designing, maintaining, and debugging a closed loop — and false positives consume irreplaceable maintainer time — the loop is net-negative infrastructure. Skipping loops here is the good system.

## Disposition table — the 8 open loops

| # | Open loop | Disposition | Why |
|---|---|---|---|
| 1 | Orchestration telemetry → default demotion | **REJECT auto; stays manual** | token_delta spikes for legitimate reasons; demotion needs qualitative judgment of the failure mode. Demotion gate (`orchestration-benchmark-gate.md`) already defines the manual path. |
| 2 | Artifact-engagement → skill pruning | **REJECT auto; counts stay ONE input** | Selection bias: low engagement ≠ low value (security/error-recovery/niche skills); high engagement ≠ high value. `evidence-based-pruning` contract's ≥2-independent-evidence floor is correct; engagement alone never sufficient. |
| 3 | Trigger-eval pass rate on cadence | **CLOSE (Phase 2)** | Direct, deterministic-per-fixture metric of the actual failure mode; low false-positive; adjust-step = surfaced report, not auto-action. Structure/freshness/presence gates already closed in `task ci`. |
| 4 | bench-drift blocking | **REJECT; stays advisory** | High false-positive (timing variance, intentional behaviour change); metric is a proxy, not the failure mode. Manual `bench:baseline-ready` flip stays the gate. |
| 5 | Golden-set coverage ratchet (14/91 rules) | **DEFER; growth stays opportunistic** | A hard ratchet pressures toward test-optimized rules over useful rules; most uncovered rules are judgment-shaped, not mechanically verifiable. `road-to-golden-set-coverage.md` continues as the deliberate path. |
| 6 | Live-app verdict source (browser/running-app) | **DEFER (unchanged)** | Already deferred by `road-to-live-app-verdict.md`; category boundary — the package ships config, not apps. |
| 7 | Measured rule-adherence signal | **REJECT** | Requires annotated corpus + threshold tuning (multi-week build, ongoing maintenance) for marginally earlier restatement; ADR-054 heuristics are intentionally coarse. |
| 8 | Success-signal re-evaluation at eval date | **REJECT auto** | Retroactive eval of sunk decisions has low marginal information; active use surfaces bad promotions. Field stays authored documentation. |

## Gap-table — loop-engineering canon vs existing surface

| Canon item | Verdict | Where it already lives / lands |
|---|---|---|
| Machine-checkable success signal | CUT | `verify-before-complete`, `verify-budget`, verification-mechanics |
| Iteration + budget caps, escalation | CUT | N=3 budget (`autonomous-execution`), `verify-repair-loop` max_attempts, do-and-judge 2-revision ceiling, context-hygiene aborts |
| Maker ≠ checker (cross-model) | CUT | `judge-*` cluster, `verify-budget` change-size floor, `subagent-orchestration` |
| On-disk state, fresh context per cycle | CUT | Roadmap files + checkbox flips + git as state (ADR-088 boundary), `agent-handoff` |
| Eval-driven keep/revert for config changes | KEEP (narrow) | Phase 2 — periodic live pass-rate over existing trigger-eval suites |
| Failure-mode boundary documentation | KEEP | Phase 1 — ADR "loop-engineering boundaries" |
| Run-until-condition goal loop | CUT (reject) | Task-execution scope creep; existing engines + contracts are the ceiling |
| Fresh-context re-loop mode for roadmap processing | CUT (reject) | Wrong domain: roadmap execution is bounded-scope by design; `roadmap-process-loop` halt conditions are the defensible pattern |
| Nightly self-check loop | FOLD | Into the existing weekly canary workflow (Phase 2 extends it; no new surface) |
| Consumer loop-design templates (`/loop:design`) | CUT (reject) | Scope creep; agents answer loop-design asks in conversation using the package's existing vocabulary |
| Loop-design contract/checklist artifact | CUT (reject) | Premature formalization; the caps/judges/state patterns are embedded in the existing loop surfaces and enforced by existing rules |

## Council notes (2026-07-10, debate, 2 rounds)

Members: anthropic/claude-sonnet-4-5 + openai/gpt-4o; actual cost $0.13. Converged (round 2, both members):

- Close **only** the trigger-eval loop; reject #1/#2/#4/#8; defer #5/#6/#7. Zero new loop surfaces. No loop-design contract (premature formalization for a single-maintainer project whose patterns emerged from built loops). No consumer templates.
- **Automation threshold** (adopted as the ADR's core principle): automate a measure→adjust loop only when the metric is a DIRECT measure of the failure mode, AND expected false-positive rate is low (<~5%), AND human judgment adds no unique information to the decision. "A number exists" is not "the number is trustworthy" (metric-existence fallacy).
- Reversibility of the adjust-step is not sufficient justification: investigating a false-positive automated action costs 20–45 min maintainer time vs a 10-second revert — opportunity cost is the binding constraint.
- Recorded revisit-ifs: reopen a rejected closure only on evidence of >2 h/month maintainer time saved in a structurally similar single-maintainer project; demote the Phase-2 closure back to advisory if its false-positive rate exceeds ~10% over 50+ runs.

## Phase 1 — ADR: loop-engineering boundaries

Record the verdict as a stable artifact so future sessions do not relitigate; correct the loop inventory with the ground truth above.

- [x] Author `ADR-NNN-loop-engineering-boundaries.md` via the `adr-create` skill: Context (research + inventory summary, neutral source descriptors only), Decision (automation-threshold principle; disposition table for the 8 loops incl. already-closed corrections; the 5 written rejections: open-ended hill-climbing on the config, autonomous config self-editing, unattended multi-hour runs without checkpoint, metric-optimizing loops without golden-set anchoring, cross-session loop state in external services restating ADR-088), Consequences, Alternatives (loop-design contract, consumer templates — rejected), References. Each rejection carries its revisit-if.
- [x] Regenerate the ADR index (`scripts/adr/regenerate_index.ts` per `adr-create`).
- [x] Add one-line disposition pointers citing the ADR to the three artifacts whose open loops it settles: `docs/contracts/evidence-based-pruning.md` (#2), `src/agent-src/contexts/execution/orchestration-benchmark-gate.md` (#1), `docs/contracts/measurement-baseline.md` (#4). One line each, no restated rationale.
- [x] Verify: `./scripts-run src/scripts/check_refs` (or the repo's reference checker) green on the touched files; ADR index contains the new entry (grep).

Exit criteria: ADR file exists with all 8 dispositions + 5 rejections + revisit-ifs; index regenerated; 3 pointer lines present; reference check green on touched files.
Rollback: delete the ADR file, regenerate index, revert the 3 pointer lines.

## Phase 2 — Periodic live trigger-eval pass-rate (the one closure)

Extend the existing weekly canary — no new workflow, no PR blocking, no local /dev/tty change (the manual local gate on `skill_trigger_eval` stays exactly as designed; the canary's secrets-gated live tier is the already-accepted cost-bounded automation path).

- [x] Extend `.github/workflows/cross-model-canary.yml` `periodic-live` job: after the existing smoke, run the live trigger-eval over a deterministic rotating subset of skills that have `evals/triggers.json` (rotation keyed on ISO week number, ~5 skills/week → full pass over all suites in ~10 weeks), using the existing runner's non-interactive path for CI (mirror how `cross_model_smoke.ts` authorizes; if the runner offers no CI-safe entry, add a `--ci` flag to `skill_trigger_eval.ts` that is active only when the workflow-provided key secrets are present — never weakening the local /dev/tty gate).
- [x] Enforce the existing per-domain precision/recall floors from `recordTriggerEval.ts` (`DOMAIN_FLOORS`) on the rotation results: any suite below floor fails the scheduled job (a failed weekly run is the maintainer notification; PRs are never blocked).
- [x] Upload the per-skill result JSONs as a workflow artifact so a breach is diagnosable without re-running.
- [x] Keep the no-secrets path a logged no-op (existing pattern) so forks and secretless clones never fail.
- [x] Add a false-positive counter note to the ADR's revisit-if section: demote this job to advisory (non-failing) if breaches are >~10% spurious over 50+ suite-runs.
- [x] Verify: workflow YAML passes `task lint-workflow-security` <!-- carve-out: new-gate-verification -->; rotation selection logic proven by a dry-run invocation (MockRouter) locally; `git diff` confirms no change to the local interactive gate.

Exit criteria: canary workflow contains the rotation step; dry-run invocation of the rotation path exits 0; workflow-security lint green; local interactive gate byte-identical.
Rollback: revert the workflow edit (single file) and the optional `--ci` flag commit; no state to clean up.

## Acceptance criteria

- ADR merged into `docs/decisions/` with all 8 dispositions, 5 rejections, revisit-ifs; index regenerated; 3 pointer lines landed.
- Weekly canary measures live trigger-eval pass-rate on a rotating subset with floor-breach surfacing; zero PR-blocking behaviour added; local /dev/tty gate untouched.
- Zero new loop surfaces, zero new rules, zero new contracts, zero consumer-facing loop commands added by this roadmap.
- No artifact duplicates an existing one; every FOLD/CUT in the gap-table is auditable against the tables above.

## Provenance

External inputs (neutral descriptors; real links retained encrypted per `link_crypto.ts`):

- Source A — June-2026 synthesis article that popularized the term (role-shift framing, failure-mode vocabulary): `ENC1:6LkzDZU1/r/UP+X4dxtgTQvfjOF2xGgdJ9Xm/BFLcDRzdHN5jkW4VlyLRWp2qSwmt7sN4Xm8Dg/BuqlFXiVe+2og5HvjkFU4Aq3S3hyMCINOHRM1u0YCXbvLcq51Hz4MI4zZhjG0saUXbQStLQ==`
- Source B — July-2025 while-loop agent technique write-up (fresh context per iteration, state on disk, one task per loop, greenfield-only caveats): `ENC1:OjfHVnB4VSHdfPun6OQOYKYA7d5BXZThdVYoV2sb/FvPej9HwiUPCpEDj0phfjOUZMeC42Dz4C8qD+9FElDW6DkOa4xb9YQW3s3nNmLbiNQm8Td8jvCR8rGapA==`
- Source C — host-vendor long-horizon harness guidance (immutable feature lists, one feature per session, e2e verification, commit-per-step): `ENC1:T2AazJOvB/Wc+n9g0dUdJNfM+aDDKNHUDt62l622l+dNOQc09e3b6HL0toWpAXFxpLKqAxnpPK+y05O3dQpGUpBTB5E4uyvOhMcuCKBI3u0BfAWD7yFqIJOeyWDKPoEKo6rAtezd7Drf2c6o3CunEHAGGMyp+AhvoD75gNFIZD+JZPWt0yD1118Rz/dNGLOJZA==`
- Source D — reward-hacking measurement paper (~15% of SE-task runs): `ENC1:qEX2wB5eYyKQX0TVz+6yiC5rHFfn3VBnA2vzZDA7xtyZq86zoKGtz8TOU7a1E/xeCztqE9Vxs4xU2qJr2BROFNhmGE8xe7ODDEBL985XThErUyEv6TZgDcUkTwu15FlW/Q==`
- Source E — vendor pattern-taxonomy article (loop-pattern list, prerequisites; marketing-adjacent): `ENC1:V5YP6M74y3B/Rw7b1zkwAFYagP29JU8aE/IZbZKx2F46TT286cnZAETdoov2BeCPFmXQsgAsG6m7wb23qbl5KfRzmjvW4lavvhc7H7sHgk78P8kDM7/9GP6O5a2MiFwt33vXbMMaFK/AISCc6jpKAUXhGEhRWWeJXoBYW0OiFB72OS4SkEav0w==`

Maintainer-provided small-loop/big-loop prompt templates (chat input, 2026-07-10) were evaluated and folded into the gap-table verdicts (consumer templates: CUT).
