# Roadmap: Agent Memory Hybrid

> Build a persistent, trust-scored project memory system that any AI coding agent can use — combining fresh code context with long-lived project knowledge and automatic invalidation.

## Prerequisites

- [ ] Read this roadmap fully before starting
- [ ] Decide on target repository for the memory service (separate repo)
- [ ] Decide on programming language (TypeScript recommended)

## Context

AI coding agents (Augment, Claude Code, Cursor, Cline, Gemini, Copilot, etc.) excel at reading current code but forget everything between sessions. This system fills that gap:

- **Fresh code context** — provided by whichever agent/IDE is active
- **Persistent project memory** — stored externally, queryable by any agent
- **Controlled invalidation** — git diffs, file changes, symbol tracking prevent stale knowledge

The memory system is **not** a replacement for code understanding. It's a **verifiable knowledge cache** that reduces re-discovery across sessions.

- **Feature:** `agents/features/multi-agent-compatibility.md`
- **Jira:** none

### Inspiration & Prior Art

This roadmap builds on analysis of two existing open-source agent memory systems:

| Project | Stars | License | Key Contribution to Our Design |
|---|---|---|---|
| [agentmemory](https://github.com/rohitg00/agentmemory) | 1.4k | Apache-2.0 | 4-tier consolidation, Ebbinghaus decay, RRF fusion, token budgets, privacy filters, self-healing |
| [claude-mem](https://github.com/thedotmack/claude-mem) | 54k | AGPL-3.0 | Progressive disclosure (3-layer retrieval), lifecycle hooks, observation-first storage |

**What we adopt:** consolidation pipeline, decay model, retrieval fusion, progressive disclosure, token budgets, privacy filters, embedding fallback, self-healing.

**What neither has (our unique safety model):** quarantine status, contradiction detection, impact levels, post-task extraction guard, poison + cascade review, semantic drift detection, hard trust threshold.

---

## Core Principles

1. **Code is the primary source of truth.** Memory is supplementary, never authoritative.
2. **Every memory entry has provenance, scope, and trust status.**
3. **Invalidation is mandatory, not optional.** Stale knowledge is worse than no knowledge.
4. **Knowledge is stored atomically.** One fact per entry, not monolithic summaries.
5. **Only reusable knowledge is persisted.** Session notes are ephemeral.
6. **Agent-agnostic by design.** Any model, any agent, any IDE can consume and contribute.
7. **Tool-based interface.** CLI commands and/or MCP server — no vendor lock-in.

---

## Safety Rules (Iron Laws)

These rules are non-negotiable. They exist to prevent stale or wrong memory from causing real coding errors.

### 1. Mandatory Expiry (TTL)

Every memory entry has a **maximum age without revalidation**:

| Knowledge Class | Max age before forced staleness |
|---|---|
| Evergreen | 90 days |
| Semi-Stable | 30 days |
| Volatile | 7 days |

After this period, the entry is **automatically** set to `stale` — even if no code change triggered invalidation. Stale entries require revalidation before being served to agents.

### 2. Hard Trust Threshold

Entries below a minimum trust score are **never returned** to agents:

| Retrieval mode | Minimum trust score |
|---|---|
| Default (agent query) | 0.6 |
| Explicit low-trust search | 0.3 (with mandatory `⚠️ LOW TRUST` marker) |
| Below 0.3 | Never returned, only visible in admin/review |

### 3. Quarantine for New Entries

New entries created by agents start in `quarantine` status — NOT `validated`:

```
agent creates entry → quarantine → validation check → validated OR rejected
```

Quarantined entries are **never served** to other agents until validated. Validation requires:
- At least one evidence link (file, commit, test) verified against current code
- No contradiction with existing validated entries

### 4. Impact-Level Determines Trust Requirements

| Impact Level | Example Types | Min Evidence | Review Required |
|---|---|---|---|
| **Critical** | `architecture_decision`, `domain_rule` | 2+ evidence links | Human review recommended |
| **High** | `integration_constraint`, `deployment_warning` | 1+ evidence link | Automated validation |
| **Normal** | `bug_pattern`, `refactoring_note`, `test_strategy` | 1 evidence link | Automated validation |
| **Low** | `coding_convention`, `glossary_entry` | Optional | None |

Critical entries with only 1 evidence link get a **trust score cap of 0.7** — they cannot reach "fully trusted" without strong evidence.

### 5. Contradiction Detection

On every ingestion and retrieval:
- Check new entries against existing entries with overlapping scope (same files, symbols, modules)
- If contradiction detected → **both entries flagged** for review
- Neither is served to agents until conflict is resolved

### 6. Post-Task Extraction Guard

Knowledge extraction after task completion is only allowed when:
- All tests pass (if tests exist for affected area)
- No quality tool errors introduced
- Diff is reviewed (by agent or human)

If tests fail or quality degrades → extraction is **blocked**, not just warned.

### 7. Audit Trail with Traceability

Every memory entry that influences agent decisions must be traceable:
- Entry ID is included in agent output / commit metadata
- If wrong code is produced, the contributing memory entries can be identified
- Rollback: mark entry as `poisoned` → triggers re-review of all dependent decisions

### 8. Semantic Drift Detection

Beyond file-level invalidation:
- Track **function signatures** and **return types** of watched symbols
- If a function's behavior changes (different return type, renamed params, different side effects) but the file name stays the same → trigger invalidation
- V1 minimum: flag entries when watched files have large diffs (>50% of lines changed)

---

## Architecture Overview

```
┌─────────────────────────┐
│  Any AI Coding Agent     │
│  (Augment, Claude Code,  │
│   Cursor, Cline, etc.)   │
└────────────┬────────────┘
             │
             ▼
┌─────────────────────────┐
│  Memory Orchestrator     │
│  CLI / MCP Server / API  │
│  ingest · retrieve ·     │
│  validate · invalidate   │
└──────┬──────────┬───────┘
       │          │
       ▼          ▼
┌──────────┐ ┌──────────────┐
│  Vector  │ │  Relational  │
│  DB      │ │  (Postgres)  │
└──────────┘ └──────────────┘
       │          │
       ▼          ▼
┌─────────────────────────┐
│  Extractors / Indexers   │
│  Git · AST · Docs · PRs │
└─────────────────────────┘
```

### Agent Integration Points

| Integration | How |
|---|---|
| **MCP Server** | Any MCP-capable agent calls `memory:retrieve`, `memory:ingest`, etc. as tools |
| **CLI** | `memory retrieve "how are invoices calculated?"` — works from any terminal |
| **API** | REST/GraphQL endpoint for IDE extensions or custom tooling |
| **Agent Commands** | `.augment/commands/` or equivalent for each agent framework |

---

## Data Model

Every memory entry contains:

```json
{
  "id": "mem_...",
  "type": "architecture_decision",
  "title": "Order totals are recalculated only via DomainService",
  "summary": "Totals must not be computed in controllers or UI adapters.",
  "details": "...",
  "scope": {
    "repository": "app-core",
    "bounded_context": "billing",
    "files": ["src/Billing/..."],
    "symbols": ["OrderTotalService::recalculate"]
  },
  "evidence": [
    {"kind": "file", "ref": "src/Billing/OrderTotalService.ts"},
    {"kind": "commit", "ref": "abc123"},
    {"kind": "adr", "ref": "docs/adr/0007-order-total-policy.md"}
  ],
  "embedding_text": "...",
  "impact_level": "critical",
  "knowledge_class": "semi_stable",
  "trust": {
    "status": "validated",
    "score": 0.91,
    "validated_at": "2026-04-13T10:00:00Z",
    "expires_at": "2026-05-13T10:00:00Z",
    "min_evidence_count": 2
  },
  "invalidation": {
    "strategy": "file_symbol_dependency_based",
    "watched_files": ["src/Billing/OrderTotalService.ts"],
    "watched_symbols": ["OrderTotalService::recalculate"],
    "watched_signatures": ["recalculate(order: Order): Money"]
  },
  "created_by": "agent",
  "created_in_task": "task_abc123",
  "updated_at": "2026-04-13T10:00:00Z"
}
```

### Memory Types

| Type | Example |
|---|---|
| `architecture_decision` | "All prices normalized via MoneyValueObject" |
| `domain_rule` | "Retries for Provider X only via IntegrationAdapter" |
| `integration_constraint` | "Feature flag Y must be active during tenant migration" |
| `bug_pattern` | "N+1 query in OrderList when eager loading disabled" |
| `refactoring_note` | "Legacy PaymentService being replaced by PaymentGateway" |
| `test_strategy` | "Billing module uses integration tests, no unit tests" |
| `deployment_warning` | "Queue restart required after config change" |
| `coding_convention` | "All DTOs are readonly final classes" |
| `glossary_entry` | "FQDN = Fully Qualified Domain Name, used as tenant identifier" |

### NOT stored (ephemeral)

- "Opened file X today"
- "I suspect there might be a bug here"
- "Task half-finished"
- Current session plans, temporary hypotheses


---

## Memory Knowledge Classes

### 1. Evergreen Memory

Long-lived, rarely changes. Examples: bounded contexts, architecture principles, naming conventions, security policies.

### 2. Semi-Stable Memory

Relevant but mutable. Examples: integration paths, module dependencies, caching rules, test strategies per module.

### 3. Volatile Memory

Quickly outdated. Examples: current workarounds, hotfix notes, temporary branch assumptions, migration transition rules.

### 4. Session Memory (NOT persisted)

Ephemeral. Current task plan, session to-dos, temporary hypotheses. Discarded after session.

---

## Memory Consolidation Pipeline

Inspired by [agentmemory](https://github.com/rohitg00/agentmemory)'s 4-tier model (analogous to human sleep consolidation):

```
Raw Observation → Working Memory → Episodic Memory → Semantic Memory → Procedural Memory
```

| Tier | What | Analogy | Lifecycle |
|---|---|---|---|
| **Working** | Raw tool observations, file reads, errors | Short-term memory | Auto-captured during session, deduped (SHA-256, 5-min window) |
| **Episodic** | Compressed session summaries | "What happened" | Generated at session end, links to observations |
| **Semantic** | Extracted facts, patterns, decisions | "What I know" | Extracted from episodic, enters quarantine |
| **Procedural** | Proven workflows, decision patterns | "How to do it" | Promoted from semantic after repeated validation |

### Consolidation Rules

- Working → Episodic: **automatic** at session end (compress observations into summary)
- Episodic → Semantic: **agent-triggered** or **scheduled** (extract stable knowledge from summaries)
- Semantic → Procedural: **only after 3+ successful validations** (proven pattern, not just observed once)
- Each tier has its own TTL multiplier: Working (1d) → Episodic (7d) → Semantic (30d) → Procedural (90d)

### Ebbinghaus Decay Model

Instead of flat TTL expiry, memory strength follows an access-frequency curve:

- **Every retrieval strengthens** the memory (increases trust score, extends effective TTL)
- **Lack of access weakens** the memory (trust score slowly decays toward stale threshold)
- **Decay rate varies by knowledge class:** Evergreen decays slowest, Volatile decays fastest
- **Hard floor:** Even frequently accessed memories must be revalidated when evidence changes

This means: a frequently-used architecture decision stays strong indefinitely (until code contradicts it), while a rarely-accessed bugfix note fades naturally.

---

## Trust & Validation

### Trust Statuses

```
quarantine → validated       (evidence verified, no contradictions)
quarantine → rejected        (evidence invalid or contradicts existing entries)
validated → stale            (TTL expired or evidence weakened)
stale → validated            (revalidated successfully)
validated → invalidated      (hard invalidation — symbol deleted, evidence gone)
stale → invalidated          (hard invalidation while already stale)
invalidated → archived       (no longer relevant, kept for audit)
any → poisoned               (confirmed wrong — triggers cascade review)
poisoned → archived          (after dependent decisions reviewed)
```

| Status | Served to agents? | Meaning |
|---|---|---|
| `quarantine` | ❌ Never | New, unverified — awaiting validation |
| `validated` | ✅ Yes | Evidence verified, trust score above threshold |
| `stale` | ⚠️ With warning | TTL expired or evidence weakened — needs revalidation |
| `invalidated` | ❌ Never | Hard-invalidated — evidence gone or contradicted |
| `rejected` | ❌ Never | Failed quarantine validation |
| `poisoned` | ❌ Never | Confirmed wrong — triggers review of dependent entries |
| `archived` | ❌ Never | Historical record only |

### Trust Signals

- Direct code evidence exists
- Referenced symbol still exists
- Referenced files unchanged
- Tests confirm behavior
- Documentation matches code
- Recent commits don't contradict

### Invalidation Triggers

- File changed
- Symbol changed / deleted / renamed
- Module structure changed
- Relevant tests changed
- ADR / documentation changed
- Dependent integration changed
- Large refactor / migration detected
- Branch switch
- Merge into main

### Invalidation Modes

| Mode | When | Effect |
|---|---|---|
| **TTL expiry** | Max age reached without revalidation | Status → `stale`, blocked until revalidated |
| **Soft invalidate** | Evidence weakened (file changed, small diff) | Status → `stale`, served with warning |
| **Hard invalidate** | Core symbol deleted, evidence gone | Status → `invalidated`, never served |
| **Contradiction** | New entry contradicts existing one | Both entries flagged, neither served until resolved |
| **Poison** | Entry confirmed to have caused wrong code | Status → `poisoned`, cascade review of dependents |
| **Semantic drift** | Watched symbol signature/behavior changed significantly | Status → `stale`, higher revalidation priority |

---

## Retrieval Strategy

### Triple-Stream Retrieval (inspired by [agentmemory](https://github.com/rohitg00/agentmemory))

Three parallel search streams, fused with Reciprocal Rank Fusion (RRF, k=60):

| Stream | What | When |
|---|---|---|
| **BM25 (Lexical)** | Stemmed keyword matching with synonym expansion | Always on |
| **Vector** | Cosine similarity over dense embeddings | When embedding provider configured |
| **Knowledge Graph** | Entity matching + BFS traversal | When entities detected in query (V2) |

Pipeline:

1. Run all streams in parallel
2. Apply **metadata filters** (repository, module, type, trust status)
3. **Freshness check** — validate against current git state, auto-stale expired entries
4. **RRF Fusion** — combine rankings from all streams
5. **Session diversification** — max 3 results per source session (prevents one session dominating)
6. **Trust threshold** — filter out entries below 0.6 trust score
7. **Token budget** — cap total response at configurable token limit (default: 2000)

### Progressive Disclosure (inspired by [claude-mem](https://github.com/thedotmack/claude-mem))

3-layer retrieval for ~10x token savings:

| Layer | What | Tokens/result | When |
|---|---|---|---|
| **1. Index** | Compact list: ID, title, trust score, type | ~50-100 | Always (default) |
| **2. Timeline** | Chronological context around selected entries | ~200-300 | On demand |
| **3. Full Details** | Complete entry with evidence, scope, metadata | ~500-1000 | Only for filtered IDs |

Agents query Layer 1 first, review the index, then fetch Layer 3 only for relevant entries. This prevents loading 20 full entries when only 3 are needed.

### Ranking Signals

- Semantic similarity to query
- Same files / modules / symbols as current context
- Same domain / bounded context
- Relevance to current diff
- Trust status and last validation time
- Access frequency (Ebbinghaus strength)
- Consolidation tier (Procedural > Semantic > Episodic)

### Token Budget

Every retrieval respects a configurable token budget (default: 2000 tokens):

- Layer 1 index entries are always within budget
- Layer 3 full entries counted against budget — system stops when budget exceeded
- Agent can override with explicit `--budget <tokens>` flag
- Budget prevents memory context from overwhelming the agent's context window

### Embedding Provider Fallback Chain (inspired by [agentmemory](https://github.com/rohitg00/agentmemory))

Auto-detect available providers, prefer free/local:

| Priority | Provider | Cost | Notes |
|---|---|---|---|
| 1 | **Local** (`all-MiniLM-L6-v2`) | Free | Offline, no API key needed |
| 2 | Gemini (`text-embedding-004`) | Free tier | 1500 RPM |
| 3 | OpenAI (`text-embedding-3-small`) | $0.02/1M | Highest quality |
| 4 | Voyage AI (`voyage-code-3`) | Paid | Optimized for code |
| Fallback | BM25 only | Free | No embeddings, lexical only |

---

## Recommended Tech Stack

| Layer | Recommendation | Rationale |
|---|---|---|
| **Language** | TypeScript | Close to IDE tooling, MCP ecosystem, Node.js |
| **Database** | Postgres + pgvector | Vector search + relational in one DB |
| **Structured metadata** | Postgres (same DB) | Simplicity for V1 |
| **Parsing** | Tree-sitter or language-specific parsers | AST / symbol extraction |
| **Git analysis** | Git CLI | Commit, diff, and history analysis |
| **Jobs** | Simple queue or cron | Sync job runner for V1 |
| **Interface** | CLI + MCP Server | Agent-agnostic access |
| **Graph (V2)** | Neo4j or Postgres relations | Only when relationship queries needed |

---

## Pre-Storage Privacy Filter

Before ANY data enters storage (inspired by [agentmemory](https://github.com/rohitg00/agentmemory)):

1. **Strip secrets** — API keys, tokens, passwords, connection strings (regex + entropy detection)
2. **Strip PII** — emails, phone numbers, names (configurable per project)
3. **Honor `<private>` tags** — content wrapped in `<private>...</private>` is never stored
4. **Sanitize file paths** — normalize to relative paths, strip home directory
5. **Redact environment variables** — `.env` content never stored verbatim

This runs BEFORE embedding creation, BEFORE storage, BEFORE any processing. Non-negotiable.

---

## Agent Workflow Integration

### Lifecycle Hooks (inspired by [claude-mem](https://github.com/thedotmack/claude-mem))

| Hook | Trigger | Memory Action |
|---|---|---|
| **SessionStart** | Agent session begins | Retrieve relevant context (Layer 1 index), inject within token budget |
| **PreToolUse** | Before file read/edit | Enrich with file-specific memories |
| **PostToolUse** | After tool execution | Capture raw observation (Working Memory tier) |
| **PostToolUseFailure** | Tool error | Capture error context (may become bug_pattern) |
| **Stop** | Task complete | Trigger post-task extraction (with guard checks) |
| **SessionEnd** | Session closes | Consolidate Working → Episodic, run dedup |

### Pre-Task

1. Agent receives task
2. Agent (or tool) identifies affected modules/files
3. Memory system retrieves relevant entries (Layer 1 index, within token budget)
4. Top entries validated against current code/git
5. Only validated or explicitly-marked-stale entries passed to agent
6. Stale entries include `⚠️ STALE` marker — agent decides whether to use

### During Task

- Raw observations captured automatically via PostToolUse hook (Working Memory)
- SHA-256 dedup with 5-minute window prevents duplicate observations
- Agent uses its own code understanding (codebase search, context window, etc.)
- Memory serves as supplementary context, never overriding fresh code
- Session notes kept in Working Memory tier (ephemeral)
- Agent can explicitly `memory save` important decisions mid-task

### Post-Task

1. **Guard check:** tests must pass, no quality regressions (extraction blocked otherwise)
2. Consolidate Working → Episodic (compress observations into session summary)
3. Extract Semantic entries from Episodic (stable knowledge enters quarantine)
4. Analyze diffs — update or invalidate affected existing entries
5. Run contradiction detection against new entries
6. Privacy filter on all new entries before final storage
7. Discard Working Memory (raw observations) after consolidation

---

## V1 Scope — What's In, What's Out

### In V1

- Memory entries with evidence + trust status
- 4-tier consolidation pipeline (Working → Episodic → Semantic → Procedural)
- Ebbinghaus decay model (access-frequency based)
- Triple-stream retrieval (BM25 + Vector, RRF fusion)
- Progressive disclosure (3-layer: Index → Timeline → Full)
- Token budget for context injection
- Pre-storage privacy filter
- Embedding provider fallback chain (local-first, free default)
- File-level git-diff invalidation
- Lifecycle hooks (SessionStart, PostToolUse, Stop, SessionEnd)
- SHA-256 dedup with time window
- Manual + agent-triggered ingestion
- CLI commands + MCP server interface
- Trust scoring and status transitions
- Self-healing / circuit breaker
- Basic ingestion from code, docs, git history

### NOT in V1

- Full knowledge graph with traversal (Neo4j / graph queries)
- Automatic symbol-level dependency graphs
- Complex multi-agent orchestration (leases, signals)
- Fully autonomous decision systems
- IDE extensions / VS Code plugins
- PR / ticket integration
- Branch-specific temporary memory
- Team memory (namespaced shared/private)
- Real-time web viewer
- MEMORY.md bridge (bi-directional sync with file-based memory)
- Action system (frontier, next, work item tracking)
- Git-based memory snapshots (version, rollback, diff)
- Endless mode (biomimetic memory for extended sessions)

---

## Phase 0: Scope & Architecture Decisions

### Goal

Lock down all foundational decisions before writing code.

### Checklist

- [x] Define V1 goal in writing → ADR-0001
- [x] Decide: TypeScript → ADR-0001 Decision 1
- [x] Decide: Postgres + pgvector → ADR-0001 Decision 2
- [x] Define first 5 memory types → ADR-0001 Decision 3
- [x] Define trust statuses → ADR-0001 Decision 4
- [x] Define revalidation triggers → ADR-0001 Decision 5
- [x] Define TTL per knowledge class → ADR-0001 Decision 6
- [x] Define hard trust threshold → ADR-0001 Decision 7
- [x] Define impact levels and min evidence → ADR-0001 Decision 8
- [x] Define quarantine → validation flow → ADR-0001 Decision 9
- [x] Define contradiction detection strategy → ADR-0001 Decision 10
- [x] Define post-task extraction guard rules → ADR-0001 Decision 11
- [x] Decide: CLI-first → ADR-0001 Decision 12
- [x] Choose example repository (agent-config) → ADR-0001 Decision 13
- [x] Create architecture ADR → `agents/adrs/0001-agent-memory-architecture.md`

### Acceptance Criteria

- Anyone can explain in 5 minutes what Memory stores and what it doesn't
- V1 scope exists with clear boundaries
- Safety rules documented and non-negotiable

---

## Phase 1: Project Setup & Infrastructure

### Goal

A runnable base project with clean local development setup.

### Checklist

- [ ] Initialize repository
- [ ] Add Docker / dev container setup
- [ ] Configure Postgres with pgvector
- [ ] Set up DB migrations
- [ ] Create `.env.example`
- [ ] Integrate logging (structured, JSON)
- [ ] Define error handling and structured error codes
- [ ] Implement circuit breaker for external dependencies (embedding APIs, etc.)
- [ ] Implement health monitoring (`memory health` command)
- [ ] Implement self-healing: auto-recovery from transient failures, provider fallback
- [ ] Provide healthcheck endpoint
- [ ] Create baseline README
- [ ] Stub CLI commands: `memory ingest`, `memory retrieve`, `memory validate`, `memory invalidate`
- [ ] Configure embedding provider fallback chain (local → Gemini → OpenAI → BM25-only)

### Acceptance Criteria

- Project starts locally and reproducibly
- DB migrations run cleanly
- Base commands exist (stubs)

---

## Phase 2: Data Model & Storage

### Goal

Store, load, and version memory entries in a structured way.

### Checklist

- [ ] Create `memory_entries` table (with `impact_level`, `knowledge_class`, `consolidation_tier`, `expires_at`, `access_count`, `last_accessed_at`)
- [ ] Create `memory_observations` table (Working Memory — raw tool observations)
- [ ] Create `memory_episodes` table (Episodic — session summaries linking to observations)
- [ ] Create `memory_evidence` table
- [ ] Create `memory_links` table (file, symbol, module, signature associations)
- [ ] Create `memory_status_history` table (full audit trail)
- [ ] Create `memory_contradictions` table (pairs of conflicting entries)
- [ ] Add vector column for embeddings
- [ ] Add `created_in_task` for traceability
- [ ] Add `observation_hash` column (SHA-256 for dedup)
- [ ] Implement status transition rules (enforce valid transitions only)
- [ ] Implement TTL expiry check (auto-stale on query if expired)
- [ ] Implement Ebbinghaus decay: access_count increments on retrieval, last_accessed_at updated
- [ ] Implement repository / DAO layer
- [ ] Write unit tests for CRUD operations
- [ ] Write unit tests for status transition enforcement
- [ ] Write unit tests for consolidation tier promotion rules

### Acceptance Criteria

- Entries can be stored with evidence, trust status, impact level, and knowledge class
- Status change history is traceable (who, when, why)
- Invalid status transitions are rejected
- TTL expiry is enforced on read

---

## Phase 3: Retrieval Engine

### Goal

Find relevant knowledge snippets for the current task.

### Checklist

- [ ] Implement BM25 lexical search (stemmed keyword matching)
- [ ] Implement vector search (cosine similarity over embeddings)
- [ ] Implement RRF fusion (Reciprocal Rank Fusion, k=60) combining both streams
- [ ] Implement session diversification (max 3 results per source session)
- [ ] Implement filters by repository / module / type / trust / status / consolidation tier
- [ ] Implement ranking function (relevance + trust + freshness + access frequency + tier)
- [ ] Implement Progressive Disclosure:
  - [ ] Layer 1: Index response (~50-100 tokens/result) — ID, title, trust, type
  - [ ] Layer 2: Timeline response (~200-300 tokens/result) — chronological context
  - [ ] Layer 3: Full response (~500-1000 tokens/result) — complete entry with evidence
- [ ] Implement token budget (default: 2000, configurable via `--budget`)
- [ ] Implement embedding provider auto-detection + fallback chain
- [ ] Enforce hard trust threshold — entries below 0.6 never returned by default
- [ ] Implement explicit low-trust mode (0.3 min, with `⚠️ LOW TRUST` marker)
- [ ] Filter out `quarantine`, `invalidated`, `rejected`, `poisoned`, `archived` statuses
- [ ] Check TTL on every retrieval — auto-stale expired entries before ranking
- [ ] Factor Ebbinghaus strength into ranking (access_count + last_accessed_at)
- [ ] Update access_count and last_accessed_at on every retrieval hit
- [ ] Include trust status + evidence count + tier in response format
- [ ] Provide query API and CLI command
- [ ] Define agent-friendly response format (always includes trust metadata)
- [ ] Write tests: ensure stale entries are not returned without warning
- [ ] Write tests: ensure quarantined entries are never returned
- [ ] Write tests: progressive disclosure returns correct detail levels
- [ ] Write tests: token budget is respected
- [ ] Write tests with realistic queries

### Acceptance Criteria

- For real coding tasks, relevant memory entries are found
- RRF fusion produces better results than either stream alone
- Progressive disclosure reduces token usage by ~10x vs always returning full entries
- Token budget is enforced — response never exceeds configured limit
- Stale entries are only returned with explicit warning
- Quarantined / invalidated / poisoned entries are NEVER returned
- Trust score, status, and tier visible in every response

---

## Phase 4: Trust & Validation System

### Goal

Memory must not be blindly trusted. Relevant entries must be validated before use.

### Checklist

- [ ] Define trust model (scores, thresholds, caps per impact level)
- [ ] Implement quarantine flow (new entries start in quarantine)
- [ ] Implement quarantine → validated transition (evidence check + no contradictions)
- [ ] Implement quarantine → rejected transition
- [ ] Create validator interfaces
- [ ] Build file-exists validator
- [ ] Build symbol-exists validator (including signature comparison)
- [ ] Build diff-impact validator
- [ ] Build test-linked validator (check if related tests still pass)
- [ ] Implement contradiction detection (overlapping scope, opposing claims)
- [ ] Implement contradiction resolution flow (flag both, block both)
- [ ] Implement impact-level trust score cap (critical with 1 evidence → max 0.7)
- [ ] Implement trust score calculation (evidence count × type weight × freshness)
- [ ] Implement TTL enforcement per knowledge class
- [ ] Implement `poisoned` status + cascade review trigger
- [ ] Document all status transitions with validation rules
- [ ] Connect trust with retrieval ranking
- [ ] Write tests: quarantined entry never bypasses validation
- [ ] Write tests: contradiction blocks both entries
- [ ] Write tests: TTL expiry correctly triggers staleness

### Acceptance Criteria

- Every returned entry has a traceable trust status
- Outdated entries are visibly downgraded
- New entries must pass quarantine before being served
- Contradictions are detected and both entries blocked
- Poisoning an entry triggers review of all dependent entries

---

## Phase 5: Ingestion Pipeline

### Goal

Generate memory candidates from code, docs, and git history.

### Sources

- Source code (AST, comments, structure)
- README / documentation
- ADRs (Architecture Decision Records)
- Tests
- Git commits (messages, diffs)
- PR descriptions

### Checklist

**Observation capture (Working Memory):**

- [ ] Implement PostToolUse hook — capture raw observations automatically
- [ ] Implement SHA-256 dedup with 5-minute time window (prevent duplicate observations)
- [ ] Run pre-storage privacy filter on every observation
- [ ] Store observations in `memory_observations` table with session ID + timestamp

**Consolidation (Working → Episodic → Semantic):**

- [ ] Implement Working → Episodic consolidation (compress observations into session summary)
- [ ] Implement Episodic → Semantic extraction (stable knowledge from summaries)
- [ ] Implement Semantic → Procedural promotion (after 3+ successful validations)
- [ ] Implement session-end trigger for consolidation

**Source scanners:**

- [ ] Implement file scanner
- [ ] Integrate symbol extraction (including function signatures for semantic drift detection)
- [ ] Integrate documentation reader
- [ ] Integrate git commit reader
- [ ] Define candidate model
- [ ] Define heuristics for relevant knowledge extraction

**Safety gates:**

- [ ] Implement contradiction check on ingestion (compare with existing entries in overlapping scope)
- [ ] Integrate embedding creation (using fallback provider chain)
- [ ] Implement post-task extraction guard:
  - [ ] Check test results before allowing extraction
  - [ ] Check quality tool results (if available)
  - [ ] Block extraction if tests fail or quality degrades
  - [ ] All new Semantic entries enter quarantine (never directly validated)
- [ ] Assign impact level automatically based on memory type
- [ ] Assign knowledge class automatically (evergreen/semi-stable/volatile)
- [ ] Assign consolidation tier based on source (observation=working, extraction=semantic)
- [ ] Calculate and set TTL based on knowledge class + Ebbinghaus base

### Acceptance Criteria

- Raw observations captured automatically during sessions
- SHA-256 dedup prevents duplicate observations within 5-minute window
- Privacy filter runs before any storage (secrets, PII, `<private>` tags stripped)
- Consolidation pipeline compresses observations → summaries → entries
- All new Semantic/Procedural entries start in quarantine status
- Post-task extraction is blocked when tests fail
- Contradictions detected during ingestion
- Noise is manageable

---

## Phase 6: Invalidation Engine

### Goal

Automatically react to code changes and update memory trust status.

### Checklist

- [ ] Implement git diff reader
- [ ] Implement file-based watch rules
- [ ] Implement symbol-based watch rules (including signature comparison)
- [ ] Implement semantic drift detection:
  - [ ] Track function signatures of watched symbols
  - [ ] Flag entries when >50% of watched file lines changed
  - [ ] Detect renamed symbols (heuristic: same file, similar signature, different name)
- [ ] Add dependency-based invalidation
- [ ] Build TTL expiry job (scheduled, auto-stales expired entries)
- [ ] Build soft-invalidate flow (→ `stale`)
- [ ] Build hard-invalidate flow (→ `invalidated`)
- [ ] Build poison flow (→ `poisoned`, cascade to dependents)
- [ ] Implement rollback mechanism:
  - [ ] Track which entries influenced which tasks
  - [ ] When entry is poisoned, list all tasks that used it
  - [ ] Provide `memory rollback <entry-id>` command for investigation
- [ ] Introduce revalidation jobs (prioritize high-impact entries)
- [ ] Create audit log for all invalidation events (who, when, trigger, old/new status)

### Acceptance Criteria

- When relevant files change, memory system reacts correctly
- TTL expiry runs on schedule and stales expired entries
- Semantic drift detected for significant symbol changes
- Poisoned entries trigger cascade review of dependents
- Full audit trail for every status change

---

## Phase 7: MCP Server & Agent Integration

### Goal

Make memory practically usable from any AI coding agent via MCP protocol.

### Checklist

**MCP tools:**

- [ ] `memory_retrieve` — query with progressive disclosure (Layer 1/2/3), token budget
- [ ] `memory_retrieve_details` — Layer 3 full details for specific entry IDs
- [ ] `memory_ingest` — manual entry creation (enters quarantine)
- [ ] `memory_validate` — trigger validation for specific entry
- [ ] `memory_invalidate` — mark entry as stale/invalidated
- [ ] `memory_poison` — mark entry as confirmed wrong (triggers cascade)
- [ ] `memory_verify` — trace entry back to source evidence (citation provenance)
- [ ] `memory_health` — show system health + quality metrics
- [ ] `memory_diagnose` — identify issues (stale entries, low trust, contradictions)

**Lifecycle hooks:**

- [ ] Implement SessionStart hook — inject relevant context (Layer 1, within token budget)
- [ ] Implement PostToolUse hook — capture observation to Working Memory
- [ ] Implement PostToolUseFailure hook — capture error context
- [ ] Implement Stop hook — trigger post-task extraction (with guard checks)
- [ ] Implement SessionEnd hook — consolidate Working → Episodic, run dedup

**Workflow integration:**

- [ ] Define standard task workflow (pre-task retrieval, post-task extraction)
- [ ] Integrate retrieval into pre-task flow (auto-inject on session start)
- [ ] Integrate validation before usage
- [ ] Integrate post-task knowledge extraction (with guard: tests must pass)
- [ ] Define memory update flow after merge
- [ ] Separate Working Memory (session) from persistent Semantic/Procedural Memory
- [ ] Test with at least 2 different agents (e.g., Claude Code + Augment)

### Acceptance Criteria

- Workflow is usable without manual special logic
- Knowledge grows in a controlled way with each completed task
- Any MCP-capable agent can interact with memory
- Lifecycle hooks capture observations automatically
- Token budget respected on session start injection
- Post-task extraction blocked when tests fail

---

## Phase 8: Quality Control & Anti-Drift

### Goal

Memory must remain useful over weeks and months.

### Checklist

- [ ] Define metrics:
  - [ ] Stale detection accuracy (target: >95% for critical/high impact)
  - [ ] Retrieval precision (relevant entries / total returned)
  - [ ] Contradiction detection rate
  - [ ] Quarantine rejection rate (how many new entries fail validation)
  - [ ] Poisoned entry count (should trend toward zero)
  - [ ] TTL compliance (% of expired entries caught on time)
  - [ ] False positive rate (valid entries incorrectly invalidated)
- [ ] Build review command for questionable entries
- [ ] Build duplicate merge mechanism
- [ ] Build contradiction resolution interface
- [ ] Define archival strategy (invalidated → archived after 30d)
- [ ] Introduce scheduled cleanup job
- [ ] Build `memory health` command showing all metrics
- [ ] Build `memory audit <entry-id>` showing full history of an entry

### Acceptance Criteria

- System quality is measurable with concrete numbers
- Stale detection accuracy >95% for critical/high-impact entries
- Bad knowledge doesn't accumulate indefinitely
- Health dashboard shows actionable metrics

---

## Phase 9: Security, Privacy & Team Readiness

### Goal

System is safe for team use.

### Checklist

- [ ] Define access scopes (repo-level, team-level)
- [ ] Ensure secrets / tokens are never stored in memory
- [ ] Filter PII / sensitive data
- [ ] Enable change log for memory entries
- [ ] Define team review process

### Acceptance Criteria

- Critical data never lands in memory
- Entries are auditable

---

## Phase 10: V1 Pilot with Real Repository

### Goal

Prove the system on a real project.

### Checklist

- [ ] Select pilot repository
- [ ] Run initial ingestion
- [ ] Execute 10 real tasks with memory support
- [ ] Document false positives
- [ ] Document stale memory occurrences
- [ ] Collect developer feedback
- [ ] Create prioritized V2 backlog

### Acceptance Criteria

- System saves noticeable discovery time in real tasks
- Stale knowledge is mostly correctly detected

---

## V2 Possibilities (Out of Scope for V1)

### From agentmemory

- **Team Memory** — namespaced shared + private across team members (`memory_team_share`, `memory_team_feed`)
- **Multi-Agent Coordination** — exclusive action leases, inter-agent signals, sentinels
- **Real-Time Web Viewer** — live observation stream, session explorer, knowledge graph visualization
- **Git-Based Memory Snapshots** — version, rollback, and diff memory state
- **Action System** — work items with dependencies, `memory_frontier` (unblocked by priority), `memory_next`
- **Knowledge Graph Traversal** — entity extraction + BFS traversal as third retrieval stream

### From claude-mem

- **MEMORY.md Bridge** — bi-directional sync between file-based memory (built-in) and database memory
- **Endless Mode** — biomimetic memory architecture for extended sessions (prevents context overflow)

### Our own

- Symbol-level dependency graph
- PR and ticket integration (Jira, GitHub Issues)
- IDE commands / VS Code extension
- Memory snapshots per release
- Automatic ADR detection
- Test impact analysis
- Tenant / domain-specific memory
- Branch-specific temporary memory

---

## Recommended Execution Order

| # | Phase | Rationale |
|---|---|---|
| 1 | Phase 0 | Decisions first |
| 2 | Phase 1 | Infrastructure |
| 3 | Phase 2 | Storage foundation |
| 4 | Phase 3 | Retrieval (usable immediately) |
| 5 | Phase 4 | Trust (quality gate) |
| 6 | Phase 5 | Ingestion (populate) |
| 7 | Phase 6 | Invalidation (keep fresh) |
| 8 | Phase 7 | MCP + Agent integration |
| 9 | Phase 8 | Quality control |
| 10 | Phase 9 | Security & team |
| 11 | Phase 10 | Pilot |

Rationale: Build storage + retrieval + trust first, then ingestion and invalidation, then workflow and quality.

---

## Minimal V1 Workflow Example

```bash
# 1. Ingest a repository
memory ingest ./my-project

# 2. Query memory
memory retrieve "how are invoice totals recalculated?"
# → Returns top entries with trust status

# 3. Agent works on task...

# 4. After work: invalidate affected entries
memory invalidate --from-git-diff

# 5. Extract new knowledge from completed work
memory ingest --from-diff HEAD~1..HEAD
```

---

## Definition of Done for V1

V1 is reached when:

- Memory entries are stored in a structured way with evidence and trust
- Hybrid retrieval returns useful results
- Trust status is visible on every entry
- Git diffs trigger invalidation
- At least one agent (any) is integrated via MCP or CLI
- A pilot repository has been successfully tested

---

## Acceptance Criteria (Roadmap)

- [ ] All Phase 0 decisions documented as ADR
- [ ] All Safety Rules implemented and enforced (no bypass)
- [ ] Working CLI + MCP server
- [ ] Quarantine flow works — no entry goes directly to `validated`
- [ ] TTL expiry enforced — expired entries auto-stale
- [ ] Contradiction detection active on ingestion + retrieval
- [ ] Post-task extraction blocked when tests fail
- [ ] Audit trail complete — every status change traceable
- [ ] Trust threshold enforced — below 0.6 never returned to agents
- [ ] 10+ real tasks completed with memory support
- [ ] Stale detection accuracy >95% for critical/high-impact entries
- [ ] Zero poisoned entries remain active (all caught and cascaded)
- [ ] At least 2 different agents tested via MCP
- [ ] `memory health` shows all quality metrics green

## Notes

- This roadmap lives in `agent-config` for planning purposes — the actual memory system will be a **separate repository**
- The system is agent-agnostic by design: any model (GPT, Claude, Gemini, etc.) and any agent (Augment, Cursor, Cline, etc.) can use it
- MCP (Model Context Protocol) is the primary integration mechanism — supported by most modern agents
- The original German roadmap is archived in `agents/roadmaps/augment-agent-memory-hybrid-roadmap.md`