---
stability: beta
keep-beta-until: 2026-09-02
---

# Capability packs

> **Status:** beta — first draft 2026-06-02 (Phase 0 of
> [`road-to-6.0.0-b-pack-scoped-projection.md`](../../agents/roadmaps/road-to-6.0.0-b-pack-scoped-projection.md)).
> Formalizes the capability-pack layer so the 6.0.0-B projection filtering
> and the 6.0.0-C per-pack budget lint have a manifest with a size class to
> read.

A **capability pack** is the domain grouping a single artefact declares it
belongs to — the value carried in a skill's or command's `packs:` frontmatter
(e.g. `laravel`, `php`, `finance-basic`, `ai-video`). It answers *"which
vertical does this artefact serve?"* It is the unit the projector filters on
when a profile is active (6.0.0-B) and the unit the per-pack command budget is
enforced against (6.0.0-C).

## Capability pack vs. workflow pack — two distinct layers

These are **different things** and must not be conflated:

| | Capability pack | Workflow pack |
|---|---|---|
| **What** | A domain grouping (`packs:` tag on an artefact). | A curated bundle (`profile + preset + surface allowlist`). |
| **Granularity** | Per-artefact ownership. | Per-audience composition. |
| **Source of truth** | `config/discovery/packs.yml` (this contract). | `.agent-src.uncondensed/packs/<id>.yml` ([`workflow-packs`](workflow-packs.md)). |
| **Cardinality** | ~19 in use today. | 3 seed bundles (`founder-mvp`, `content-engine`, `agency-delivery`). |
| **Consumed by** | Projection filtering (6.0.0-B), per-pack budget lint (6.0.0-C), the pack-dependency graph. | The onboarding wizard's first-screen surface rendering. |

A workflow pack *references* capability packs indirectly (through the profile
it composes); a capability pack knows nothing about workflow packs. When this
document says "pack" unqualified, it means **capability pack**.

## Registry — extend the existing vocabulary, do not fork it

Capability packs already exist as the closed discovery vocabulary at
`config/discovery/packs.yml`, governed by
[`ADR-013`](../decisions/ADR-013-discovery-frontmatter-contract.md) § packs.
This contract **formalizes that file as the capability-pack registry** — it
does not introduce a parallel catalog. Phase 0 extends each entry with the
three new fields below; the existing fields keep their ADR-013 meaning.

### Manifest shape

```yaml
# config/discovery/packs.yml — one entry per capability pack
- id: laravel                        # kebab-case; matches the `packs:` tag
  label: Laravel                     # human-readable (existing, ADR-013)
  description: Laravel framework patterns; depends on PHP.
  workspaces: [engineering]          # discovery axis (existing, ADR-013)
  trust_level_default: professional  # existing, ADR-013
  domain: engineering                # NEW — the single primary vertical
  size_class: medium                 # NEW — budget input (see table)
  requires: [php, engineering-base]  # NEW — hard dependency edges
  suggests: [api, ui]                # NEW — soft companion edges
```

### Field semantics

