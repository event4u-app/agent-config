# Roadmap Progress

> Auto-generated — do not edit. Regenerate with `task roadmap-progress` or by running the `update_roadmap_progress` script for your install; rewritten on every roadmap create / execute / completion change (timestamp lives in git history).
>
> 4 open roadmaps · [roadmaps/](roadmaps/) · [archive/](roadmaps/archive/) · [skipped/](roadmaps/skipped/) · [later/](roadmaps/later/) · **5** open blockers

## Overall

**51 / 77 steps done · 66%**

```text
██████████████████████████░░░░░░░░░░░░░░   66%
```

## Open roadmaps

| # | Roadmap | Phases | Steps | Open | Done | Deferred | Cancelled | Blocker | Progress |
|---|---|---:|---:|---:|---:|---:|---:|---:|---|
| 1 | [road-to-discipline-profile-tiering.md](roadmaps/road-to-discipline-profile-tiering.md) | 5 | 16 | 4 | 12 | 0 | 0 | [1](#blockers-road-to-discipline-profile-tiering) | ████████░░ 75% |
| 2 | [road-to-flow-learnings.md](roadmaps/road-to-flow-learnings.md) | 4 | 19 | 2 | 17 | 0 | 0 | [2](#blockers-road-to-flow-learnings) | █████████░ 89% |
| 3 | [road-to-subagent-value-realization-followup.md](roadmaps/road-to-subagent-value-realization-followup.md) | 2 | 9 | 9 | 0 | 0 | 0 | [1](#blockers-road-to-subagent-value-realization-followup) | ░░░░░░░░░░ 0% |
| 4 | [road-to-token-saving.md](roadmaps/road-to-token-saving.md) | 7 | 35 | 11 | 22 | 0 | 2 | [1](#blockers-road-to-token-saving) | ███████░░░ 67% |

---

## Per-roadmap phase breakdown

### [road-to-discipline-profile-tiering.md](roadmaps/road-to-discipline-profile-tiering.md)

**Road to discipline-profile tiering — the ~3x lift as the default shape, host-gated** — 12 / 16 done (75%)

| # | Phase | State | Open | Done | Deferred | Cancelled | % |
|---|---|---|---:|---:|---:|---:|---:|
| 1 | Tier mechanism, built inert (no default change) | ✅ done | 0 | 5 | 0 | 0 | 100% |
| 2 | Retire the measured-dead `balanced` cut | ✅ done | 0 | 3 | 0 | 0 | 100% |
| 3 | Evidence gate P1: essential on the full corpus (weak host) | ✅ done | 0 | 3 | 0 | 0 | 100% |
| 4 | Evidence gate P2 + default flip | 🟡 in progress | 2 | 1 | 0 | 0 | 33% |
| 5 | Full-tier disposition (open-source hypothesis, gated) | ⬜ not started | 2 | 0 | 0 | 0 | 0% |

<a id="blockers-road-to-discipline-profile-tiering"></a>
**Blockers**

- **non-claude-host-adapter** (owner: maintainer) — blocks Phase 4 (P2 replication run + default flip), Phase 5
  - **What to do:**
    run needs one of: (a) a fresh interactive `codex login` (stored ChatGPT
    token expired), or (b) approving non-interactive codex runs for the agent
    session (the auto-mode permission classifier blocks `codex exec` variants),
    using the isolated API-key home (`CODEX_BENCH_HOME`). Then:
    `CODEX_BENCH_HOME=<home> npx tsx src/scripts/bench_ab_v2_run.ts --host codex
    --arms vanilla,rules-kernel-dc --seeds 3 --model gpt-5-nano --budget 3.5`.
  - **Resolved when:** the harness completes a paired vanilla-vs-essential run on a non-Claude host with the deterministic scorer.

_1 blocker resolved._

### [road-to-flow-learnings.md](roadmaps/road-to-flow-learnings.md)

**Road to flow learnings — adopt the real fifth of an external orchestration suite, reject the theater** — 17 / 19 done (89%)

| # | Phase | State | Open | Done | Deferred | Cancelled | % |
|---|---|---|---:|---:|---:|---:|---:|
| 0 | Install & conformance contract | ✅ done | 0 | 7 | 0 | 0 | 100% |
| 1 | Fleet rollout (`init --fleet fleet.yaml`) | 🟡 in progress | 1 | 4 | 0 | 0 | 80% |
| 2 | Dispatch failure-policy clarification | ✅ done | 0 | 3 | 0 | 0 | 100% |
| 3 | Bench matrix expansion + per-section render | 🟡 in progress | 1 | 3 | 0 | 0 | 75% |

<a id="blockers-road-to-flow-learnings"></a>
**Blockers**

- **org-fleet-run** (owner: maintainer) — blocks Phase 1 — Fleet rollout
  - **What to do:**
    1. After the fixture test is green, run the fleet init across ≥3 real
    org repos (`fleet.yaml` listing the app/package repos) with one
    intentionally mis-permissioned repo as the seeded failure.
    2. Capture the aggregate JSON report.
  - **Resolved when:** aggregate JSON is schema-valid; the seeded repo is red with its pre-flight finding; all siblings are green and conformance-passing.
- **live-matrix-run** (owner: maintainer) — blocks Phase 3 — live matrix run (live API spend)
  - **What to do:**
    1. Invoke the matrix runner for ≥2 task families × 2 hosts from the
    matrix YAML (paired arms per the existing ab-v2 discipline).
    2. Pin the resulting report alongside the existing pinned reports.
  - **Resolved when:** one schema-valid matrix report exists and the per-section render consumes it without manual edits.

### [road-to-subagent-value-realization-followup.md](roadmaps/road-to-subagent-value-realization-followup.md)

**Follow-up to Subagent value realization** — 0 / 9 done (0%)

| # | Phase | State | Open | Done | Deferred | Cancelled | % |
|---|---|---|---:|---:|---:|---:|---:|
| 1 | Seed real telemetry | ⬜ not started | 3 | 0 | 0 | 0 | 0% |
| 2 | Re-gate the `auto: on` flip | ⬜ not started | 6 | 0 | 0 | 0 | 0% |

<a id="blockers-road-to-subagent-value-realization-followup"></a>
**Blockers**

- **telemetry-sample-size** (owner: user) — blocks Phase 1 — Seed real telemetry
  - **What to do:**
    1. Use the agent with `subagents.enabled: true` and `subagents.auto: ask`
    (or `on`) during real work, long enough to accumulate real orchestrated
    dispatches — the build work is done; only real usage produces this.
    2. Check the current-month audit log line count:
    `wc -l agents/runtime/state/audit/$(date +%Y-%m).jsonl`.
    3. Once the count reaches ≥ 20, resume this roadmap
    (`/roadmap:process-full road-to-subagent-value-realization-followup.md`).
  - **Resolved when:** `agents/runtime/state/audit/YYYY-MM.jsonl` carries ≥ 20 orchestration lines for the current month.

### [road-to-token-saving.md](roadmaps/road-to-token-saving.md)

**Road to token saving — measure, then cut, at constant quality** — 22 / 33 done (67%)

| # | Phase | State | Open | Done | Deferred | Cancelled | % |
|---|---|---|---:|---:|---:|---:|---:|
| 0 | Measurement substrate (the prerequisite to every cut) | 🟡 in progress | 2 | 4 | 0 | 0 | 67% |
| 1 | RTK everywhere (un-gate the scope) | 🟡 in progress | 1 | 2 | 0 | 1 | 67% |
| 2 | Close the RTK trigger gap | 🟡 in progress | 1 | 2 | 0 | 0 | 67% |
| 3 | Deterministic RTK wrap hook + install verification | ✅ done | 0 | 4 | 0 | 0 | 100% |
| 5 | Cache-aware ordering as a CI invariant (D5) | ✅ done | 0 | 2 | 0 | 1 | 100% |
| 8 | Always-loaded budget linter (D6) | 🟡 in progress | 1 | 2 | 0 | 0 | 67% |
| 10 | Token-saving backlog (extensible umbrella) | 🟡 in progress | 6 | 6 | 0 | 0 | 50% |

<a id="blockers-road-to-token-saving"></a>
**Blockers**

- **phase-0-golden-set** (owner: maintainer) — blocks Phase 0 Steps 1 + 2 (golden set + host-compliance probe), Phase 1 Step 1 (RTK golden-set run), Phase 8 Step 2 (quality-elbow threshold), and Phase 10 Step 1 (tier-conditional loading)
  - **What to do:**
    1. Build the held-out golden set of ~30 tasks spanning all 88 rules (see Phase 0 Step 1 comment — run the LIVE paired judge with `ANTHROPIC_API_KEY` set, estimated cost US$3–5).
    2. Run: `task bench:ab:value:quick` (or the full bench target) to produce `internal/bench/reports/quality-run.json`.
    3. Verify the paired judge output has the expected shape (model A vs model B, per-task scores, aggregate win rate).
    4. The output file is the unlock — once it exists, Phase 1 Step 1 + Phase 8 Step 2 can proceed.
  - **Resolved when:** `ls internal/bench/reports/quality-run.json` exists and `npx tsx tests/scripts/bench_ab_integrity.test.ts` exits 0.

---

## Ticket bundles

Materialised ticket bundles under [`agents/tickets/`](tickets/) (via `/roadmap:materialize`), counted from `agents/tickets/_registry.yml`.

| Bundle | Tickets | Status | Source roadmap |
|---|---:|---|---|
| road-to-ticket-bundles | 6 | in_progress | agents/roadmaps/archive/road-to-ticket-bundles.md |

