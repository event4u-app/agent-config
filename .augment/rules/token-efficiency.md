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
running commands, or making straightforward edits. ONLY for genuinely complex
multi-step reasoning. Calling such tools more than once per task = looping. Stop and act directly.

### Anti-loop: "CRITICAL INSTRUCTION" and self-prompting

Generating "CRITICAL INSTRUCTION", "I need to", "Let me think", "Related tools:" inside a tool call
or as preamble = **loop**. Happens after connection errors or "continue" / "mach weiter".

**Immediate action:**

1. STOP generating self-instructions.
2. Read last user message — what did they actually ask?
3. Do that ONE thing directly. No planning monologue.
4. If unknown, ask: "Where were we?"

## Fresh Output Over Memory

**CRITICAL**: When tool/command returns value (branch name, file path, PR number),
use EXACT value in subsequent calls. NEVER substitute from earlier conversation.
Context decay causes silent mismatches — fresh output is only source of truth.

## Conversation Efficiency

### Act, skip narration

- Skip repeating user's request — they know what they asked
- Just do it — skip announcing intentions
- Skip explaining obvious tool calls
- Report only outcomes

**This rule NEVER overrides user-interaction or command rules.**
Token efficiency = fewer *unnecessary* words — NOT skipping required questions,
numbered options, or command steps. When a rule says "ask the user", you ask.

### Stop early — max 2 retries

- Command fails twice → stop, rethink, different approach
- grep/search empty 2× → switch approach or ask
- Max 3 diagnostic commands per error
- One hypothesis at a time

### Keep intermediate output minimal

Read `minimal_output` from project settings (default: `true`).

When `true`:

- **Multi-step work:** short bullet points only, no paragraphs.
- **No thinking out loud** — user doesn't need your reasoning process.
- **Play-by-play**: Read `play_by_play` from settings (default: `false`).
  When `false`: silently investigate, report conclusion.
  When `true`: briefly share intermediate findings.
    - ❌  "Hmm, exit code 1. Let me check... 18 errors..."
    - ✅  *(silently investigate, then report conclusion)*
- **At the end:** concise summary — what changed, what user needs to know.

### Don't re-read what you already know

- Edited file → edit tool showed result. Don't re-read.
- Ran command → you have output. Don't re-run to "verify".
- File in context from recent messages → don't reload.
- Found symbol → don't search again differently.

### Search before reading

- Search first — codebase search, regex, `grep`.
- Don't load entire files when you only need few lines.
- Small files (< 50 lines) — OK to read fully.

### Minimize tool calls

- Parallel reads — don't read 5 files sequentially.
- Regex search over full file reads when possible.
- View specific line ranges when you know location.
- One codebase search call with all symbols — not 5 separate calls.

### Right-size responses

- Short question → short answer.
- Code change → show what changed, not entire file.
- Error fix → what was wrong, what you did. No history lesson.
- Summary tables → only for 3+ items.

## Exceptions

- **Small output** (< 30 lines): Read directly, no redirect needed.
- **Debugging**: OK to read more context around that one error.
- **User explicitly asks** to see full output: Show it.

→ Output patterns, targeted operations, tool-first policy: see `guidelines/agent-infra/output-patterns.md`