| Field | Type | Required | Notes |
|---|---|:-:|---|
| `id` | string | yes | kebab-case; matches the artefact `packs:` tag. No collision with a workflow-pack, profile, or preset id. |
| `label` | string | yes | Existing ADR-013 field. |
| `description` | string | yes | Existing ADR-013 field. |
| `workspaces` | list[string] | yes | Existing ADR-013 discovery axis — the workspace tiles a pack surfaces under. A pack may serve several workspaces. |
| `trust_level_default` | enum | yes | Existing ADR-013 field (`core` / `professional` / `experimental`). |
| `domain` | string | in-use | **NEW.** The single primary vertical the pack belongs to (`engineering`, `product`, `finance`, `gtm`, `ops`, `founder`, `media`, `meta`, `fun`). Distinct from `workspaces` (a list of surfacing tiles): `domain` is the one canonical home used for the per-domain reasoning the persona/skill governance leans on; `workspaces` is where it *shows up*. **Co-required with `size_class`** — both present on an in-use pack, both absent on a reserved-unused vocab id. |
| `size_class` | enum | in-use | **NEW.** `core` / `small` / `medium` / `large` / `platform`. The input the 6.0.0-C per-pack **visible-command** budget lint reads. Co-required with `domain`. Required for every in-use pack; absent on reserved vocab ids with zero artefacts (assigning it would fail the orphan-manifest determinism check). |
| `always_on` | bool | no | **NEW.** When `true`, the pack loader (6.0.0-B Phase 3) includes this pack's artefacts in **every** projection, regardless of the selected profile / workspace / pack set. Default `false` (absent). See "Always-on packs" below. |
| `requires` | list[id] | no | **NEW.** Hard dependency edges — packs whose artefacts must be present for this pack to function (e.g. `laravel.requires = [php, engineering-base]`). Formalizes the advisory `requires_hint` from ADR-013; once a manifest carries `requires`, `requires_hint` is the deprecated alias. Default `[]`. |
| `suggests` | list[id] | no | **NEW.** Soft companion edges — packs commonly installed together but not mandatory (e.g. `laravel.suggests = [api, ui]`). Advisory; the resolver MAY surface them, never auto-installs. Default `[]`. |

`cluster:` and `onboarding:` (ADR-013) remain valid optional fields and are
out of scope for this contract.

## Size class → visible-command budget

`size_class` exists so the 6.0.0-C budget lint can cap how many **visible**
(`visibility: visible` + `advanced`) commands a pack surfaces. `internal`
commands are the composition layer and are **uncapped** — capping them kills
composability (council, 2026-06-02).

| `size_class` | Visible-command budget | Intended for |
|---|:-:|---|
| `core` | ≤ 8 | Always-relevant base packs (`engineering-base`, `meta`). |
| `small` | ≤ 2 | Narrow single-purpose packs (`fun`, `python`). |
| `medium` | ≤ 5 | Standard framework / domain packs (`laravel`, `gtm-sales`). |
| `large` | ≤ 8 | Broad multi-surface packs (`ai-video`). |
| `platform` | ≤ 10 | Cross-cutting platform packs spanning many surfaces. |

> The **budget table is owned here** (size_class definition); the **enforcement
> lint** is defined and wired into CI by 6.0.0-C Phase 1. This contract assigns
> the class; the lint reads it. No pack is classified by guess — Phase 0 Step
> 0.2 assigns each in-use pack a class, reviewed at PR time.

## Budget exemption process

The budget is a **hard cap with an explicit exemption path**, not a
weighted/dynamic cap. The council (2026-06-02) was decisive: dynamic caps are
"governance-by-algorithm and get gamed at the meta level". A pack that needs to
exceed its `size_class` budget earns the exemption through a documented
decision, never through a formula.

A pack over budget MUST carry a **budget-exemption ADR** under `docs/adr/`
(or legacy `docs/decisions/`) that records:

1. **The user need** — the concrete workflow each over-budget visible command
   serves, and why a user must reach it by name (not behind a `tier: 2`
   internal surface or inside a sibling cluster).
2. **The alternatives considered and rejected** — for each command over the
   cap: why not **merge** into an existing cluster, why not **relocate** to a
   pack with headroom, why not **internalize** (`tier: 2`). "All three were
   considered and rejected because …" is mandatory; an exemption that does not
   show its work is rejected at review.
3. **Re-justification cadence** — the exemption is **re-justified at the next
   major release**. An ADR that is not re-affirmed lapses; the lint then fails
   the over-budget pack until commands are cut or the ADR is renewed.

The `--check-new` gate (Phase 1) does not parse ADRs — it is forward-looking
and fails any *newly visible* command that breaches the cap. The exemption ADR
is the human record that authorises a maintainer to grandfather a pre-existing
over-budget pack; the gate stays green for it only because no *new* visible
command is added.

### Gaming-detection — pack-split dodge

