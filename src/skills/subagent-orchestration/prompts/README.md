# Subagent dispatch prompts

One file per mode in [`SKILL.md`](../SKILL.md) § *The seven modes*. Each
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

## Contract

Every prompt cites the status taxonomy in
[`../schemas/subagent-status.json`](../schemas/subagent-status.json) and
ends with the **return-envelope** instruction so the subagent's reply
validates against `tests/test_subagent_status_schema.py`.

## Prompt-cache discipline

When dispatching sibling subagents (e.g. `do-in-parallel` with N independent
slices), **reuse a stable system-prompt prefix** across all siblings. Keep
task-invariant text (role declaration, constraints, status enum, return-envelope
instruction) in the prefix; put only the slice-specific `TASK:` and
`CONTEXT FILES:` in the variable section. This maximises host-side prompt-cache
hits (Anthropic `cache_control: ephemeral`) across the cohort — the prefix is
cached after the first sibling and served from cache for the rest, cutting
input-token cost proportionally to cohort size.

## Loading

`tests/test_subagent_prompt_loading.py` asserts that every mode named
in `SKILL.md` § *The seven modes* has a loadable prompt file under this
directory and that each prompt mentions all four status enum values.
