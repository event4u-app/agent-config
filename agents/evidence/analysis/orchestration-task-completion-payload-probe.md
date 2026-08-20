<!-- evidence-type: analysis -->

# Task-completion payload probe — which hook slot can populate the orchestration quality columns

> Read-only measurement for the merged blocker pair `real-orchestration-usage`
> ([`road-to-orchestration-scope-decision`](../../roadmaps/road-to-orchestration-scope-decision.md))
> and `telemetry-sample-size`
> ([`road-to-subagent-value-realization-followup`](../../roadmaps/road-to-subagent-value-realization-followup.md)),
> disposed **B — transferred** by
> [`drain-blocker-dispositions-a.md`](../council/drain-blocker-dispositions-a.md).
>
> Measured **2026-08-20** on host `2.1.237 (Claude Code)`,
> `/opt/homebrew/lib/node_modules/@anthropic-ai/claude-code/bin/claude.exe`,
> against `origin/main` @ `caa046343`. Every number below carries the command
> that produced it. Nothing is asserted from memory.

## What the probe was asked

The merged resolution criterion, verbatim from both blockers:

> a probe result records whether any hook slot sees the task-completion
> payload, and — if one does — the current-month audit log carries ≥ 20
> orchestration lines whose **quality** columns are populated rather than
> `null`.

Both blockers had, until 2026-08-17, a bare line-count condition that was
already satisfied while they stayed open. The count is **not** the question and
is no longer diagnostic. The question is whether a hook can observe task
completion and thereby fill the quality fields.

## Result — a three-way split, not a yes/no

The single question turns out to cover three field groups with three different
answers. Reporting one verdict for all three would have been wrong in both
directions.

| Field group | Fields | Reachable from a hook payload? | Slot |
|---|---|---|---|
| Absolute cost / latency | `dispatch_tokens`, `wall_clock_ms`, `tiers` | **YES — already wired** | `post_tool_use`, on a **sync** completion |
| Same, for a **background** dispatch | as above | **CANDIDATE, unverified** | `subagent_stop` (bound on this host) via `transcript_path` |
| Quality | `first_pass_success`, `escalated` | **NO — not payload-derivable at any slot, by construction** | none |

`task_class` is a fourth case and belongs with neither: see § task_class.

### 1. Cost fields ARE seen by a hook, and the hook already reads them

`orchestration_record_hook.ts` runs on `post_tool_use` (`hook_manifest.yaml:896`
and the five other platform rows) filtered to the `Agent` / `Task` tools. It
reads the tool result at `src/scripts/hooks/orchestration_record_hook.ts:120`
(`tool_response` / `toolResponse` / `tool_result` / `toolUseResult`), takes
`totalTokens` at `:193`, and falls back to `usage.input_tokens +
usage.output_tokens` at `:194-199`.

The payload it reads really does carry that data. Measured over the 40
most-recently-modified transcripts of this project
(`~/.claude/projects/-Users-…-agent-config/*.jsonl`), counting entries whose
`toolUseResult` is agent-shaped:

```
AGENT_SHAPED_RESULTS=8
WITH_USAGE=8
UNION_KEYS=agentId,agentType,content,prompt,resolvedModel,status,toolStats,
           totalDurationMs,totalTokens,totalToolUseCount,usage
```

8 of 8 carry a populated `usage` object (`input_tokens`,
`cache_creation_input_tokens`, `cache_read_input_tokens`, `output_tokens`, plus
per-iteration breakdown). So for a **sync** completion the answer to "does any
hook slot see the task-completion payload" is **yes**, and it has been yes for
as long as the concern has been bound.

This is corroborated on the output side: `dispatch_tokens` is numeric on
**40 of 570** current-month orchestration lines (§ Corpus below) — those 40 are
the sync completions.

### 2. For a background dispatch the candidate slot is named, and unverified

`post_tool_use` on an async launch receives a spawn ack — `isAsync: true` /
`status: "async_launched"`, no usage — which the concern documents at
`orchestration_record_hook.ts:28-30` and handles by recording the dispatch fact
and omitting every metric. That is correct behaviour, not a defect.

`subagent_stop` **is** bound on this host (`hook_manifest.yaml:926`, `:967`;
native alias `SubagentStop` at `:1062`, `:1081`) and carries `subagent-ledger`.
The live ledger has observed it 3410 times:

