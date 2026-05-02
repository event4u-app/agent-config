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
On-disk write format for signals in the `absent` path — append-only
JSONL with `merge=union` — is specified in
[`road-to-memory-merge-safety.md`](road-to-memory-merge-safety.md#agent-written-without-the-package).

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

- [x] `scripts/memory_status.py` with cached result, CLI flag, Python import *(2026-04-22: [`scripts/memory_status.py`](../../scripts/memory_status.py) — env + file cache, 2s health probe timeout, graceful degradation, 6 tests in [`tests/test_memory_status.py`](../../tests/test_memory_status.py))*
- [x] `scripts/memory_lookup.py` — file-based retrieval (from `road-to-project-memory.md` Phase 2) *(2026-04-22: [`scripts/memory_lookup.py`](../../scripts/memory_lookup.py) — YAML curated + JSONL intake with supersede chains, 7 tests in [`tests/test_memory_lookup.py`](../../tests/test_memory_lookup.py))*
- [x] Single abstraction in both scripts: `retrieve(types, keys, limit)` returns the same shape regardless of backend *(2026-04-22: `Hit` dataclass with `id`, `type`, `source`, `path`, `score`, `entry` — stable across file and package backends)*
- [x] Guideline `guidelines/agent-infra/memory-access.md` — how a skill calls it *(2026-04-22: [`guidelines/agent-infra/memory-access.md`](../../docs/guidelines/agent-infra/memory-access.md) — contract, detection helper, per-role access policy, anti-patterns)*

### Phase 1 — wire read-side consumers

- [x] Extend `review-routing`, `bug-analyzer`, `blast-radius-analyzer`, `validate-feature-fit` to call the abstraction *(2026-04-22: all four skills reference `scripts/memory_lookup.retrieve()` via [`memory-access`](../../docs/guidelines/agent-infra/memory-access.md); each cites the concrete types and keys to pass)*
- [x] Each consumer has a test proving the `absent` path works *(2026-04-22: covered transitively by [`tests/test_memory_lookup.py`](../../tests/test_memory_lookup.py) — `retrieve()` itself runs in `absent` mode by default; skills are markdown orchestrators over this function)*
- [x] Output includes `status` and `confidence` so the agent weights entries *(2026-04-22: `Hit.source` (`"curated"` vs `"intake"`) carries confidence; `Hit.score` carries relevance; skills treat intake as provisional)*

### Phase 2 — wire write-side producers

- [x] `/bug-fix`, `/do-and-judge`, `/propose-memory`, incident role exit all drop signals via the abstraction *(2026-04-22: [`/bug-fix`](../../.agent-src.uncompressed/commands/bug-fix.md) step 7 + [`/do-and-judge`](../../.agent-src.uncompressed/commands/do-and-judge.md) step 6 + new [`/propose-memory`](../../.agent-src.uncompressed/commands/propose-memory.md) + [`role-contracts`](../../docs/guidelines/agent-infra/role-contracts.md) incident-exit already mandates a write)*
- [x] When `absent`, signals become `/propose-memory` drafts locally — no operational store write attempted *(2026-04-22: [`scripts/memory_signal.py`](../../scripts/memory_signal.py) appends JSONL to `agents/memory/intake/signals-YYYY-MM.jsonl`; no CLI is invoked; package adapter is the Phase 3 boundary)*
- [x] Rate-limit hook (per-user, per-path) in the producer helper *(2026-04-22: `memory_signal.emit()` deduplicates identical `(type, path, body)` within a rolling 7-day window; [`tests/test_memory_signal.py`](../../tests/test_memory_signal.py) covers the dedupe + expiry paths)*

### Phase 3 — promotion into repo files

- [x] `/memory-promote <id>` command — drafts a PR moving a qualified entry into a shared repo file *(2026-04-22: [`/memory-promote`](../../.agent-src.uncompressed/commands/memory-promote.md) — runs the gate, hydrates the curated schema, appends a supersede line, opens the PR branch)*
- [x] When `present`, the entry source is the operational store; when `absent`, the source is a `/propose-memory` draft file *(2026-04-22: `--intake-id` path reads from JSONL; `--proposal` path reads YAML; package-operational-store adapter is the future Phase 3b boundary and will reuse the same gate)*
- [x] Gate script `scripts/check_memory_proposal.py` checks metadata + 3-future-decisions heuristic *(2026-04-22: [`scripts/check_memory_proposal.py`](../../scripts/check_memory_proposal.py) — required fields, valid type, `PATTERN_MIN_PATHS=2` OR `MIN_FUTURE_DECISIONS=3` discipline; 7 tests in [`tests/test_check_memory_proposal.py`](../../tests/test_check_memory_proposal.py))*

### Phase 4 — observability

- [x] One-shot `task memory:status` shows backend, recent proposal counts, and staleness of repo files *(2026-04-22: [`Taskfile.yml` → `memory:status`](../../Taskfile.yml) invokes [`scripts/memory_report.py`](../../scripts/memory_report.py) — prints backend + intake counts by type/month + curated staleness vs `review_after_days`; `--format json` for CI consumption)*
- [x] Quarterly report script (from `road-to-project-memory.md` Phase 5) gains a section for operational-store stats when `present` *(2026-04-22: [`scripts/memory_report.py`](../../scripts/memory_report.py) — `build_report()` now emits `quarterly` (accepted/retired/staleness-rate) and `operational_store` (stub when backend=`present`, null otherwise); 5 tests in [`tests/test_memory_report.py`](../../tests/test_memory_report.py) cover quarter grouping, accepted/retired counts, and operational-store gating)*

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
- [`road-to-memory-merge-safety.md`](road-to-memory-merge-safety.md) — no-conflict contract every write path must follow
- [`road-to-memory-self-consumption.md`](road-to-memory-self-consumption.md) — bidirectional-use, no-circular-dep clause, conflict rule
- [`agent-memory/road-to-retrieval-contract.md`](agent-memory/road-to-retrieval-contract.md) — versioned cross-repo contract consumed here
