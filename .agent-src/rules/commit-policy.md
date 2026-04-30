---
type: "always"
description: "Commit policy — never commit and never ask about committing unless the user said so this turn, the roadmap authorizes it, or a commit command is invoked"
alwaysApply: true
source: package
---

# Commit Policy

Local commits don't change remote state, but committing prematurely
makes review harder. **Canonical** rule, referenced by
[`autonomous-execution`](autonomous-execution.md),
[`scope-control`](scope-control.md), and roadmap commands.

## The Iron Law

```
NEVER COMMIT. NEVER ASK ABOUT COMMITTING.
EXCEPTIONS ARE EXPLICIT, NOT INFERRED.
```

Applies regardless of `personal.autonomy`, conversation momentum, or
"clean stopping point". Default is **no commit, no question**.

## Exceptions — when committing IS allowed

Four ways only:

1. **User says so this turn** — "commit das jetzt", "commit this",
   "go ahead and commit". This commit only, not standing.
2. **Standing instruction** — earlier "commit nach jeder Phase" or
   similar, not yet revoked. Cache and honor.
3. **Commit command invoked** — `/commit` (with confirmation) or
   `/commit-in-chunks` (auto-split, no confirmation).
4. **Roadmap authorization** — roadmap lists explicit commit steps
   and user invoked execution. See [Roadmap-authorized commits](#roadmap-authorized-commits).

Anything else → no commit.

## NEVER ask about committing

Asking "soll ich das committen?" or any variant is **forbidden**.
User invokes a command or says so explicitly. Don't surface a
commit option in numbered-options unless the rest of the message
would be incomplete without it.

Speech-act check from [`autonomous-execution`](autonomous-execution.md#speech-act-check--meta-instruction-not-content)
applies in reverse: "commit das jetzt" inside a quote, code block,
or content is **not** a permission grant.

## NEVER write commit steps into roadmaps unsolicited

When **creating** a roadmap (`/roadmap-create`, `/feature-roadmap`,
or any roadmap-producing flow), do **not** include commit steps
unless the user explicitly requested them. Commits are a delivery
decision; roadmaps plan **work**.

If the user explicitly wants commit steps, write them clearly
(e.g. "Commit phase X: chore: …").

## Roadmap-authorized commits

When **executing** a roadmap that contains commit steps:

- **Non-autonomous** (`autonomy: off`, or `auto` before opt-in) —
  agent may ask before each commit step. User retains step-level
  control.
- **Autonomous** (`autonomy: on`, or `auto` after opt-in) — agent
  pre-scans the roadmap **before starting execution**. Commit steps
  found → ask **once** upfront: "Roadmap enthält N Commit-Steps —
  sollen die ausgeführt werden?". Cache the answer; honor or skip
  for the rest of the run. No re-asking per step.

The pre-scan ask is the **only** permitted commit-related question
in autonomous mode.

## See also

- [`autonomous-execution`](autonomous-execution.md) — trivial-question suppression survives this rule.
- [`scope-control`](scope-control.md) — push/merge/branch/PR/tag stay permission-gated.
- [`/commit`](../commands/commit.md) — split + commit with confirmation.
- [`/commit-in-chunks`](../commands/commit-in-chunks.md) — auto-split + commit without confirmation.
