# Roadmap: agent-memory integration (agent-config side)

> Which commands, rules, and skills consume the optional
> `@event4u/agent-memory` package, how they detect its presence, and
> how they degrade when it is absent.

## Status

Follow-up to [`road-to-project-memory.md`](road-to-project-memory.md).
That roadmap defines the settings split and the repo-shared curated
files (agent-config's minimal baseline memory, works without
`agent-memory`). This roadmap defines **how `agent-config` talks to
`agent-memory` when it is installed** — and how every integration
point stays usable when it is not.

The companion specs describing the memory package itself live in
[`agent-memory/`](agent-memory/).

## Prerequisites

- [x] `.agent-project-settings` + settings layering — Phase 0 of
      [`road-to-project-memory.md`](road-to-project-memory.md)
- [x] [`agent-memory/road-to-consumer-integration-guide.md`](agent-memory/road-to-consumer-integration-guide.md) agreed
- [x] [`agent-memory/road-to-promotion-flow.md`](agent-memory/road-to-promotion-flow.md) agreed
- [x] [`agent-memory/road-to-decay-calibration.md`](agent-memory/road-to-decay-calibration.md) agreed
- [x] [`road-to-role-modes.md`](road-to-role-modes.md) retrieval
      contract (`auto_load_shared_types` per mode)

## Vision

A flat contract, two code paths:

- **Agent-memory present** → skills retrieve via its API, signals
  flow into quarantine, promotion drafts PRs against repo files
- **Agent-memory absent** → skills retrieve via file lookup,
  proposals are explicit via `/propose-memory`, no operational layer

No skill fails because `agent-memory` is missing. No skill is half-
wired when it is present. The detection helper is the only branch.

## Non-goals

- **No** auto-install of `agent-memory` from `agent-config`
- **No** embedded fallback that tries to imitate `agent-memory`'s
  trust-scoring or decay — the file fallback is **only** static file
  lookup
- **No** bidirectional data sync between repo files and the
  operational store — repo files are authoritative; the operational
  store is a superset that decays
- **No** feature in `agent-config` that hard-requires `agent-memory`

## Detection helper

Single source of truth: `scripts/memory_status.py` (and a bash thin
wrapper for shell callers). Returns one of:

| Status | Meaning | Consumer action |
|---|---|---|
| `absent` | Package not installed or CLI/MCP not on PATH | Use file fallback only |
| `misconfigured` | Installed but `health()` fails (DB down, schema missing) | Surface a warning once per session; fall back to file |
| `present` | Installed and `health()` returns OK within 2s | Route retrieval through agent-memory API |

Result is cached for the session. Skills call a single helper, not
repeat probes. Exposed both via Python import and as a CLI flag
(`--memory-status`).

## 6-type → 4-tier mapping (recap)

Full rationale in
[`agent-memory/road-to-decay-calibration.md`](agent-memory/road-to-decay-calibration.md).
Agent-config uses the table below when choosing which memory types
to consult in which role mode.

| Type (agent-config) | Tier (agent-memory) | Retrieval key |
|---|---|---|
| Ownership | Semantic | Path glob |
| Domain invariants | Semantic | Path + domain tag |
| Architecture decisions | Semantic | Path + decision id |
| Product rules | Semantic | Feature area + rule id |
| Historical patterns | Procedural | Path + symptom |
| Incident learnings | Episodic | Path + class-of-failure |

Working-memory (session-local, ~hours) is never stored in the repo
files and is only ever a concern of `agent-memory` when present.

## Access policy per role mode

Echoes `memory.retrieval.auto_load_shared_types` in
`.agent-project-settings`. Identical whether `agent-memory` is present
or not — the difference is only the retrieval backend.

| Role mode | Auto-loaded types |
|---|---|
| Developer | `domain-invariants`, `ownership` |
| Reviewer | `ownership`, `historical-patterns`, `incident-learnings` |
| Tester | `historical-patterns`, `incident-learnings` |
| PO / planner | `product-rules`, `architecture-decisions` |
| Incident | `incident-learnings`, `ownership` |

`memory.retrieval.max_entries_per_task` caps the cumulative load.
All other types remain accessible via `/memory-full <type>`.

## Commands and skills that produce signals

Each produces a draft entry either in the operational store (when
`agent-memory` is present) or as an explicit file-scope proposal via
`/propose-memory` (when absent).

| Producer | Output type | When it fires |
|---|---|---|
| `/bug-fix` post-resolution | Historical pattern candidate | After a fix, only if the error shape has no matching existing entry |
| Incident role mode exit | Incident learning | Mandatory at closure |
| `/do-and-judge` judge verdicts | Historical pattern candidate | When a judge rejects the same failure class ≥2 times on nearby paths |
| `receiving-code-review` | Review finding (pre-pattern) | Aggregated signal, not a direct memory entry |
| `/propose-memory <type>` | Any type | Fully manual, the universal fallback |