```
$ node … agents/runtime/state/subagent-ledger/2026-08.jsonl
ledger lines: 4091
events: { spawn_guard_shadow: 324, subagent_start: 331,
          subagent_stop: 3410, subagent_reaped: 26 }
subagent_stop => agent_type,concurrent_open,depth,depth_basis,duration_ms,
   envelope_error_count,envelope_parse,event,ref,session_id,start_seen,
   stop_loss_arms_exceeded,ts
```

The ledger records **no** usage field, because the hook never reads one — it is
a lifecycle instrument by design (`subagent_ledger_hook.ts:1-52`). So the ledger
cannot answer whether usage arrives; it only shows nobody looked.

The exact-token string table of the installed binary does carry the field the
indirect route would need:

```
$ strings -a "$BIN" | grep -c '^transcript_path$'   → 1
  stop_hook_active 1 · last_assistant_message 1 · agent_id 5 · agent_type 3
  totalTokens 3 · totalDurationMs 1 · isAsync 2 · async_launched 12
  tool_response 1 · usage 19
```

Presence in a string table is necessary and **not** sufficient — it cannot say
which event carries which field, the same limit
[`subagent-lifecycle-phase0-host-pin.md`](../investigations/subagent-lifecycle-phase0-host-pin.md)
states for its own table (measured there on `2.1.229`; this is a fresh read on
`2.1.237`). What the probe therefore achieves on this branch is a **narrowing**,
not a resolution: the open live-host question is no longer "does any slot see
it" but the single decidable pair *does `transcript_path` arrive on
`SubagentStop` stdin, and does the transcript entry it points at carry the
`toolUseResult` usage object for a background dispatch*. The capture instrument
for that already exists (`dispatch_hook.ts:578`, `_maybe_capture_payload`, gated
on `AGENT_HOOK_CAPTURE_DIR`); what it needs is the host env, which is the
standing `raw-capture-needs-host-env` dependency and is not a repository act.

### 3. The quality columns cannot come from a payload — at any slot

This is the load-bearing finding and it is definitional, not a measurement, so
no amount of probing or usage moves it.

`src/agent-src/contexts/execution/orchestration-telemetry.md:86-107` defines
both quality booleans over the **parent orchestrator's subsequent actions**:

> `first_pass_success = TRUE iff the parent adopts the subagent work product
> with NO scope-relevant modification and issues NO corrective follow-up prompt
> to the same subagent within the same task scope.`
>
> `escalated = TRUE iff the parent re-dispatched the same slice to a higher tier
> after a verification failure.`

Both are facts about what happens **after** the dispatch returns. At the instant
of task completion the parent has not yet reworked the diff and has not yet
re-dispatched, so there is no value for a completion payload to carry. A hook at
`post_tool_use`, at `subagent_stop`, or at any slot the host may add later is
reading a moment that is strictly earlier than the event being measured.

Confirmed on the write side — no hook in the tree writes either field:

```
$ grep --line-number -rE 'first_pass_success|escalated' src/scripts/hooks/
(no output)
```

The only producer is the model-carried CLI (`orchestration_record.ts:136`,
`--first-pass-success` / `--escalated`), i.e. the orchestrator asserting its own
subsequent behaviour after the fact.

**Consequence for the merged criterion.** Its second clause — ≥ 20 lines whose
quality columns are populated — is not reachable by the probe's positive branch.
Even a fully successful `subagent_stop` payload probe fills `dispatch_tokens`
and `wall_clock_ms` for background dispatches; it leaves the quality columns
exactly as `null` as they are today. Populating them requires either the
model-carried emit step to be run reliably (measured capture rate before the
hook existed: 1 of 370, `orchestration_record_hook.ts:6-10`) or new
infrastructure the telemetry contract explicitly declines to add
(`orchestration-telemetry.md:109-120`, the two-field cap and its
`Revisit-if: a verification harness exists`).

### task_class — a fourth case, neither reachable-today nor structurally barred

`task_class` is `null` on 570 of 570 lines, and unlike the quality booleans it
is **known at dispatch time**: `classifyTask` computes it, and
`delegation-nudge` already runs it on `user_prompt_submit`. The record hook has
the raw material too — it reads `tool_input` at
`orchestration_record_hook.ts:107`, and the agent-shaped `toolUseResult` union
above includes `prompt`.

