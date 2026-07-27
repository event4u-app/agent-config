---
adr: 129
status: accepted
date: 2026-07-27
decision: sqlite-substrate-maintainer-override
supersedes: 116
superseded_by: —
phase: road-to-reachable-code-memory · Phase 6
---

# ADR-129 — `node:sqlite` substrate lands by maintainer direction; ADR-116's ship-gate clause overridden, thresholds become rollback triggers

- **Deciders:** maintainer (recorded direction in the 2026-07-26 intake,
  `agents/tmp.old/consumer-index.txt`) + AI council procedural review
  2026-07-27 (anthropic/claude-sonnet-4-5 + openai/gpt-4o, 2 rounds — the
  round that activated `road-to-reachable-code-memory`; its convergence
  block in that roadmap explicitly states "this council round itself
  constitutes the procedural review of the ADR-116 reopening").

## Status

Accepted. Supersedes the **ship-gate clause and the scale-only activation
condition** of ADR-116. ADR-116's tripwire thresholds (200 files/type, 500
total as *monitoring* signals) and its documentation-conflict history remain
valid context; ADR-094's Layer-2 sunset is **explicitly untouched**.

## Context

ADR-116 pre-decided SQLite FTS5 (`node:sqlite`) as the memory-scale-tripwire
engine but bound it to (a) a scale-only activation condition (engine builds
only when the corpus crosses 200/type or 500 total) and (b) a ship-gate
clause: measured retrieval lift at activation, else honest-null and keep
grep. Its 2026-07-12 amendment records that the FTS5 engine was never built
and a stdlib BM25 (`src/scripts/_lib/lexical_index.ts`) took the activation
path instead.

Since then, the 2026-07-26 consumer-index measurement (fresh clone, engine
invoked directly; recorded in `agents/tmp.old/consumer-index.txt`) produced
three facts that change the decision surface:

1. **Separator-recall gap is a correctness defect, not a ranking preference**:
   hyphen/underscore query keys (`ai_council`, `roadmap-progress`,
   `force-push`) score **0** under the shipped `_score` substring scorer while
   the tokenizing engine returns 5 hits with 5 distinct scores (ADR-116
   § context already recorded this class).
2. **Byte-identical answers at ~1/90 the latency** for graph queries on a
   derived SQLite store, with ~14× less memory and zero new dependencies.
3. `node:sqlite` with FTS5 is verified available, unflagged, on the current
   Node (re-verified 2026-07-27 on v25.9.0: `CREATE VIRTUAL TABLE … USING
   fts5` + MATCH round-trip succeeds; the runtime keeps the established
   lazy-import + graceful-fallback guard because the supported floor is
   Node ≥ 20.11, below `node:sqlite`'s ≥ 22.5).

## Decision

1. The `node:sqlite` substrate ships now, **by maintainer direction**, as
   derived stores only: a `code-graph-v1.sqlite3` beside the canonical JSON
   graph cache, and an FTS5 index over both curated memory layouts + intake
   JSONL. JSON stays canonical and byte-deterministic; every SQLite artifact
   is derived, gitignored, disposable, and rebuilt from committed truth.
2. **ADR-116's ship-gate clause ("measured lift at activation, else keep
   grep") is overridden** for this landing, with the recorded three-point
   rationale:
   - the separator-recall gap is a **correctness defect you don't A/B
     against** — a query key that scores 0 cannot be rescued by ranking
     comparisons;
   - **byte-identical answers at ~1/90 latency** make a lift-gate the wrong
     instrument — there is no quality delta to measure, only a cost delta
     already measured;
   - the clause was **written for a scale question** (when does an index
     earn its complexity at corpus growth), not for a correctness-plus-cost
     landing at current scale.
3. **ADR-116's scale-only activation condition is retired.** The tripwire
   (`lint_knowledge_scale`) stays as a monitoring signal, not as the gate on
   this substrate.
4. **Thresholds are ROLLBACK triggers, never undisclosed ship gates**:
   - graph store: query p95 ≤ 50 ms and heap ≤ 10 MB — a miss reverts THAT
     store to the JSON fallback plus an incident note;
   - memory store: the 24-query replay reports recall AND tie-distribution
     against the recorded `mean_tie_set_size: 4.11` baseline
     (`internal/bench/reports/second-brain-retrieval.json`; the sibling
     `lexical-ranking.json` records 3.333 for the same scorer — the
     cross-artefact discrepancy is documented in `docs/proof.md` and the
     replay must state which baseline artefact it compares against).
5. **ADR-094's Layer-2 sunset is untouched**: no service, no vector tier, no
   daemon, no auto-promotion into curated memory. Promotion stays human.

## Consequences

- Zero new `dependencies`; old-Node runtimes degrade to the JSON/BM25
  fallback paths (CI-asserted by the install-friction guard).
- Rollback = delete the derived `.sqlite3` files; committed truth is never
  in SQLite.
- The never-read `SCHEMA_VERSION` defect class in the existing telemetry
  twins is fixed by stamping `PRAGMA user_version` on ALL derived SQLite
  stores (zero-touch upgrade phase).
- No silent relitigation: this ADR is the recorded override; the council
  session that reviewed the reopening is named in the header.

## Alternatives

- **Keep the ship-gate and run a lift benchmark first** — rejected: no
  quality delta exists to measure (byte-identical answers); the gate would
  measure noise and delay a correctness fix.
- **Grow `lexical_index.ts` into the persistent store** — rejected: it
  remains the in-memory fallback scorer; persistence economics (rebuild
  cost, mmap'd queries, FTS5 tokenization closing the separator gap) were
  ADR-116's own grounds for choosing SQLite.
- **A vector/embedding tier** — rejected (ADR-094 sunset; external API,
  network, non-determinism).

## References

- ADR-116 (superseded clause + tripwire context), ADR-094 (Layer-2 sunset),
  ADR-061 (no engine fork), ADR-124 (embedded-engine doctrine).
- `agents/roadmaps/road-to-reachable-code-memory.md` § Council convergence
  (2026-07-27) and Phase 6.
- Measurement record: `agents/tmp.old/consumer-index.txt` (2026-07-26).
