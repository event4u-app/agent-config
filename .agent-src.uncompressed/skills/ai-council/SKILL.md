---
name: ai-council
description: "Use when polling external AIs (OpenAI, Anthropic) outside the host session for a neutral second opinion on a roadmap, diff, prompt, or file set — or 'cross-check with another model'."
source: package
---

> **Experimental.** AI Council is not yet validated by external users. API costs apply per consultation.

# ai-council

## When to use

* The host agent has drafted a roadmap, plan, or design and wants an
  **external** critique that is not biased by its own framing.
* The user asks "what would Claude / GPT say about this?" or invokes
  `/council`.
* A PR diff or commit range needs a second-opinion review beyond the
  internal four-judge pass.
* A free-form proposal benefits from being challenged by an outside
  reviewer before it calcifies into work.

Do NOT use when:

* The decision is internal-only and budget matters more than diversity
  of opinion → use `subagent-orchestration` (in-session, no network,
  no money).
* The artefact contains secrets that cannot be redacted with the
  bundler's pattern set → ask the user before sending.
* The user has not configured any council member → state that and stop;
  do not silently fall back to anything.

## Goal

Bring in **independent** external models to critique a project
artefact. Independent means: the council members never see the host
agent's reasoning, internal state, or framing language — only the
artefact (roadmap, diff, prompt, file set) plus a neutral system
prompt that asks them to think on their own merits.

## Neutrality guidelines (Iron Law)

```
THE COUNCIL DOES NOT SEE THE HOST AGENT'S ANALYSIS.
THE COUNCIL DOES NOT SEE PRIOR REPLIES.
THE COUNCIL SEES THE ARTEFACT + THE NEUTRAL SYSTEM PROMPT. NOTHING ELSE.
```

If you find yourself wanting to "frame" the artefact for the council,
stop. Framing is exactly what kills the second-opinion value. Use the
unbiased system prompts in `scripts/ai_council/prompts.py`; do not
roll your own.

### Neutrality — context-handoff

External reviewers do better critique when they know **what the
project is**, not just what the artefact looks like. The council
ships a neutral **handoff preamble** (modelled on `/agent-handoff`)
in front of every member's system prompt, assembled by
`prompts.handoff_preamble(project, original_ask)`:

| Carried | Forbidden |
|---|---|
| Project name (from `composer.json` / `package.json` / repo dir) | Host-agent identity (Augment, Claude Code, Cursor, Cline, Windsurf, Copilot agent) — stripped line-by-line before send |
| Stack one-liner inferred from manifest files | Host-agent reasoning, prior turns, internal analysis |
| One paragraph of repo purpose from `README.md` (max 400 chars) | Host-agent framing language ("I think this looks weak", "the user probably wants…") |
| The user's **original ask** verbatim (the free-form sentence that triggered `/council`) | Anything the host agent generated about the artefact |

`detect_project_context()` in `scripts/ai_council/project_context.py`
reads only the manifest files + root README; missing fields collapse
to `None` and the preamble silently omits the line. With both
`project=None` and `original_ask=""`, the preamble degrades to the
bare `NEUTRALITY_PREAMBLE` (v1 shape — back-compat for callers that
have not migrated yet).

## Execution modes

A council member can run in one of three transports. The neutrality
preamble is identical across all of them — only the path the bytes
travel changes.

| Mode | Client | Billable | Transport | Status |
|---|---|---|---|---|
| `api` | `AnthropicClient` / `OpenAIClient` | yes | provider SDK + key from `~/.config/agent-config/<provider>.key` | shipped |
| `manual` | `ManualClient` | no | `stdout` (prompt block) + `stdin` (user pastes the web-UI reply, terminated by a line containing only `END`) | shipped (Phase 2b) |
| `playwright` | `PlaywrightClient` | no | persistent-profile browser at the provider's chat URL via DOM adapter | reserved (Phase 2c — capture-only) |

