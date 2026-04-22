# Subagent Configuration

Loaded by the `subagent-orchestration` skill and the `/do-and-judge`,
`/do-in-steps`, and `/judge` commands. Describes how the three
`subagents.*` keys in `.agent-settings.yml` are resolved at runtime.

## Settings

| Key | Default | Purpose |
|---|---|---|
| `subagents.implementer_model` | _(empty → session model)_ | Model alias used for implementer subagents |
| `subagents.judge_model` | _(empty → one tier up)_ | Model alias used for judge subagents |
| `subagents.max_parallel` | `3` | Hard cap on concurrent subagent invocations |

## Model tier ladder

The "one tier up" fallback walks this ladder. Session model is the
starting point; judge picks the tier above.

```
haiku  →  sonnet  →  opus
```

If the session runs on **opus**, judge stays on opus (no higher tier
available). If the session runs on **sonnet**, judge defaults to opus.
If the session runs on **haiku**, judge defaults to sonnet.

## Resolution order

For both implementer and judge:

1. If the `.agent-settings.yml` value is **non-empty**, use it verbatim
2. If empty, apply the default (session tier for implementer, one tier
   up for judge)
3. Refuse to run if the resolved alias is unknown — list the known
   aliases and ask the user to pick

The agent must **never silently fall back** to a different model than
the user configured. An unknown alias is a configuration error.

## Parallelism

`subagents.max_parallel: 1` serializes — pipelines run step-by-step with
no concurrency. This is the recommended setting when debugging a new
command or when cost is a concern.

Values higher than 3 are allowed but cost scales linearly with
concurrent subagents. The default 3 is the sweet spot from the PoC
measurements: three parallel implementers with one judge typically
completes a multi-step task 2-3x faster than serial at ~2x the cost.

## When settings change

The `/config-agent-settings` command detects changes and re-resolves
on next invocation. There is no long-running process to restart — the
commands read `.agent-settings.yml` on each run.

## Related

- [`subagent-orchestration`](../skills/subagent-orchestration/SKILL.md) — the skill
- [`model-recommendations`](model-recommendations.md) — tier definitions
- [`/do-and-judge`](../commands/do-and-judge.md), [`/do-in-steps`](../commands/do-in-steps.md), [`/judge`](../commands/judge.md) — commands that read these keys
