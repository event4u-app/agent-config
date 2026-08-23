# `subagent_start` payload probe — can a rule body be trigger-matched at spawn?

> Evidence for steps **0.6** and **0.7** of
> [`road-to-trigger-delivered-rule-bodies`](../../roadmaps/archive/road-to-trigger-delivered-rule-bodies.md),
> and the resolving mechanism for blocker `b-subagent-payload-trigger-match`.
> Measured **2026-08-23** against `origin/main` @ `e7c437fe5`, from a live
> Claude Code session on this machine. Every claim below carries the command or
> the state file that produced it; nothing is asserted from memory.

## Host pin

```
$ claude --version
2.1.241 (Claude Code)

$ readlink -f "$(which claude)"
/opt/homebrew/lib/node_modules/@anthropic-ai/claude-code/bin/claude.exe
```

This is **2.1.241**, twelve patch versions past the **2.1.229** pinned in
[`subagent-lifecycle-phase0-host-pin.md`](subagent-lifecycle-phase0-host-pin.md),
so the findings below are a fresh measurement on the version this roadmap ships
against — not a transferred one.

## Method

One `Explore` subagent, spawned from a live orchestrator session, with a prompt
deliberately carrying three router trigger values (`technical debt`,
`modernize`, `blade template`) so that a prompt-shaped matcher would have
something to fire on. The subagent was instructed to make **exactly one** tool
call (a `Read` of `src/rules/ui-audit-gate.md`) and return; it did.

Hook state under the **parent** checkout
(`/Users/mathiasberg/projects/galawork/galawork-packages/event4u/agent-config`,
because in a worktree session hook state lands in the parent — `CLAUDE_PROJECT_DIR`
resolves there) was snapshotted immediately before the spawn and diffed
immediately after:

| instrument | slot it proves | state path |
|---|---|---|
| `subagent-ledger` | `subagent_start` / `subagent_stop` | `agents/runtime/state/subagent-ledger/2026-08.jsonl` |
| `injection-budget` | `user_prompt_submit` | `agents/runtime/state/injection-turn/<session_id>.<hash>.json` |
| `tool-result-census` | `post_tool_use` | `agents/runtime/state/tool-result-census.jsonl` |
| `spawn-guard-shadow` | `pre_tool_use` (orchestrator side) | same ledger file, `spawn_guard_shadow` lines |

A confound is stated up front and is what makes verdict 3 readable rather than
merely absent: **other sessions were running on this machine during the window**,
so the instruments were demonstrably live throughout — 32 `Bash` census lines
landed in the same 20 seconds from other worktrees. An empty diff here is
therefore an observed negative, not a dead instrument.

## verdict: spawn payload carries NO prompt — a rule body CANNOT be trigger-matched at `subagent_start`

The event fired and was recorded, verbatim:

```json
{"event":"subagent_start","ts":"2026-08-23T13:29:09.075Z","ref":"659935bd5fef",
 "session_id":"b5f7a7a6-07f0-42eb-bc27-f097510e0338","agent_type":"Explore",
 "parent_ref":null,"depth":1,"depth_basis":"assumed-root","concurrent_open":17}
```

Two readings, both load-bearing:

- The `session_id` is the **orchestrator's** own session id, not a child
  session id. The host does not mint a separate session for the subagent at
  this event, so nothing downstream can key child-scoped state off it.
- The field set the concern resolves is `agent_id` (recorded only as the hashed
  `ref`), `agent_type` / `subagent_type`, and `session_id`. The concern reads
  those under six aliases and finds nothing prompt-shaped, which is consistent
  with the binary's own payload-field string table
  ([`subagent-lifecycle-phase0-host-pin.md:53-71`](subagent-lifecycle-phase0-host-pin.md)):
  `agent_id`, `agent_type`, `subagent_type`, `last_assistant_message`,
  `additionalContext`, `hook_event_name`, `transcript_path`, `stop_hook_active`
  — **no `prompt`, no `task`, no `description`**.

**Evidence grade, stated honestly.** This is a ledger observation plus a
string-table presence check, not an enumeration of the raw stdin keys. A raw-key
capture would need a code change to a concern that runs from the **parent**
checkout's built dispatcher, which would leak into the other sessions live on
this machine at the time; that cost was judged higher than the residual
uncertainty. The two independent readings agree, and neither can produce a
prompt field that the other hides — so the verdict is *no* at high confidence
and is not claimed as an exhaustive key dump.

## verdict: `user_prompt_submit` does NOT fire inside a subagent session

`injection_budget` writes one file per turn at
`agents/runtime/state/injection-turn/<session_id>.<hash>.json`. Across the
spawn:

```
$ ls agents/runtime/state/injection-turn/ | sort | comm -13 <pre-snapshot> -
(empty)
```

Zero new files. The child's task prompt is not delivered through the
prompt slot, so a prompt-triggered concern cannot reach a subagent.

## verdict: `pre_tool_use` / `post_tool_use` do NOT fire inside a subagent session

The subagent made exactly one `Read`. `tool-result-census.jsonl` records every
tool call and `Read` is squarely in its vocabulary — 1,579 historical `Read`
lines, the most recent at `2026-08-23T13:28:48.046Z`, twenty-one seconds before
the spawn. In the window `13:29:05`–`13:29:25`, which brackets the subagent's
entire lifetime:

```
$ grep -E '"ts":"2026-08-23T13:29:(0[5-9]|1[0-9]|2[0-5])' tool-result-census.jsonl \
    | grep -o '"tool":"[^"]*"' | sort | uniq -c
   1 "tool":"Agent"
  32 "tool":"Bash"
```

One `Agent` — the spawn itself, seen from the **orchestrator's** side — and 32
`Bash` lines from the parallel sessions. **Zero `Read`.** The child's tool call
produced no tool-slot event. No new `reread-guard` or `turn-end-gate` entries
appeared either.

## The finding nobody asked for: the spawn IS visible, on the orchestrator's tool slot

`spawn-guard-shadow` is bound on `pre_tool_use`
(`src/scripts/hook_manifest.yaml:960`) and recorded the spawn:

```json
{"event":"spawn_guard_shadow","ts":"2026-08-23T13:30:46.520Z","tool":"Agent",
 "concurrent_open":15,"depth_estimate":2, … ,"posture":"shadow"}
```

A `pre_tool_use` payload for an `Agent`/`Task` call carries `tool_input`, and
`tool_input` for that tool carries the child's prompt. So prompt-shaped matching
*at spawn time* is reachable after all — but only on the **orchestrator's** side,
injecting into the **orchestrator's** context. Nothing this tree can bind reaches
inside the child session, on any of the three slots probed.

## Consequence for the roadmap

`subagent delivery: orchestrator-only`. The subagent census arm of step 2.3 does
not run, and step 1.7 has no `subagent_start` binding to charge for. Whether the
orchestrator-side spawn match is worth building is the question put to the
council in `trigbody-subagent-payload.md`; this file only establishes what the
host does.
