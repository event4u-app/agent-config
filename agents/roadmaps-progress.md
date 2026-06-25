# Roadmap Progress

> Auto-generated — do not edit. Regenerate with `task roadmap-progress` or by running the `update_roadmap_progress` script for your install; rewritten on every roadmap create / execute / completion change (timestamp lives in git history).
>
> 5 open roadmaps · [roadmaps/](roadmaps/) · [archive/](roadmaps/archive/) · [skipped/](roadmaps/skipped/) · [later/](roadmaps/later/)

## Overall

**71 / 158 steps done · 45%**

```text
██████████████████░░░░░░░░░░░░░░░░░░░░░░   45%
```

## Open roadmaps

| # | Roadmap | Phases | Steps | Open | Done | Deferred | Cancelled | Progress |
|---|---|---:|---:|---:|---:|---:|---:|---|
| 1 | [road-to-auto-subagent-orchestration-followup.md](roadmaps/road-to-auto-subagent-orchestration-followup.md) | 1 | 5 | 5 | 0 | 0 | 0 | ░░░░░░░░░░ 0% |
| 2 | [road-to-operator-runtime-harvest.md](roadmaps/road-to-operator-runtime-harvest.md) | 6 | 20 | 8 | 7 | 5 | 0 | █████░░░░░ 47% |
| 3 | [road-to-py2ts-teardown-completion.md](roadmaps/road-to-py2ts-teardown-completion.md) | 5 | 21 | 13 | 8 | 0 | 0 | ████░░░░░░ 38% |
| 4 | [road-to-token-saving.md](roadmaps/road-to-token-saving.md) | 11 | 50 | 50 | 0 | 0 | 0 | ░░░░░░░░░░ 0% |
| 5 | [road-to-typescript-only-scripts.md](roadmaps/road-to-typescript-only-scripts.md) | 12 | 67 | 11 | 56 | 0 | 0 | ████████░░ 84% |

---

## Per-roadmap phase breakdown

### [road-to-auto-subagent-orchestration-followup.md](roadmaps/road-to-auto-subagent-orchestration-followup.md)

**Follow-up to automatic subagent orchestration — benchmark & default-flip** — 0 / 5 done (0%)

| # | Phase | State | Open | Done | Deferred | Cancelled | % |
|---|---|---|---:|---:|---:|---:|---:|
| 1 | Benchmark & default-flip (carried from parent Phase 6) | ⬜ not started | 5 | 0 | 0 | 0 | 0% |

### [road-to-operator-runtime-harvest.md](roadmaps/road-to-operator-runtime-harvest.md)

**Road to operator-runtime harvest — cross-model parity is the keystone; gate the rest on it** — 7 / 15 done (47%)

| # | Phase | State | Open | Done | Deferred | Cancelled | % |
|---|---|---|---:|---:|---:|---:|---:|
| 0 | Cross-model e2e parity (keystone; everything downstream gates on it) | ✅ done | 0 | 4 | 3 | 0 | 100% |
| 0b | Output-format governance (decision-gated on P0 evidence; NOT a first-class P2) | ⬜ not started | 1 | 0 | 0 | 0 | 0% |
| 1 | `finding_floor` eval kind (after Phase 0; calibrated, not guessed) | ✅ done | 0 | 3 | 2 | 0 | 100% |
| 2 | size-budget undershoot-floor + audited override (after Phase 1) | ⬜ not started | 2 | 0 | 0 | 0 | 0% |
| G | (GATED) — model-overlays — open ONLY on a Phase-0 RDP failure | ⬜ not started | 2 | 0 | 0 | 0 | 0% |
| 3 | (parallel track) — product surface: QA-orchestration skill + lifecycle packaging | ⬜ not started | 3 | 0 | 0 | 0 | 0% |

### [road-to-py2ts-teardown-completion.md](roadmaps/road-to-py2ts-teardown-completion.md)

**Road to py2ts Teardown Completion** — 8 / 21 done (38%)

| # | Phase | State | Open | Done | Deferred | Cancelled | % |
|---|---|---|---:|---:|---:|---:|---:|
| 0 | Pre-flight gates (block Phase 1) — council-mandated | ✅ done | 0 | 2 | 0 | 0 | 100% |
| 1 | Purge the remaining live-python test layer | 🟡 in progress | 3 | 4 | 0 | 0 | 57% |
| 2 | CI + scaffolding cleanup (requires Phase 1 complete) | 🟡 in progress | 4 | 2 | 0 | 0 | 33% |
| 2b | AI-council live-call layer (py2ts gap — transport now wired) | ⬜ not started | 2 | 0 | 0 | 0 | 0% |
| 3 | Consumer + merge readiness | ⬜ not started | 4 | 0 | 0 | 0 | 0% |

