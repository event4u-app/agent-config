---
stability: beta
keep-beta-until: 2026-09-15
---

# Surface tiers — core vs lab

Every shipped artefact carries a **surface tier** so lab churn cannot
destabilise the lean engine users install (road-to-install-contract-stability
Phase 2).

- **`core`** — the lean stable multi-host engine: rules + skills + install +
  condensation, plus the engineering/authoring packs and the script tooling
  that build and ship them. This is the adoptable surface.
- **`lab`** — experimental / pilot meta-tooling that must not ride the same
  release train as the core: AI media pipelines, the multi-model council, the
  MCP server, prediction-pool, cost analytics, chat-history, benchmarking.

The split is council-locked (2026-06-17, claude-sonnet-4-5 + gpt-4o, design
mode, full convergence). Where it lives:

- **Packs/domains** carry `surface_tier: core | lab` in their `pack.yaml`
  manifest (default `core`; sourced from `src/config/discovery/packs.yml`).
- **`src/scripts/` clusters** are mapped in
  [`src/scripts/surface-tiers.yml`](../../src/scripts/surface-tiers.yml)
  (exhaustive over cluster directories).
- A **boundary guard** (`scripts/check_surface_tiers.py`) asserts the registry
  is exhaustive and that no `core` module hard-imports a `lab` module.

## Pack / domain tiers

| Pack / domain | Tier | Reason |
|---|---|---|
| engineering-base, git, php, laravel, symfony | core | framework-neutral engineering hygiene + language patterns |
| javascript, typescript, react, nextjs, python | core | language / framework pattern packs |
| frontend-design, brand | core | design-intelligence + brand-consistency corpus |
| product-basic, product-discovery | core | PO/PM + discovery surface |
| finance-basic, finance-advanced | core | cash/runway + valuation cognition |
| gtm-sales, gtm-marketing | core | pipeline + positioning surface |
| ops-people, founder-strategy, small-business, construction | core | stable role/vertical packs |
| analysis-workbench | core | RCA / post-mortem learning loop, no lab deps |
| meta, memory, analytics, product-reasoning | core | always-on maintainer engine |
| **ai-video** | **lab** | AI video pipeline, `trust_level_default: experimental` |
| **ai-image** | **lab** | AI image generation, `trust_level_default: experimental` |
| **fun** | **lab** | prediction-pool tips, non-essential, experimental |

## Script-cluster tiers

Authoritative map: [`src/scripts/surface-tiers.yml`](../../src/scripts/surface-tiers.yml).

| Cluster | Tier | Reason |
|---|---|---|
| `_cli`, `_lib` | core | install / condense / CLI engine |
| `adr`, `config`, `hooks`, `schemas`, `skill_tools`, `tools`, `smoke`, `repro` | core | engine tooling: ADR, discovery vocab, hooks, schemas, linters, fixtures |
| `ai_council` | lab | multi-model council orchestration, external API deps |
| `mcp_server` | lab | MCP stdio server, separate runtime, pilot distribution |
| `media`, `ai-video`, `ai-image` | lab | AI media adapters + shared substrate (experimental consumers only) |
| `command_suggester` | lab | context-aware suggestion engine, pilot; no core caller |
| `prediction-pool` | lab | prediction-pool optimizer (fun pack) |
| `cost` | lab | cost tracking / budget gate, observability (not a core/CI dep) |
| `_archive` | lab | archived / deprecated scripts |

Top-level lab scripts (`council_cli`, `chat_history`, `mine_session`,
`mcp_render`, `bench_ab_*`, `cost_*`, `build_cloud_bundle`,
`build_linear_digest`, `build_mcp_registry_manifest`, `memory_report`,
`memory_signal`, …) are listed under `lab_modules` in the registry; every other
top-level script defaults to `core`.

## Core → lab coupling

The boundary guard forbids a `core` module from **hard**-importing a `lab`
module. A `try/except ModuleNotFoundError` *optional* import is allowed —
core degrades gracefully when lab is absent. The only existing core→lab edges
are three such guarded optional imports (`_lib/knowledge_global_redaction.py`
and `_cli/cmd_doctor.py` → `ai_council`); they are tolerated by design.

## See also

- [`install-layout.md`](install-layout.md) — the install-ABI freeze this split builds on.
- [`src/scripts/surface-tiers.yml`](../../src/scripts/surface-tiers.yml) — the cluster registry.
- [`docs/architecture.md`](../architecture.md) — core vs full install (the consumer-facing framing).
