---
type: "auto"
tier: "2a"
description: "CLI runs, log fetches, replies — redirect verbose output, minimize tool calls, stay concise"
alwaysApply: false
load_context:
  - ../contexts/communication/rules-auto/token-efficiency-mechanics.md
triggers:
  - keyword: "minimize tool calls"
  - phrase: "fetching logs"
self_contained: true
workspaces: [agent-config-maintainer, construction, engineering, finance, founder, gtm, legal-review-prep, ops, product, small-business]
packs: [meta]
# obligation: line 21
obligation_frequency: "per-edit"
---

# Token Efficiency

## The Iron Laws

```
NEVER load full command output into context. Redirect → read summary → targeted details.
```

```
NEVER CALL THE SAME TOOL >2 TIMES IN A ROW WITH SIMILAR PARAMETERS.
IF YOU CATCH YOURSELF REPEATING → STOP, RETHINK, ASK.
```

## Independent calls go in ONE block

```
CALLS WITH NO DEPENDENCY BETWEEN THEM GO IN THE SAME BLOCK.
A CALL THAT DOES NOT READ THE PREVIOUS RESULT IS NOT A SECOND TURN.
```

The ceiling above forbids repetition; this forbids splitting work that had no
reason to be split — measured mean batch size **1.01**, i.e. fully serial. The
discriminator is the dependency, never the count. `instruction-only` — nothing
can observe a call that was not batched. Evidence + the absent-cause finding:
[`token-efficiency-mechanics`](../contexts/communication/rules-auto/token-efficiency-mechanics.md).

**Corrected 2026-09-08.** This paragraph used to end "NOT \"write shorter
commands\": the long commands are already the batching." That sentence was
written about token cost, where it was true, and it is wrong about the layer
below — see the next section. A batch is N tool calls in ONE block; it was
never N shell commands in ONE call, and the old wording collapsed the two.

## One command per Bash call

```
ONE COMMAND PER BASH CALL. NEVER CHAIN WORK STEPS WITH `;`, `&&` OR `||`,
AND NEVER CARRY STATE FORWARD IN A LEADING `VAR=…` ASSIGNMENT.
N COMMANDS GO IN N CALLS IN ONE BLOCK — THAT IS WHAT A BATCH IS.
A CHAINED CALL IS AUTHORIZED ONLY AS STRONGLY AS ITS WEAKEST SEGMENT.
```

Not a token rule — a permission rule, which is why it is not folded into the
section above. The host splits a compound command on `&&`, `||`, `;`, `|`,
`|&`, `&` and newlines and requires **each segment to match the allowlist
independently**. One unmatched segment sends the whole call down the
permission path even when every other segment was already allowed. Chaining
therefore does not save a round-trip; it converts N cheap authorizations into
one expensive one.

Measured over 40,268 real Bash calls: 97.7 % carry a shell metacharacter, and
17.9 % have a head token matching no pattern — of those, **5,037 are a leading
`VAR=…` assignment**, a shape that cannot be written as an allowlist pattern
at all. That class does not shrink by granting more permission. It shrinks
only by not writing it.

The substitutions are mechanical and each is also the clearer command:

| Instead of | Write |
|---|---|
| `D=/repo; cd $D && git status` | `git -C /repo status` |
| `V=$(git rev-parse HEAD); echo $V` | two calls, the second using the printed value |
| `mkdir -p x && cp a x/` | two calls in the same block |
| `cd sub && <cmd>` | the directory flag the tool already has (`-C`, `--cwd`, `--prefix`) |

**Still fine, and not what this forbids:** a pipe whose segments are all
ordinary filters (`grep foo file | head`) — that is one command with a filter,
not two work steps; and a redirect into a file, whose target is checked
against the file rules on its own. A loop that genuinely cannot be expressed
without the shell stays a loop — prefer a script file over an inline `for`
when it recurs.

**Carrier gap, named rather than implied.** This rule is `type: auto`, so its
triggers match the PROMPT — and nothing in a prompt announces that the next
tool call will be a chained Bash command. The obligation is therefore
model-carried at exactly the moment it applies, on every host. `rule-inject`
is the only `pre_tool_use` concern that could deliver a rule body at tool-call
time, and it ships default-off (`lean_projection.mode: delivery`) and unbound
on the default role, so it is not a carrier today. Closing this needs its own
`pre_tool_use` concern reading `tool_input.command` — deliberately out of this
change, and stated so a reader does not mistake a written rule for an enforced
one.

## Enumerated file sets are ONE operation, not N repetitions

The same-tool ceiling counts *repetition without new information* — the loop where the agent re-runs a tool because it did not learn from the last result. Reading N **declared, enumerated** files is the opposite: each read returns different content and the set was known before the first call. Counting it as N repetitions puts this rule in direct conflict with [`downstream-changes`](downstream-changes.md) ("find **ALL** callers, tests, imports") and with [`source-discovery-gate`](source-discovery-gate.md), which cannot be satisfied in two calls.

Exempt — the file set is enumerated **before** the first read and each read is a distinct member:

- an override / settings-resolution chain (project → user → global);
- a downstream-caller sweep after a rename or signature change;
- the members of a directory listing or grep result being opened in turn;
- a declared read protocol under [`context-hygiene`](context-hygiene.md).

Not exempt, and still the failure this rule exists to catch: re-reading the *same* file hoping for a different answer, re-running a failing command unchanged, or widening a grep by one word at a time instead of thinking. The discriminator is **did the previous call change what I know** — not the tool name. Nor `cd X && …`: `git -C`.

## Fresh Output Over Memory

When a tool returns a value (branch name, file path, PR number), use that EXACT value in subsequent API calls. NEVER substitute a value from earlier in the conversation. Context decay causes silent mismatches — fresh output is the only source of truth.

## API-dollar levers

Large stable context reused across turns (caching), non-interactive bulk
cohorts (batch), or a cost-aware model/effort decision → route via the
[`token-optimizer`](../skills/token-optimizer/SKILL.md) index branch
(`api-cost-levers` row) — single source of truth for the billing levers.

## Size-gated reads — probe a large file before loading it whole

```
A FILE OVER THE THRESHOLD IS PROBED, NEVER LOADED WHOLE ON SPEC.
SIZE CHECK → STRUCTURAL GREP → BOUNDED SLICE. FULL READ BELOW IT.
```

**Threshold: 800 lines.** Above it, establish the file's shape before its
content — size, then a structural grep for the offsets that matter, then a
ranged read of those offsets. Below it, just read it: a probe you did not need
costs a call and teaches nothing.

The number is a **stated default, not a measured optimum** — said plainly rather
than implying a derivation it does not have. *Revisit-if:* a run records a
probe-then-slice that cost more than the full read would have, or the host's
ranged-read primitive changes its own default. Either falsifies the number, not
the obligation.

Additive: the repetition discriminator above is untouched, an enumerated
multi-file sweep stays ONE operation, and re-probing a file whose shape you
already established this session is the loop, not the fix.

## Mechanics

Anti-loop patterns, act-skip-narration / stop-early / minimize-tool-calls clauses, and small-output / debugging exceptions: [`token-efficiency-mechanics`](../contexts/communication/rules-auto/token-efficiency-mechanics.md). Precedence: never overrides `user-interaction` or command rules.
