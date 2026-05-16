---
stability: beta
keep-beta-until: 2026-08-14
---

# ADR — Runtime user-types axis (review lens, parallel to personas)

> **Status:** Decided · 2026-05-15
> **Source:** user-authored brief (no council session — direct user spec)
> **Owner roadmap:** [`agents/roadmaps/step-6-user-types-axis.md`](../../agents/roadmaps/step-6-user-types-axis.md)
> **Sibling axis (distinct layer):** [`adr-install-user-type-axis`](adr-install-user-type-axis.md) — install-time `personal.user_type` filter; same vocabulary, different layer

## Context

The persona axis (`personas/`) was overloaded with two semantics:

1. **Methodology lenses** — `qa`, `senior-engineer`, `critical-challenger`,
   `developer`, `product-owner`. These voices answer: *how* we review.
2. **End-user simulations** — proposals like `galabau-field-crew`,
   `truck-driver`, `metalworking-shop`. These voices answer: *who*
   experiences the software.

Mixing the two collapses the taxonomy. A `qa` reviewer applies QA
methodology regardless of which end-user the software serves. A
`galabau-field-crew` is not a review methodology — it is the end-user
viewpoint a methodology reviewer should adopt while reviewing.

The composition the system needs is orthogonal:

```
/refine-ticket --personas=qa --user-type=truck-driver PROJ-123
```

QA methodology applied through a truck-driver end-user lens. Two
axes, one orthogonal product.

## Decision

Split into a parallel axis. Add `.agent-src.uncompressed/user-types/`
as a first-class directory mirroring the persona pipeline:

- Source dir: `.agent-src.uncompressed/user-types/`
- Schema doc: [`user-type-schema`](user-type-schema.md) — 7-section spine, ≤ 120 lines
- JSON schema: [`scripts/schemas/user-type.schema.json`](../../scripts/schemas/user-type.schema.json)
- Linter: `scripts/skill_linter.py § lint_usertype`
- CLI surface: `/refine-ticket --user-type=<id>` (single id in v1)
- Composition: `--user-type=` and `--personas=` compose orthogonally

Persona surface is **byte-identical** after this work. No persona
moves, no schema change to `persona-schema.md` or `persona.schema.json`,
no behaviour change to `--personas=`. The three seed user-types
(`galabau-field-crew`, `metalworking-shop`, `truck-driver`) are born
as user-types — existing personas stay as personas.

## Consequences

**Additive surface:**

- One new CLI flag (`--user-type=`)
- One new schema doc + JSON schema
- One new linter hook (`lint_usertype` + classifier branch)
- One new directory (`user-types/`) projected the same way `personas/`
  is
- Three seed files at merge time; consumer projects add their own
  domain-specific user-types under `.agent-src/user-types/`

**Locked v1 boundaries:**

- CLI-only. Skills do NOT declare a default `user-types:` frontmatter
  key in v1. Migration path to v2: if usage patterns show > 3 skills
  citing the same user-type default, add the key and the audit script
  to mirror `recommended_for_user_types` discipline (smaller surface
  now, additive later).
- Single user-type per invocation (`--user-type=<id>`, not a list).
  Multi-user-type composition deferred to v2 with a one-line note —
  it requires synthesis logic that does not exist yet and would block
  v1 on a non-load-bearing nice-to-have.
- **Review lens only.** User-types never provide trade execution
  instructions. Guardrails encoded in every file's `Anti-Patterns`
  section per [`user-type-schema § 5`](user-type-schema.md#-5--guardrails-encoded-in-every-anti-patterns-block).
- **Anti-Generic Quality Bar.** Every user-type encodes ≥ 5 concrete,
  domain-specific review points and ≥ 3 Unique Questions no other
  persona asks verbatim. Generic prose is rejected at lint or review
  time.

## Alternatives considered

**Alt-1 — Extend persona schema with a `subtype: end-user` discriminator.**
Rejected. Same physical file, two semantics, two enforcement paths
inside one linter hook. Scales worse: every persona-consuming surface
(`--personas=`, `lint_persona`, `audit_persona_coverage.py`) would
need a branch on `subtype` to know whether the artefact is a
methodology lens or an end-user lens. The clean axis split is a
single fork-point at the classifier; the subtype fork-point recurs at
every consumption site.

**Alt-2 — Reuse the existing `user-types/` (install-time) directory
for runtime lenses.** Rejected. The install-time axis stores YAML
configs filtering *which skills load*; the runtime axis stores
Markdown lenses filtering *whose viewpoint a review adopts*. Same
vocabulary, completely different content shape (YAML key-value vs.
Markdown prose + frontmatter), completely different consumer
(`scripts/install.sh` vs. `refine-ticket`). Co-locating them would
force a single `kind:` discriminator on a directory whose two halves
do not share a schema. The separation is in different physical paths
(`user-types/` root vs. `.agent-src.uncompressed/user-types/`) and
the vocabulary overlap is deliberate per [`adr-install-user-type-axis`](adr-install-user-type-axis.md).

**Alt-3 — Defer the axis until end-user lenses prove themselves in
the field.** Rejected. The methodology / end-user overload is already
producing taxonomy drift in the persona README (review-lens vs
end-user examples mixing). Splitting now is cheaper than splitting
after three more end-user "personas" land.

## Migration

No migration. v1 ships with three seed user-types born under the new
axis. Existing personas (`qa`, `developer`, `senior-engineer`,
`product-owner`, `stakeholder`, `critical-challenger`, `ai-agent`,
plus specialists) stay put. The `personas/README.md` gains one
cross-link sentence pointing readers at the parallel axis when their
intent is end-user simulation rather than methodology review.

## See also

- [`user-type-schema`](user-type-schema.md) — locked shape, 7-section spine, size budget, quality bar
- [`persona-schema`](persona-schema.md) — sister axis (untouched by this ADR)
- [`adr-install-user-type-axis`](adr-install-user-type-axis.md) — install-time `personal.user_type` filter (distinct layer)
- [`agents/roadmaps/step-6-user-types-axis.md`](../../agents/roadmaps/step-6-user-types-axis.md) — work plan, 7 phases