The cheapest way to dodge a per-pack cap is to split a pack in two so each half
stays under budget. To catch this at the meta level: **more than 3 new
capability packs created in any rolling 6-month window without a user-facing
launch (a profile, a wizard surface, or a documented consumer use case) triggers
a governance review.** A burst of pack creation with no corresponding surfacing
is the signal that the cap is being routed around rather than respected. The
review asks the same exemption questions above, one level up: does each new pack
serve a distinct user need, or is it a budget-laundering split?

## Always-on packs

A pack flagged `always_on: true` is a **default pack**: the resolver includes
its artefacts in every projection unconditionally — it is never gated by the
selected profile, workspace, or pack set, and it cannot be deselected. This is
the mechanism for package-maintenance tooling that must be present wherever
agent-config is installed.

**Day-one always-on pack:** `meta`. Every install ships the agent-config layer
(`.augment/`, `.claude/`, …), so the commands that maintain that layer
(`condense`, `agents:audit`, `optimize:skills`, …) are relevant in every
project regardless of the consumer's domain. The 6.0.0-B Phase 3 resolver
seeds the active set with all `always_on` packs before expanding the selected
profile's `requires` closure.

`always_on` is independent of `size_class` (an always-on pack still has a
visible-command budget) and of `requires` (always-on packs are seeded, not
reached through a dependency edge).

## Pack-dependency graph

`requires` and `suggests` form a directed graph the pack loader
(`scripts/config/packs.py`, 6.0.0-B Phase 3) expands when resolving the active
artefact set: selecting `laravel` pulls in `php` and `engineering-base` via the
transitive `requires` closure, so a Laravel install never lands without its
PHP / testing base (closes the council / part1.5 § 6 "install Laravel but the
base is missing" gap).

**Graph invariants** (enforced by the Phase 0 Step 0.3 graph lint):

1. Every `requires` / `suggests` target resolves to a declared capability pack
   — no dangling edge.
2. The `requires` graph is **acyclic** (`suggests` may form cycles; it is
   advisory and never expanded transitively).
3. `requires` is transitive (resolver expands the full closure); `suggests` is
   non-transitive (one hop, surfaced not installed).

## Determinism

The capability-pack registry is release-time data, not runtime state. Two
checks keep it honest (Phase 0 Step 0.2):

- **No orphan tag** — every `packs:` value used by any artefact has a manifest
  entry.
- **No orphan manifest** — every manifest entry is referenced by at least one
  artefact (a pack with zero artefacts is dead vocabulary; remove it or cite
  the artefact).

Both reproduce from the discovery manifest
(`scripts/build_discovery_manifest.py` → `dist/discovery/`) with no manual
list.

## In-use packs (2026-06-02)

19 capability packs carry at least one artefact today, enumerated from the
built discovery manifest (not guessed):

`engineering-base`, `meta`, `laravel`, `php`, `react`, `symfony`, `nextjs`,
`typescript`, `python`, `ai-video`, `ops-people`, `gtm-marketing`,
`gtm-sales`, `founder-strategy`, `product-basic`, `product-discovery`,
`finance-basic`, `finance-advanced`, `fun`.

Vocabulary ids with **zero** referencing artefacts today (`javascript`,
`small-business`, `construction`) are not assigned a `size_class` until an
artefact adopts them — an orphan manifest fails the determinism check.

## See also

- [`workflow-packs`](workflow-packs.md) — the bundle layer; do not conflate.
- [`ADR-013`](../decisions/ADR-013-discovery-frontmatter-contract.md) — the
  `packs:` vocabulary this contract formalizes; amendments require an ADR-013
  amendment in the same PR.
- [`discovery-manifest`](discovery-manifest.md) — the release-time scan that
  feeds the determinism checks.
- [`command-surface-tiers`](command-surface-tiers.md) — the orthogonal
  visibility axis (tier 0/1/2); `size_class` budgets count `visible` +
  `advanced`, tiers gate `--help` surfacing.
- [`road-to-6.0.0-b-pack-scoped-projection.md`](../../agents/roadmaps/road-to-6.0.0-b-pack-scoped-projection.md)
  Phase 0 — the steps that derive and lint the manifests defined here.
