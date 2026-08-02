---
type: "auto"
tier: "1"
alwaysApply: false
description: "Debugging, fixing errors, or long conversations — 3-failure stop rule, tool-loop detection, fresh-chat triggers"
triggers:
  - keyword: "3-failure"
  - phrase: "long conversation"
routes_to:
  - "guideline:agent-infra/context-hygiene-mechanics"
workspaces: [agent-config-maintainer, construction, engineering, finance, founder, gtm, legal-review-prep, ops, product, small-business]
packs: [meta]
enforced_by:
  - "hook:context-hygiene"
---

# Context Hygiene

> **Enforced by:** [`scripts/context_hygiene_hook.ts`](../../scripts/context_hygiene_hook.ts)
> on Augment + Claude Code (`PostToolUse`). The hook maintains
> `agents/runtime/state/context-hygiene.json` (turn count, loop signal,
> freshness milestones at 20/40/60); the prose below is the spec the
> hook implements and the agent-side fallback.

## Conversation Freshness

Monitor for **context decay** — long conversations degrade quality and waste tokens.

**Suggest a new chat when:** ~20+ user messages · complete topic change ·
re-reading files already in context · 15+ completed tasks and a new unrelated
topic · branch changed since start · ~24 hours passed.

**Repeat** at multiples: messages 20/40/60, tasks 15/30/45.
**ONLY at exact thresholds.** Between: silence. Suggestion template
(token-cost estimate + numbered options): the mechanics guideline below.

## The 3-Failure Rule

When **3 consecutive attempts** at the same task fail (code fix, test fix, config change, etc.):

1. **STOP** — do not attempt a 4th fix.
2. **State dump** — summarize what was tried, what failed, and what you know so far.
3. **Recommend fresh start** — suggest a fresh session with the state dump as context, or ask for a different approach.

**What counts as a failure:** a change that doesn't fix the problem · a test still failing after the fix · a quality check still erroring · a build/deploy failing after a config change. **Does NOT reset the counter:** unrelated tasks; the user providing new information (course correction).

**Failure identity — same error vs new error.** Failure signature = **same target + same error class** (same failing test + same assertion/exception, same lint rule id, same build error).

- **Same failure signature twice → stop and pivot now.** Don't burn the third attempt on a near-identical retry of a fix that already failed the same way — a repeated identical signature means the hypothesis is wrong, not under-applied. Change strategy (re-read source, new hypothesis, ask).
- **New error signature each attempt = progress.** Peeling one error to reveal a different one is forward motion; counter continues — learning, not looping.

**Hard-blocker classes — skip retries, go straight to ask/surface.** On the **first** occurrence, do not count toward the 3 — stop and surface: missing credentials / unset secret · permission denied · spend / quota / rate limit reached · external-service 5xx / outage. Retrying a hard-blocker is the canonical wasted attempt; the fix is a decision or external change only the user/environment can make.

## Tool Loop Detection

Calling the **same tool** more than **2 times in a row** with similar parameters = loop.
**Immediate action:** 1. STOP all tool calls. 2. Do the task directly. 3. Can't proceed → ask the user.
`sequentialthinking` is especially prone to loops: at most **once** per task, NEVER for simple file operations, command execution, or straightforward edits.

## Read-Loop Detection — the 15 / 25 rule

```
READING WITHOUT ACTING IS A LOOP.
EVERY TURN MUST EDIT, RUN, OR ASK.
```

**Read-only turn:** only `view` / `codebase-retrieval` / `grep` /
`git log` / `git show`. No edit/save, no test/build/quality run, no `git commit`.

**15-min warning (3 read-only turns in a row) — change approach.** The next turn MUST contain at least one of: an edit, a test/build/quality command, or an explicit user question (self-check in the mechanics guideline).

**25-min abort (5 read-only turns) — STOP and ask** with the abort block (template in the mechanics guideline). Non-bypassable: an autonomous mandate does **not** lift the abort — it is the safety net that protects autonomy from becoming a token sink.

Body migrated to [`guideline:agent-infra/context-hygiene-mechanics`](../docs/guidelines/agent-infra/context-hygiene-mechanics.md) (per P4 of `road-to-kernel-and-router.md`) — the freshness-suggestion template, the read-loop self-check + abort block, the state-dump format + `/agent-handoff` pointer, the Augment ignored-skills recovery flow, and the Copilot no-hook fallback (manual `context_hygiene_hook` refresh).
Trigger-set above activates this routing on demand, independent of the discipline profile (ADR-110).

## See also

- [`guideline:agent-infra/context-hygiene-mechanics`](../docs/guidelines/agent-infra/context-hygiene-mechanics.md) — templates + per-host procedures.
- [`systematic-debugging § Debug micro-loop`](../skills/systematic-debugging/SKILL.md) — the read-loop debug procedure.
