---
id: T-004
roadmap: road-to-ticket-bundles
phase: 5
title: "Build build_ticket_export.py — bundle to Linear (GraphQL, query/map-first)"
status: ready
model_tier: lite
estimate: 3
priority: 1
labels: [tooling, python, linear]
parent: null
blocked_by: [T-002]
adr_refs:
  - { path: docs/decisions/ADR-101-ticket-bundle-emission.md, sha: pending }
source_refs:
  - { path: src/scripts/build_linear_digest.py, sha: ba658e8ebf054c22df3dbf8e07752185d75df229 }
assets: none
acceptance:
  - "python3 src/scripts/build_ticket_export.py agents/tickets/road-to-ticket-bundles/ --dry-run exits 0 and prints a planned create|skip line per ticket."
  - "Idempotency is query/map-first: for each ticket, if manifest.linear_state[id].linear_id is set, plan skip; else plan create. NO native externalId upsert assumed."
  - "Phases map to Parent issue; frontmatter maps to priority/estimate/labels; the full ticket body becomes the issue description."
  - "Live mode posts GraphQL issueCreate and records the returned id into linear_state; a mid-batch failure leaves a resumable state (no duplicate on re-run)."
  - "Pure stdlib (json, urllib, pathlib, argparse) + yaml; exit 0 success, 2 missing token in live mode, 3 unresolved asset."
boundaries:
  must_touch: [src/scripts/build_ticket_export.py]
  may_touch: [Taskfile.yml]
  must_not_touch: ["src/scripts/work_engine/**", ".github/**"]
---

# T-004 — Linear export generator

## Why
The projection generator — deliberately mechanical and fully specified so a `lite` agent builds it from this ticket alone.

## Context spine
- Sibling pattern to mirror (stdlib, curated source in → output, documented exit codes): `src/scripts/build_linear_digest.py`.
- Mapping + idempotency: `docs/contracts/ticket-bundle-format.md` §6/§8.
- Idempotency state lives in the bundle `manifest.yml` under `linear_state` (per-ticket `linear_id`).

## Do
1. Load the bundle manifest + every `T-*.md` (frontmatter + body).
2. For each ticket, query/map-first: if `linear_state[id].linear_id` set, plan `skip`; else plan `create`.
3. `--dry-run` (default in CI): print one `create|skip <id>` line per ticket and exit 0 without any network.
4. Live mode: POST GraphQL `issueCreate` (urllib), record the returned id into `linear_state`, write the manifest back. Phases become Parent issues. Resumable on mid-batch failure.
5. Token from `~/.event4u/agent-config/linear.key` or env; exit 2 if missing in live mode.

## Do NOT touch
- No `work_engine/` or `.github/` edits. Do not modify ticket Markdown (read-only input). stdlib + yaml only.

## Example
`linear_state.T-001.linear_id = null` -> plan `create T-001`; after live create + write-back, a re-run plans `skip T-001`.

## Acceptance
See frontmatter.

## Quality gates
- `python3 src/scripts/build_ticket_export.py agents/tickets/road-to-ticket-bundles/ --dry-run` exits 0.
