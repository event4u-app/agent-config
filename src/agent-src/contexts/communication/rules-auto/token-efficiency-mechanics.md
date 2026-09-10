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

### Where the 800 came from, and what would falsify it

Migrated out of `token-efficiency.md` on 2026-09-09 to fund that rule's
provided-artifact carve-out — a named substitution rather than a deletion, per
the council verdict on `blocker: standing-payload-headroom`.

The number is a **stated default, not a measured optimum** — said plainly rather
than implying a derivation it does not have. *Revisit-if:* a run records a
probe-then-slice that cost more than the full read would have, or the host's
ranged-read primitive changes its own default. Either falsifies the number, not
the obligation.

### The provided-artifact carve-out

A handed-over design artifact is not a large file to be probed; it is the spec,
and reading it whole is the work. A bundle of several thousand lines across
markup, CSS and tokens is ordinary, so the agent that reads it properly is the
one the size gate and the read-loop detector both punish, while the agent that
skims it produces the fidelity failure `design-fidelity` exists to prevent.

Two obligations, and they compose rather than cancel:

1. **The size gate does not fire on it.** Read the artifact whole.
2. **The read is declared** — [`context-hygiene`](../../../../../docs/guidelines/agent-infra/context-hygiene-mechanics.md)
   § the declared-protocol cap — with its goal, its expected read count and the
   output shape, before the reading starts. Declaring raises the read-only abort
   from 5 turns to 8; it never suspends it, and exceeding the declared count by
   more than 2 is still the violation.

What this does NOT do: it does not exempt an *undeclared* read loop, and it does
not apply to a file that merely happens to be large. The discriminator is the
handover, not the size.

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

## One command per Bash call — the detail

Migrated from `token-efficiency` § One command per Bash call on 2026-09-08,
because that rule's body is re-written on every subagent spawn while this file
is loaded on demand. The Iron Law stays in the rule; everything below is
lookup material.

### Why chaining costs more, not less

The host splits a compound command on `&&`, `||`, `;`, `|`, `|&`, `&` and
newlines and requires **each segment to match the allowlist independently**.
A single unmatched segment sends the whole call down the permission path even
when every other segment was already allowed. So chaining does not save a
round-trip — it converts N cheap authorizations into one expensive one.

### The measurement

Over 40,268 real Bash calls from one maintainer's transcripts:

- **97.7 %** carry a shell metacharacter. The package's own category-A
  classifier (`permission_gate` + `category_a.ts`) is therefore reachable on
  **2.3 %** of real calls; the host allowlist decides the rest.
- **17.9 %** have a head token matching no allowlist pattern. Distribution:
  a leading `VAR=…` assignment 5,215×, `./scripts-run` 520×, `python3` 518×,
  shell loop keywords 460×, `sleep` 155×, `mkdir` 71×, `cp` 49×.
- Of those 5,215 assignments, **5,037 are genuinely standalone** (`F=/path; …`)
  and only 178 are env prefixes (`VAR=v cmd`). The distinction was checked
  rather than assumed, because a review had claimed the whole class was a
  measurement artifact. It is not: that shape cannot be written as an
  allowlist pattern at all, so it shrinks only by not being written.

### Re-measured 2026-09-10, with a shipped probe

The figures above were computed once by hand. `autonomy_friction_traffic`
(`./scripts-run src/scripts/autonomy_friction_traffic --store <dir> --limit 40`)
recomputes them from a transcript store and shares the live detectors — and the
metacharacter class is `category_a`'s own exported constant — so the report and
the carrier cannot drift. Over **7,530 distinct** Bash calls in 39 transcripts
(deduplicated by tool-use id, with the measuring session excluded):

- **1.7 %** (125) are category A. Of the 7,405 uncovered calls, **7,105** are
  disqualified by a shell metacharacter before their argv is read, 21 name a
  consequence operation, and **279** get as far as the head list and are refused
  there. Widening the head list therefore cannot move this number — the shape
  can. Read the 279 as an upper bound: a simple command is also refused for a
  directory flag whose value escapes the working tree, and that case is not
  separable from the head bucket.
