# Token Efficiency — mechanics

Anti-loop patterns, conversation efficiency rules, and exception
catalog for the [`token-efficiency`](../../../rules/token-efficiency.md)
rule. The rule body holds the two Iron Laws and the fresh-output
principle; this file is the lookup material.

## Anti-loop: Extended Reasoning

Do NOT use extended reasoning / chain-of-thought tools for simple
tasks like viewing files, running commands, or making straightforward
edits. They are ONLY for genuinely complex multi-step reasoning. If
calling such tools more than once per task — you are looping. Stop
immediately and act directly.

## Anti-loop: "CRITICAL INSTRUCTION" and self-prompting

Generating text that starts with "CRITICAL INSTRUCTION", "I need
to", "Let me think", "Related tools:", or similar self-directed
reasoning inside a tool call or as a preamble before acting → **you
are in a loop**. Happens after connection errors or when the user
says "continue" / "mach weiter".

**Immediate action:**

1. STOP generating self-instructions.
2. Read the last user message — what did they actually ask?
3. Do that ONE thing directly. No planning monologue, no tool
   selection reasoning.
4. Don't know what the user wanted → ask: "Where were we?"

## Conversation Efficiency

### Act, skip narration

- **Skip repeating the user's request.** They know what they asked.
- **Just do it** — skip announcing what you're about to do.
- **Skip explaining obvious tool calls.** Reading a file needs no
  justification.
- **Report only outcomes** — skip intermediate step summaries unless
  the user needs them.

This rule NEVER overrides `user-interaction` or command rules. Token
efficiency means fewer *unnecessary* words — NOT skipping required
questions, numbered options, or command steps. When a rule or
command says "ask the user", you ask.

### Stop early — max 2 retries

- Command fails twice with same error → stop, rethink. Try a
  different approach.
- `grep` / search returns nothing after 2 attempts → switch approach
  or ask the user.
- Max 3 diagnostic commands per error. Read the error, think, act.
- One hypothesis at a time. Pick the most likely, try it. Fails →
  ask.

### Keep intermediate output minimal

Read `personal.minimal_output` (default: `true`) and
`personal.play_by_play` (default: `false`) from `.agent-settings.yml`.

When `personal.minimal_output: true`:

- Multi-step work: short bullet points only, no paragraphs.
- No thinking out loud — user doesn't need your reasoning.
- `personal.play_by_play: false` → silently investigate, report
  conclusion only.
- `personal.play_by_play: true` → briefly share intermediate
  findings.
- At the end: concise summary — what changed, what user needs to
  know.

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

- Small output (< 30 lines) — read directly.
- Debugging — OK to read more context around one error.
- User explicitly asks for full output — show it.

→ Detailed patterns: `docs/guidelines/agent-infra/output-patterns.md`
