---
type: "auto"
tier: "mechanical-already"
description: "Linking a specific file in agents/council-{questions,responses,sessions}/ from any artifact — council files are gitignored, local-only, auto-pruned; inline the convergence instead"
alwaysApply: false
source: package
triggers:
  - path_prefix: "agents/council-questions/"
  - path_prefix: "agents/council-responses/"
  - path_prefix: "agents/council-sessions/"
  - intent: "link to council artefact"
---

# No Council References from Any Artifact

Council artefacts under `agents/council-{questions,responses,sessions}/`
are **gitignored, local-only, and auto-pruned** after
`ai_council.session_retention_days` (default 7). They are
disposable scratch — never part of the repo, never visible to a
reviewer who clones, never durable across the retention window.

A link to a specific council file rots three ways: gitignored
(not in cloned repo), pruned after retention window (gone even
locally), and the installed `.augment/` projection cannot follow a
path that does not exist in the consumer.

## The Iron Law

```
NEVER LINK TO A SPECIFIC FILE INSIDE
agents/council-{questions,responses,sessions}/
FROM ANY ARTIFACT — ROADMAPS INCLUDED.
INLINE THE CONVERGENCE WITH DATE + MEMBERS, NEVER THE PATH.
```

Applies to **every** artifact. Council artefacts are more transient
than roadmaps — the local copy disappears too.

## Forbidden vs allowed

**Forbidden** in any `*.md` / `*.yml` / `*.json` / `*.py`:
`agents/council-questions/<file>.md`,
`agents/council-responses/<file>.json`,
`agents/council-sessions/<file>.json` or `<timestamp>/...`.

**Allowed**: directory mentions (talking about the output convention,
not a specific file); the `ai-council` skill and `/council:*` commands
documenting the output path schema; inline convergence summary —
e.g. *"Council (claude-sonnet-4-5 + gpt-4o, 2026-05-06) converged
on …"* with date + members, no filepath.

## What to do instead

Identify the durable conclusion (decision, contract, lesson),
inline a convergence-summary block (members, date, cost if relevant
— see `ai-council` § Output format), and optionally promote the
lesson to `agents/contexts/`. The context is durable; the council
file was the catalyst.

Failure mode: *"I'll just link to the session JSON, it's evidence."*
The session is gone in 7 days. **Inline first, link never.**

## See also

- [`no-roadmap-references`](no-roadmap-references.md) — sibling rule
  for the roadmap layer
- [`augment-source-of-truth`](augment-source-of-truth.md) — edit
  `.agent-src.uncompressed/`
- [`ai-council`](../skills/ai-council/SKILL.md) — output path
  convention and convergence-summary format
