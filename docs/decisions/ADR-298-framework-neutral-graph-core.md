---
adr: 298
status: accepted
date: 2026-10-23
decision: framework-neutral-graph-core
supersedes: —
superseded_by: —
amends: —
phase: road-to-graph-providers-for-every-stack · step 0.1
type: structural
reopen_policy: unclassified
protected_dimensions: none
provenance:
  kind: human
  decision_makers: [owner]
  human_directed: true
evidence:
  strength: E1
  basis:
    - agents/roadmaps/road-to-graph-providers-for-every-stack.md
    - docs/decisions/ADR-124-embedded-engine-doctrine.md
    - agents/roadmaps/archive/road-to-a-map-that-draws-itself.md
review_trigger: >-
  Reopen if a provider needs a hook the provider interface lacks, if a framework
  crosses the usage line in the next survey year, or if a core file of the code
  graph is found naming a framework.
---

# ADR-298 — The code-graph core is framework-neutral; framework knowledge sits behind providers

## Status

Accepted 2026-10-23 on three owner rulings of the same day, recorded verbatim in
`road-to-graph-providers-for-every-stack`. **Reopens decision E6 and replaces kill-register
entry K13 of `road-to-a-map-that-draws-itself`** (both roadmap records, not ADRs). ADR-124
stands unchanged: providers are Class-A code inside the engine, no network, no model call.

## Context

The project map added a Laravel overlay as a fixed import and call in the graph build
(`build.ts`), Laravel path rules in the map model and Laravel names in the graph schema. The
docs layer and the SCIP merge were wired the same way. E6 put Laravel first because the
measurement fixture was a Laravel application; K13 let further overlays follow only when a
fixture demanded one. The owner asked why exactly Laravel, chose a neutral interface with a
registry, and ruled that specific support, where it is added, is added for the most common
languages and frameworks, over a default that serves every project.

## Decision

1. **The core names no framework.** The build, the pass list, the map model, the schema and
   the query verbs contain no framework identifier and import providers only through the
   provider registry. A vitest test enforces it.
2. **Three provider kinds, one ordered pass list.** Post-extraction passes run in a declared
   order: convention providers → docs → SCIP. A convention provider is selected by
   project markers per package root (manifests, framework entry files), never by file
   suffix; several may be active at once. A pass that fails is reported and the build
   continues.
3. **A default runs for every project.** A framework-neutral pass links what only a string
   states — literal paths, dotted template names, manifest entry points, file-system routes
   — and only on a single match, as INFERRED, never over a stronger edge.
4. **Coverage follows usage, proof follows the provider.** Dedicated providers exist for
   the most common frameworks (the list is the roadmap's decision table). A fixture with a
   positive and a negative oracle is what proves a provider; it is no longer what permits
   one.
5. **Fixed vocabulary, explicit trust.** Providers emit only the shared relations; every
   provider edge carries its provider id. Trust is an allowlist of stated mechanisms: an
   unlisted `resolved_via` is a guess.
6. **No false parity.** A catalog states per provider what it resolves and how far that is
   proven (`detected | partial | verified | deep`); `verified` needs a registered
   real-repository reading.

## Consequences

- Adding a framework is a provider module, its fixture and a catalog row — no edit to the
  build.
- The schema version rises once for the generic names; caches rebuild.
- Third-party providers are not loaded (supply-chain cost with no demand); the registry is
  first-party.

## Alternatives considered

- **A second hard-wired call per framework.** Rejected: the core grows with every framework,
  and the order of graph mutations becomes accidental.
- **Remove framework knowledge for a rule-free matcher.** Rejected: a string literal is not a
  route; route and ORM semantics need provider code. The rule-free part is the default.
- **Providers only when a fixture demands one (K13).** Rejected by the owner's coverage rule.

## References

- ADR-124 § 1 — Class-A engine doctrine, unchanged.
- `agents/roadmaps/road-to-graph-providers-for-every-stack.md` — the rulings and the plan.
