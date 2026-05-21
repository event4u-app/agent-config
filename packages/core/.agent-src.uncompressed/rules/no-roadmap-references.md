---
type: "auto"
tier: "mechanical-already"
description: "Linking transient files (agents/roadmaps/, agents/runtime/council/*/) from a stable artifact — both layers expire; promote findings"
alwaysApply: false
source: package
triggers:
  - path_prefix: "agents/roadmaps/"
  - path_prefix: "agents/runtime/council/questions/"
  - path_prefix: "agents/runtime/council/responses/"
  - path_prefix: "agents/runtime/council/sessions/"
  - intent: "link from stable artifact"
  - intent: "link to council artefact"
routes_to:
  - "skill:ai-council"
validator_ignore:
  - type: "substring"
    pattern: ".agent-src.uncompressed/"
    reason: "Rule contrasts the authoring tree with transient layers."
workspaces:
  - agent-config-maintainer
packs:
  - meta
lifecycle: active
trust:
  level: core
  confidence: high
  human_review_required: false
install:
  default: true
  removable: false
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

## Forbidden patterns

These paths must not appear inside a stable artifact:

- `agents/roadmaps/<file>.md`, `agents/roadmaps/archive/<file>.md`,
  `agents/roadmaps/skipped/<file>.md`
- `agents/runtime/council/questions/<file>.md`,
  `agents/runtime/council/responses/<file>.json`,
  `agents/runtime/council/sessions/<file>.json` or `<timestamp>/...`

Stable artifact = any file under `.agent-src.uncompressed/{rules,
skills,commands,contexts,templates,personas}/`, `agents/settings/contexts/`,
`docs/guidelines/`, `docs/contracts/`, `docs/architecture.md`,
`docs/customization.md`, `docs/getting-started.md`, `docs/catalog.md`,
`AGENTS.md`, `README.md`, `copilot-instructions.md`.

CI enforcement: `scripts/check_no_roadmap_refs.py` (roadmap layer)
and `scripts/check_council_references.py` (council layer) — both
fail the build on any new violation.

## Allowed patterns

- `agents/roadmaps/` and `agents/runtime/council/*/` as **directory** mentions
  (talking about the layer, not a specific file)
- Roadmap → roadmap references (siblings within the transient layer)
- The `ai-council` skill and `/council:*` commands documenting the
  output path schema
- Inline council convergence summary — e.g. *"Council
  (claude-sonnet-4-5 + gpt-4o, 2026-05-06) converged on …"* with
  date + members, no filepath
- Council sessions, `agents/runtime/.agent-chat-history`, commit messages, PR
  descriptions — transient by construction, not part of the package
  surface

## Structural carve-outs (immutable inputs / decision provenance)

Two source/target shapes are exempt from the council-link ban
because the target is **immutable input** or **decision provenance**,
not transient drafting state. The linter implements these directly
(`STRUCTURAL_CARVEOUTS` in `scripts/check_council_references.py`);
they do **not** need an inline `<!-- council-ref-allowed: ... -->`
pragma.

| Source                                         | Target                                           | Why                                                                                  |
| ---------------------------------------------- | ------------------------------------------------ | ------------------------------------------------------------------------------------ |
| `agents/settings/contexts/evaluation-*.md`              | `agents/runtime/council/questions/*.md`                  | Question file is a frozen function-parameter / spend-gate input, not documentation. |
| `docs/contracts/*.md`                          | `agents/runtime/council/sessions/*/synthesis.md`         | Synthesis is the audit-trail receipt; contract inlines the decision body itself.    |

Driven by the 2026-05-14 P3.4 council round (claude-sonnet-4-5 +
gpt-4o, converged on rule refactor over escape-hatch overuse). Any
other source/target combination still needs an inline pragma or
inline-summary rewrite.

## What to do instead

When a stable artifact needs to cite a transient finding:

1. Identify the durable conclusion — decision, contract, lesson,
   mechanic.
2. Promote it to a context file under `agents/settings/contexts/` (ADR,
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

- [`augment-edit-discipline`](augment-edit-discipline.md) — portability
  + cross-reference sync after rename / delete
- [`skill:agent-docs-writing`](../skills/agent-docs-writing/SKILL.md) —
  roadmap layer conventions
- [`roadmap-progress-sync`](roadmap-progress-sync.md) — sync dashboard
  on roadmap touch
- [`augment-source-of-truth`](augment-source-of-truth.md) — edit
  `.agent-src.uncompressed/`
- [`ai-council`](../skills/ai-council/SKILL.md) — output path
  convention and convergence-summary format