### [road-to-token-saving.md](roadmaps/road-to-token-saving.md)

**Road to token saving — measure, then cut, at constant quality** — 0 / 50 done (0%)

| # | Phase | State | Open | Done | Deferred | Cancelled | % |
|---|---|---|---:|---:|---:|---:|---:|
| 0 | Measurement substrate (the prerequisite to every cut) | ⬜ not started | 6 | 0 | 0 | 0 | 0% |
| 1 | RTK everywhere (un-gate the scope) | ⬜ not started | 4 | 0 | 0 | 0 | 0% |
| 2 | Close the RTK trigger gap | ⬜ not started | 3 | 0 | 0 | 0 | 0% |
| 3 | Deterministic RTK wrap hook + install verification | ⬜ not started | 4 | 0 | 0 | 0 | 0% |
| 4 | Thin projection (the −46k lever), gated on Phase 0 | ⬜ not started | 4 | 0 | 0 | 0 | 0% |
| 5 | Cache-aware ordering as a CI invariant (D5) | ⬜ not started | 3 | 0 | 0 | 0 | 0% |
| 6 | Retire telegraph-speak (D3) | ⬜ not started | 3 | 0 | 0 | 0 | 0% |
| 7 | Condensation ROI decision (D4) | ⬜ not started | 3 | 0 | 0 | 0 | 0% |
| 8 | Always-loaded budget linter (D6) | ⬜ not started | 3 | 0 | 0 | 0 | 0% |
| 9 | Rule-surface audit (D7), after thin is proven | ⬜ not started | 2 | 0 | 0 | 0 | 0% |
| 10 | Token-saving backlog (extensible umbrella) | ⬜ not started | 15 | 0 | 0 | 0 | 0% |

### [road-to-typescript-only-scripts.md](roadmaps/road-to-typescript-only-scripts.md)

**TypeScript-only scripts — full Python → TypeScript migration** — 56 / 67 done (84%)

| # | Phase | State | Open | Done | Deferred | Cancelled | % |
|---|---|---|---:|---:|---:|---:|---:|
| 1 | Migration infrastructure (blocking — nothing ports before this is green) | ✅ done | 0 | 13 | 0 | 0 | 100% |
| 2 | Shared libraries (`src/scripts/_lib/` — 26 files, ~6.2k LOC) | ✅ done | 0 | 4 | 0 | 0 | 100% |
| 3 | Dual-mode installer (consumer trust boundary) | ✅ done | 0 | 4 | 0 | 0 | 100% |
| 4 | Linters & CI checks (101 files, ~17.4k LOC) | ✅ done | 0 | 5 | 0 | 0 | 100% |
| 5 | Condensation & sync pipeline (8 files, ~3.8k LOC) | ✅ done | 0 | 4 | 0 | 0 | 100% |
| 6 | Hooks (16 files, ~2.6k LOC) | ✅ done | 0 | 4 | 0 | 0 | 100% |
| 7 | Memory & telemetry (dev-side, 13 files, ~3.1k LOC) | ✅ done | 0 | 3 | 0 | 0 | 100% |
| 8 | Reporting, MCP, doctor & misc tooling (~199 files, ~46k LOC) | ✅ done | 0 | 6 | 0 | 0 | 100% |
| 9 | Consumer-shipped templates (work_engine 78 / memory 7 / telemetry 9 / misc ~6 files, ~17.4k LOC) | ✅ done | 0 | 7 | 0 | 0 | 100% |
| 10 | AI council (55 files, ~17k LOC) | ✅ done | 0 | 3 | 0 | 0 | 100% |
| 11 | Installer finalization | ✅ done | 0 | 3 | 0 | 0 | 100% |
| 12 | Teardown & final audit | ⬜ not started | 11 | 0 | 0 | 0 | 0% |

---

## Ticket bundles

Materialised ticket bundles under [`agents/tickets/`](tickets/) (via `/roadmap:materialize`), counted from `agents/tickets/_registry.yml`.

| Bundle | Tickets | Status | Source roadmap |
|---|---:|---|---|
| road-to-ticket-bundles | 6 | in_progress | agents/roadmaps/archive/road-to-ticket-bundles.md |

