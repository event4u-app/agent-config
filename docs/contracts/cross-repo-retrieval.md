---
stability: experimental
---

# Cross-Repo Retrieval Contract

> **Status** · v0 / design · 2026-05-30. Phase 4 of `road-to-leaner-core-and-discovery`.
> Extends [ADR-032](../decisions/ADR-032-linked-projects-scope.md) **Option A** (passive,
> read-only, opt-in-per-sibling, no bulk inclusion). Does **not** advance to Option B (auto-scan)
> or Option C (implicit inclusion).

## Problem

The ADR-032 detector finds IDE-attached sibling repos but today only produces a passive *awareness
note* — the agent knows a sibling exists but cannot pull context from it. This contract makes opted-in
siblings a **read-only, targeted retrieval source**: the agent can fetch a shared type, an API contract
the frontend consumes, or a config the sibling owns, **without bulk-including** its files.

## Scope guards (Option A, non-negotiable)

```
READ-ONLY. OPT-IN-PER-SIBLING. TARGETED QUERY, NEVER A FULL-TREE SWEEP.
```

- **Read-only.** No writes to any sibling. Out-of-root writes still pass the host permission gate;
  this surface never writes.
- **Opt-in only.** Only siblings with `include: true` in `agents/settings/.agent-settings.local.yml`
  → `linked_projects[]` are read. A sibling not opted in is never touched.
- **Targeted query only.** Every retrieval is a bounded path-glob + content grep — never a blind walk.
  A `large`-flagged sibling (per the detector) **requires a path scope** and rejects an unscoped query.
- **Bounded.** ≤ `max_chunks` results per query (default 8). One concept per query.

## Retrieval envelope

Each match is returned as:

```json
{ "source_repo": "<sibling dir name>", "path": "<rel path in sibling>",
  "chunk": "<≤ 2 KB redacted excerpt>", "freshness": "<git last-commit date or mtime>",
  "match_reason": "<why this matched: path-glob or content term>" }
```

`chunk` passes the same redaction floor as `knowledge_ingest.py` — secrets and PII are scrubbed before
any cross-repo text is surfaced. Cross-repo text never leaks a secret.

## Memory integration — tagged + discounted

Cross-repo matches projected into `memory_retrieve` carry `source: cross-repo` and are scored **below**
local curated knowledge — the same 0.85× discount the `knowledge:` namespace already applies — so
cross-repo context never outranks the project's own truth.

## Surfaces

- CLI: `agent-config linked-projects:list` — prints opted-in siblings (`path · detected_via · large`).
  Closes the ADR-032 follow-up "expose the detector as a CLI subcommand for consumer reach."
- CLI / agent: `/knowledge:cross-repo <query>` — renders matches as `source_repo · path · freshness · why`.
  Honours opt-out (a sibling not `include: true` is never read); inert with a clear message when no
  siblings are opted in.

## Implementation

`scripts/cross_repo_retrieve.py` (≤ 300 LOC). Pure-local, read-only, no network. Reuses the chunking +
redaction floor from `knowledge_ingest.py`. Coverage: `tests/test_cross_repo_retrieve.py` against
fixture sibling repos under `tests/fixtures/cross-repo/`.
