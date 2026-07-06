# Roadmap Progress

> Auto-generated — do not edit. Regenerate with `task roadmap-progress` or by running the `update_roadmap_progress` script for your install; rewritten on every roadmap create / execute / completion change (timestamp lives in git history).
>
> 5 open roadmaps · [roadmaps/](roadmaps/) · [archive/](roadmaps/archive/) · [skipped/](roadmaps/skipped/) · [later/](roadmaps/later/)

## Overall

**96 / 151 steps done · 64%**

```text
██████████████████████████░░░░░░░░░░░░░░   64%
```

## Open roadmaps

| # | Roadmap | Phases | Steps | Open | Done | Deferred | Cancelled | Progress |
|---|---|---:|---:|---:|---:|---:|---:|---|
| 1 | [road-to-prompt-pattern-adoption.md](roadmaps/road-to-prompt-pattern-adoption.md) | 5 | 21 | 16 | 5 | 0 | 0 | ██░░░░░░░░ 24% |
| 2 | [road-to-py2ts-teardown-completion.md](roadmaps/road-to-py2ts-teardown-completion.md) | 5 | 21 | 11 | 10 | 0 | 0 | █████░░░░░ 48% |
| 3 | [road-to-subagent-value-realization-followup.md](roadmaps/road-to-subagent-value-realization-followup.md) | 2 | 9 | 9 | 0 | 0 | 0 | ░░░░░░░░░░ 0% |
| 4 | [road-to-token-saving.md](roadmaps/road-to-token-saving.md) | 7 | 35 | 12 | 21 | 0 | 2 | ██████░░░░ 64% |
| 5 | [road-to-typescript-only-scripts.md](roadmaps/road-to-typescript-only-scripts.md) | 12 | 67 | 7 | 60 | 0 | 0 | █████████░ 90% |

---

## Per-roadmap phase breakdown

### [road-to-prompt-pattern-adoption.md](roadmaps/road-to-prompt-pattern-adoption.md)

**Road to prompt pattern adoption** — 5 / 21 done (24%)

| # | Phase | State | Open | Done | Deferred | Cancelled | % |
|---|---|---|---:|---:|---:|---:|---:|
| 1 | Content-quoting floor | ✅ done | 0 | 4 | 0 | 0 | 100% |
| 2 | Memory-application etiquette | ⬜ not started | 5 | 0 | 0 | 0 | 0% |
| 3 | Volatile-fact freshness table | ⬜ not started | 3 | 0 | 0 | 0 | 0% |
| 4 | Micro-sharpenings (folds only, no new files) | ⬜ not started | 5 | 0 | 0 | 0 | 0% |
| 5 | Contextual reminder injection (build-to-measure, per council verdict) | 🟡 in progress | 3 | 1 | 0 | 0 | 25% |

### [road-to-py2ts-teardown-completion.md](roadmaps/road-to-py2ts-teardown-completion.md)

**Road to py2ts Teardown Completion** — 10 / 21 done (48%)

| # | Phase | State | Open | Done | Deferred | Cancelled | % |
|---|---|---|---:|---:|---:|---:|---:|
| 0 | Pre-flight gates (block Phase 1) — council-mandated | ✅ done | 0 | 2 | 0 | 0 | 100% |
| 1 | Purge the remaining live-python test layer | 🟡 in progress | 3 | 4 | 0 | 0 | 57% |
| 2 | CI + scaffolding cleanup (requires Phase 1 complete) | 🟡 in progress | 2 | 4 | 0 | 0 | 67% |
| 2b | AI-council live-call layer (py2ts gap — transport now wired) | ⬜ not started | 2 | 0 | 0 | 0 | 0% |
| 3 | Consumer + merge readiness | ⬜ not started | 4 | 0 | 0 | 0 | 0% |

### [road-to-subagent-value-realization-followup.md](roadmaps/road-to-subagent-value-realization-followup.md)

**Follow-up to Subagent value realization** — 0 / 9 done (0%)

| # | Phase | State | Open | Done | Deferred | Cancelled | % |
|---|---|---|---:|---:|---:|---:|---:|
| 1 | Seed real telemetry | ⬜ not started | 3 | 0 | 0 | 0 | 0% |
| 2 | Re-gate the `auto: on` flip | ⬜ not started | 6 | 0 | 0 | 0 | 0% |

### [road-to-token-saving.md](roadmaps/road-to-token-saving.md)

**Road to token saving — measure, then cut, at constant quality** — 21 / 33 done (64%)

| # | Phase | State | Open | Done | Deferred | Cancelled | % |
|---|---|---|---:|---:|---:|---:|---:|
| 0 | Measurement substrate (the prerequisite to every cut) | 🟡 in progress | 2 | 4 | 0 | 0 | 67% |
| 1 | RTK everywhere (un-gate the scope) | 🟡 in progress | 1 | 2 | 0 | 1 | 67% |
| 2 | Close the RTK trigger gap | 🟡 in progress | 1 | 2 | 0 | 0 | 67% |
| 3 | Deterministic RTK wrap hook + install verification | ✅ done | 0 | 4 | 0 | 0 | 100% |
| 5 | Cache-aware ordering as a CI invariant (D5) | ✅ done | 0 | 2 | 0 | 1 | 100% |
| 8 | Always-loaded budget linter (D6) | 🟡 in progress | 1 | 2 | 0 | 0 | 67% |
| 10 | Token-saving backlog (extensible umbrella) | 🟡 in progress | 7 | 5 | 0 | 0 | 42% |

### [road-to-typescript-only-scripts.md](roadmaps/road-to-typescript-only-scripts.md)

**TypeScript-only scripts — full Python → TypeScript migration** — 60 / 67 done (90%)

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
| 12 | Teardown & final audit | 🟡 in progress | 7 | 4 | 0 | 0 | 36% |

---

## Ticket bundles

Materialised ticket bundles under [`agents/tickets/`](tickets/) (via `/roadmap:materialize`), counted from `agents/tickets/_registry.yml`.

| Bundle | Tickets | Status | Source roadmap |
|---|---:|---|---|
| road-to-ticket-bundles | 6 | in_progress | agents/roadmaps/archive/road-to-ticket-bundles.md |

