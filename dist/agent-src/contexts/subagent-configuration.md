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
starting point; judge picks the tier above. The ladder is written in
**bands**, not vendor models — the package keeps exactly one tier→model
mapping and it lives in
[`model-recommendations`](model-recommendations.md) (ADR-035 § 3). A
second per-vendor ladder here would be the two-clocks drift ADR-232 was
careful not to create.

```
lite  →  medium  →  high
```

If the session runs at **`high`**, judge stays at `high`. If the session
runs at **`medium`**, judge defaults to `high`. If the session runs at
**`lite`**, judge defaults to `medium`.

### The judge cap (binding)

```
THE JUDGE LADDER STOPS AT `high`. IT NEVER CLIMBS TO `frontier`.
A SATURATED LADDER ESCALATES CROSS-VENDOR VIA THE COUNCIL —
NEVER INTO A SECOND SAME-VENDOR TOP-BAND AGENT.
```

`frontier` (ADR-232) sits above `high` in the vocabulary, so a naive
"one tier up" would now resolve a `high` implementer's judge to
`frontier` and buy the most expensive band available for every
verification pass. The cap forecloses that: `frontier` is opt-in by
declaration only, on both the implementer and the judge side.

**What to do when the ladder saturates.** A `high` implementer's judge
is also `high`, so the verification is same-band — the reviewer is no
stronger than the author, which is the condition the one-tier-up rule
existed to avoid. The answer is *different vendor*, not *bigger model*:

- Route the saturation case through
  [`ai-council`](../skills/ai-council/SKILL.md), which polls models
  outside the host session (Anthropic + OpenAI) and is therefore
  genuinely independent of the implementer's framing.
- This is the escalation **instead of** a second top-band context, not
  in addition to one. Two same-vendor top-band agents on one task cost
  twice and correlate their blind spots; a second vendor costs less and
  disagrees for real reasons.
- Cost boundary unchanged: the council is a network call and is
  therefore never automatic. It is what the saturation case escalates
  *to* when a second opinion is wanted, not a step every `high` task
  takes ([`ai-council`](../skills/ai-council/SKILL.md) § Do NOT use).

**Honest scope.** This is policy prose in a context file — it binds the
agent that reads it and no gate re-derives a judge tier at dispatch
time. `enforced_by: none`, stated rather than implied.

**Downshift never touches the judge.** When cost-aware routing runs an
implementer on a downshifted tier (per the category → tier defaults in
[`model-recommendations § Subagent Category → Tier Defaults`](model-recommendations.md)),
the judge still resolves one tier above the IMPLEMENTER's resolved tier,
**capped at `high` per the judge cap above** — so a `lite` implementer
gets at least a `medium` judge, and no implementer tier resolves a
`frontier` judge. Downshifting an implementer never downshifts its judge
below what the verify contract requires, and a judge is never `lite`.

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

Edits to `.agent-settings.yml` (manual or via the agent) take effect
on the next invocation — there is no long-running process to restart.
The commands read `.agent-settings.yml` fresh on each run.

## Related

- [`subagent-orchestration`](../skills/subagent-orchestration/SKILL.md) — the skill
- [`model-recommendations`](model-recommendations.md) — tier definitions
- `guideline:agent-infra/model-recommendation` § Orchestrator → subagent model routing — per-subtask model right-sizing (downgrade easy work, keep the strong model for hard)
- [`/do-and-judge`](../commands/do-and-judge.md), [`/do-in-steps`](../commands/do-in-steps.md), [`/judge`](../commands/judge.md) — commands that read these keys
