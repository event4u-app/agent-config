---
adr: 099
status: accepted
date: 2026-06-15
decision: file-first-pattern-library
supersedes: —
superseded_by: —
phase: harvest-small-enhancements
type: structural
---

# ADR-099 — File-first pattern library (`src/patterns/`)

## Status

Accepted (2026-06-15). Implements `road-to-harvest-small-enhancements` Phase 1.
The pattern library was an earlier competitive-harvest **REJECT that the council
reversed** (two-member, deep + peer-review, 2026-06-15): a static `patterns/`
dir is materially different from the sunset runtime memory store and is not
persona proliferation.

## Context

A competitive-harvest pass surfaced a recurring need: reusable **refactor/fix
recipes** (e.g. "N+1 → eager load", "enum switch → Strategy") that an agent
should be reminded of when the matching problem appears. The first instinct —
fold this into a runtime "continuous-learning" store — was rejected with the
pgvector/MCP memory layer ([`ADR-094`](ADR-094-agent-memory-layer-removal.md),
[[council-agent-memory-sunset]]): no daemon, no writable per-user store, no decay.

The council reversed the blanket REJECT for the **file-first** shape: a
`patterns/` directory of markdown + frontmatter — read at authoring time, like
`rules/` — enables cross-project recipe reuse **without** any runtime, and is not
persona-proliferation (so `persona-governance`'s ≤2-per-domain cap does not apply).

## Decision

Add `src/patterns/` as a **file-first reference library**:

- Each `src/patterns/<slug>.md` is a recipe (Problem / Before / After /
  **Verification** / Gotchas) with frontmatter `applies_to`, `reliability`,
  `last_verified`. Contract: [`src/patterns/README.md`](../../src/patterns/README.md).
- **Not a registered condensation source root.** Patterns are reference material
  (read on demand, like `docs/guidelines/`), **not** projected into per-tool
  context. This is the deliberate boundary that keeps them file-first and
  out of the always-loaded budget.
- **Surfaced, never forced.** [`learning-to-rule-or-skill`](../../src/skills/learning-to-rule-or-skill/SKILL.md)
  adds `patterns/` to its overlap-search surfaces and routes recurring fix-recipes
  here; the human decides whether to apply a surfaced pattern.
- **Cross-project sharing is manual + redacted.** `src/scripts/pattern_share.py`
  (a maintainer dev script, not a user command) exports/imports patterns through
  the same redactor as [`low-impact-corpus-privacy-floor`](../../src/rules/low-impact-corpus-privacy-floor.md);
  it overlaps [[council-team-shared-memory]] only in governance (redaction), not
  storage (patterns are recipes, not memory entries).

## Consequences

- **Positive:** recurring fixes become a discoverable, reliability-tagged library;
  cross-project learning without a runtime; clear boundary vs `rules/`
  (always-on), `guidelines/` (prose conventions), `skills/` (workflows).
- **Cost:** a fifth knowledge surface to keep honest. Mitigated by `last_verified`
  + the surfaced-not-forced rule.
- **Rollback / sunset (council Phase-1 caution):** patterns must earn their keep.
  If a pattern (or the whole surface) sees no surfacing hit and no edit across two
  review cycles, it is a removal candidate — `git rm` the file, no migration
  needed (nothing is projected). The surface adds no CI gate and no runtime, so
  removal is a clean revert.

## Alternatives

- **Fold into a runtime continuous-learning store** — rejected (re-opens the
  Layer-2 sunset; daemon/decay/auto-write all out of scope).
- **Put recipes in `docs/guidelines/`** — rejected: guidelines are prose
  conventions read for style; patterns are keyed, reliability-tagged recipes with
  a verification step, surfaced by problem-detection. Different read trigger.
- **A new user-facing command** — rejected: surfacing belongs inside the existing
  authoring-time `learning-to-rule-or-skill` flow; export/import is a maintainer
  dev script, not a user command.

## References

- `road-to-harvest-small-enhancements.md` Phase 1 (council-reversed ADOPT).
- [`ADR-094`](ADR-094-agent-memory-layer-removal.md) — the runtime memory sunset
  this surface deliberately stays clear of.
- [`src/patterns/README.md`](../../src/patterns/README.md) — the surface contract.
- Council: live two-member run (claude-sonnet-4-5 + gpt-4o, deep, peer-review,
  2026-06-15).
