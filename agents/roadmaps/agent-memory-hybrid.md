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
  "trust": {
    "status": "validated",
    "score": 0.91,
    "validated_at": "2026-04-13T10:00:00Z"
  },
  "invalidation": {
    "strategy": "file_symbol_dependency_based",
    "watched_files": ["src/Billing/OrderTotalService.ts"],
    "watched_symbols": ["OrderTotalService::recalculate"]
  },
  "created_by": "agent",
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

## Trust & Validation

### Trust Statuses

```
new → validated
new → stale
validated → stale
stale → validated (revalidated)
validated → invalidated
stale → invalidated
invalidated → archived
```

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
| **Soft invalidate** | Evidence weakened but entry may still be useful | Status → `stale`, requires review before use |
| **Hard invalidate** | Core symbol deleted, evidence gone, contradicted | Status → `invalidated`, archived |

---

## Retrieval Strategy

Hybrid retrieval pipeline:

1. **Lexical search** — keyword matching
2. **Vector search** — semantic similarity via embeddings
3. **Metadata filters** — repository, module, type, trust status
4. **Freshness check** — validate against current git state
5. **Ranking** — relevance + trust score + freshness

### Ranking Signals

- Semantic similarity to query
- Same files / modules / symbols as current context
- Same domain / bounded context
- Relevance to current diff
- Trust status and last validation time

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

## Agent Workflow Integration

### Pre-Task

1. Agent receives task
2. Agent (or tool) identifies affected modules/files
3. Memory system retrieves relevant entries
4. Top entries validated against current code/git
5. Only validated or explicitly-marked-stale entries passed to agent

### During Task

- Agent uses its own code understanding (codebase search, context window, etc.)
- Memory serves as supplementary context, never overriding fresh code
- Session notes kept separate from persistent memory

### Post-Task

1. Analyze diffs from completed work
2. Extract new stable knowledge (architecture decisions, conventions discovered)
3. Update or invalidate affected existing entries
4. Discard session notes

---

## V1 Scope — What's In, What's Out

### In V1

- Memory entries with evidence + trust status
- Hybrid retrieval (lexical + vector)
- File-level git-diff invalidation
- Manual + agent-triggered ingestion
- CLI commands + MCP server interface
- Trust scoring and status transitions
- Basic ingestion from code, docs, git history

### NOT in V1

- Full knowledge graph (Neo4j)
- Automatic symbol-level dependency graphs
- Complex multi-agent orchestration
- Fully autonomous decision systems
- IDE extensions / VS Code plugins
- PR / ticket integration
- Branch-specific temporary memory

---

## Phase 0: Scope & Architecture Decisions

### Goal

Lock down all foundational decisions before writing code.

### Checklist

- [ ] Define V1 goal in writing
- [ ] Decide: TypeScript or Python as core language
- [ ] Decide: Postgres + pgvector or alternative vector DB
- [ ] Define first 5 memory types for V1
- [ ] Define trust statuses (`new`, `validated`, `stale`, `invalidated`, `archived`)
- [ ] Define revalidation triggers
- [ ] Decide: CLI-first or service-first approach
- [ ] Choose example repository for development
- [ ] Create architecture ADR documenting the above decisions

### Acceptance Criteria

- Anyone can explain in 5 minutes what Memory stores and what it doesn't
- V1 scope exists with clear boundaries

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
- [ ] Integrate logging
- [ ] Define error handling and structured error codes
- [ ] Provide healthcheck endpoint
- [ ] Create baseline README
- [ ] Stub CLI commands: `memory:ingest`, `memory:retrieve`, `memory:validate`, `memory:invalidate`

### Acceptance Criteria

- Project starts locally and reproducibly
- DB migrations run cleanly
- Base commands exist (stubs)

---

## Phase 2: Data Model & Storage

### Goal

Store, load, and version memory entries in a structured way.

### Checklist

- [ ] Create `memory_entries` table
- [ ] Create `memory_evidence` table
- [ ] Create `memory_links` table (file, symbol, module associations)
- [ ] Create `memory_status_history` table
- [ ] Add vector column for embeddings
- [ ] Define JSON fields for flexible metadata
- [ ] Implement repository / DAO layer
- [ ] Write unit tests for CRUD operations

### Acceptance Criteria

