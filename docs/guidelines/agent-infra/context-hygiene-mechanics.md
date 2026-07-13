# Context Hygiene — Mechanics

> Suggestion templates, state-dump format, read-loop self-checks, and host fallbacks for the `context-hygiene` rule

_Origin: migrated from `src/rules/context-hygiene.md` per the P4 pattern of `road-to-kernel-and-router.md`. The freshness thresholds, the 3-failure rule (with failure-identity and hard-blocker classes), the tool-loop cap, and the read-loop 15/25 Iron Law stay in the rule; this file carries the templates and per-host procedures._

## Conversation-freshness suggestion — how to phrase it

Estimate token cost: responses × ~1,500 tokens.

```
> ⚡ This conversation has ~{N} messages (~{N×1500} tokens history cost — charged on EVERY request).
> A fresh chat saves ~{N×1500} input tokens per request.
>
> 1. Start fresh — I'll initiate a session handoff
> 2. Continue here
```

**If the user picks 1:** Initiate a session handoff or start fresh.

## Read-loop self-check (fires at the 15-min warning)

1. Source expectation known? If no → read **once**, then act.
2. Can a single failing test name the error? If yes → run it now.
3. Regression in working code? → `git log` + `git show <sha> -- <file>`.
4. Guessing at mock / payload shape? → read the producer **once**.

## Read-loop abort block (the 25-min stop)

```
> ⛔ Loop: N read-only turns, ~M min. Read: <files>. Hypothesis: <X>.
> 1. Different approach (suggestion: <Y>)
> 2. Point me at the right spot
> 3. Fresh chat with state dump
```

Non-bypassable. An autonomous mandate (`/work`, `/roadmap:process-*`,
"entscheide selbst") does **not** lift the abort — it is the safety
net that protects autonomy from becoming a token sink.

Debug procedure for "I'm in a read loop fixing tests" →
`systematic-debugging` § Debug micro-loop (one test, one fix, one re-run).

## State dump format

```
## State Dump: [Task]
### Tried: 1. [Approach] → [Why failed] 2. ... 3. ...
### Known: [Key facts]
### Hypothesis: [Best guess for root cause]
### Recommendation: [Next approach for fresh session]
```

Use `/agent-handoff` to generate a context summary for a fresh conversation.

## Augment-specific: ignored-skills recovery

Skills excluded via `.augmentignore` don't appear in `<available_skills>`.
If you need an ignored skill: read its SKILL.md directly, apply guidance, then ask:

```
> 💡 I loaded `{name}` manually — currently ignored in `.augmentignore`.
> 1. Remove from ignore — relevant for this project
> 2. Keep ignored — one-off
```

## Copilot fallback

GitHub Copilot has no `PostToolUse` hook surface, so
`scripts/context_hygiene_hook.ts` cannot run structurally and
`agents/runtime/state/context-hygiene.json` is not maintained automatically
(turn count, loop signal, freshness milestones at 20/40/60).

The cooperative path: track turns and tool-loop signals from memory
during the conversation and apply the suggest-a-new-chat / 3-failure
stop / loop-detection rules. To refresh the state file manually so the
dashboard or another tool can read the latest counters, run:

```bash
./scripts-run src/scripts/context_hygiene_hook < /dev/null
```

The script reads from stdin if a JSON envelope is provided and
otherwise writes a no-op snapshot under the shared dispatcher lock.
Exit code is always 0 — hooks must never block the agent loop.

## See also

- `context-hygiene` (rule) — thresholds, 3-failure rule, tool-loop cap, read-loop Iron Law.
- `systematic-debugging` § Debug micro-loop — the one-test-one-fix-one-rerun procedure.
