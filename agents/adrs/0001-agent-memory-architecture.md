# ADR-0001: Agent Memory Hybrid — Architecture Decisions

> **Status:** Accepted
> **Date:** 2026-04-14
> **Roadmap:** `agents/roadmaps/agent-memory-hybrid.md`
> **Inspiration:** [agentmemory](https://github.com/rohitg00/agentmemory), [claude-mem](https://github.com/thedotmack/claude-mem)

## V1 Goal

Build a persistent, trust-scored project memory system that any AI coding agent can query via MCP/CLI.
It stores validated project knowledge, invalidates on code changes, and prevents stale knowledge from being served to agents.

**V1 is NOT:** a knowledge graph, a multi-agent orchestration system, a team collaboration tool, or an autonomous decision engine.

## Decision 1: Programming Language — TypeScript

**Chosen:** TypeScript (Node.js)

**Rationale:**
- MCP SDK is TypeScript-native (`@modelcontextprotocol/sdk`)
- Close to IDE tooling ecosystem (VS Code extensions, LSP)
- Strong typing catches schema/model errors at compile time
- npm ecosystem for embedding libraries, parsers, DB clients
- agentmemory (inspiration) is also TypeScript

**Rejected:** Python — good for ML but weaker typing, no native MCP SDK advantage.

## Decision 2: Database — Postgres + pgvector

**Chosen:** Single Postgres instance with pgvector extension

**Rationale:**
- Vector search + relational metadata in one DB (no sync issues)
- pgvector supports cosine similarity, L2, inner product
- Postgres is battle-tested for structured data (trust history, audit trails)
- Single dependency to manage (vs Postgres + Chroma/Pinecone)
- Scales well for V1 volumes (thousands of entries, not millions)

**Rejected:** SQLite (too limited for concurrent access, no native vector), Chroma (extra service, sync complexity).

## Decision 3: First 5 Memory Types for V1

| Type | Impact Level | Knowledge Class |
|---|---|---|
| `architecture_decision` | Critical | Evergreen |
| `domain_rule` | Critical | Evergreen |
| `coding_convention` | Low | Evergreen |
| `bug_pattern` | Normal | Semi-Stable |
| `refactoring_note` | Normal | Volatile |

Additional types added as needed after pilot. All types in roadmap are valid, but V1 starts lean.

## Decision 4: Trust Statuses

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

**Iron rule:** New entries ALWAYS start in `quarantine`. No shortcut to `validated`.

## Decision 5: Revalidation Triggers

| Trigger | Action |
|---|---|
| Watched file changed | Soft invalidate → `stale` |
| Watched symbol deleted/renamed | Hard invalidate → `invalidated` |
| TTL expired | Auto → `stale` |
| Function signature changed | Semantic drift → `stale` (high priority) |
| Large refactor (>50% of file) | Soft invalidate → `stale` |
| Branch merged to main | Re-check all entries scoped to merged files |
| Tests fail for watched area | Block new extraction, flag related entries |

## Decision 6: TTL per Knowledge Class

| Class | TTL (without access) | With Ebbinghaus Boost |
|---|---|---|
| Evergreen | 90 days | +30d per 10 accesses (cap: 365d) |
| Semi-Stable | 30 days | +7d per 10 accesses (cap: 90d) |
| Volatile | 7 days | +2d per 10 accesses (cap: 30d) |

**Hard floor:** Even frequently accessed entries must be revalidated when evidence changes.

## Decision 7: Trust Threshold

| Mode | Minimum Score | Behavior |
|---|---|---|
| Default (agent query) | 0.6 | Below → not returned |
| Explicit low-trust | 0.3 | Below 0.6 → `⚠️ LOW TRUST` marker |
| Admin/review | 0.0 | All entries visible |
| Below 0.3 | — | Never returned to agents, only in admin |

## Decision 8: Impact Levels

| Level | Types | Min Evidence | Trust Cap (1 evidence) |
|---|---|---|---|
| Critical | `architecture_decision`, `domain_rule` | 2+ | 0.7 |
| High | `integration_constraint`, `deployment_warning` | 1+ | 0.85 |
| Normal | `bug_pattern`, `refactoring_note`, `test_strategy` | 1 | 1.0 |
| Low | `coding_convention`, `glossary_entry` | Optional | 1.0 |

## Decision 9: Quarantine → Validation Flow

```
1. Agent creates entry → status: quarantine
2. System checks evidence:
   a. Referenced file exists? (file-exists validator)
   b. Referenced symbol exists? (symbol-exists validator)
   c. No contradiction with existing validated entries? (contradiction detector)
3. If ALL checks pass → status: validated (with calculated trust score)
4. If ANY check fails → status: rejected (with reason)
5. Rejected entries kept for 7 days (debugging), then archived
```

## Decision 10: Contradiction Detection Strategy

**On ingestion:**
1. Find existing entries with overlapping scope (same files OR same symbols OR same module)
2. Compare claims semantically (embedding similarity > 0.8 AND opposing sentiment)
3. If contradiction detected → flag BOTH entries, set both to `stale`
4. Neither served to agents until conflict resolved (manually or by new evidence)

**On retrieval:**
1. If multiple results share scope but conflict → include `⚠️ CONTRADICTION` marker
2. Return both with context, let agent decide

## Decision 11: Post-Task Extraction Guard

Extraction is BLOCKED (not just warned) when:
- Tests fail for affected area (if tests exist)
- Quality tools report new errors (if quality tools configured)
- Diff contains only deletions (nothing to extract)

Extraction proceeds to quarantine when:
- Tests pass OR no tests exist for affected area
- Quality tools clean OR not configured
- Meaningful additions/changes in diff

## Decision 12: Interface — CLI-first, MCP in Phase 7

**V1 order:**
1. CLI commands (`memory ingest`, `memory retrieve`, etc.) — Phase 1-6
2. MCP server wrapping CLI — Phase 7
3. REST API — V2

**Rationale:** CLI is testable, debuggable, and usable by any agent via shell. MCP adds structured tool interface for agents that support it.

## Decision 13: Example Repository

**Primary:** `event4u/agent-config` (this repo)
- Has rules, skills, commands, guidelines — good variety
- Has git history with meaningful commits
- Small enough for fast iteration

**Secondary (pilot):** A real application repository (TBD during Phase 10)

## Decision 14: Project Location

**Repository:** [`event4u-app/agent-memory`](https://github.com/event4u-app/agent-memory)

**Rationale:** Sibling package in the `event4u` family, same pattern as `agent-config`, `data-helpers`, `strict-laravel-models`. Can be published independently to npm.

## Decision 15: Embedding Provider

**Default:** Local `all-MiniLM-L6-v2` (free, offline, no API key)
**Fallback chain:** Local → Gemini (free tier) → OpenAI → BM25-only

No external API required for basic operation.
