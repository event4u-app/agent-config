# Roadmap Progress

> Auto-generated — do not edit. Regenerate with `task roadmap-progress` or by running the `update_roadmap_progress` script for your install; rewritten on every roadmap create / execute / completion change (timestamp lives in git history).
>
> 3 open roadmaps · [roadmaps/](roadmaps/) · [archive/](roadmaps/archive/) · [skipped/](roadmaps/skipped/) · [later/](roadmaps/later/) · **3** open blockers

## Overall

**22 / 45 steps done · 49%**

```text
████████████████████░░░░░░░░░░░░░░░░░░░░   49%
```

## Open roadmaps

| # | Roadmap | Phases | Steps | Open | Done | Deferred | Cancelled | Blocker | Progress |
|---|---|---:|---:|---:|---:|---:|---:|---:|---|
| 1 | [road-to-discipline-profile-tiering-followup.md](roadmaps/road-to-discipline-profile-tiering-followup.md) | 1 | 3 | 3 | 0 | 0 | 0 | [1](#blockers-road-to-discipline-profile-tiering-followup) | ░░░░░░░░░░ 0% |
| 2 | [road-to-subagent-value-realization-followup.md](roadmaps/road-to-subagent-value-realization-followup.md) | 2 | 9 | 9 | 0 | 0 | 0 | [1](#blockers-road-to-subagent-value-realization-followup) | ░░░░░░░░░░ 0% |
| 3 | [road-to-token-saving.md](roadmaps/road-to-token-saving.md) | 7 | 35 | 11 | 22 | 0 | 2 | [1](#blockers-road-to-token-saving) | ███████░░░ 67% |

---

## Per-roadmap phase breakdown

### [road-to-discipline-profile-tiering-followup.md](roadmaps/road-to-discipline-profile-tiering-followup.md)

**Follow-up to discipline-profile tiering — full-tier disposition** — 0 / 3 done (0%)

| # | Phase | State | Open | Done | Deferred | Cancelled | % |
|---|---|---|---:|---:|---:|---:|---:|
| 1 | Full-tier disposition (carried from parent Phase 5) | ⬜ not started | 3 | 0 | 0 | 0 | 0% |

<a id="blockers-road-to-discipline-profile-tiering-followup"></a>
**Blockers**

- **legacy** (owner: user) — blocks entire roadmap
  - **What to do:**
    an open-source-host adapter exists AND the maintainer wants
  - **Resolved when:** condition described above clears

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

