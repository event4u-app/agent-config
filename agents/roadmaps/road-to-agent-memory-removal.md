---
complexity: structural
status: ready
---

# Road to agent-memory removal

> Remove every trace of the heavyweight Layer-2 `@event4u/agent-memory`
> integration from agent-config (the external repo is being deleted),
> keep the file-first Layer-1 memory standalone, and fold the portable
> write-time-curation discipline from MemSkill into the existing
> `memory-consolidation` skill.

## Goal

Reduce agent-config to a single, file-first memory layer: zero tracked
references to `@event4u/agent-memory`, its contract, or its MCP routing —
while Layer-1 retrieval keeps working unchanged and `memory-consolidation`
gains MemSkill's write-time curation heuristics.

## Prerequisites

- [ ] Confirm no consumer depends on Layer-2 routing (maintainer-confirmed
      unused; external `event4u-app/agent-memory` repo will be deleted —
      no deprecation window, no consumer git-tag needed).
- [ ] Council decision recorded (claude-sonnet-4-5 + gpt-4o, 2026-06-14:
      remove not freeze, adopt MemSkill patterns 1 & 3 as docs, fold
      pattern 2 into `memory-consolidation`, reject the ML pipeline).

## Context

Two prior council rounds (2026-06-14) ruled: Layer 1 (file-first curated
`agents/memory/<type>/` YAML + `intake/*.jsonl`, typed `retrieve()` lookup)
is governance, stays; Layer 2 (separate PostgreSQL+pgvector+MCP+decay+trust+
cross-project package) is architecturally unsound for a "no app runtime"
suite and is unused — remove it.

MemSkill (github.com/ViktorAxelsen/MemSkill, Apache-2.0) is academic ML
(vllm/torch/W&B, RL trainer, HF weights) — its **pipeline is not adopted**.
Only its distilled write-time discipline is portable, and it reinforces the
removal: memory quality comes from skills applied at write time, not from a
heavy storage/decay/vector substrate.

### Blast radius (measured 2026-06-14) — file ownership

| Surface | Files | Action |
|---|---|---|
| Retrieval/status scripts | `src/scripts/memory_lookup.py` (`package_operational_provider`, "present" path), `memory_status.py`, `memory_report.py`, `memory_signal.py` + `src/agent-src/templates/scripts/` mirrors | Reduce to file-first only |
| MCP package routing | `src/scripts/mcp_server/tools.py`, `mcp_server/consumer_tool_catalog.json` | Drop Layer-2 tool routing |
| Contract + settings | `docs/contracts/agent-memory-contract.md`, `memory-visibility-v1.md`, `src/config/agent-settings.template.yml`, consumer settings templates | Remove contract + keys |
| Cross-references | `docs/contracts/{adr-layout,adr-level-6-productization,explain-modes,implement-ticket-flow,mcp-tool-inventory,rule-interactions,universal-skills}.md`, `docs/guidelines/agent-infra/memory-access.md`, `src/domains/meta/memory/mine-session/command.md`, `src/skills/memory-consolidation/SKILL.md`, `src/scripts/{audit_adr_coverage,check_memory}.py` | Scrub references |
| Decision records | `docs/adrs/memory/0001-consumer-side-snapshot.md` + `README.md`, `docs/decisions/ADR-026`, `ADR-037` | Supersede (do not delete ADRs); scrub passing mentions |
| Archived specs | `agents/roadmaps/archive/agent-memory/` (specs for the deleted repo) | Delete (residue) |

## Phase 1 — Strip Layer-2 from memory scripts

- [ ] Remove `package_operational_provider` + the package "present" retrieval
      path from `src/scripts/memory_lookup.py`; keep file-first `retrieve()`
      as the sole path. Mirror in `src/agent-src/templates/scripts/memory_lookup.py`.
- [ ] Reduce `memory_status.py` to a file-store status (drop `@event4u/agent-memory`
      detection); update `memory_report.py`, `memory_signal.py` accordingly +
      their `templates/scripts/` mirrors.
- [ ] Update `src/scripts/check_memory.py` / `audit_adr_coverage.py` to stop
      asserting the contract.
- [ ] Update callers of `retrieve(..., operational_provider=...)` in skills/rules
      (downstream-changes sweep).

