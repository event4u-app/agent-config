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
| Contract + settings | the agent-memory contract doc under `docs/contracts/` (deleted), `memory-visibility-v1.md`, `src/config/agent-settings.template.yml`, consumer settings templates | Remove contract + keys |
| Cross-references | `docs/contracts/{adr-layout,adr-level-6-productization,explain-modes,implement-ticket-flow,mcp-tool-inventory,rule-interactions,universal-skills}.md`, `docs/guidelines/agent-infra/memory-access.md`, `src/domains/meta/memory/mine-session/command.md`, `src/skills/memory-consolidation/SKILL.md`, `src/scripts/{audit_adr_coverage,check_memory}.py` | Scrub references |
| Decision records | `docs/adrs/memory/0001-consumer-side-snapshot.md` + `README.md`, `docs/decisions/ADR-026`, `ADR-037` | Supersede (do not delete ADRs); scrub passing mentions |
| Archived specs | `agents/roadmaps/archive/agent-memory/` (specs for the deleted repo) | Delete (residue) |

## Phase 1 — Strip Layer-2 from memory scripts

- [x] Remove `package_operational_provider` + the package "present" retrieval
      path from `src/scripts/memory_lookup.py`; keep file-first `retrieve()`
      as the sole path. Mirror in `src/agent-src/templates/scripts/memory_lookup.py`.
- [x] Reduce `memory_status.py` to a file-store status (drop `@event4u/agent-memory`
      detection); update `memory_report.py`, `memory_signal.py` accordingly +
      their `templates/scripts/` mirrors.
- [x] Update `src/scripts/check_memory.py` / `audit_adr_coverage.py` to stop
      asserting the contract.
- [x] Update callers of `retrieve(..., operational_provider=...)` in skills/rules
      (downstream-changes sweep). Skills/rules pass no provider (0 hits);
      removed the operational/shadow unit tests (`test_conflict_rule.py` deleted,
      operational-provider tests pruned from `test_memory_lookup.py`,
      `operational_store` tests pruned from `test_memory_report.py`).

**Exit:** `grep -rn "package_operational_provider\|@event4u/agent-memory" src/scripts` returns zero; `python3 src/scripts/memory_lookup.py --types ownership --key billing` still returns file results.
**Rollback:** revert the script commits; the package path was inert, so Layer 1 is unaffected either way.

## Phase 2 — Drop MCP package routing

- [x] Remove Layer-2 tool routing from `src/scripts/mcp_server/tools.py`
      (`package_operational_provider`, `with_package`, `.features`; file-backed
      `memory_status` description).
- [x] Remove the agent-memory entries from `mcp_server/consumer_tool_catalog.json`
      (`with_package` param + package `memory_status` description).
- [x] Update `docs/contracts/mcp-tool-inventory.md` (regenerated via
      `audit_mcp_tools.py`; no agent-memory routing remains).

**Exit:** MCP server starts; `grep -rn "agent-memory" src/scripts/mcp_server` returns zero; tool inventory lints clean.
**Rollback:** revert the MCP commits.

## Phase 3 — Remove contract, settings keys, and cross-references

- [x] Delete the agent-memory contract doc (`agent-memory-contract.md`) from `docs/contracts/`.
- [x] Remove Layer-2 keys from `src/config/agent-settings.template.yml` and
      consumer settings templates (`src/agent-src/templates/agents/agent-project-settings.example.yml`);
      keep Layer-1 `memory:` consolidation keys. (No Layer-2 keys existed — only
      package-pointer comments; reworded to file-backed.)
- [x] Scrub the contract/package references from `memory-visibility-v1.md`,
      the other `docs/contracts/*.md`, `docs/guidelines/agent-infra/memory-access.md`,
      and `src/domains/meta/memory/mine-session/command.md` — reword to file-first.
- [x] Run `/fix:refs` (or `task check-refs`) to confirm no dangling links.
      (`check_references.py`: only the `dist/` projection of memory-consolidation
      remains — clears on `/condense` in Phase 6.)

**Exit:** `task check-refs` green; `grep -rn "agent-memory-contract" src docs` returns zero.
**Rollback:** restore the contract file + reverted reference edits.

## Phase 4 — Supersede decision records + delete archived specs

