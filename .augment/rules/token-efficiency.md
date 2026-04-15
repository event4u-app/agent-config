---
type: "always"
description: "Token efficiency — redirect output, minimize tool calls, keep responses concise"
alwaysApply: true
source: package
---

# Token Efficiency

## The Iron Laws

```
NEVER load full command output into context. Redirect → read summary → targeted details.
```

```
NEVER call the same tool more than 2 times in a row with similar parameters.
If you catch yourself repeating a tool call — STOP, rethink, try a different approach, or ask the user.
```

### Anti-loop: Extended Reasoning

Do NOT use extended reasoning / chain-of-thought tools for simple tasks like viewing files,
running commands, or making straightforward edits. They are ONLY for genuinely complex
multi-step reasoning. If you find yourself calling such tools more than once per task —
you are looping. Stop immediately and act directly instead.

### Anti-loop: "CRITICAL INSTRUCTION" and self-prompting

If you find yourself generating text that starts with "CRITICAL INSTRUCTION", "I need to",
"Let me think", "Related tools:", or similar self-directed reasoning inside a tool call
or as a preamble before acting — **you are in a loop**. This happens after connection errors
or when the user says something like "continue" / "mach weiter".

**Immediate action:**

1. STOP generating self-instructions.
2. Read the last user message — what did they actually ask?
3. Do that ONE thing directly. No planning monologue, no tool selection reasoning.
4. If you don't know what the user wanted, ask: "Where were we?"

## Fresh Output Over Memory

**CRITICAL**: When tool/command returns value (branch name, file path, PR number),
use EXACT value in subsequent calls. NEVER substitute from earlier conversation.
Context decay causes silent mismatches — fresh output is only source of truth.

## Conversation Freshness

Monitor for **context decay** — long conversations degrade quality.

**Suggest new chat when:**

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

## Conversation Efficiency

### Act, skip narration

- Skip repeating user's request — they know what they asked
- Just do it — skip announcing intentions
- Skip explaining obvious tool calls
- Report only outcomes

**This rule NEVER overrides user-interaction or command rules.**
Token efficiency means fewer *unnecessary* words — NOT skipping required questions,
numbered options, or command steps. When a rule or command says "ask the user", you ask.

### Stop early — max 2 retries

- Command fails twice → stop, rethink, different approach
- grep/search empty 2× → switch approach or ask
- Max 3 diagnostic commands per error
- One hypothesis at a time

### Keep intermediate output minimal

Read `minimal_output` from the project settings file (default: `true`).

When `true`:

- **During multi-step work:** short bullet points only, no paragraphs.
- **No thinking out loud** — the user doesn't need your reasoning process.
- **Play-by-play**: Read `play_by_play` from the project settings file (default: `false`).
  When `false`: don't narrate each tool call result. Silently investigate, then report the conclusion.
  When `true`: briefly share intermediate findings as you go.
    - ❌  (when false) "Hmm, exit code 1. Let me check... 18 errors. The errors are about method_exists..."
    - ✅  (when false) *(silently investigate, then report the conclusion)*
- **At the end:** concise summary — just what changed and what the user needs to know.

### Don't re-read what you already know

- Edited a file → the edit tool showed the result. Don't re-read the file.
- Ran a command → you have the output. Don't re-run to "verify".
- File in context from recent messages → don't reload.
- Found a symbol → don't search again in a different way.

### Search before reading

- **Search first** — use codebase search tools, regex search in files, or `grep`.
- **Don't load entire files** when you only need a few lines.
- **Small files** (< 50 lines) — OK to read fully.

### Minimize tool calls

- **Parallel reads** — don't read 5 files sequentially.
- **Regex search** over full file reads when possible.
- **View specific line ranges** when you know the exact location.
- **One codebase search call** with all symbols — not 5 separate calls.

### Right-size responses

- Short question → short answer.
- Code change → show what changed, not the entire file.
- Error fix → what was wrong, what you did. No history lesson.
- Summary tables → only for 3+ items.

## Pattern: Redirect, Summarize, Target

