# Roadmap Progress

> Auto-generated — do not edit. Regenerate with `task roadmap-progress` or by running the `update_roadmap_progress` script for your install; rewritten on every roadmap create / execute / completion change (timestamp lives in git history).
>
> 3 open roadmaps · [roadmaps/](roadmaps/) · [archive/](roadmaps/archive/) · [skipped/](roadmaps/skipped/) · [later/](roadmaps/later/)

## Overall

**77 / 121 steps done · 64%**

```text
██████████████████████████░░░░░░░░░░░░░░   64%
```

## Open roadmaps

| # | Roadmap | Phases | Steps | Open | Done | Deferred | Cancelled | Progress |
|---|---|---:|---:|---:|---:|---:|---:|---|
| 1 | [road-to-py2ts-teardown-completion.md](roadmaps/road-to-py2ts-teardown-completion.md) | 5 | 21 | 13 | 8 | 0 | 0 | ████░░░░░░ 38% |
| 2 | [road-to-token-saving.md](roadmaps/road-to-token-saving.md) | 7 | 34 | 20 | 13 | 0 | 1 | ████░░░░░░ 39% |
| 3 | [road-to-typescript-only-scripts.md](roadmaps/road-to-typescript-only-scripts.md) | 12 | 67 | 11 | 56 | 0 | 0 | ████████░░ 84% |

---

## Per-roadmap phase breakdown

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

**Road to token saving — measure, then cut, at constant quality** — 13 / 33 done (39%)

| # | Phase | State | Open | Done | Deferred | Cancelled | % |
|---|---|---|---:|---:|---:|---:|---:|
| 0 | Measurement substrate (the prerequisite to every cut) | 🟡 in progress | 2 | 4 | 0 | 0 | 67% |
| 1 | RTK everywhere (un-gate the scope) | ⬜ not started | 3 | 0 | 0 | 1 | 0% |
| 2 | Close the RTK trigger gap | 🟡 in progress | 1 | 2 | 0 | 0 | 67% |
| 3 | Deterministic RTK wrap hook + install verification | ✅ done | 0 | 4 | 0 | 0 | 100% |
| 5 | Cache-aware ordering as a CI invariant (D5) | 🟡 in progress | 1 | 2 | 0 | 0 | 67% |
| 8 | Always-loaded budget linter (D6) | 🟡 in progress | 2 | 1 | 0 | 0 | 33% |
| 10 | Token-saving backlog (extensible umbrella) | ⬜ not started | 11 | 0 | 0 | 0 | 0% |

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

