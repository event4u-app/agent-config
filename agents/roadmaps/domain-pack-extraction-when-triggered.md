---
complexity: structural
status: draft
---

# Roadmap: Domain-Pack Extraction (when triggered)

> Placeholder marker for the future extraction of in-repo domain
> capabilities (video first, then audio / image / docs / exports) into
> separately-installable domain packs under `agents/domain-packs/`.
> Held at `status: draft` so the dashboard skips it. This file becomes
> an active roadmap only when the three trigger conditions in
> [`ADR-011`](../../docs/decisions/ADR-011-domain-pack-readiness.md)
> all hold.

## Trigger conditions (all three required)

1. **A second heavyweight domain has landed in `main`.** "Heavyweight"
   matches the PR #176 / AI-Video shape: a provider-adapter cluster,
   a skill cluster, a command cluster, a governance rule, and a
   policy directory. One-skill additions do not count.
2. **An overlap inventory exists.** Documented under
   `docs/contracts/domain-pack-overlap-inventory.md` (file does not
   exist yet — created at trigger time). Lists at least three
   structural patterns shared between the two domains: adapter
   contract, governance routing, provider-lifecycle declaration,
   persona-cap policy, or equivalent.
3. **Shared abstractions have stabilised for ≥ 1 minor release**
   without breaking changes. Measured against the package's
   `CHANGELOG.md` between domain-2 landing and the extraction PR's
   first commit. A moving target is structurally premature to
   extract.

## Out of scope until trigger fires

- Reshaping `src/` directory layout.
- Introducing a `pack.id` field to `.agent-settings.yml`.
- Splitting `scripts/ai-video/` into a sibling repo or namespaced
  pack.
- Adding `agents/domain-packs/<name>/` ownership to the
  `file-ownership-matrix.json` contract.

## When the trigger fires

Flip this file's status from `draft` to `proposed`, write the actual
extraction plan, run it through the council, and supersede
[`ADR-011`](../../docs/decisions/ADR-011-domain-pack-readiness.md)
with a follow-up ADR that records the *acceptance* decision and the
extraction interface shape.

Until then, this file is a marker, not a plan.
