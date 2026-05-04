---
type: "auto"
tier: "mechanical-already"
description: "Adding a link to a specific file in agents/roadmaps/ from any stable artifact (rule, skill, command, context, guideline) — roadmaps are transient; promote durable findings to agents/contexts/ instead"
alwaysApply: false
source: package
---

# No Roadmap References from Stable Artifacts

Roadmaps in `agents/roadmaps/` are **transient** — archived, skipped,
or deleted as work completes. Stable artifacts (rules, skills,
commands, contexts, guidelines, AGENTS.md, README) outlive them. A
stable artifact citing a specific roadmap file becomes a broken
reference the moment that roadmap is deleted.

## The Iron Law

```
NEVER LINK TO A SPECIFIC FILE IN agents/roadmaps/ FROM A STABLE ARTIFACT.
PROMOTE DURABLE CONCLUSIONS TO agents/contexts/ AND CITE THAT INSTEAD.
```

Stable artifact = anything that is **not** a roadmap, council
session, chat-history archive, commit message, or PR description.

## Forbidden patterns

These paths must not appear inside a stable artifact:

- `agents/roadmaps/<file>.md`, `agents/roadmaps/archive/<file>.md`,
  `agents/roadmaps/skipped/<file>.md`

Stable artifact = any file under `.agent-src.uncompressed/{rules,
skills,commands,contexts,templates,personas}/`, `agents/contexts/`,
`docs/guidelines/`, `docs/contracts/`, `docs/architecture.md`,
`docs/customization.md`, `docs/getting-started.md`, `docs/catalog.md`,
`AGENTS.md`, `README.md`, `copilot-instructions.md`.

CI enforcement: `scripts/check_no_roadmap_refs.py` (companion linter
— fails the build on any new violation).

## Allowed patterns

- `agents/roadmaps/` and its subdirectories as directory mentions
  (talking about the layer, not a specific file)
- Roadmap → roadmap references (siblings within the transient layer)
- Council sessions, `.agent-chat-history`, commit messages, PR
  descriptions — transient by construction, not part of the package
  surface

## What to do instead

When a stable artifact needs to cite a roadmap finding:

1. Identify the durable conclusion — decision, contract, lesson,
   mechanic.
2. Promote it to a context file under `agents/contexts/` (ADR,
   mechanics doc, locked decision). The roadmap can then point at
   the context, not the other way around.
3. Reference the context from the stable artifact.

Failure mode: *"I'll just link to the roadmap, it's evidence."* The
roadmap gets archived, then deleted, then the link rots. **Promote
first, link second.**

## See also

- [`docs-sync`](docs-sync.md) — cross-reference sync after rename / delete
- [`agent-docs`](agent-docs.md) — roadmap layer conventions
- [`roadmap-progress-sync`](roadmap-progress-sync.md) — sync dashboard on
  roadmap touch
- [`augment-source-of-truth`](augment-source-of-truth.md) — edit
  `.agent-src.uncompressed/`
