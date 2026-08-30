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
  next hypothesis; failures on the same target accrue to the ONE
  retry ladder (2 retries per approach → N=3 stop-and-ask, per
  [`autonomy-mechanics § Retry-budget escalation ladder`](../../execution/autonomy-mechanics.md))
  — never a separate one-strike cap.

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
- One codebase search call with all symbols — not 5 separate.
- Short question → short answer. Summary tables only for 3+ items.

### Size-gated read procedure (the 800-line threshold)

The rule states the obligation; this is how to discharge it. Three steps, in
order, and each one narrows the next:

1. **Size** — `wc -l <file>`. Under the threshold, stop here and read it.
2. **Shape** — a structural grep for the anchors you need, emitting offsets:
   `grep -nE '^(class|function|def|export|## )' <file>` for a map, or
   `grep -n '<the symbol>' <file>` when you know what you are after.
3. **Slice** — a ranged read around those offsets only (the host's
   `offset`/`limit` read, or `sed -n 'A,Bp'`), widened once if the slice
   straddles a boundary.

Two failure modes this replaces. **Blind full read:** loading a 3,000-line file
to answer a question one function answers — the cost is paid on every later turn
that carries it. **Blind slice:** reading lines 1–200 of an unknown file and
guessing the rest, which is the probe skipped rather than performed.

The step-2 grep is not a second probe of the same file for the same fact — it
returns information step 1 did not have, so it is one operation with step 3, per
the enumerated-set carve-out.

### Exceptions

- Small output (< 30 lines) — read directly.
- Debugging — OK to read more context around one error.
- User explicitly asks for full output — show it.

→ Detailed patterns: `docs/guidelines/agent-infra/output-patterns.md`

## Independent calls go in ONE block — the evidence

```
CALLS WITH NO DEPENDENCY BETWEEN THEM GO IN THE SAME BLOCK.
A SECOND CALL THAT DOES NOT READ THE FIRST ONE'S RESULT IS NOT A SECOND TURN.
BEFORE EMITTING A SINGLE CALL, ASK WHAT ELSE IS ALREADY KNOWN TO BE NEEDED.
```

The ceiling above forbids repetition; this forbids the opposite failure —
splitting work that had no reason to be split. It is stated because it is
**measured, not suspected**: over ten sessions of this package,
`probe_turnaround` reports a mean tool-call batch size of **1.01**, with 27 of
2,889 tool-using requests (0.93 %) carrying more than one call. At a 4.7 s
median generation latency, a request that fans out to 42 calls spends about five
minutes on serialization before a single tool runs.

**Nothing in this package caused that, and nothing in it can fix it.** The cause
was looked for and is recorded as absent
(`agents/evidence/analysis/agent-turnaround-2026-08-30.md` § E2): no rule, skill
or template forbids parallel calls, and parallel calls do occur — so 1.01 is a
tendency, not a floor with a mechanism behind it.

**The discriminator is the dependency, never the count.** Two greps over
different files, a status and a log, three independent reads named before the
first one runs — one block. A read whose path comes out of the previous result —
two blocks, and batching them would be guessing.

**Do not read this as "write shorter commands".** In the same corpus, 98.1 % of
`Bash` calls are already compound or heredoc, and the 18 % that exceed 1,500
characters carry 75 % of all command bytes — those are one-shot scripts that each
replace three to six round-trips. Splitting them trades one expensive call for
several cheap ones and makes the number worse while looking like a fix.

**Honest enforcement — `instruction-only`.** No gate can observe a call that was
not batched: a transcript records the calls that happened, never the block they
could have shared. `probe_turnaround` reports the rate afterwards and refuses to
gate on a store CI does not have. This paragraph is the whole mechanism, and the
roadmap that added it pre-committed to recording a null if the rate does not
move rather than repeating the reminder more loudly.