**Exit:** `grep -rn "package_operational_provider\|@event4u/agent-memory" src/scripts` returns zero; `python3 src/scripts/memory_lookup.py --types ownership --key billing` still returns file results.
**Rollback:** revert the script commits; the package path was inert, so Layer 1 is unaffected either way.

## Phase 2 — Drop MCP package routing

- [ ] Remove Layer-2 tool routing from `src/scripts/mcp_server/tools.py`.
- [ ] Remove the agent-memory entries from `mcp_server/consumer_tool_catalog.json`.
- [ ] Update `docs/contracts/mcp-tool-inventory.md` to drop the routed tools.

**Exit:** MCP server starts; `grep -rn "agent-memory" src/scripts/mcp_server` returns zero; tool inventory lints clean.
**Rollback:** revert the MCP commits.

## Phase 3 — Remove contract, settings keys, and cross-references

- [ ] Delete `docs/contracts/agent-memory-contract.md`.
- [ ] Remove Layer-2 keys from `src/config/agent-settings.template.yml` and
      consumer settings templates (`src/agent-src/templates/agents/agent-project-settings.example.yml`);
      keep Layer-1 `memory:` consolidation keys.
- [ ] Scrub the contract/package references from `memory-visibility-v1.md`,
      the other `docs/contracts/*.md`, `docs/guidelines/agent-infra/memory-access.md`,
      and `src/domains/meta/memory/mine-session/command.md` — reword to file-first.
- [ ] Run `/fix:refs` (or `task check-refs`) to confirm no dangling links.

**Exit:** `task check-refs` green; `grep -rn "agent-memory-contract" src docs` returns zero.
**Rollback:** restore the contract file + reverted reference edits.

## Phase 4 — Supersede decision records + delete archived specs

- [ ] Write an ADR (`adr-create`) recording the Layer-2 removal + MemSkill-discipline
      adoption; mark `docs/adrs/memory/0001-consumer-side-snapshot.md` + its README
      as superseded by it.
- [ ] Scrub passing `agent-memory` mentions from `ADR-026`, `ADR-037` (keep the ADRs).
- [ ] Delete `agents/roadmaps/archive/agent-memory/` (specs for the deleted external repo).

**Exit:** new ADR present + indexed (`regenerate_index.py`); archived spec dir gone; `grep -rn "@event4u/agent-memory" docs` returns only the superseding/historical ADR.
**Rollback:** `git restore` the ADR + archived dir.

## Phase 5 — Adopt MemSkill write-time discipline (Layer-1 quality)

- [ ] Extend `src/skills/memory-consolidation/SKILL.md` with a "Write-time
      curation discipline" section: dedupe before adding, split distinct facts,
      merge + preserve still-valid details on refresh, delete only on explicit
      contradiction, **prefer no-op under uncertainty**, skip trivial/fleeting/
      speculative content. Add a MemSkill provenance line (Apache-2.0 + commit SHA).
- [ ] Add the meta-memory framing (skill = *how to remember*, memory file =
      *content*) as a short note where the memory architecture is documented.
- [ ] Add the storage/retrieval/quality failure taxonomy as a review checklist
      in the `/memory` consolidation command docs.
- [ ] Do NOT create a new INSERT/UPDATE/DELETE/NOOP operation skill (taxonomy
      doesn't map to append-only YAML/JSONL); do NOT import any ML pipeline.

**Exit:** `memory-consolidation` SKILL passes `task lint-skills`; the three doc additions present; no new memory skill/rule introduced.
**Rollback:** revert the skill/doc edits.

## Phase 6 — Verify clean + regenerate

- [ ] `grep -rn "@event4u/agent-memory\|package_operational_provider\|agent-memory-contract" src docs agents` returns zero (excluding the superseding ADR's historical note).
- [ ] `/condense` (Layer-1 + skill edits) and `task generate-tools`.
- [ ] `task ci` green.

**Exit:** all greps clean, `task ci` green, dist/tool projections regenerated.
**Rollback:** none needed once green; otherwise revert the failing phase.

## Acceptance criteria

- [ ] Zero tracked references to `@event4u/agent-memory`, its contract, or its
      MCP routing (the superseding ADR's historical note is the only mention).
- [ ] Layer-1 file-first memory works standalone (`memory_lookup.py` returns
      results with no package present).
- [ ] `memory-consolidation` carries MemSkill write-time discipline; no new
      memory framework, skill, or ML dependency added.
- [ ] `task check-refs` and `task ci` green.
