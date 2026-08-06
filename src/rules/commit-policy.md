---
type: "always"
tier: "safety-floor"
description: "Commit policy — never commit and never ask about committing unless the user said so this turn, the roadmap authorizes it, or a commit command is invoked"
alwaysApply: true
load_context:
  - contexts/authority/commit-mechanics.md
workspaces: [engineering]
packs: [engineering-base]
---

# Commit Policy

## The Iron Law

```
NEVER COMMIT. NEVER ASK ABOUT COMMITTING.
EXCEPTIONS ARE EXPLICIT, NOT INFERRED.
```

Holds regardless of `personal.autonomy`, momentum, or "clean stopping point". Default: **no commit, no question**.

## Exceptions — when committing IS allowed

Exactly four:

1. **User says so this turn** — "commit this now". This commit only, not standing.
2. **Standing instruction not yet revoked** — "commit after every phase"; cache and honor.
3. **Commit command invoked** — `/commit` (confirmed) or `/commit:in-chunks` (auto-split).
4. **Roadmap authorization** — roadmap lists explicit commit steps and the user invoked roadmap execution.

Anything else → no commit. Hard Floor (bulk deletions, infra changes) still fires on top of any exception — diff triggers + roadmap-authorized flow: [`commit-mechanics`](../contexts/authority/commit-mechanics.md).

## One-shot authorization is not a standing license

```
A ONE-OFF AUTHORIZATION IS SPENT ON EXACTLY THAT OPERATION, ONCE.
IT NEVER BECOMES A STANDING LICENSE FOR LATER COMMITS OR PUSHES.
EACH FURTHER COMMIT / PUSH NEEDS ITS OWN FRESH, EXPLICIT GO-AHEAD.
```

"Commit this", "push it", "open the PR", "create the PRs" authorize **that operation, once** — not later commits/pushes in the **same** task. "Create the PR" is spent on the initial branch + commit + push + PR; the next change (follow-up fix, review response, quality pass, "while I'm here" cleanup) waits for a new instruction. A task instruction asking only for **code** ("fix X", "use file Y for tests", "there's a linter error") authorizes the code change **only** — never a commit or push. Re-using an earlier authorization for a later operation is exactly the inference (exception 2 misread as "standing") this rule forbids.

## NEVER ask about committing

"Should I commit this?" / "do we want to commit?" — **forbidden**. The user invokes a command or says so. No commit option in numbered-options blocks unless the message is incomplete without it.

Quoted commit phrases (chat-log paste, log excerpt, roadmap snippet) are **not** permission — see [`commit-mechanics`](../contexts/authority/commit-mechanics.md).

## Always split into logical chunks — never ask how

```
COMMIT AUTHORIZED → SPLIT INTO LOGICAL CHUNKS BY DEFAULT.
NEVER ASK "ONE COMMIT OR MULTIPLE?", "HOW SHOULD I SPLIT?",
"WHICH CHUNK FIRST?". THE AGENT PICKS THE SPLIT.
```

One chunk per concern, foundation-first; generated files ride with their source. Mechanics + carve-outs: [`commit-mechanics`](../contexts/authority/commit-mechanics.md).

## The commit line

Before a commit, emit the **commit line**: the authorization and its exact scope
· the staged set matches the intended edit · nothing unintended is staged. It is
separate from the authorization line because a commit with a stray file is
authorized and still wrong. Shape:
[`mandated-lines`](../contexts/execution/mandated-lines.md).

## NEVER write commit steps into roadmaps unsolicited

Roadmaps plan **work**, not commits — never add commit steps to a roadmap unless the user explicitly asked. Detail: [`commit-mechanics`](../contexts/authority/commit-mechanics.md).
