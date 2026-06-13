---
adr: 091
status: accepted
date: 2026-06-13
decision: split-meta-capability-packs
supersedes: —
superseded_by: —
phase: command-surface-refactor-residuals
type: structural
---

# ADR-091 — Split the `meta` pack into capability-scoped packs (logical re-tag)

## Status

**Accepted** · 2026-06-13. Decided by AI council (anthropic/claude-sonnet-4-5
+ openai/gpt-4o, peer-review, deep) — converged on **logical re-tag, phased,
memory-first**, and flagged the `council`/`challenge-me`/`grill-me`
surface-map↔pack ontology mismatch as the real defect to fix.

## Context

`meta` was one capability pack owning the artefacts that maintain the package
itself: **68 commands** (`pack: meta`) + **58 skills** (`packs: [meta]`),
`artefact_count: 263`, `size_class: core`, `always_on: true`, `domain: meta`.
A reviewer and the 6.1.0 roadmap (line 103) repeatedly asked to split it into
capability-scoped packs; it was punted twice.

Verified mechanism facts that shaped the decision:

- Pack-manifest membership is the frontmatter `packs:` axis
  (`generate_pack_manifests.py::_collect_flat` → `pid in fm['packs']`); the
  per-pack visible-command budget groups by the canonical `pack:` owner.
- Command **slugs are derived from the physical `src/domains/<pack>/<subpath>`
  path**, independent of the `pack:`/`packs:` tags. A frontmatter re-tag
  therefore changes ownership **without** changing any slug → no deprecation
  aliases needed.
- The discovery resolver's `always_on` seeding is vocabulary-driven
  (`config/packs.always_on_packs`), not hard-coded to the string `meta`.
- A **physical** re-parent hits real friction: an orchestrator-root command
  (`/memory`, `/council`) lives at `src/domains/<pack>/<cluster>/command.md`
  and cannot sit at a pack root (the activation gate rejects a bare
  `src/domains/<pack>/command.md`), and `slug_prefix` only resolves for packs
  homed under `src/domains/`. This is the hidden cost that stalled the split
  twice.
- The council's stated "budget violation (8.5×)" premise is **false**: the
  68 are mostly tier-2 *internal* commands (uncapped); meta's *visible* count
  is within its budget of 8 (`audit_command_surface.py --budget` → 0 over
  budget). There is no CI-forcing function; the driver is capability clarity.

## Decision

**Logical re-tag.** Carve three cohesive capabilities out of `meta` by
re-tagging command frontmatter (`pack:` + `packs:`) and adding the new pack
ids to `src/config/discovery/packs.yml`. Command files stay physically under
`src/domains/meta/<cluster>/` (no moves → no slug churn → no aliases); the new
packs are homed under `src/packs/<id>/` like the other capability packs.

New packs (all `workspaces: [agent-config-maintainer]`, `trust_level_default:
core`, `always_on: false` — opt-in capabilities surfaced to the maintainer
workspace):

| Pack | Clusters carved out | size_class |
|---|---|---|
| `memory` | `memory`, `chat-history` | small |
| `analytics` | `analytics`, `cost-report` | small |
| `product-reasoning` | `council`, `challenge-me`, `grill-me` | medium |

`meta` **stays** the `always_on` platform / agent-admin core pack (agents,
mode, profile, override, sync-*, optimize, skill(s), condense, context,
orchestrate, package-reset, set-cost-profile, upstream-contribute,
review-routing, rule-compliance-audit, agent-handoff, agent-status,
check-current-md) plus all 58 skills. `review-routing` +
`rule-compliance-audit` (governance, 2 commands) stay folded into `meta`
rather than a 2-command pack of their own.

The `knowledge` cluster is intentionally **not** part of `memory`: it is
already owned by `pack: product-discovery` (`src/domains/product-discovery/
knowledge/`), not `meta`, so it is out of this split's scope.

`product-reasoning` resolves the ontology bug: `council`/`challenge-me`/
`grill-me` are classified `product` in `src/flows/surface-map.yaml` but were
owned by `pack: meta`. They now have an owning capability pack.

### Rejected / deferred

- **Physical re-parent** (moving command dirs under `src/domains/<newpack>/`):
  deferred — the orchestrator-root + `slug_prefix` friction above makes it a
  separate, careful change with deprecation-alias cost, and the logical re-tag
  already satisfies the acceptance criterion. Recorded as a follow-up.
- **`governance` as its own pack**: rejected — 2 commands do not warrant a
  budget unit; folded into `meta`.
- **Big-bang full split** in one pass: rejected per the council's phased
  guidance; executed memory-first as the proof, then analytics +
  product-reasoning in the same change once the pipeline was proven green.

## Consequences

- The carved commands move from the `always_on` meta surface to opt-in
  capability packs scoped to the `agent-config-maintainer` workspace; the
  maintainer still resolves them via that workspace.
- `meta`'s `artefact_count` drops; three new `pack.yaml` manifests are
  generated; the discovery manifest gains the new pack tags.
- Pack-dependency, budget, and marketplace lints stay green (verified).
- Physical co-location of the carved commands under their new pack homes
  remains a future, alias-bearing change.

## References

- `agents/roadmaps/archive/road-to-command-surface-refactor-residuals.md` — Phase 2.
- `docs/contracts/capability-packs.md` — pack ownership + budget model.
- `src/flows/surface-map.yaml` — the `product` classification reconciled here.
- ADR-057 — consolidation-evidence-gate outcomes (physical folding out of scope).
