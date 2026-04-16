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

**CRITICAL**: When a tool or command returns a value (branch name, file path, PR number),
use that EXACT value in subsequent API calls. NEVER substitute a value from earlier in
the conversation. Context decay causes silent mismatches — fresh output is the only source of truth.

## Conversation Efficiency

### Act, skip narration

- **Skip repeating the user's request.** They know what they asked.
- **Just do it** — skip announcing what you're about to do.
- **Skip explaining obvious tool calls.** Reading a file needs no justification.
- **Report only outcomes** — skip intermediate step summaries unless the user needs them.

**This rule NEVER overrides user-interaction or command rules.**
Token efficiency means fewer *unnecessary* words — NOT skipping required questions,
numbered options, or command steps. When a rule or command says "ask the user", you ask.

### Stop early — max 2 retries

- **Command fails twice with same error** → stop, rethink. Try a different approach.
- **grep/search returns nothing after 2 attempts** → switch approach or ask the user.
- **Max 3 diagnostic commands** per error. Read the error, think, act.
- **One hypothesis at a time.** Pick the most likely, try it. If it fails, ask.

### Keep intermediate output minimal

Read `minimal_output` (default: `true`) and `play_by_play` (default: `false`) from project settings.

When `minimal_output=true`:
- Multi-step work: short bullet points only, no paragraphs.
- No thinking out loud — user doesn't need your reasoning.
- When `play_by_play=false`: silently investigate, report conclusion only.
- When `play_by_play=true`: briefly share intermediate findings.
- At the end: concise summary — what changed, what user needs to know.

### Don't re-read what you already know

- Edited a file → edit tool showed result. Don't re-read.
- Ran a command → you have output. Don't re-run to "verify".
- File in context from recent messages → don't reload.

### Minimize tool calls

- Parallel reads — don't read 5 files sequentially.
- Regex search over full file reads. View specific line ranges.
- One codebase search call with all symbols — not 5 separate.
- Short question → short answer. Summary tables only for 3+ items.

### Exceptions

- Small output (< 30 lines): read directly.
- Debugging: OK to read more context around one error.
- User explicitly asks for full output: show it.

→ Detailed patterns: `guidelines/agent-infra/output-patterns.md`