## Pattern: Redirect, Summarize, Target

Every command that MAY produce more than ~30 lines of output:

### Step 1: Redirect to file

```bash
docker compose exec -T <service> <command> 2>&1 > /tmp/<tool>-output.txt
echo "EXIT=$?"
```

### Step 2: Read ONLY the summary

```bash
tail -5 /tmp/<tool>-output.txt
```

### Step 3: If errors exist, read ONLY what you need to fix

```bash
# Read specific error lines
grep "ERROR\|error\|✏️" /tmp/<tool>-output.txt | head -20

# Read a specific file's errors
grep "app/Services/MyService.php" /tmp/<tool>-output.txt
```

**NEVER** do:

- `cat /tmp/<tool>-output.txt` (loads everything)
- Read the full output of a passing command (waste)
- Read diffs you don't plan to act on

## Targeted Operations

Minimize scope. Never fetch more than you need.

### Queries
- Single item over list: query directly, don't fetch list to find one entry
- Filtered queries: always filter when listing unavoidable
- Specific fields: request only needed fields
- JSON + jq: use JSON output + `jq` to extract exactly what you need

### Testing
- During work: ONLY the specific test affected (`--filter=ClassName`)
- Broader scope: only if change could affect other tests
- Full suite: only at the very end
- Decision: changed method → method's test · changed class → class tests · changed shared service → all consumers · changed config → full suite

### API calls
- Targeted endpoints over list endpoints
- Small page sizes, stop after finding what you need
- Don't re-fetch what you just received

## Tool-First, Script-Last

**Prefer skills with CLI tools over custom scripts.**

1. **Existing skill** — use directly
2. **Skill + CLI tool** (jq, grep, awk, sed) — compose
3. **Python/Bash script** — only when no skill/tool combination exists

Scripts allowed only when: no skill covers it, no CLI tool achieves it, operation needs programmatic logic, script is reusable.
Scripts NOT allowed when: skill exists, `jq` can extract it, `grep` + `head` can filter it.

**Learning trigger:** When you write a script because no skill exists → capture learning → propose skill that replaces the script.

## General Rules

For tool-specific commands → see `quality-workflow` rule.

1. **ECS and Rector are trusted tools** — their configs define exactly what they do.
   Run with `--fix`, don't read diffs, don't review changes. Trust the config.
   The only verification needed is PHPStan + tests afterwards.

2. **Both ECS and Rector always run with `--fix`** — dry-run diffs are a waste of tokens.
   The workflow is: fix → verify (PHPStan + tests) → fix issues if any.

3. **Exit code first**: Check `$?` before reading ANY output. If 0, you're done — don't read.

4. **Summary line**: Most tools print a summary as the last few lines. That's all you need.

5. **Targeted grep**: When you need details, `grep` for the specific file or error type.
   Never read the full output "just in case".

6. **Don't re-read**: Once you've read output and acted on it, don't read it again.
   The file is still there if you need it, but don't re-load it into context.

7. **Iterative fixing**: Fix one error at a time, re-run, check exit code.
   Don't try to fix all errors from a single output read — the output becomes stale after each fix.

## Exceptions

- **Small output** (< 30 lines): Read directly, no redirect needed.
- **Debugging**: OK to read more context around that one error.
- **User explicitly asks** to see the full output: Show it.

## Augment-specific

_The following section applies only to Augment Code._

### Ignored Skills Recovery

Skills excluded via `.augmentignore` don't appear in `<available_skills>`.
When you need expertise from an ignored skill during a task:

1. **Read the SKILL.md directly** — `.augmentignore` only hides from the system prompt,
   not from `view`. Use `view .augment/skills/{name}/SKILL.md` to load it on demand.
2. **Continue working** — apply the skill's guidance for the current task.
3. **After the task**, ask the user:

```
> 💡 I loaded the `{name}` skill manually — it's currently ignored in `.augmentignore`.
>
> 1. Remove from ignore — this skill is relevant for the project
> 2. Keep ignored — this was a one-off
```
