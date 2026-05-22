---
type: "auto"
tier: "1"
alwaysApply: false
description: "Debugging, fixing errors, or long conversations — 3-failure stop rule, tool-loop detection, fresh-chat triggers"
source: package
triggers:
  - intent: "long conversation"
  - intent: "tool loop"
  - intent: "fresh chat"
  - keyword: "3-failure"
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

# Context Hygiene

> **Enforced by:** [`scripts/context_hygiene_hook.py`](../../scripts/context_hygiene_hook.py)
> on Augment + Claude Code (`PostToolUse`). The hook maintains
> `agents/runtime/state/context-hygiene.json` (turn count, loop signal,
> freshness milestones at 20/40/60); the prose below is the spec the
> hook implements and the agent-side fallback.

## Conversation Freshness

Monitor for **context decay** — long conversations degrade quality and waste tokens.

**Suggest a new chat when:**

- Conversation exceeds **~20 user messages**
- Topic **changes completely**
- Re-reading files already in context
- **15+ completed tasks** and new unrelated topic
- Branch changed since start
- ~24 hours passed

**Repeat** at multiples: messages 20/40/60, tasks 15/30/45.
**ONLY at exact thresholds.** Between: silence.

**How to suggest:**

Estimate token cost: responses × ~1,500 tokens.

```
> ⚡ This conversation has ~{N} messages (~{N×1500} tokens history cost — charged on EVERY request).
> A fresh chat saves ~{N×1500} input tokens per request.
>
> 1. Start fresh — I'll initiate a session handoff
> 2. Continue here
```

**If the user picks 1:** Initiate a session handoff or start fresh.

## The 3-Failure Rule

When **3 consecutive attempts** at the same task fail (code fix, test fix, config change, etc.):

1. **STOP** — do not attempt a 4th fix.
2. **State dump** — summarize what was tried, what failed, and what you know so far.
3. **Recommend fresh start** — suggest a fresh session with the state dump as context, or ask for a different approach.

**What counts as a failure:**

- Code change that doesn't fix the problem
- Test that still fails after the fix
- Quality check (type-checker, linter, formatter) that still errors
- Build/deploy that fails after config change

**Does NOT reset the counter:** Unrelated tasks. User providing new information (course correction).

## Tool Loop Detection

Calling the **same tool** more than **2 times in a row** with similar parameters = loop.

**Immediate action:**
1. **STOP** all tool calls.
2. **Do the task directly** — write the code, run the command, answer the question.
3. If you can't proceed — ask the user for help.

`sequentialthinking` is especially prone to loops. Use at most **once** per task,
NEVER for simple file operations, command execution, or straightforward edits.

## Read-Loop Detection — the 15 / 25 rule

```
READING WITHOUT ACTING IS A LOOP.
EVERY TURN MUST EDIT, RUN, OR ASK.
```

**Read-only turn:** only `view` / `codebase-retrieval` / `grep` /
`git log` / `git show`. No `str-replace-editor`, `save-file`, no
test/build/quality run, no `git commit`.

**15-min warning (3 read-only turns in a row) — change approach.**
Next turn MUST contain at least one of: an edit, a test/build/quality
command, or an explicit user question. Self-check:

1. Source expectation known? If no → read **once**, then act.
2. Can a single failing test name the error? If yes → run it now.
3. Regression in working code? → `git log` + `git show <sha> -- <file>`.
4. Guessing at mock / payload shape? → read the producer **once**.

**25-min abort (5 read-only turns) — STOP and ask:**

```
> ⛔ Loop: N read-only turns, ~M min. Read: <files>. Hypothesis: <X>.
> 1. Different approach (suggestion: <Y>)
> 2. Point me at the right spot
> 3. Fresh chat with state dump
```

Non-bypassable. Autonomous mandate (`/work`, `/roadmap:process-*`,
"entscheide selbst") does **not** lift the abort — it is the safety
net that protects autonomy from becoming a token sink.

Debug procedure for "I'm in a read loop fixing tests" →
[`systematic-debugging § Debug micro-loop`](../skills/systematic-debugging/SKILL.md#debug-micro-loop--one-test-one-fix-one-re-run).

## State dump format

```
## State Dump: [Task]
### Tried: 1. [Approach] → [Why failed] 2. ... 3. ...
### Known: [Key facts]
### Hypothesis: [Best guess for root cause]
### Recommendation: [Next approach for fresh session]
```

Use `/agent-handoff` to generate a context summary for a fresh conversation.

## Augment-specific: Ignored Skills Recovery

Skills excluded via `.augmentignore` don't appear in `<available_skills>`.
If you need an ignored skill: read its SKILL.md directly, apply guidance, then ask:

```
> 💡 I loaded `{name}` manually — currently ignored in `.augmentignore`.
> 1. Remove from ignore — relevant for this project
> 2. Keep ignored — one-off
```

## Copilot fallback

GitHub Copilot has no `PostToolUse` hook surface, so
`scripts/context_hygiene_hook.py` cannot run structurally and
`agents/runtime/state/context-hygiene.json` is not maintained automatically
(turn count, loop signal, freshness milestones at 20/40/60).

The cooperative path: track turns and tool-loop signals from memory
during the conversation and apply the suggest-a-new-chat / 3-failure
stop / loop-detection rules above. To refresh the state file
manually so the dashboard or another tool can read the latest
counters, run:

```bash
python3 scripts/context_hygiene_hook.py < /dev/null
```

The script reads from stdin if a JSON envelope is provided and
otherwise writes a no-op snapshot under the shared dispatcher lock.
Exit code is always 0 — hooks must never block the agent loop.