Signal shape and quarantine-to-semantic promotion live in
[`agent-memory/road-to-promotion-flow.md`](agent-memory/road-to-promotion-flow.md).

## Commands and skills that consume memory

All consult the retrieval backend via the detection helper; all must
function in `absent` mode.

| Consumer | Types read | Notes |
|---|---|---|
| `review-routing` skill | `ownership`, `historical-patterns`, `incident-learnings` | Already file-based today; gains operational entries transparently |
| `bug-analyzer` skill | `historical-patterns`, `incident-learnings` | Symptom-keyed lookup |
| `/feature-plan` command | `architecture-decisions`, `product-rules`, `domain-invariants` | Decision-level lookup |
| `blast-radius-analyzer` skill | `architecture-decisions`, `ownership` | Uses path globs |
| `validate-feature-fit` skill | `product-rules`, `domain-invariants` | Rule-level lookup |
| `/bug-investigate` command | `incident-learnings`, `historical-patterns` | Failure-class lookup |
| `developer-like-execution` skill | `domain-invariants` | Path-scoped, small entries only |

## Phases

### Phase 0 — detection + fallback contract

- [ ] `scripts/memory_status.py` with cached result, CLI flag, Python import
- [ ] `scripts/memory_lookup.py` — file-based retrieval (from `road-to-project-memory.md` Phase 2)
- [ ] Single abstraction in both scripts: `retrieve(types, keys, limit)` returns the same shape regardless of backend
- [ ] Guideline `guidelines/agent-infra/memory-access.md` — how a skill calls it

### Phase 1 — wire read-side consumers

- [ ] Extend `review-routing`, `bug-analyzer`, `blast-radius-analyzer`, `validate-feature-fit` to call the abstraction
- [ ] Each consumer has a test proving the `absent` path works
- [ ] Output includes `status` and `confidence` so the agent weights entries

### Phase 2 — wire write-side producers

- [ ] `/bug-fix`, `/do-and-judge`, `/propose-memory`, incident role exit all drop signals via the abstraction
- [ ] When `absent`, signals become `/propose-memory` drafts locally — no operational store write attempted
- [ ] Rate-limit hook (per-user, per-path) in the producer helper

### Phase 3 — promotion into repo files

- [ ] `/memory-promote <id>` command — drafts a PR moving a qualified entry into a shared repo file
- [ ] When `present`, the entry source is the operational store; when `absent`, the source is a `/propose-memory` draft file
- [ ] Gate script `scripts/check_memory_proposal.py` checks metadata + 3-future-decisions heuristic

### Phase 4 — observability

- [ ] One-shot `task memory:status` shows backend, recent proposal counts, and staleness of repo files
- [ ] Quarterly report script (from `road-to-project-memory.md` Phase 5) gains a section for operational-store stats when `present`

## Consolidation of `feat/hybrid-agent-memory`

That branch already separated the memory package (see commit
`104627a` on the branch, "remove agent-memory roadmap and ADR"). Its
remaining content is installer/script refactoring orthogonal to this
integration. No merge conflict with memory concepts is expected.

Recommendation: resolve the installer work on its own terms and merge
to `main` independently. This roadmap plugs in on top, referencing
the installer exit points without depending on specific hybrid-branch
content.

## Open questions

- **Abstraction surface.** Python-first (scripts) or TypeScript parity
  (so `agent-memory`'s MCP client can be consumed directly)? Proposal:
  Python abstraction in `agent-config` scripts, MCP used from the
  agent-memory side — avoids cross-language glue.
- **Write-side rate-limit shape.** Per-user + per-path? Per-type?
  Leaning per-user + per-path, with a per-type override.
- **`absent` + producer path.** Should `/bug-fix` silently skip the
  signal emit in `absent` mode, or always drop a `/propose-memory`
  draft? Proposal: drop a draft. Developers can discard it.

## See also

- [`road-to-project-memory.md`](road-to-project-memory.md) — settings + repo files (required baseline)
- [`agent-memory/README.md`](agent-memory/README.md) — companion specs index
- [`agent-memory/road-to-consumer-integration-guide.md`](agent-memory/road-to-consumer-integration-guide.md) — install contract
- [`agent-memory/road-to-promotion-flow.md`](agent-memory/road-to-promotion-flow.md) — write-side semantics
- [`agent-memory/road-to-decay-calibration.md`](agent-memory/road-to-decay-calibration.md) — 6→4 mapping detail
- [`road-to-role-modes.md`](road-to-role-modes.md) — retrieval-key authority
- [`road-to-curated-self-improvement.md`](road-to-curated-self-improvement.md) — pipeline that Stage-3-plugs into