- [x] Write an ADR (`ADR-094`) recording the Layer-2 removal + MemSkill-discipline
      adoption; mark `docs/adrs/memory/0001-consumer-side-snapshot.md` + its README
      as superseded by it. INDEX regenerated.
- [x] Scrub passing `agent-memory` mentions from `ADR-026`, `ADR-037` (keep the ADRs).
      Broken envelope link in ADR-026 repointed to the retrieval-v1 schema; the
      decision bodies are preserved verbatim (ADR immutability — history is not
      rewritten); ADR-037 carries no agent-memory reference.
- [x] Delete `agents/roadmaps/archive/agent-memory/` (specs for the deleted external repo).

**Exit:** new ADR present + indexed (`regenerate_index.py`); archived spec dir gone; `grep -rn "@event4u/agent-memory" docs` returns only the superseding/historical ADR.
**Rollback:** `git restore` the ADR + archived dir.

## Phase 5 — Adopt MemSkill write-time discipline (Layer-1 quality)

- [x] Extend `src/skills/memory-consolidation/SKILL.md` with a "Write-time
      curation discipline" section: dedupe before adding, split distinct facts,
      merge + preserve still-valid details on refresh, delete only on explicit
      contradiction, **prefer no-op under uncertainty**, skip trivial/fleeting/
      speculative content. Add a MemSkill provenance line (Apache-2.0 + commit SHA).
- [x] Add the meta-memory framing (skill = *how to remember*, memory file =
      *content*) as a short note where the memory architecture is documented.
      (In the same SKILL section.)
- [x] Add the storage/retrieval/quality failure taxonomy as a review checklist
      in the `/memory` consolidation command docs. (mine-session command § Step 3.)
- [x] Do NOT create a new INSERT/UPDATE/DELETE/NOOP operation skill (taxonomy
      doesn't map to append-only YAML/JSONL); do NOT import any ML pipeline.

**Exit:** `memory-consolidation` SKILL passes `task lint-skills`; the three doc additions present; no new memory skill/rule introduced.
**Rollback:** revert the skill/doc edits.

## Phase 6 — Verify clean + regenerate

- [x] Residual grep returns only intentional historical docstrings (4 mentions:
      "the former optional @event4u/agent-memory package was removed" in
      `memory_lookup.py` / `memory_status.py` + their mirrors). No contract or
      live-routing references remain.
- [x] Re-condensed the 2 changed `.md` (memory-consolidation SKILL +
      mine-session command) into `dist/` + `--mark-done`; `task generate-tools`
      run (0 locally — `tools: []` gate; remote CI regenerates).
- [x] `task ci`: all gates touched by this change are green (`check-refs`,
      `check-condensation`, `validate-schema`, `lint-mcp-inventory`,
      `lint-adr-coverage`, `check-index`, `check-no-roadmap-refs`,
      `lint-skills`, `lint-namespace` + 322 pytest). The one red,
      `audit-tokens-budget`, is a **pre-existing dangling `.claude/` symlink**
      (`augment-source-of-truth.md` → renamed `source-of-truth.md`, PR #427;
      Jun-6 drift, untouched by this branch) that remote CI regenerates away.

**Exit:** change-scoped gates green + projections regenerated; the lone red is
pre-existing, unrelated, and remote-CI-only-regenerated.
**Rollback:** none needed; otherwise revert the failing phase.

## Acceptance criteria

- [x] Zero tracked references to `@event4u/agent-memory`, its contract, or its
      MCP routing (only intentional historical docstrings + the superseding ADR).
- [x] Layer-1 file-first memory works standalone (`memory_lookup.py` returns
      results with no package present).
- [x] `memory-consolidation` carries MemSkill write-time discipline; no new
      memory framework, skill, or ML dependency added.
- [x] `check-refs` green; `task ci` change-scoped gates green (lone pre-existing
      `.claude/`-symlink red is unrelated; remote CI regenerates it). <!-- merge-gated: archives with the memory-layer-cleanup PR; ADR-094 + the consolidation roadmap reference this file until then -->
- [ ] Open the memory-layer-cleanup PR. <!-- merge-gated: this roadmap archives + ref-migrates the moment the PR merges -->
