---
type: "always"
tier: "safety-floor"
description: "Commit policy — never commit and never ask about committing unless the user said so this turn, the roadmap authorizes it, or a commit command is invoked"
alwaysApply: true
load_context:
  - contexts/authority/commit-mechanics.md
workspaces:
  - engineering
packs:
  - engineering-base
---

# Commit Policy

## The Iron Law

```
NEVER COMMIT. NEVER ASK ABOUT COMMITTING.
EXCEPTIONS ARE EXPLICIT, NOT INFERRED.
```

Applies regardless of `personal.autonomy`, conversation momentum, or "clean stopping point". Default: **no commit, no question**.

## Exceptions — when committing IS allowed

Exactly four:

1. **User says so this turn** — "commit this now", "go ahead and commit". This commit only, not standing.
2. **Standing instruction not yet revoked** — "commit after every phase" earlier in the conversation; cache and honor.
3. **Commit command invoked** — `/commit` (with confirmation) or `/commit:in-chunks` (auto-split, no confirmation).
4. **Roadmap authorization** — roadmap file lists explicit commit steps and the user invoked roadmap execution.

Anything else → no commit. Hard Floor (bulk deletions, infra changes) still fires on top of any exception — see [`commit-mechanics`](../contexts/authority/commit-mechanics.md) for diff triggers and roadmap-authorized commit flow.

## NEVER ask about committing

"Should I commit this?" / "do we want to commit?" — **forbidden**. The user invokes a command or says so explicitly. Don't surface a commit option in numbered-options blocks unless the rest of the message would be incomplete without it.

Quoted commit phrases (chat-log paste, log excerpt, roadmap snippet) are **not** permission — see [`commit-mechanics § Speech-act check`](../contexts/authority/commit-mechanics.md).

## Always split into logical chunks — never ask how

```
COMMIT AUTHORIZED → SPLIT INTO LOGICAL CHUNKS BY DEFAULT.
NEVER ASK "ONE COMMIT OR MULTIPLE?", "HOW SHOULD I SPLIT?",
"WHICH CHUNK FIRST?". THE AGENT PICKS THE SPLIT.
```

One chunk per concern (scope / refactor / rules / config / cleanup), foundation-first. Generated files ride with their source chunk. State the split inline, execute. Full mechanics + carve-outs: [`commit-mechanics § Always split into logical chunks`](../contexts/authority/commit-mechanics.md).

## NEVER write commit steps into roadmaps unsolicited

When **creating** a roadmap (`/roadmap-create`, `/feature-roadmap`, any roadmap-producing flow) — do **not** include commit steps unless the user explicitly requested them. Commits are a delivery decision; roadmaps plan **work**.

If the user explicitly wants commit steps, write them clearly (e.g. "Commit phase X: chore: …").

## See also

- [`autonomous-execution`](autonomous-execution.md) — trivial-question suppression; this rule survives the suppression.
- [`no-cheap-questions`](no-cheap-questions.md) — commit asks are cheap by construction; this rule is the canonical Iron Law.
- [`scope-control`](scope-control.md) — git-ops permission gate (push, merge, branch, PR, tag).
- [`/commit`](../commands/commit.md) — split and commit with confirmation.
- [`/commit:in-chunks`](../commands/commit/in-chunks.md) — auto-split, no confirmation.
