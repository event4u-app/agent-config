---
type: "auto"
tier: "mechanical-already"
description: "Linking transient files (agents/roadmaps/, agents/council-{questions,responses,sessions}/) from a stable artifact — both layers expire; promote findings"
alwaysApply: false
source: package
triggers:
  - path_prefix: "agents/roadmaps/"
  - path_prefix: "agents/council-questions/"
  - path_prefix: "agents/council-responses/"
  - path_prefix: "agents/council-sessions/"
  - intent: "link from stable artifact"
  - intent: "link to council artefact"
routes_to:
  - "skill:ai-council"
validator_ignore:
  - type: "substring"
    pattern: ".agent-src.uncompressed/"
    reason: "Rule contrasts the authoring tree with transient layers."
---

# No Transient References from Stable Artifacts

Two transient layers under `agents/` outlive nothing: roadmaps in
`agents/roadmaps/` are archived, skipped, or deleted as work
completes; council artefacts in `agents/council-{questions,responses,
sessions}/` are **gitignored, local-only, and auto-pruned** after
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
OR IN agents/council-{questions,responses,sessions}/
FROM A STABLE ARTIFACT.
PROMOTE DURABLE CONCLUSIONS TO agents/contexts/ AND CITE THAT INSTEAD.
INLINE COUNCIL CONVERGENCE WITH DATE + MEMBERS, NEVER THE PATH.
```

Stable artifact = anything that is **not** a roadmap, council
session, chat-history archive, commit message, or PR description.

## Forbidden patterns

These paths must not appear inside a stable artifact:

- `agents/roadmaps/<file>.md`, `agents/roadmaps/archive/<file>.md`,
  `agents/roadmaps/skipped/<file>.md`
- `agents/council-questions/<file>.md`,
  `agents/council-responses/<file>.json`,
  `agents/council-sessions/<file>.json` or `<timestamp>/...`

Stable artifact = any file under `.agent-src.uncompressed/{rules,
skills,commands,contexts,templates,personas}/`, `agents/contexts/`,
`docs/guidelines/`, `docs/contracts/`, `docs/architecture.md`,
`docs/customization.md`, `docs/getting-started.md`, `docs/catalog.md`,
`AGENTS.md`, `README.md`, `copilot-instructions.md`.

CI enforcement: `scripts/check_no_roadmap_refs.py` (roadmap layer)
and `scripts/check_council_references.py` (council layer) — both
fail the build on any new violation.

## Allowed patterns

- `agents/roadmaps/` and `agents/council-*/` as **directory** mentions
  (talking about the layer, not a specific file)
- Roadmap → roadmap references (siblings within the transient layer)
- The `ai-council` skill and `/council:*` commands documenting the
  output path schema
- Inline council convergence summary — e.g. *"Council
  (claude-sonnet-4-5 + gpt-4o, 2026-05-06) converged on …"* with
  date + members, no filepath
- Council sessions, `agents/.agent-chat-history`, commit messages, PR
  descriptions — transient by construction, not part of the package
  surface

## What to do instead

When a stable artifact needs to cite a transient finding:

1. Identify the durable conclusion — decision, contract, lesson,
   mechanic.
2. Promote it to a context file under `agents/contexts/` (ADR,
   mechanics doc, locked decision). The roadmap or council session
   can then point at the context, not the other way around.
3. Reference the context from the stable artifact.
4. For council convergences specifically: inline a convergence-summary
   block (members, date, cost if relevant — see `ai-council`
   § Output format) instead of linking the session JSON.

Failure modes:

- *"I'll just link to the roadmap, it's evidence."* The roadmap
  gets archived, then deleted, then the link rots. **Promote first,
  link second.**
- *"I'll just link to the session JSON, it's evidence."* The session
  is gone in 7 days. **Inline first, link never.**

## See also

- [`docs-sync`](docs-sync.md) — cross-reference sync after rename / delete
- [`agent-docs`](agent-docs.md) — roadmap layer conventions
- [`roadmap-progress-sync`](roadmap-progress-sync.md) — sync dashboard
  on roadmap touch
- [`augment-source-of-truth`](augment-source-of-truth.md) — edit
  `.agent-src.uncompressed/`
- [`ai-council`](../skills/ai-council/SKILL.md) — output path
  convention and convergence-summary format
