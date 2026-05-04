---
type: "always"
tier: "safety-floor"
description: "Commit policy — never commit and never ask about committing unless the user said so this turn, the roadmap authorizes it, or a commit command is invoked"
alwaysApply: true
source: package
load_context:
  - .agent-src.uncompressed/contexts/authority/commit-mechanics.md
---

# Commit Policy

Local commits do not change remote state, but committing prematurely
makes review harder. This is the **canonical** rule for committing,
referenced by [`autonomous-execution`](autonomous-execution.md),
[`scope-control`](scope-control.md), and the roadmap commands.

## The Iron Law

```
NEVER COMMIT. NEVER ASK ABOUT COMMITTING.
EXCEPTIONS ARE EXPLICIT, NOT INFERRED.
```

Applies regardless of `personal.autonomy`, conversation momentum, or
"but it's a clean stopping point". Default is **no commit, no
question**.

## Exceptions — when committing IS allowed

Exactly four ways the agent may commit:

1. **User says so this turn** — explicit phrase like "commit this now",
   "go ahead and commit". Permission is for **this commit only**, not
   standing.
2. **Standing instruction not yet revoked** — user said earlier in
   the conversation "commit after every phase" or similar, and has not
   revoked it. Cache and honor.
3. **Commit command invoked** — `/commit` (with confirmation) or
   `/commit:in-chunks` (auto-split, no confirmation).
4. **Roadmap authorization** — the roadmap file lists explicit commit
   steps and the user invoked roadmap execution.

Anything else → no commit. Hard Floor (bulk deletions, infra changes)
still fires on top of any exception — see
[`commit-mechanics`](../contexts/authority/commit-mechanics.md) for
the diff triggers and the roadmap-authorized commit flow.

## NEVER ask about committing

Asking "should I commit this?", "do we want to commit?", or any
variant is **forbidden**. The user invokes a command or says so
explicitly. Don't surface a commit option in numbered-options blocks
unless the rest of the message would be incomplete without it.

Quoted commit phrases (chat-log paste, log excerpt, roadmap snippet)
are **not** permission — see
[`commit-mechanics`](../contexts/authority/commit-mechanics.md)
§ Speech-act check.

## NEVER write commit steps into roadmaps unsolicited

When **creating** a roadmap (via `/roadmap-create`,
`/feature-roadmap`, or any roadmap-producing flow), do **not** include
commit steps unless the user explicitly requested them. Commits are a
delivery decision; roadmaps plan **work**.

If the user explicitly wants commit steps in the roadmap, write them
clearly and unambiguously (e.g. "Commit phase X: chore: …").

## See also

- [`autonomous-execution`](autonomous-execution.md) — when to suppress
  trivial questions; this rule survives the suppression.
- [`no-cheap-questions`](no-cheap-questions.md) — commit asks are
  cheap by construction; this rule is the canonical Iron Law, the
  cheap-questions rule cites it and refuses to surface the option.
- [`scope-control`](scope-control.md) — git-ops permission gate
  (push, merge, branch, PR, tag stay separately permission-gated).
- [`/commit`](../commands/commit.md) — split and commit with confirmation.
- [`/commit:in-chunks`](../commands/commit/in-chunks.md) — auto-split
  and commit without confirmation.