Resolution lives in `scripts/ai_council/modes.py`:
`resolve_mode(name, invocation_mode, member_settings, global_mode)`
with precedence **invocation flag > per-member setting > global
setting > default (`api`)**. Whitespace-and-case insensitive; empty
strings fall through; unknown values raise `InvalidModeError` with
the offending settings path (`ai_council.mode`,
`ai_council.members.<name>.mode`, or `/council mode=`).

### Manual-mode UX

`ManualClient` is the user-as-transport variant: the agent prints
one Markdown block per member (system prompt + handoff preamble +
artefact between two `═` rules), the user pastes it into a web
chat (Claude.ai, ChatGPT, Gemini), then pastes the reply back
ending with a line containing only `END`. After each reply, a 1/2/3
menu surfaces:

1. More feedback for this member (continue this thread)
2. Done with this member, move to the next
3. Abort the council run

`1` re-emits a follow-up block addressed to the **same chat
thread** (no system prompt repetition). `2` records the round and
moves to the next member. `3` returns `error="manual_aborted"` for
that member and the orchestrator stops the fan-out.

### Cost-gate bypass for non-billable members

`ExternalAIClient.billable` is the contract. Clients with
`billable=False` (today: `ManualClient`; future: `PlaywrightClient`)
bypass the cost gate entirely — the orchestrator skips the
projection check, the `on_overrun` callback, and the USD-budget
short-circuit for that member, but still records the response's
token counts (from the manual-paste length heuristic or the
provider's reply, when available) for observability. Mixed runs
(one manual + one api) gate only the api members.

## Procedure

1. **Resolve target.** Identify the artefact mode (`prompt`, `roadmap`,
   `diff`, `files`) and locate the source. Refuse to proceed if the
   target is ambiguous.
2. **Bundle + redact.** Call `scripts/ai_council/bundler.py` to produce
   a redacted artefact bundle. If `BundleTooLarge` fires, surface the
   size and ask the user to narrow scope — do NOT truncate silently.
3. **Confirm spend.** Before any network call, surface members + cost
   ceiling and require an explicit user `1` to proceed. Autonomy
   settings do not override this gate.
4. **Fan out.** Dispatch the bundle to each enabled council member via
   `scripts/ai_council/orchestrator.py`. Each member receives the
   neutrality preamble from `prompts.py` plus the artefact — nothing
   from the host agent's prior reasoning.
5. **Render results.** Stack each member's response under its own
   provider-attributed heading. Never merge or paraphrase responses
   into the host agent's voice.
6. **Summarise.** Write a `Convergence / Divergence` block listing
   agreements, disagreements, and unique insights — provider-attributed.
7. **Translate to options.** Convert actionable council suggestions
   into concrete numbered options for the user. The user decides;
   the council advises.

## Output format

Every council reply MUST contain, in this order:

1. **Header line** with mode, member count, and total token cost.
2. **One section per member**, titled `### <provider> · <model>`,
   containing the member's verbatim output.
3. **Convergence / Divergence summary** — bullet list, every claim
   attributed by provider name.
4. **User-facing options** — numbered block per `user-interaction`,
   with "discard council input" always present as an option.

The host agent NEVER ships council output as its own reasoning.
Provider attribution stays visible in every render.

## Do NOT

- Do NOT paraphrase council output into the host agent's voice — strip
  attribution and you've stripped the value.
- Do NOT pre-warm the council with the host agent's analysis or
  identity — that primes the reviewer and collapses diversity.
- Do NOT silently truncate a too-large bundle — surface the size and
  ask for narrower scope.
- Do NOT auto-spend tokens under `personal.autonomy: on` — the cost
  gate fires every time, no exceptions.
- Do NOT reuse SDK clients across invocations — re-load keys via
  `load_*_key()` each call.

## Gotchas

Real failure modes seen in the wild:

- **Bias-by-framing:** agent pastes "I think X is the right answer,
  what do you think?" → council rubber-stamps. Symptom: 100%
  convergence, zero unique insight. Fix: send artefact only, neutral
  preamble, no host reasoning.
- **Silent budget overrun:** `cost_budget_exceeded` mid-fan-out, agent
  retries one member to "complete" the council. Result: skewed sample,
  hidden spend. Fix: surface partial result, stop, ask user.
- **Identity leak:** roadmap text contains "the agent decided…" —
  reviewer infers host model and mirrors it. Fix: redact host-agent
  identity strings before bundling.

| Anti-pattern | Why it's wrong | Correct approach |
|---|---|---|
| "Pre-warm" the council with the agent's own analysis. | Bias attack — collapses the reviewer to a yes-man. | Send the artefact text only. |
| Paste the host-agent identity ("I am Augment / Claude Code…") | Identity primes the reviewer's model. | Neutrality preamble in `prompts.py` already handles this. |
| Silently truncate a too-large bundle. | Misleads the reviewer into thinking they saw the whole thing. | Bundler raises `BundleTooLarge`; surface and ask for narrower scope. |
| Reuse the same SDK client across calls without re-loading the key. | Leaks the key in long-lived process state. | Each invocation builds fresh clients from `load_*_key()`. |
| Auto-spend tokens under `personal.autonomy: on`. | Autonomy ≠ permission to spend money. | Always ask before consultation, even under autonomy. |

## Redaction expectations

The bundler's redaction pass strips:

- Paths matching `~/.config/agent-config/*.key`.
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
  `~/.config/agent-config/council-spend.jsonl` (mode 0600). Breach
  fires `on_overrun(event)` with `event.breach_kind == "daily"` and,
  if the callback returns False or is absent, tags the member
  `daily_budget_exceeded` instead of `cost_budget_exceeded`.

Prices come from `.agent-prices.md` (gitignored, refreshed weekly).
The pricing module bootstraps it from `_default_prices.py` on first
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
> 1. Refresh now (`python3 scripts/update_prices.py`)
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

## Multi-round debate (`rounds:N`)

`consult(..., rounds=N)` enables 2-3 round critique loops. Round 1
runs the standard single-round flow. Round 2+ rebuilds the user
prompt as `<original artefact> + <prior round, anonymised>` so each
member can refine, agree, or push back on the previous critique
without seeing which provider produced which point.

| Property | Behaviour |
|---|---|
| Anonymisation | Provider/model identity is stripped. Reviewers are labelled `Reviewer A / B / C…` in input order. |
| Errored prior responses | Skipped — they reveal nothing useful and can leak provider error formats. |
| Cost budget | Accumulates across rounds. A round-2 call that breaches the cap fires `on_overrun` exactly like a round-1 breach. |
| Daily limit | Same — every billable round-2 call records spend in the rolling 24h ledger. |
| Return value | Final round only. Use `on_round_complete(round_idx, responses)` to capture intermediate rounds for rendering. |

> Iron Law: anonymisation is non-negotiable. If you ever need to
> surface "which model said what" between rounds, that is a different
> feature — debug-only, off by default, never enabled in user-facing
> output. The neutrality contract dies the moment a member learns it
> is talking to Claude vs GPT in round 2.

Pre-call estimate must surface the round count: total = `N × single-round cost`. Render inline:

```
External council call — billable · 2 rounds
Round 1: artefact only
Round 2: artefact + anonymised round 1 critiques

| member             | per-round | × 2     |
|--------------------|----------:|--------:|
| anthropic/sonnet   |   $0.0176 | $0.0352 |
| openai/gpt-4o      |   $0.0121 | $0.0242 |
| **total**          |           | $0.0594 |
```

## See also

- `/council` command — the user-facing entry point.
- `subagent-orchestration` skill — internal multi-agent variant (no
  network, no spend, but no diversity of weights either).
- `scripts/ai_council/prompts.py` — neutrality preamble + per-mode
  system prompts.
- `scripts/ai_council/bundler.py` — redaction pattern set + size
  guard.
- `docs/customization.md` § `ai_council.*` — settings reference.
