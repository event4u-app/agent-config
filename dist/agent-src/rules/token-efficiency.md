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
discriminator is the dependency, never the count. NOT "write shorter commands":
the long commands are already the batching. `instruction-only` — nothing can
observe a call that was not batched. Evidence + the absent-cause finding:
[`token-efficiency-mechanics`](../contexts/communication/rules-auto/token-efficiency-mechanics.md).

## Enumerated file sets are ONE operation, not N repetitions

The same-tool ceiling counts *repetition without new information* — the loop where the agent re-runs a tool because it did not learn from the last result. Reading N **declared, enumerated** files is the opposite: each read returns different content and the set was known before the first call. Counting it as N repetitions puts this rule in direct conflict with [`downstream-changes`](downstream-changes.md) ("find **ALL** callers, tests, imports") and with [`source-discovery-gate`](source-discovery-gate.md), which cannot be satisfied in two calls.

Exempt — the file set is enumerated **before** the first read and each read is a distinct member:

- an override / settings-resolution chain (project → user → global);
- a downstream-caller sweep after a rename or signature change;
- the members of a directory listing or grep result being opened in turn;
- a declared read protocol under [`context-hygiene`](context-hygiene.md).

Not exempt, and still the failure this rule exists to catch: re-reading the *same* file hoping for a different answer, re-running a failing command unchanged, or widening a grep by one word at a time instead of thinking. The discriminator is **did the previous call change what I know** — not the tool name.

## Address another directory by flag, not by `cd`

```
A `cd X && …` COMPOUND RE-ENTERS THE DIRECTORY ON EVERY CALL.
THE ONE CALL THAT FORGETS RUNS IN THE WRONG TREE AND SUCCEEDS.
USE THE TOOL'S DIRECTORY FLAG. WHERE THERE IS NONE, USE A SUBSHELL.
```

`git -C <path>`, `npm --prefix <path>`, `composer -d <path>`,
`pytest --rootdir <path>`, `make -C <path>`. Where a tool genuinely has no
directory flag, `( cd <path> && <cmd> )` keeps the change inside the subshell.

Two costs, and the second is the reason this sits in a rule rather than in a
skill. A host whose working-directory boundary excludes the target prints a
cwd-reset line and runs the next command somewhere else, so the `cd` has to be
repeated per call — that is the token cost. The silent one is worse: a command
that omits the repeat does not fail, it edits the main checkout.

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
