---
type: "auto"
tier: "1"
alwaysApply: false
norm:
  tokens: 2000
  remainder:
    - "../docs/guidelines/agent-infra/context-hygiene-mechanics.md"
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
# obligation: line 67
obligation_frequency: "per-turn"
---

# Context Hygiene

> **Enforced by:** [`scripts/context_hygiene_hook.ts`](../../scripts/context_hygiene_hook.ts)
> on Augment + Claude Code (`PostToolUse`). Run `agent-config hooks:status` to
> see whether that slot is actually bound on the host you are on — this line is
> a statement about the manifest, not about your install. The hook maintains
> `agents/state/context-hygiene.json` (tool-call count, loop signal,
> freshness milestones at 20/40/60); the prose below is the spec the
> hook implements and the agent-side fallback.
>
> **What the slot cannot reach.** The carrier fires per *tool call*; the
> read-loop law below is per *turn*. A turn that makes no tool call fires it
> zero times — and a reply with no tool call is exactly the shape the read-loop
> counter is trying to notice. So the counters are hook-carried and the
> every-turn obligation is model-carried, on every host. Named here because the
> frequency join in `check_enforcement_coverage.ts` reports it, and a rule whose
> header says "enforced by" without that sentence reads as a guarantee it is not.

## Conversation Freshness

Monitor for **context decay** — long conversations degrade quality and waste tokens.

**Suggest a new chat when:** ~20+ user messages · complete topic change ·
re-reading files already in context · 15+ completed tasks and a new unrelated
topic · branch changed since start · ~24 hours passed.

**Repeat** at multiples: messages 20/40/60, tasks 15/30/45 (the task
15/30/45 ladder is agent-side only — the hook tracks no task counter).
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

**"Similar parameters" is the load-bearing word — an enumerated set is not a loop.** Walking N *declared, distinct* targets (a downstream-caller sweep per [`downstream-changes`](downstream-changes.md), an override chain, the members of a grep result) is one operation whose parameters differ every call. Counting it as N repetitions makes `downstream-changes`' "find **ALL** callers, tests, imports" unsatisfiable — it cannot be done in two calls. The loop this detects is *repetition without new information*: same target, same parameters, hoping for a different answer. Mirrors the same carve-out in [`token-efficiency`](token-efficiency.md).
`sequentialthinking` is especially prone to loops: at most **once** per task, NEVER for simple file operations, command execution, or straightforward edits.

### Waiting is one waiter, never a fleet

```
ONE WAITER PER CONDITION. NEVER A TIMER AND A WATCHER FOR THE SAME WAIT.
NEVER START A NEW WAITER WHILE ONE IS STILL LIVE FOR THAT CONDITION.
A NUMBER THAT CHANGED IS NOT NEW INFORMATION UNLESS IT CHANGES WHAT YOU DO NEXT.
```

Waiting on something external — CI, a deploy, a queue, a background job — is the
one shape the loop test above systematically misses. Pick **one** waiter for the
condition and let it finish; for CI use `ci_settle <pr>` rather than a
hand-written loop. Enforcement is `none` and structurally so: the hook counts
tool calls and a waiter is indistinguishable from any other call at that layer.

Why the loop test misses it in both clauses, the n=1 measurement behind the
clause, and the enforcement argument: [`context-hygiene-mechanics § Waiting is one
waiter`](../docs/guidelines/agent-infra/context-hygiene-mechanics.md).

## Read-Loop Detection — the 15 / 25 rule

```
READING WITHOUT ACTING IS A LOOP.
EVERY TURN MUST EDIT, RUN, OR ASK.
```

**Read-only turn:** only `view` / `codebase-retrieval` / `grep` /
`git log` / `git show`. No edit/save, no test/build/quality run, no `git commit`.

**15-min warning (3 read-only turns in a row) — change approach.** The next turn MUST contain at least one of: an edit, a test/build/quality command, or an explicit user question (self-check in the mechanics guideline).

**25-min abort (5 read-only turns) — STOP and ask** with the abort block (template in the mechanics guideline). Non-bypassable: an autonomous mandate does **not** lift the abort — it is the safety net that protects autonomy from becoming a token sink.

### Declared read protocol — the cap goes UP, never off

A mandated analysis/audit/review protocol is exactly the case that legitimately needs *more* reads, not fewer — an 8-turn evidence sweep is the protocol working, not a loop. Capping a declared protocol tighter than an undeclared one is backwards. So:

- **Undeclared reading keeps 3-warn / 5-abort.** Unchanged.
- **A declared protocol raises the abort to 8 read-only turns** — and never suspends it. "Non-bypassable" narrows to **no *silent* bypass**: a declared protocol is not silent.

> **The 8 is a guess, a LOWER BOUND, and revisitable** — derivation, the n=1 run behind it, and the two-branch `revisit-if`: [`context-hygiene-mechanics § The declared-protocol cap`](../docs/guidelines/agent-infra/context-hygiene-mechanics.md).

A declaration is only valid when it states, before the reading starts, all three of:

1. **the analysis goal**, falsifiably ("map every call chain that writes to the audit table" — not "understand the code");
2. **the expected read count**;
3. **the output shape** the reads feed (a table, an evidence report, a decision).

Free-text intent is not a declaration — the three fields exist so that "declared protocol: I need to read things" cannot buy the higher cap. Exceeding the declared count by more than 2 is itself the violation: stop, surface what the extra reads were for, and ask.

Body migrated to [`guideline:agent-infra/context-hygiene-mechanics`](../docs/guidelines/agent-infra/context-hygiene-mechanics.md) (per P4 of `road-to-kernel-and-router.md`) — the freshness-suggestion template, the read-loop self-check + abort block, the state-dump format + `/agent-handoff` pointer, the Augment ignored-skills recovery flow, and the Copilot no-hook fallback (manual `context_hygiene_hook` refresh).
Trigger-set above activates this routing on demand, independent of the discipline profile (ADR-110).

## See also

- [`guideline:agent-infra/context-hygiene-mechanics`](../docs/guidelines/agent-infra/context-hygiene-mechanics.md) — templates + per-host procedures.
- [`systematic-debugging § Debug micro-loop`](../skills/systematic-debugging/SKILL.md) — the read-loop debug procedure.
