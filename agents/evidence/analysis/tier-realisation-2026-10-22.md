# Tier realisation — what dispatch records and transcripts say, and whether the carrier works

<!-- evidence-type: analysis -->

> **Produced on** `feat/subagent-system-2583` (from `main` @ `5653d32f32`), 2026-10-22,
> for steps 0.1 and 0.2 of `road-to-a-tier-the-dispatch-carries`. Host at reading
> time: Claude Code **2.1.308**.
>
> **One maintainer machine.** The audit store (`agents/runtime/state/audit/`) and the
> transcript root (`~/.claude/projects/`) are gitignored and local; a fresh checkout has
> neither, so the counts below cannot be re-run from the tree. The commands are given so
> they can be re-run on a machine that has them.

## Step 0.1 — the three shares over the last 14 days

Window: audit records with `ts` ≥ 2026-10-08, last record 2026-10-22T08:19Z.

| Measure | Value |
|---|---:|
| audit records in the window | 436 |
| … of them carrying an `orchestration` block | 435 |
| share with a non-null `tier_chosen` | 0 / 435 (0 %) |
| share of `lite` among those | n/a (no denominator) |
| share with `model_served` ≠ `model_requested` | n/a — `model_requested` 0 / 435, `model_served` 0 / 435 |
| `session_tier` non-null | 0 / 435 |

Every `orchestration` block in the window was written by a spawn path (`spawn_count` 1,
`route_taken` null); none was a rung-0.5 ask line, the only writer of the two model fields
today (`src/scripts/ask_transport.ts:113-114`).

**The transcripts answer the served half the record cannot.** Over the same 14 days, 443
subagent transcripts under this repository's project directories, first assistant call per
leg:

| Served model | Legs | of which `general-purpose` | `Explore` | other |
|---|---:|---:|---:|---:|
| `claude-opus-5-5` | 327 | 314 | 10 | 3 (`fork`) |
| `claude-opus-5` | 101 | 95 | 6 | — |
| `claude-haiku-5-5` | 14 | 8 | — | 6 (guide, probes) |
| `<synthetic>` | 1 | — | — | 1 (`fork`) |

So about 3 % of legs ran below the head's tier, and the record says nothing about any of
them: the legs that did run on `haiku` carry no `tier_chosen`, and no leg carries the model
it asked for.

Reproduce:

```bash
cat agents/runtime/state/audit/2026-{09,10}.jsonl | jq -c 'select(.ts >= "2026-10-08") | .orchestration // empty' \
  | jq -s '{n:length, tier:(map(select(.tier_chosen!=null))|length), req:(map(select(.model_requested!=null))|length)}'
find ~/.claude/projects -path '*agent-config*' -path '*/subagents/*.jsonl' -mtime -14 \
  | while read f; do jq -r 'select(.type=="assistant")|.message.model' "$f" | head -1; done | sort | uniq -c
```

## Step 0.2 — does a per-call model argument reach the host?

One print-mode child session on Claude Code 2.1.308, subscription login, head model `sonnet`,
in an empty scratch project carrying the shipped `ac-researcher` definition
(`docs/wedge/ac-researcher/ac-researcher.md`, `model: inherit`). The head was told to call
the Agent tool once with `subagent_type: ac-researcher` and `model: haiku`.

| Host | Definition `model` | Requested (tool input) | Served (every assistant call of the leg) | Answer |
|---|---|---|---|---|
| 2.1.308 | `inherit` | `"model":"haiku"` | `claude-haiku-5-5` (7 of 7 calls) | correct |

The carrier is honoured on this host: the per-call argument overrides a definition's
`inherit`, and every call of the leg ran on the requested model. `lite` maps to `haiku` in
`TIER_TO_CLAUDE_MODEL` (`src/scripts/_lib/model_tier.ts`), so 1.2 may name that value.

**Bounds.** n = 1 on one host version. A host build that ignores the argument would show
`served ≠ requested` here; re-run this row on every host version before trusting it.