So this column is a **buildable** gap rather than a structural one. It is
recorded here as an option and deliberately **not** built: classifying at
`post_tool_use` would introduce a second classification site whose verdicts
could drift from the `user_prompt_submit` one, and the corpus this telemetry
feeds is supposed to compare like with like. Naming it is the finding; choosing
it is a design decision this probe has no mandate for.

## Corpus — re-measured today

`agents/runtime/state/audit/` in the primary checkout. Field presence counted
over the `orchestration` sub-object.

| | 2026-07 | 2026-08 |
|---|---:|---:|
| total lines | 1 | 579 |
| orchestration lines | 1 | **570** |
| `token_delta` non-null | 1 | 570 |
| `token_delta_provenance` `measured` | 1 | **0** (`estimated` 570) |
| `dispatch_tokens` numeric | 0 | **40** |
| `wall_clock_ms` numeric | 1 | 570 |
| `first_pass_success` non-null | 1 | **0** |
| `escalated` non-null | 1 | **0** |
| `task_class` non-null | 1 | **0** |
| `dispatch_mode` non-null | 0 | **0** |
| `spawn_count` ≥ 2 | 1 (=3) | **0** (1 in 569, 0 in 1) |

Movement against the 2026-08-17 reading recorded in both blockers (368 lines /
367 orchestration): the corpus grew by **203 orchestration lines** and **not one
of them changed a field verdict**. `dispatch_tokens` is numeric on the same
**40** rows — no sync completion has landed in three days — and the four
`null`-in-all columns are still `null` in all. That is the prediction the
blockers' own recommendation makes, now confirmed on a third reading.

The single July line is the whole quality corpus, and it is worth naming
precisely because it looks like a counter-example: it is the hand-emitted
pipeline-verification line from the sibling roadmap's Phase 1 Step 1. It proves
the schema can carry the columns and that a human/model can fill them. It is not
evidence that a hook can.

`spawn_count ≥ 2` at **0 of 570** is the second standing finding: across 570
recorded dispatches the corpus has never produced a fan-out, so the parallel arm
of the pre-registered claim has no population at all — independently of the
quality columns.

## Reading through the gate

```
$ ./scripts-run src/scripts/orchestration_savings_report
Orchestration savings report
  dispatches: 570  (total spawns: 572)
  net token_delta: 1087078 (negative = net saved)   | first_pass_success_rate: n/a (n=1)
  tokens saved: 0 · tokens added: 1087078            | escalation_rate: n/a (n=1)
  provenance: measured 1 (Δ 1087078) · estimated 569 (Δ 0)
  measured share: 0%
  MODELED cost reduction: n/a (needs dispatch_tokens + session_tier + tier_chosen on a dispatch)
```

`n=1` on both quality rates is the § 3 finding restated by the aggregator, and
`measured share: 0%` means the whole net figure is the one July line. This is a
reading, not a verdict: it is assembled from a single row and reports tokens
**added**, which is neither PROVE nor DROP under the pre-registered thresholds
(`docs/CLAIMS.md:259-264`).

## What this probe does NOT establish

- It does **not** run the live-host `SubagentStop` payload capture. That needs
  `AGENT_HOOK_CAPTURE_DIR` in the host's own hook environment; the instrument is
  shipped and the env is not a repository act.
- It does **not** decide PROVE or DROP. The DROP branch's first clause is
  premise-stale (there is no `subagents.auto` left to demote) and its second is
  a change to what the package publicly claims — maintainer-owned either way.
- It does **not** claim the `null` quality columns are a defect. They are
  correct at their layer, for the reason § 3 gives.

## Method — commands, so a later reader can re-run them

```
claude --version ; readlink -f "$(which claude)"
strings -a "$BIN" | grep -c '^<token>$'                       # exact-token presence
node -e '…' agents/runtime/state/audit/2026-0{7,8}.jsonl        # orchestration field census
node -e '…' agents/runtime/state/subagent-ledger/2026-08.jsonl  # ledger event + key census
node -e '…' ~/.claude/projects/<slug>/*.jsonl                   # agent-shaped toolUseResult census
./scripts-run src/scripts/orchestration_savings_report
grep --line-number -rE 'first_pass_success|escalated' src/scripts/hooks/
```

The audit, ledger, and transcript paths are gitignored runtime / host state, so
the counts above are this machine on this date and are not reproducible from the
tree alone. The four `file:line` citations into `src/` are.
