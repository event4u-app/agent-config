# ai-council — cost awareness and redaction

> Mode body of the [`ai-council`](../SKILL.md) skill (router-head retrofit,
> 2026-08-20). Content moved VERBATIM from SKILL.md — load this file when the
> mode table in SKILL.md routes here.

## Redaction expectations

The bundler's redaction pass strips:

- Paths matching `~/.event4u/agent-config/*.key` and the legacy
  `~/.config/agent-config/*.key`.
- Lines starting with `Authorization:`.
- `key = …`, `secret = …`, `token = …`, `password = …` assignments.
- `sk-ant-…` and `sk-…` token-like strings.

If your artefact contains other sensitive data (customer names,
internal hostnames, contractual prose) you are responsible for
scrubbing it before bundling. The redaction pass is a **floor**, not
a ceiling.

## Cost awareness

Every consultation hits a paid API. The orchestrator enforces
per-invocation caps from `ai_council.cost_budget`:

- `max_input_tokens` / `max_output_tokens` — token caps across all members.
- `max_total_usd` — per-invocation USD ceiling. `0` disables the USD ceiling (token caps still apply).
- `max_calls` — maximum number of council members per invocation.
- `daily_limit_usd` — rolling 24h spend cap across all `/council`
  invocations. `0` disables. Persists in
  `~/.event4u/agent-config/council-spend.jsonl` (mode 0600; legacy
  `~/.config/agent-config/council-spend.jsonl` read as fallback). Breach
  fires `on_overrun(event)` with `event.breach_kind == "daily"` and,
  if the callback returns False or is absent, tags the member
  `daily_budget_exceeded` instead of `cost_budget_exceeded`.

Prices come from `agents/runtime/.agent-prices.md` (gitignored, refreshed weekly).
The pricing module bootstraps it from `_default_prices.ts` on first
use and flags it stale when older than the most recent Monday 00:00
UTC.

### Pre-call estimate format

Before the cost gate, compute `orchestrator.estimate(question, members,
table)` and render a per-member table. Heuristic: `len(text) / 4` for
input, member's `max_tokens` ceiling for output (actual spend is
usually lower).

> External council call — billable
>
> Mode: roadmap · Target: `agents/roadmaps/<name>.md` (~3 KB after redaction)
>
> | member                          | est. in / out tokens | est. USD |
> |---------------------------------|---------------------:|---------:|
> | anthropic / claude-sonnet-4-5   |      ~750 / 1024     |  $0.0176 |
> | openai / gpt-4o                 |      ~750 / 1024     |  $0.0121 |
> | **total**                       |                      | **$0.0297** |
>
> Budget: 50k in / 20k out tokens · USD ceiling: $0.50
>
> 1. Run the consultation
> 2. Cancel

### Stale price-table gate

If `pricing.is_stale(table)` returns true, ask before proceeding:

> Price table is stale (last_updated: YYYY-MM-DD)
> 1. Refresh now (`./scripts-run src/scripts/update_prices`)
> 2. Continue with the stale table
> 3. Cancel

Do not silently auto-refresh — the user keeps control.

### Mid-flow overrun callback (`on_overrun`)

The orchestrator runs members **sequentially**. Before each member
whose projected spend would breach a cap, it invokes the
`on_overrun(event)` callback. The callback returns `True` to proceed
with that member (raises the effective ceiling for THIS call only)
or `False` to skip and record `cost_budget_exceeded`. The callback
fires again for every subsequent breaching member — the user keeps
control on each step.

> Cost budget overrun — pausing before next member
>
> Member: openai / gpt-4o (member 2 of 2)
> Already spent: ~620 in / ~480 out tokens · $0.0094
> Next call estimate: ~750 in / 1024 out tokens · $0.0121
> **Projected total after this call: $0.0215** (ceiling: $0.0150)
>
> 1. Continue with this member
> 2. Skip this member (records `cost_budget_exceeded`, continues with the rest)

Without `on_overrun`, breaching short-circuits all remaining members
(v1 fallback). Do not retry silently. Surface the partial result and
ask the user.