- Entries can be stored with evidence and trust status
- Status change history is traceable

---

## Phase 3: Retrieval Engine

### Goal

Find relevant knowledge snippets for the current task.

### Checklist

- [ ] Implement lexical search
- [ ] Implement vector search
- [ ] Implement filters by repository / module / type / trust / status
- [ ] Implement ranking function (relevance + trust + freshness)
- [ ] Provide query API and CLI command
- [ ] Define agent-friendly response format
- [ ] Write tests with realistic queries

### Acceptance Criteria

- For real coding tasks, relevant memory entries are found
- Obviously irrelevant entries don't rank high

---

## Phase 4: Trust & Validation System

### Goal

Memory must not be blindly trusted. Relevant entries must be validated before use.

### Checklist

- [ ] Define trust model (scores, thresholds)
- [ ] Create validator interfaces
- [ ] Build file-exists validator
- [ ] Build symbol-exists validator
- [ ] Build diff-impact validator
- [ ] Optional: build test-linked validator
- [ ] Implement trust score calculation
- [ ] Document status transitions
- [ ] Connect trust with retrieval ranking

### Acceptance Criteria

- Every returned entry has a traceable trust status
- Outdated entries are visibly downgraded

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

- [ ] Implement file scanner
- [ ] Integrate symbol extraction
- [ ] Integrate documentation reader
- [ ] Integrate git commit reader
- [ ] Define candidate model
- [ ] Define heuristics for relevant knowledge extraction
- [ ] Implement deduplication strategy
- [ ] Integrate embedding creation

### Acceptance Criteria

- System generates meaningful memory candidates from a real repository
- Noise is manageable

---

## Phase 6: Invalidation Engine

### Goal

Automatically react to code changes and update memory trust status.

### Checklist

- [ ] Implement git diff reader
- [ ] Implement file-based watch rules
- [ ] Implement symbol-based watch rules
- [ ] Add dependency-based invalidation
- [ ] Build soft-invalidate flow
- [ ] Build hard-invalidate flow
- [ ] Introduce revalidation jobs
- [ ] Create audit log for invalidation events

### Acceptance Criteria

- When relevant files change, memory system reacts correctly
- Stale knowledge doesn't stay silently active

---

## Phase 7: MCP Server & Agent Integration

### Goal

Make memory practically usable from any AI coding agent via MCP protocol.

### Checklist

- [ ] Implement MCP server with tools: `memory_retrieve`, `memory_ingest`, `memory_validate`, `memory_invalidate`
- [ ] Define standard task workflow (pre-task retrieval, post-task extraction)
- [ ] Integrate retrieval into pre-task flow
- [ ] Integrate validation before usage
- [ ] Integrate post-task knowledge extraction
- [ ] Define memory update flow after merge
- [ ] Separate session notes from persistent memory
- [ ] Test with at least 2 different agents (e.g., Claude Code + Augment)

### Acceptance Criteria

- Workflow is usable without manual special logic
- Knowledge grows in a controlled way with each completed task
- Any MCP-capable agent can interact with memory

---

## Phase 8: Quality Control & Anti-Drift

### Goal

Memory must remain useful over weeks and months.

### Checklist

- [ ] Define metrics: retrieval precision, stale rate, duplicate rate, revalidation success rate
- [ ] Build review command for questionable entries
- [ ] Build duplicate merge mechanism
- [ ] Define archival strategy
- [ ] Introduce scheduled cleanup job

### Acceptance Criteria

- System quality is measurable
- Bad knowledge doesn't accumulate indefinitely

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

- Graph memory (Neo4j)
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

- [ ] All Phase 0 decisions documented
- [ ] Working CLI + MCP server
- [ ] 10+ real tasks completed with memory support
- [ ] Stale detection accuracy > 80%
- [ ] At least 2 different agents tested

## Notes

- This roadmap lives in `agent-config` for planning purposes — the actual memory system will be a **separate repository**
- The system is agent-agnostic by design: any model (GPT, Claude, Gemini, etc.) and any agent (Augment, Cursor, Cline, etc.) can use it
- MCP (Model Context Protocol) is the primary integration mechanism — supported by most modern agents
- The original German roadmap is archived in `agents/roadmaps/augment-agent-memory-hybrid-roadmap.md`