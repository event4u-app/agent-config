---
adr: 094
status: accepted
date: 2026-06-14
decision: agent-memory-layer-removal
supersedes: —
superseded_by: —
phase: memory-layer-cleanup
type: structural
---

# ADR-094 — Remove the heavyweight agent-memory layer; keep file-first memory

## Status

**Accepted** · 2026-06-14. Resolved by three AI-council rounds
(claude-sonnet-4-5 + gpt-4o) on 2026-06-14; maintainer-directed package
optimization.

## Context

Engineering memory in this suite had **two layers**:

- **Layer 1 — file-first (in this repo).** Curated YAML under
  `agents/memory/<type>/` + agent-written `agents/memory/intake/*.jsonl`,
  read through `scripts/memory_lookup.retrieve()`. Git-tracked, lintable,
  redactable, vendor-neutral. No external infrastructure.
- **Layer 2 — the `@event4u/agent-memory` companion package (separate repo).**
  PostgreSQL + pgvector, an MCP server, Ebbinghaus decay, trust scoring, and
  cross-project learning. Consumed optionally via a versioned cross-repo
  contract; `scripts/memory_lookup.py` exposed an `operational_provider` seam,
  `scripts/memory_status.py` probed for the package CLI, and the MCP tools
  routed through it when "present".

The package was unused, its integration roadmaps were already archived, and
its external repository is being deleted. Native agent memory (Claude, Cursor)
is improving on the exact axis — semantic cross-session recall — where the
package competed, and its PostgreSQL + MCP runtime contradicted the suite's
"no app runtime" positioning.

## Decision

1. **Remove Layer 2 entirely** from `agent-config` — the package binding and
   the now-dead generic operational machinery it alone served:
   `package_operational_provider` / `_cli_operational_provider`, the
   `operational_provider` parameter, the `OperationalProvider` type, the
   repo-vs-operational conflict rule, `Shadow` / `with_shadows` /
   `shadowed_by`, the package-detection in `memory_status.py`, the MCP
   `with_package` routing, and the `agent-memory-contract.md` contract doc.
2. **Keep Layer 1** — file-first `retrieve()`, the `check_memory.py` redaction
   gate, and the typed curated/intake store. This is *governance* (auditable,
   portable, reviewable), a different job from native memory.
3. **Simplify contract artefacts in-place, do not loudly break.** The internal
   `retrieval-v1` schema + conformance suite were reduced to repo-only
   (`source: "repo"`; no `operational` / `trust` / `shadowed_by`) rather than
   version-bumped, because the only consumer (the package) is deleted.
4. **Adopt MemSkill's write-time curation discipline** (Apache-2.0,
   github.com/ViktorAxelsen/MemSkill) into the `memory-consolidation` skill —
   dedupe before insert, split distinct facts, merge-and-preserve on update,
   delete only on explicit contradiction, prefer no-op under uncertainty, skip
   trivial/fleeting/speculative. The ML training/eval pipeline is **not**
   adopted; MemSkill's own thesis (quality comes from write-time skills, not a
   heavy storage substrate) reinforces the removal.

## Consequences

- One memory layer, file-backed, smaller surface, no infra prerequisite.
- `memory_status.status()` is now a constant file-backend report; `health()`
  still emits the v1 envelope shape so the MCP `memory_status` tool is stable.
- No decay engine → committed memory is bounded manually (intake gitignored,
  type narrowing, entry caps, archived-entry deletion — see
  `road-to-memory-pipeline-consolidation.md`).
- The memory ADR area (`docs/adrs/memory/`) is retired from
  `audit_adr_coverage.py`; ADR 0001 there is marked superseded by this ADR.

## Alternatives considered

- **Freeze Layer 2 (leave inert).** Rejected — a dormant integration surface
  advertising a capability the suite no longer has is misleading residue.
- **Markdown-only (drop the YML layer too).** Rejected — the working
  `retrieve()` machinery + the `check_memory.py` redaction gate are real
  governance a schema-less markdown parser cannot cheaply replace; an 8-consumer
  migration is untested risk for no gain (council, Option B).
- **Revive Layer 2 later.** Gated: requires ≥2 funded consumer projects with a
  named maintainer each + explicit PostgreSQL adoption.

## References

- `agents/roadmaps/archive/road-to-agent-memory-removal.md` — the executing roadmap (archived).
- `agents/roadmaps/archive/road-to-memory-pipeline-consolidation.md` — follow-on
  mining consolidation + size bounding.
- `docs/adrs/memory/0001-consumer-side-snapshot.md` — superseded by this ADR.
- `docs/guidelines/agent-infra/memory-access.md` — the surviving file-backed
  retrieval contract.