- **60.4 %** (4,548) carry the chain class; `cd` heads 3,541 of the uncovered
  calls — a different denominator from the shape classes, which count every call.
- **4.1 %** (306) write a file through the shell: 216 `cat >`, 66 `sed -i`,
  16 a `python3 -c` opening a path for writing, 7 `perl -i`, 1 `tee`.

**Two host facts that decide what any of this can buy**, both read out of the
host's own permission documentation on 2026-09-10. First, `permissions.allow`
does **not** bypass the auto-mode classifier — they are layers, the rules go
first and the classifier still judges what passes, so an allow entry cannot make
a prompt go away on its own. Second, "don't ask again" saves a permanent rule
for a read-only command and only a session-lifetime one for a write-shaped one.
The second is why the write class earns its own line: no amount of confirming
makes the next `sed -i` cheaper. The adjacent question — whether a hook's
`permissionDecision: allow` suppresses the classifier — was looked for in the
same pass and **not found documented**, so nothing here rests on it.

**And a correction to the table below.** `git -C /repo status` is the right
substitution for the host's matcher, but it is **not** category A: `category_a`
refuses a global option whose value is absolute, and every cross-worktree
invocation in a multi-worktree checkout writes an absolute one. So unwinding a
chain removes the metacharacter without buying the allow. The row stays because
it is still the cheaper shape; what changes is the claim that it lands inside
category A. Pinned in `tests/scripts/autonomy_friction_traffic.test.ts` §
"the recommended substitution is only covered with a RELATIVE path".

### The substitutions

| Instead of | Write |
|---|---|
| `D=/repo; cd $D && git status` | `git -C /repo status` |
| `V=$(git rev-parse HEAD); echo $V` | two calls, the second using the printed value |
| `mkdir -p x && cp a x/` | two calls in the same block |
| `cd sub && <cmd>` | the directory flag the tool already has (`-C`, `--cwd`, `--prefix`) |
| `sed -i '' -e 's/a/b/' f` | the **Edit** tool — a write-shaped Bash grant expires with the session |
| `cat > f <<'EOF' … EOF` | the **Write** tool for a new file, **Edit** for a change to an existing one |
| `python3 -c "open(p,'w').write(s)"` | the same two tools; keep the interpreter for reads and computation |

A loop that genuinely cannot be expressed without the shell stays a loop —
prefer a script file over an inline `for` when it recurs.

### What the carrier does and does not do

`chain-nudge` (`src/scripts/hooks/chain_nudge_hook.ts`) is a `pre_tool_use`
concern bound on the three hook-capable platforms. It reads
`tool_input.command`, strips quoted spans and heredoc bodies so an operator
inside a string literal cannot be misread, and injects one advisory line the
first time a session chains work. It is ON by default with
`hooks.chain_nudge.enabled: false` as the opt-out — inverting
`code-graph-nudge`, which gates on a project capability that may be absent,
because the fact this one carries is a property of the host's permission
matcher and holds in every consumer.

Since 2026-09-10 it carries a second shape class — a Bash command that fills a
file (`sed -i`, `cat > f`, `tee f`, `perl -i`, a `python3 -c` opening a path for
writing) — and the latch is per class, so a session sees at most one line per
class instead of one line for whichever mistake came first. A redirect that
names no file being filled (`2>&1`, `> /dev/null`) is still not a write and is
still not flagged.

**It never blocks, and each class fires once.** So it changes what the agent knows,
not what the agent may do: compliance stays model-carried, and the concern's
tests establish detector behavior, not adherence. On a host with no
`pre_tool_use` slot nothing fires at all and the rule is model-carried end to
end — `agent-config hooks:status` reports which slots are bound where you are.

### The sentence this replaced

Until 2026-09-08 the batching paragraph in the rule ended "NOT write shorter
commands: the long commands are already the batching." That was written about
token cost, where it holds, and it is wrong about the permission layer below —
a batch is N tool calls in ONE block, never N shell commands in ONE call. The
old wording collapsed the two and so encouraged the most expensive shape.
