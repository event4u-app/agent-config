<!-- evidence-type: analysis -->

# Spike s01 — does a tool event name the invoked skill?

**Date:** 2026-08-18
**Roadmap:** [road-to-org-telemetry.md](../../roadmaps/road-to-org-telemetry.md) Phase 0
**Tree:** `851568b5c` (branch base `origin/main`)
**Host stamp:** Claude Code 2.1.234 · model `claude-opus-5[1m]` · node v25.9.0
**Pre-registered branch:** the step names its own fallback — "If it does not, the
design falls back to a transcript scan at session end and the per-invocation
precision claim is withdrawn rather than weakened."

## Verdict — PASS

A real `post_tool_use` envelope identifies the tool as `Skill`, and a real
`Skill` invocation carries the skill's own name in `tool_input.skill`. The
per-invocation precision claim stands; the transcript-scan fallback is not
needed.

| Metric | Target | Observed | Verdict |
|---|---|---|---|
| `tool_name` present in real post-tool envelopes | yes | 14,171 records, 18 distinct tools | PASS |
| a Skill invocation produces such an event | yes | **22** records with `tool: "Skill"` | PASS |
| skill name present in the tool input | yes | **164 / 164** carry `input.skill` | PASS |
| `tool_input` delivered at the same slot | yes | 182 real trips off `tool_input.command` | PASS |

## Evidence

**1 — `tool_name` and the Skill event, read off live host envelopes.** The
`tool-result-bytes` concern is bound on claude's `post_tool_use`
(`src/scripts/hook_manifest.yaml:769`) and appends one line per event to
`agents/runtime/state/tool-result-census.jsonl`. That file is session state on
the maintainer machine, not a fixture. Its 14,171 lines carry 18 distinct
`tool_name` values:

```
 11141  'Bash'      1505  'Edit'       877  'Read'       358  'Write'
   141  'Agent'       36  'ToolSearch'  22  'Skill'       18  'TaskOutput'
    16  'TaskStop'    14  'Monitor'      9  'ListAgents'   8  'AskUserQuestion'
     8  'EnterWorktree' 6 'TaskUpdate'   5  'SendMessage'  4  'TaskCreate'
     2  'WebFetch'     1  'TaskList'
```

A Skill invocation therefore does reach the slot, and the envelope names it.

**2 — the skill's own name, read off real invocations.** 283 session files
across the 48 `~/.claude/projects/` slug directories of this repository contain
**164** assistant `tool_use` blocks named `Skill`. Every one carries `skill` in
its `input` object — two key sets, no third:

```
   135  {args,skill}
    29  {skill}
```

17 distinct skills, led by `roadmap:process-full` ×64, `worktree:create` ×30,
`roadmap-process-full` ×22, `roadmap-writing` ×17, `using-git-worktrees` ×12.

**3 — `tool_input` is delivered, not just documented.** Three independent live
records, none of them a fixture:

- `pr-url-reminder` is a `post_tool_use` concern whose fire condition reads
  `payload.tool_input.command` (`src/scripts/pr_url_reminder_hook.ts:89`), and
  `agents/runtime/state/rule-trips.json` records **182 warns**, last 2026-08-18.
- `block-no-verify` reads the same field on `pre_tool_use`: **339 blocks**.
- `reread-guard` persisted `.claude/worktrees/evidence-typing/.worktree-scope.md`
  during *this* session — a path that exists only in a real `tool_input.file_path`.

On the transcript side the same passthrough is visible at scale: `file_path` is
present on 16,290 of 16,291 `Read`/`Write`/`Edit` blocks.

## What is observed and what is one step removed

The census records `tool_name` but not `tool_input.skill`, so no single artefact
in the tree shows a Skill envelope's `tool_input` directly. The conclusion rests
on (2) — the field is present in 164/164 real invocations — plus (3) — the same
`tool_input` object reaches this exact slot. That is a two-legged argument on
real data rather than a direct read, and it is graded here instead of being
stated as if it were one.

**The one-line change that would close it** is adding `skill` to the census
line. It is not made here: this phase's rollback is "spikes are scratch-only;
nothing ships", and the emission schema belongs to Phase 1.

## Finding that changes Phase 1 — the same skill arrives under two spellings

`roadmap:process-full` (64) and `roadmap-process-full` (22) are one skill under
two spellings, as are `roadmap:ai-council` / `roadmap-ai-council`. Both forms
are what the host actually sends. A Phase 1 schema that stores `input.skill`
verbatim will split per-skill counts across spellings and undercount the busiest
skills by roughly a quarter on this sample. Normalisation belongs in the
emitter, before the record is written — not in the report, which would leave the
raw records ambiguous.

## Consequence for the roadmap

- Phase 0 step 1: **closed, PASS.** The fallback branch does not fire.
- Phase 1 step 2 ("append Class-A usage records … on the tool event confirmed by
  the first spike") has its confirmed event: `post_tool_use`, `tool_name ==
  "Skill"`, name from `tool_input.skill`.
- Phase 1 gains one requirement this spike surfaced: normalise the skill name.

## Reproduction

```bash
# tool_name distribution over live envelopes
python3 - <<'EOF'
import json, collections
c = collections.Counter()
for line in open('agents/runtime/state/tool-result-census.jsonl'):
    line = line.strip()
    if line:
        c[json.loads(line).get('tool')] += 1
print(c.most_common())
EOF
# the transcript arm is the same scan s03 documents (§ Reproduction there)
```
