# Subagent dispatch prompts

One file per mode in [`SKILL.md`](../SKILL.md) § *The nine modes*. Each
prompt is the **literal template** the orchestrator hands to the
subagent on dispatch — externalized so prompt edits do not bloat the
skill above the 400-line sunset trigger.

| Mode | File |
|---|---|
| do-and-judge | [`do-and-judge.md`](do-and-judge.md) |
| do-and-judge-two-stage | [`do-and-judge-two-stage.md`](do-and-judge-two-stage.md) |
| do-in-steps | [`do-in-steps.md`](do-in-steps.md) |
| do-in-parallel | [`do-in-parallel.md`](do-in-parallel.md) |
| do-competitively | [`do-competitively.md`](do-competitively.md) |
| judge-with-debate | [`judge-with-debate.md`](judge-with-debate.md) |
| do-in-worktrees | [`do-in-worktrees.md`](do-in-worktrees.md) |
| adversarial-verification-council | [`adversarial-verification-council.md`](adversarial-verification-council.md) |

## Contract

Every prompt cites the status taxonomy in
[`../schemas/subagent-status.json`](../schemas/subagent-status.json) and
ends with the **return-envelope** instruction so the subagent's reply
validates against that schema.

## Prompt-cache discipline

When dispatching sibling subagents (e.g. `do-in-parallel` with N independent
slices), **reuse a stable dispatch-prompt prefix** across all siblings. On
this host the **system prompt comes from the agent definition**, not from
anything the orchestrator writes — the dispatch prompt (the templated user
message below) is the one prefix the orchestrator actually controls. Keep
task-invariant text (role declaration, constraints, status enum, return-envelope
instruction) in the prefix; put only the slice-specific `TASK:` and
`CONTEXT FILES:` in the variable section. This maximises host-side prompt-cache
hits (Anthropic `cache_control: ephemeral`) across the cohort — the prefix is
cached after the first sibling and served from cache for the rest, cutting
input-token cost proportionally to cohort size.

**Break-even + failure modes.** A cache write costs ~1.25× the base input rate
(5-min TTL); a read costs ~0.1×. So the prefix pays off once **≥ 2** siblings
read it — a lone subagent with no sibling reuse only pays the write premium and
saves nothing. The cache is a **byte-exact prefix match**: any drift in the
shared prefix (a timestamp, a per-sibling id, reordered text) forces a re-write
instead of a read, and the prefix must be re-hit within the **5-minute TTL**, so
dispatch siblings promptly rather than trickling them. This is why the win is
real for **fan-out** (many siblings, one prefix) and marginal for one-shot
dispatch. Verify a cohort is actually reading, not re-writing, by checking
`usage.cache_read_input_tokens > 0` on the 2nd+ sibling. Measured effect
(anthropics/claude-code#74318): same-type sibling prefix hits reach **85%**
within a 5-minute window vs **45%** for a mismatched or trickled cohort.

**Sibling-uniformity rules** (follow from cache partitioning — the cache key
includes model and tool set, and any mismatch fragments the cohort's shared
prefix into separate caches): dispatch a cohort with the **same model**, the
same `effort`, and the **same tool set** across every sibling, and fire them
**promptly** rather than trickling dispatches one at a time — a sibling
dispatched after the 5-minute window has already closed pays the full write
premium alone, gaining nothing from the cohort.

**Fork vs. named subagent — an ordering, not a default.** Tool and scope fit
is first-order; cache inheritance is second-order. Prefer a **fork** when the
child continues the parent's task under identical tools and constraints (a
fork inherits the parent's system prompt, tools, and conversation history
exactly, so its first request reads the parent's cache). Prefer a **named
subagent** when the child needs isolation, a different tool set, or nested
dispatch — a fork cannot nest, and forking forces background mode, which
changes the tool set and therefore invalidates the very prefix that
motivated the fork in the first place. Never default to "always fork": that
option was considered and cut ([`../SKILL.md`](../SKILL.md) § Form gate)
precisely because the cache-sharing benefit cannot be predicted before the
fork happens, and background mode can erase it outright.

## Loading

Every dispatchable mode named in `SKILL.md` § *The nine modes* maps to a
prompt file in the table above (mode 8 is gated/experimental — its
live-app rubric lives in the `subagent-modes-detail` context, not here);
each prompt mentions all four status enum values.
