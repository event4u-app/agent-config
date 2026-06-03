# Command budget decisions — 6.0.0-B Phase 2 (Step 5)

> **Status:** decided 2026-06-03 (maintainer-approved). Parent:
> [`road-to-6.0.0-b-pack-scoped-projection.md`](../../roadmaps/road-to-6.0.0-b-pack-scoped-projection.md)
> Phase 2. Source report: `agents/reports/command-budget-audit.{json,md}`.

## Context

After the Phase-1 best-guess `pack:` assignment, two core packs were over the
visible-command budget (capability-packs.md: `core ≤ 8`). The budget counts
`tier ∈ {0,1}` (visible); `tier 2` is internal and uncapped.

| Pack | size_class | visible (before) | budget | over |
|---|---|--:|--:|--:|
| `engineering-base` | core | 18 | 8 | +10 |
| `meta` | core | 12 | 8 | +4 |

## Decision

**Demote the lowest-cited visible commands to `tier: 2` (internal) until each
pack is at budget.** Cut rule: `docs/`-citation count `< 10` (slash-form
`/<name>`), restricted to `tier-1` candidates. No relocations (so no
profile→pack reachability risk). **Zero deletions** — every command stays
invokable by full name; only `--help` surfacing changes.

### `engineering-base` — demote 10 (tier 1 → 2)

`prepare-for-review`, `create-pr:description-only`, `project-health`,
`bug-investigate`, `project-analyze`, `sync-gitignore`, `bug-fix`,
`commit:in-chunks`, `quality-fix`, `threat-model`.

Remain visible (8): `work`, `commit`, `implement-ticket`, `fix`, `create-pr`,
`feature`, `review-changes`, `judge` (all ≥ 10 docs citations).

### `meta` — demote 4 (tier 1 → 2)

`rule-compliance-audit`, `upstream-contribute`, `set-cost-profile`,
`sync-agent-settings`.

Remain visible (8): `agents`, `council`, `condense`, `memory`, `mode`,
`optimize`, `agent-handoff` (tier-0), `agent-status` (tier-0).

## Tier-0 exception

`agent-status` (tier-0, 2 docs citations) is **kept visible** despite a
below-cut citation count: it is a canonical Tier-0 daily-driver
(command-surface-tiers.md) whose value is daily-loop UX, not doc citations.
Demoting a Tier-0 command would require an explicit Tier-0→2 justification per
that contract; not taken here. No other Tier-0 command was touched.

## Reversibility

Each demotion is a single `tier: 1 → 2` flip. None of the 14 appear in the
command-surface-tiers.md canonical Tier-0/Tier-1 lists, so no contract-list
update was required. Re-promotion follows the normal tier promotion gate.
