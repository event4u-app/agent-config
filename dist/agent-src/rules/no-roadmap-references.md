---
type: "auto"
tier: "mechanical-already"
description: "Linking transient files (agents/roadmaps/, agents/runtime/council/) from stable artifacts — both expire; promote findings"
alwaysApply: false
triggers:
  - path_prefix: "agents/roadmaps/"
  - path_prefix: "agents/runtime/council/questions/"
  - path_prefix: "agents/runtime/council/responses/"
  - path_prefix: "agents/runtime/council/sessions/"
routes_to:
  - "skill:ai-council"
  - "skill:agent-docs-writing"
validator_ignore:
  - type: "substring"
    pattern: ".agent-src.uncondensed/"
    reason: "Rule contrasts the authoring tree with transient layers."
workspaces: [agent-config-maintainer]
packs: [meta]
enforced_by:
  - "validator:src/scripts/check_no_roadmap_refs.ts"
  - "validator:src/scripts/check_council_references.ts"
collision_ok:
  "agents/roadmaps/": "roadmap edits are where transient-ref links get written"
# obligation: "NEVER LINK TO A SPECIFIC FILE IN agents/roadmaps/" — src/rules/no-roadmap-references.md:47
obligation_frequency: "per-edit"
---

# No Transient References from Stable Artifacts

Two transient layers under `agents/` outlive nothing: roadmaps in
`agents/roadmaps/` are archived, skipped, or deleted as work
completes; council artefacts in `agents/runtime/council/{questions,
responses,sessions}/` are **gitignored, local-only, and auto-pruned** after
`ai_council.session_retention_days` (default 7). Stable artifacts
(rules, skills, commands, contexts, guidelines, AGENTS.md, README,
copilot-instructions) outlive both. A stable artifact citing a
specific transient file becomes a broken reference the moment that
file is deleted or pruned.

Council links rot three ways: gitignored (not in cloned repo),
pruned after retention window (gone even locally), and the installed
`.augment/` projection cannot follow a path that does not exist in
the consumer.

## The Iron Law

```
NEVER LINK TO A SPECIFIC FILE IN agents/roadmaps/
OR IN agents/runtime/council/{questions,responses,sessions}/
FROM A STABLE ARTIFACT.
PROMOTE DURABLE CONCLUSIONS TO agents/settings/contexts/ AND CITE THAT INSTEAD.
INLINE COUNCIL CONVERGENCE WITH DATE + MEMBERS, NEVER THE PATH.
```

Stable artifact = anything that is **not** a roadmap, council
session, chat-history archive, commit message, or PR description.

Forbidden in one line: any specific `*.md` / `*.json` file under
`agents/roadmaps/` (incl. `archive/`, `skipped/`) or under
`agents/runtime/council/{questions,responses,sessions}/` cited from a stable
artifact. CI enforcement: `scripts/check_no_roadmap_refs.ts` (roadmap layer)
and `scripts/check_council_references.ts` (council layer) — both fail the
build on any new violation.

Body migrated to [`skill:agent-docs-writing` § Transient-reference discipline](../skills/agent-docs-writing/SKILL.md) (per P4 of `road-to-kernel-and-router.md`) — forbidden/allowed pattern catalog, structural carve-outs table (evaluation-context → council-question, contract → session-synthesis), promote-then-link procedure, failure modes.
Trigger-set above activates this routing on demand, independent of the discipline profile (ADR-110).

## See also

- [`skill:agent-docs-writing`](../skills/agent-docs-writing/SKILL.md) —
  roadmap layer conventions + the migrated pattern catalog
- [`augment-edit-discipline`](augment-edit-discipline.md) — portability
  + cross-reference sync after rename / delete
- [`roadmap-progress-sync`](roadmap-progress-sync.md) — sync dashboard
  on roadmap touch
- [`source-of-truth`](source-of-truth.md) — edit
  `src/`
- [`ai-council`](../skills/ai-council/SKILL.md) — output path
  convention and convergence-summary format
