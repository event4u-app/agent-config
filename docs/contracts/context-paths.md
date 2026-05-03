---
stability: beta
---

# Context-file path conventions

> **Audience:** rule, skill, and command authors who need to extract
> reasoning material into a `contexts/` file.
> **Linter:** `scripts/check_context_paths.py`
> (run via `task check-context-paths`).
> **Companion:** [`load-context-schema.md`](load-context-schema.md) —
> frontmatter contract for citing a context from a rule.

This contract defines **where** a context file is allowed to live under
`.agent-src.uncompressed/contexts/` (the source-of-truth tree). It is the
DAG root of `road-to-structural-optimization` Phase 0: the file-ownership
matrix (Phase 0.1) greps for context-file fan-out at the locked tree, and
several later phases (2A, 2B, 3a/b/c, 6) extract material into specific
sub-trees named here. Locking the layout up-front keeps the matrix
deterministic and prevents naming drift across phases.

**Status:** internal-locked. Changes require a contract version bump and
a roadmap revision (per `road-to-structural-optimization.md` § Definitions).

## Locked path tree

| Sub-tree | Owner phase | Naming convention |
|---|---|---|
| `contexts/communication/rules-always/` | Phase 2A | `<rule-name>-mechanics.md` |
| `contexts/communication/rules-auto/` | Phase 2B | `<rule-name>-mechanics.md` |
| `contexts/judges/` | Phase 3a | `judge-shared-procedure.md`, `persona-voice-rubric.md`, `no-consolidate-rationale.md` |
| `contexts/analysis/` | Phase 3b | `project-analysis-core-procedure.md` (+ future siblings) |
| `contexts/skills/` | Phase 3c | `skill-quality-rules.md` (+ future siblings) |
| `contexts/chat-history/` | Phase 6 | `cadence.md`, `ownership.md`, `visibility.md` |
| `contexts/execution/` | PR #34 (existing) | `<topic>-mechanics.md`, `<topic>-detection.md`, `<topic>-examples.md` |
| `contexts/authority/` | PR #34 (existing) | `<topic>-mechanics.md` |

## Grandfathered files

The six root-level files below predate this contract and stay where they
are. **No new files at the contexts root** — every new context must live
in a sub-tree above.

```
contexts/augment-infrastructure.md
contexts/documentation-hierarchy.md
contexts/model-recommendations.md
contexts/override-system.md
contexts/skills-and-commands.md
contexts/subagent-configuration.md
```

## Rules enforced by `check_context_paths.py`

1. **Sub-tree allow-list.** Every `*.md` under
   `.agent-src.uncompressed/contexts/` must be either (a) in one of the
   eight locked sub-trees above, or (b) one of the six grandfathered
   root-level files. Anything else fails CI.
2. **No collisions.** No two context files may share the same basename
   across sub-trees. `judges/persona-voice-rubric.md` and
   `analysis/persona-voice-rubric.md` are mutually exclusive.
3. **No orphans.** Every context file must be referenced from at least
   one rule, skill, command, or other context. References count as either
   a frontmatter `load_context:` / `load_context_eager:` entry, **or** a
   markdown body mention of the relative path
   (`contexts/<sub-tree>/<file>.md` or
   `.agent-src.uncompressed/contexts/<sub-tree>/<file>.md`).

The linter exits non-zero on any violation and prints a one-line
diagnostic per offence.

## Adding a new sub-tree

1. Open a roadmap revision proposing the new sub-tree (owner phase,
   naming convention, expected first-mover file).
2. Council-review under the same gate as a `load_context:` schema change.
3. Bump this contract's version line in the roadmap (G2 fan-out: the
   ownership matrix re-runs after the bump and new cells must remain
   `READ_ONLY` only).
4. Update `LOCKED_SUBTREES` in `scripts/check_context_paths.py` and
   the table above in the same PR.

## Why `check_context_paths.py` carries the orphan check

`road-to-structural-optimization.md` 0.6.3 specified extending
`scripts/docs-sync.py` for the orphan check. That script does not exist
in this repo (the cross-reference checker lives in
`scripts/check_references.py`, scoped to broken refs rather than orphan
detection). Folding the orphan check into `check_context_paths.py` keeps
all context-file invariants in one linter and avoids inventing a new
sync tool. Functionally equivalent to the roadmap intent; the roadmap
itself is annotated with this deviation.

## See also

- [`load-context-schema.md`](load-context-schema.md) — how a rule cites
  one of these paths in frontmatter.
- [`rule-priority-hierarchy.md`](rule-priority-hierarchy.md) — which rule
  wins when several fire on the same turn (independent of context paths).
- [`agents/roadmaps/road-to-structural-optimization.md`](../../agents/roadmaps/road-to-structural-optimization.md)
  — Phase 0.6 (this contract's origin) and the DAG that follows.
