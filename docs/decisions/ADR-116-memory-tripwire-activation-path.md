---
adr: 116
status: accepted
date: 2026-07-08
decision: memory-tripwire-activation-path
supersedes: —
superseded_by: —
phase: road-to-memory-retrieval-economy · Phase 6
---

# ADR-116 — Memory scale-tripwire activation path: one engine, measured at fire time

- **Deciders:** maintainer + AI council (anthropic/claude-sonnet-4-5 +
  openai/gpt-4o; disposition debate 2 rounds + engine tie-break 2 rounds,
  2026-07-08 — tie-break converged after the in-repo `node:sqlite`
  precedent was surfaced)

## Context

An external second-opinion review (round 2 of the Obsidian-reference
comparison) surfaced a real documentation conflict: the memory-scale
tripwire (>200 files in one memory/knowledge type, or >500 files total —
guarded by `lint_knowledge_scale.ts`) had **three different pre-decided
activation paths** across three artifacts, written by two councils one day
apart:

1. `agents/settings/contexts/second-brain-delta-verdict.md` Q4
   (2026-07-07): "file-first in-memory BM25 (minisearch-class, re-index at
   session-start, no persistence)".
2. `agents/roadmaps/road-to-memory-retrieval-economy.md` Phase 6
   (2026-07-07/08): "SQLite FTS5 over the memory files … replacing
   `_score()`'s substring pass".
3. `docs/decisions/ADR-061-corpus-grounding-layer.md`: "a new domain ships
   a manifest + data + a named owner — **not a forked engine**", with a
   tested in-house BM25 (`src/skills/corpus-grounding/scripts/bm25_search.ts`,
   generic `class BM25` over `Row[]`) as the implied reuse candidate.

The whole point of a pre-decided path is that the tripwire firing needs no
new debate; in this state, firing would have required one.

## Decision

1. **One engine: SQLite FTS5 via Node's built-in `node:sqlite`.**
   - Zero npm dependency — the repo already uses `node:sqlite` in
     production code (`src/scripts/mcp_telemetry_store.ts` /
     `mcp_telemetry_query.ts`) with the established pattern: lazy import +
     runtime guard for Node < 22.5 (`src/scripts/_lib/node_sqlite.d.ts`).
     `better-sqlite3` and a minisearch dependency are both rejected.
   - **Persistence economics** decided the tie-break: at tripwire scale the
     in-memory re-index per session-start is a startup tax that grows with
     the corpus; FTS5 gives a persisted index plus incremental updates.
     The in-house `class BM25` lacks a persistence layer; building one
     (serialization, incremental updates, corruption handling) recreates
     what SQLite ships.
   - Index location: `agents/runtime/state/` (gitignored, never tracked).
   - **Re-index is batch/lazy** — post-session or on first lookup, never
     inline per write: during active sessions files churn (drafts,
     rollbacks), and inline indexing would put fsync latency and lock
     contention inside the write path (council round-2 caveat).
   - FTS5 availability in the bundled SQLite is verified at implementation
     time; on absence or Node < 22.5 the runtime guard falls back to the
     current grep/substring path.

2. **Measurement at activation, no speculative harness.** At today's
   corpus (~85 auto-memory files / 412 KB) the ranked-retrieval lift over
   grep is zero by construction — the honest-zero is already recorded in
   the verdict. No grep-vs-ranked benchmark harness is built now. Instead,
   the pre-decided path carries a clause: when the tripwire fires, reuse
   the retrieval-economy Phase-0 replay set to measure the grep baseline
   vs the FTS5 candidate on the then-current corpus BEFORE building; ship
   only on measured retrieval lift, else record the honest-null and keep
   grep.

3. **ADR-061 boundary restated.** Memory lookup is a **Reference**
   operation in ADR-061's four-operation model — memory is never
   registered as a grounding corpus ("grounding theater"), and
   `corpus-grounding`'s engine is not forked per domain. This ADR does not
   amend ADR-061; it confirms the tripwire path lives outside the
   grounding layer.

4. **Wording migration.** The verdict Q4 "minisearch-class" sentence and
   the tripwire-table row are amended in the same change; a grep sweep for
   `minisearch` / "pre-decided BM25" catches stragglers in stable
   artifacts.

## Consequences

- Firing the tripwire is now a wiring-plus-measurement task, not a design
  debate: guard fires → replay-set comparison → on lift, ~30-line
  `node:sqlite` FTS5 schema + query wrapper replacing `_score()`'s
  substring pass.
- No new npm dependency at any point on this path; Layer-2 sunset stands
  (no vectors, no services, no always-on workers).
- The rejected review items are recorded here so they are not relitigated:
  a pre-built grep-vs-ranked harness (speculative — measures a known
  zero), and a deterministic "next step" hot-context field (feature envy
  absent a real resume-context gap; the LLM-summary ban from the verdict's
  REJECT-list is untouched).

## Alternatives

- **In-house `bm25_search.ts` as a library** — rejected in the tie-break:
  no persistence layer; the "zero new deps" advantage evaporated once
  `node:sqlite` (also zero-dep) was on the table; retrofitting
  persistence ≈ 200 LOC of database-shaped code SQLite already provides.
- **minisearch dependency** (verdict Q4's original wording) — rejected:
  new npm dependency for a problem the built-in module covers; same
  missing-persistence shape.
- **Two-step (in-house now, FTS5 escalation later)** — rejected: a
  pre-decided path must be single and unambiguous; a conditional two-step
  re-imports the debate the tripwire exists to avoid.
- **Pre-building the measurement harness now** — rejected: honest expected
  lift at the current corpus is zero; the replay set from Phase 0 will
  exist independently and is reused at fire time.

## References

- `agents/roadmaps/road-to-memory-retrieval-economy.md` § Phase 6 (engine
  note + measurement-at-activation clause).
- `agents/settings/contexts/second-brain-delta-verdict.md` Q4 (amended
  wording + tripwire table).
- `docs/decisions/ADR-061-corpus-grounding-layer.md` (four-operation
  model; engine-fork ban).
- `src/scripts/mcp_telemetry_store.ts`, `src/scripts/_lib/node_sqlite.d.ts`
  (in-repo `node:sqlite` precedent).
