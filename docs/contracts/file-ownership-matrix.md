---
stability: beta
---

# File-ownership matrix

> **Audience:** roadmap authors, phase reviewers, and CI gate writers
> who need to know which artefact reads which, and whether two phases
> can run concurrently without colliding.
> **Generator:** `scripts/generate_ownership_matrix.py`
> (run via `task generate-ownership-matrix`).
> **Validator:** `task check-ownership-matrix` (fails if the JSON drifts
> from a fresh regeneration).
> **Companion contracts:** [`load-context-schema.md`](load-context-schema.md),
> [`context-paths.md`](context-paths.md).

This contract defines the **schema** of the file-ownership matrix: the
machine-readable JSON at `docs/contracts/file-ownership-matrix.json` and
the human-readable mirror at
`agents/contexts/structural/file-ownership-matrix.md`. Both are
regenerated from `.agent-src.uncompressed/` by the generator and locked
by CI.

**Status:** internal-locked (`stability: beta`). Schema bumps require a
contract version increment plus a roadmap revision (per
`road-to-structural-optimization.md` § 0.1).

## Why the matrix exists

`road-to-structural-optimization` Phase 0.1 (CRITICAL) is the DAG
successor of Phase 0.6 (path conventions). Subsequent phases (1, 2A,
2B, 3, 6) extract material into context files, slim rules, and reorder
command surface. The matrix is the substrate that lets later phases
ask three questions deterministically:

1. **Which files does my edit reach transitively?** Answered by the
   `READ_ONLY` edges plus their depth-2 closure.
2. **Can Phase X and Phase Y land in either order?** Answered by
   intersecting per-phase `WRITE` sets — empty intersection = safe.
3. **Has the matrix drifted since the last green CI run?** Answered by
   the `check-ownership-matrix` consistency gate.

## Schema (v1)

The JSON document is a single object:

```json
{
  "version": 1,
  "generated_by": "scripts/generate_ownership_matrix.py",
  "source_of_truth": ".agent-src.uncompressed/",
  "files": {
    "<repo-root-relative path>": {
      "kind": "rule | skill | command | context | persona",
      "rule_type": "always | auto | manual | null",
      "load_context": ["<path>", ...],
      "load_context_eager": ["<path>", ...]
    }
  },
  "edges": [
    {
      "source": "<path>",
      "target": "<path>",
      "type": "READ_ONLY | WRITE | BLOCKS_IF_CONCURRENT",
      "via": "load_context | load_context_eager | load_context_transitive | body_link",
      "depth": 1
    }
  ]
}
```

**Edge types**

| Type | Meaning | Populated in v1 |
|---|---|:-:|
| `READ_ONLY` | Source file reads target (frontmatter declaration or body markdown link). | ✅ |
| `WRITE` | Source file owns target. Self-edge for every file (`source == target`). | ✅ |
| `BLOCKS_IF_CONCURRENT` | Two phases would write the same file. Derived later from a phase manifest; reserved in v1. | ⏳ |

**Edge `via` values**

- `load_context` — frontmatter `load_context:` entry (lazy).
- `load_context_eager` — frontmatter `load_context_eager:` entry.
- `load_context_transitive` — depth-2 hop reached by following a target's own
  `load_context*` declarations one level deeper.
- `body_link` — markdown link in body to a path inside one of the
  scanned roots.

## Depth invariant (G2 — v3.1)

The generator computes the transitive closure of `load_context` /
`load_context_eager` edges **up to depth 2**. Any chain
`R → A → B → C` where every hop is a `load_context*` edge **fails the
build** with exit code 2. This duplicates the same nesting cap that
Phase 0.2.4 will enforce in `scripts/check_always_budget.py` — two
enforcement points, one invariant.

## Regeneration policy

| Trigger | What runs | What fails |
|---|---|---|
| `task generate-ownership-matrix` | Regenerates JSON + MD in place. | Depth-3 chain → exit 2. |
| `task check-ownership-matrix` (CI) | Regenerates to memory, diffs against committed JSON. | Diff non-empty → exit 1. Depth-3 → exit 2. |
| Pre-commit hook (Phase 2A — A1 fix) | Future: regenerate and diff on commits that touch contexts. | Same as `check-ownership-matrix`. |

Any commit that adds, moves, or modifies a context, rule, skill, or
command MUST regenerate the matrix in the same commit. CI is the
backstop; the consistency gate fails if regeneration drifts.

## Scope notes (v1)

- **Greppable surface:** `rules/`, `skills/`, `commands/`, `contexts/`,
  `personas/` under `.agent-src.uncompressed/`. Generated tool
  projections (`.augment/`, `.claude/`, `.cursor/`, …) are intentionally
  ignored — they are downstream of the source of truth.
- **`skill:` frontmatter in rules** (named in roadmap 0.1.2) is reserved.
  No rules currently declare it; the generator scans for it but emits
  zero edges of that kind in v1.
- **Body link parser** is conservative: it only recognises markdown
  link targets ending in `.md` whose path resolves under one of the
  scanned roots. Bare backtick-name references (e.g., `` `skill-quality` ``)
  are **not** edges in v1; they are too ambiguous to attribute.
- **Cycles** are not the matrix's concern — the existing
  `lint_load_context.py` rejects them. The matrix generator follows
  edges with a visited-set so a cycle, if one slipped through, cannot
  loop forever; it would surface as a depth-3 abort.

## Versioning

`version: 1` is the initial lock. Schema-breaking changes (renaming a
field, removing an edge type, changing semantics of an existing
`via`) require a version bump and a roadmap revision. Additive changes
(new `via` values, new optional file fields) MAY land at the current
version with a `CHANGELOG.md` entry under `### Beta`.
