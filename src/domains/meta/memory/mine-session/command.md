---
model_tier: medium
name: memory-mine-session
pack: memory
tier: 2
visibility: internal
cluster: memory
sub: mine-session
description: The single session-mining command — mine the cross-host chat-history log (or a host transcript) for memory signals AND/OR rule/skill proposal seeds via --mode=[signals|proposals|both]. Preview-by-default, opt-in access. Folds in the former /chat-history learn.
skills: [memory-consolidation, file-editor]
suggestion:
  eligible: false
  rationale: "Reads transcript files — opt-in, per-invocation confirmation required."
workspaces:
  - agent-config-maintainer
packs:
  - memory
---

# /memory mine-session

The **single session-mining command**. Runs the **GATHER SIGNAL** phase of
the [`memory-consolidation`](../../skills/memory-consolidation/SKILL.md) loop
against the **cross-host chat-history JSONL log**
(`agents/runtime/.agent-chat-history`, written by platform hooks on every
host) — falling back to the per-host Claude-Code transcript when the log is
absent — and surfaces normalised project-scoped facts as a preview.

`--mode` selects the output:

- **`signals`** (default) — normalised facts → intake preview / `--commit-intake`.
- **`proposals`** — frames the facts as candidate rule/skill learnings, then
  run [`learning-to-rule-or-skill`](../../skills/learning-to-rule-or-skill/SKILL.md)
  on each seed to draft proposals. **This folds in the former
  `/chat-history learn`.**
- **`both`** — render signals + proposal seeds together.

No file is written without `--commit-intake`. No source is read without
`--confirm-transcript-access`.

## When to use

- After a multi-day implementation, before the conversation history
  rotates out of context.
- The user says "mine my recent sessions" or "consolidate what we've
  decided".
- The `/memory load` inline-review block flagged > 10 unreviewed signals
  and the user wants to add fresh ones from the live transcript before
  promoting.

Do NOT use as an automatic post-session hook. Mining is per-invocation
and confirmed.

## Flags

| Flag | Default | Purpose |
|---|---|---|
| `--mode <signals\|proposals\|both>` | `signals` | Output selector. `signals` → intake facts; `proposals` → proposal seeds for `learning-to-rule-or-skill`; `both` → both. |
| `--source <auto\|chat-history\|claude-code>` | `auto` | `auto` prefers the cross-host chat-history log, then the Claude-Code transcript. |
| `--since <ISO-date>` | 14 days ago | Only mine turns at or after this date. Re-anchors relative phrases like "yesterday" with `YYYY-MM-DD`. |
| `--confirm-transcript-access` | off | Opt-in gate. Without it, the miner reads zero turns and prints the opt-in hint. Per-invocation, not persistent. |
| `--preview` | on | Render to stdout. No file write. Default behaviour. |
| `--commit-intake` | off | `signals` only. Append normalised facts to `agents/memory/intake/<primary-tag>.jsonl`. |
| `--host <name>` | auto-detect | Labels the source host. The chat-history log is cross-host, so any host mines via it; `claude-code` additionally resolves the local transcript fallback. |

## Steps

### 1. Verify opt-in

If `--confirm-transcript-access` is absent, print:

```
> Mining reads your session transcript files. Re-run with
> --confirm-transcript-access to proceed. The flag is per-invocation
> and not persisted.
```

Then exit with code 0. **Do not read any file.**

### 2. Resolve TranscriptAdapter

Auto-detect the host (Claude Code → `~/.claude/projects/<repo>/sessions/*.jsonl`).
If auto-detect fails or `--host` names an unimplemented adapter, print:

```
> No TranscriptAdapter for host=<name>. Phase 1 supports: claude-code.
> Use /memory propose to record signals manually.
```

Then exit with code 0.

### 3. Stream + extract

Iterate transcript turns within the `--since` window through the four
signal regex families documented in
[`memory-consolidation`](../../skills/memory-consolidation/SKILL.md)
§ Phase 2. For each match, normalise the fact (strip pronouns, IDE
chrome, timestamps, turn-id) and assign a primary tag from the
schema-routing table.

If the normalised count exceeds 5, **stop after the 5th** and print:

```
> ⚠️  Miner produced > 5 facts. Tighten patterns or narrow --since.
>     Showing the first 5; the rest are dropped.
```

This is the strict-gate exit per the skill's exit criteria.

**Failure-mode review lens** (adapted from MemSkill, Apache-2.0). Before
emitting a fact, ask which failure it prevents — and drop it if it prevents
none:

- **Storage failure** — a durable fact the next agent will need was never
  written. Capture it.
- **Retrieval failure** — the fact exists but its `key` / anchor path won't
  match how a future skill queries. Fix the anchor, don't duplicate.
- **Quality failure** — the fact is too vague or narrative to act on. Sharpen
  it to one durable PATTERN / INVARIANT / GOTCHA, or drop it.

### 4. Render preview

Print one Markdown block to stdout:

```
## Mining preview — <project> · <window> · host=<name>

| # | Tag | Key | Observation | Source turn |
|---|---|---|---|---|
| 1 | convention | <symbol> | <one-line fact> | <ts> |
| 2 | gotcha     | <path>   | <one-line fact> | <ts> |

Schemas touched: conventions, operational-gotchas
Stale curated entries (last_validated > 90d, not seen in 30d): <list or "none">
```

If `--preview` (default), stop here.

### 5. Commit (only with `--commit-intake`)

Append each fact as one JSONL line to
`agents/memory/intake/<primary-tag>.jsonl` with the contract fields:
`ts`, `type`, `key`, `observation`, `source: agent`,
`session_id`, plus the optional `tags: [<one>, <two>]` field.

Confirm:

```
✅ Appended <N> intake lines across <M> files.
   Next: /memory promote to lift validated lines into curated YAML.
```

## Safety

- **Never** writes outside `agents/memory/intake/`.
- **Never** reads transcripts without `--confirm-transcript-access`.
- **Never** synthesizes facts. The miner is a strict gate against
  the four regex families; if zero matches → prints "no signals".
- **Never** auto-promotes. `/memory promote` is a separate, validated
  step.

## Gotcha

- `--commit-intake` and `--preview` are mutually exclusive. Passing
  both → exit with usage error.
- The `TranscriptAdapter` strips IDE chrome (tool-call boilerplate,
  reasoning blocks, system reminders) before pattern matching. If the
  miner under-counts, audit the adapter's redact list, not the regex.
- Date-discipline: relative phrases (`yesterday`, `last week`) in the
  observation field are rejected by `scripts/check_memory.py` unless
  re-anchored with `YYYY-MM-DD` within ±20 chars. The miner re-anchors
  automatically using the turn's `ts`; verify before commit.

## See also

- [`memory-consolidation`](../../skills/memory-consolidation/SKILL.md) — the
  four-phase loop (ORIENT → GATHER → CONSOLIDATE → PRUNE) this command
  implements GATHER SIGNAL for.
- [`memory:propose`](propose.md) — manual fallback when no
  `TranscriptAdapter` matches the current host.
- [`memory:promote`](promote.md) — lifts validated intake lines into
  curated YAML.
- [`memory-access`](../../../docs/guidelines/agent-infra/memory-access.md) —
  file-backed retrieval contract for curated + intake entries.
