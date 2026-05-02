---
stability: beta
---

# `load_context:` Frontmatter Schema

> **Audience:** rule authors and reviewers who want to keep an Always-rule
> small while making deeper reasoning available on demand.
> **Linter:** `scripts/lint_load_context.py` (run via `task lint-load-context`).
> **Companion:** [`rule-priority-hierarchy.md`](rule-priority-hierarchy.md) —
> hierarchy that decides *which* rule wins when several fire on the same turn.

This contract defines the frontmatter convention by which a rule (or
another context) declares the deeper reading material it relies on.
The convention is **lazy by default**: declared entries are *available
to load* when the situation demands them, never auto-loaded into every
turn.

## Schema

Two keys, both optional, both top-level frontmatter:

```yaml
---
type: "always"
description: "..."
load_context:                # lazy — on-demand reference list
  - .agent-src.uncompressed/contexts/<file>.md
  - agents/contexts/<file>.md
load_context_eager:          # opt-in eager — auto-loaded on rule fire
  - .agent-src.uncompressed/contexts/<file>.md
---
```

| Key | Loading | When to use |
|---|---|---|
| `load_context:` | **Lazy.** The agent reads the entry only when the rule's reasoning needs it. | Default. Use for everything that is "available knowledge" rather than "on every turn". |
| `load_context_eager:` | **Eager.** The entry is concatenated into the active context whenever the rule fires. | Only when the deeper material is needed *every single time* the rule fires. Counts against the combined char budget. |

**No default eager-load.** A rule with `load_context:` only does **not**
auto-load anything; the agent decides per turn. Eager loading is
opt-in and budget-gated.

## Path rules

- Paths are repo-root relative.
- Paths MUST end in `.md`.
- Allowed roots: `.agent-src.uncompressed/contexts/`, `agents/contexts/`,
  `.agent-src/contexts/` (compressed mirror). Any other root → linter
  error.
- A rule MAY reference contexts under either tree, but a
  `.agent-src.uncompressed/` rule SHOULD NOT eager-load an
  `agents/contexts/` file (project-local leak into shared package).
  Linter warns on this combination.
- A context file may itself declare `load_context:` (chain reasoning).
  The linter rejects cycles.

## Combined char-budget guard

`load_context_eager:` triggers a budget check:

```
chars(rule.md) + sum(chars(eager_target.md) for each entry) ≤ rule_cap
```

`rule_cap` is the per-rule budget from
[`road-to-rebalancing.md`](../../agents/roadmaps/road-to-rebalancing.md)
§ Target architecture:

- Always rule: 2,500
- Auto rule: 4,000
- Safety rule (`type: "always"` AND covers Hard-Floor topics): 5,000

Linter computes the rule's class from frontmatter `type:` and the
hard-floor allowlist (`non-destructive-by-default`,
`security-sensitive-stop`). Exceeding the cap → linter error.

Lazy `load_context:` does **not** count against the budget — by
definition it is not loaded into every turn.

## Public-vs-internal leak

A rule shipped to consumers (`.agent-src.uncompressed/rules/`) may
declare `load_context:` entries pointing at:

- `.agent-src.uncompressed/contexts/` — public, OK.
- `agents/contexts/` — package-internal, **lint warning** (the entry
  will not exist in consumer projects).

Project-local rules may reference either. The linter classifies by
the rule's tree, not by the target's tree.

## No circular references

A `load_context:` graph that cycles fails the linter. Cycles are
defined across both `load_context:` and `load_context_eager:` edges.

## Stability

`beta` — the schema is settled but no rule currently uses it (Phase 1
of the rebalancing roadmap closed-as-moot, no over-deletion to
restore). Adding the first consumer will surface ergonomic edges; a
breaking schema change is a SemVer-minor pre-1.0 bump. Adding a new
optional key is non-breaking.

## Linter behavior with zero consumers

The linter is wired into `task ci` even though no rule currently
declares `load_context:`. With zero consumers it is a fast no-op
(scans frontmatter, finds nothing, exits 0). The wiring exists so
that the *first* consumer ships under a green CI without retroactive
infrastructure work.

## Cross-references

- [`rule-priority-hierarchy.md`](rule-priority-hierarchy.md) — which
  rule wins on conflict; this schema is orthogonal (depth, not
  priority).
- [`rule-interactions.yml`](rule-interactions.yml) — pairwise rule
  interaction matrix.
- [`STABILITY.md`](STABILITY.md) — beta-tag implications.
