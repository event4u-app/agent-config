# API Cost Levers

Reference material for a downstream AI-coding agent that wants to cut its own
Claude API dollar bill. Four platform-level billing levers, the exact economics
of each, and how they interact. Read on demand — not always-loaded.

Facts sourced from the in-repo `claude-api` plugin skill plus platform research
(2026-07-14). Do not invent an API shape beyond what is stated here.

## The four levers at a glance

| Lever | Cuts | Best for | Watch out for |
|---|---|---|---|
| Prompt caching | Repeated input tokens | Stable prefix reused across calls (system prompt, tools, repo map) | Any byte change in the prefix invalidates the rest |
| Batch API | 50% input + output | Non-interactive bulk work (classification, summarization, evals) | Async, up to 24h, results unordered |
| Model tiering | Per-token price | Routine work on a cheaper model | Switching model is a cache miss |
| Effort / output sizing | Thinking + output tokens | Routine turns that don't need deep reasoning | Oversized `max_tokens` risks runaway output |

## 1. Prompt caching

Put the large, byte-**stable** context first — system prompt, tool definitions,
a corpus or repo map, few-shot examples — behind a
`cache_control: {type: 'ephemeral'}` breakpoint. Keep volatile content (the
varying question, timestamps, per-request IDs) **after** the last breakpoint.
The cache is a **prefix match**: any byte change in the cached prefix
invalidates everything after it. Render order is tools then system then
messages.

Caching is GA — **no beta header needed**.

Economics:

- Cache reads cost approximately 0.1x the base input price.
- Cache writes cost 1.25x (5-minute TTL) or 2x (1-hour TTL).
- Break-even is after **one** read on the 5-minute TTL.

Constraints:

- The minimum cacheable prefix is model-dependent (approximately 1024–4096
  tokens). Shorter prefixes silently do not cache.
- The cache is workspace-isolated (since February 2026).

Verify a hit with `usage.cache_read_input_tokens > 0`.

```json
{
  "system": [
    { "type": "text", "text": "<large stable system prompt>",
      "cache_control": { "type": "ephemeral" } }
  ],
  "messages": [
    { "role": "user", "content": "<the varying question>" }
  ]
}
```

## 2. Batch API

For **non-interactive, non-latency-sensitive bulk work** — bulk classification,
mass file summarization, eval runs. Not chatbots or interactive assistants.

- **50% off both input and output tokens.**
- Async: results within 24h (usually much less), keyed by `custom_id`, arriving
  **unordered** — key results by `custom_id`, never by position.
- **Stacks with prompt caching**: a cached-batch input token can reach
  approximately 0.05x the standard input price.

## 3. Model tiering

Treat models like a team — a cheap model for mechanical or routine work, the
expensive model only for hard judgment. Approximate input / output price per 1M
tokens:

| Model | Input | Output |
|---|---|---|
| Haiku | $1 | $5 |
| Sonnet | $3 | $15 |
| Opus | $5 | $25 |
| Fable | $10 | $50 |

Opus input is approximately 5x Haiku. Tier by task **difficulty**, not blindly:
a cheaper model that gives wrong answers on judgment tasks costs correction
cycles, which erases the saving.

**Interaction with caching.** The prompt cache is keyed by `(model, prefix)`, so
switching a call to a cheaper model is a cache **miss**. Weigh the downgrade
saving against the lost cache-read saving before routing a cached call to a
different model.

## 4. Effort and output right-sizing

- `output_config.effort` (low through max) controls thinking and output depth,
  and therefore spend. Dial effort **down** on routine turns; reserve high / max
  for hard reasoning.
- Right-size `max_tokens` — do not leave a huge ceiling. An unrealistically
  large `max_tokens` does not cost tokens by itself, but it risks runaway output
  and defeats pre-flight budgeting.

## When to reach for which

| Situation | Lever |
|---|---|
| Same large context reused across many calls | Prompt caching |
| Thousands of independent, non-urgent jobs | Batch API (+ caching) |
| Turn is mechanical / narrow / well-specified | Cheaper model tier |
| Turn is routine and does not need deep thinking | Lower `effort` |
| Output could balloon unnecessarily | Cap `max_tokens` |
| Interactive latency matters | Caching + tiering; not Batch |

## Claude Code note

In Claude Code, prompt caching is automatic for the **main loop** — resending
the same context prefix is cheap, so keeping a stable prefix pays off without
any explicit `cache_control`. The session-level hygiene levers are `/clear`
and `/compact` to shed accumulated context, plus subagent delegation for
verbose output so it never lands in the main context window.

**Subagents and forks pay a different cache economy — verified against host
version 2.1.220 (2026-07-30), re-check on drift:**

- A **named subagent** starts its own conversation with its own system
  prompt and tool set. It builds its own cache from scratch, so its **first
  call has no cache hit** — the entire per-spawn preamble (rules, tools,
  dispatch prompt) is a cold write. Subagents use the **five-minute TTL**
  even on a subscription; there is no per-agent setting to change that (see
  `## Known upstream costs` below).
- A **fork** inherits the parent's system prompt, tools, and conversation
  history exactly, so its first request **reads the parent's cache** instead
  of writing a fresh one — the only documented mechanism that shares a cache
  across a dispatch boundary. Forking forces background mode, which changes
  the tool set and therefore invalidates the very prefix that motivated the
  fork; weigh that cost before reaching for it — see the fork-vs-subagent
  ordering rule in See also.
- Either way, the **cold-start preamble is re-written on every spawn** — the
  always-loaded rule set, the tool definitions, and the dispatch prompt are
  not shared across separate subagent instances. Fan-out (many subagents
  from one parent) multiplies this cost by cohort size; see
  `## Known upstream costs` below for the fan-out re-prefill issue this
  package cannot fix.

## Known upstream costs

Host-controlled behaviour this package has confirmed but cannot change at
any layer. Each entry carries the host version observed and the command to
re-verify it — a stale entry degrades into a dated observation, never a
false promise, when Anthropic changes the behaviour underneath it.

| Cost | Observed on | Re-verify |
|---|---|---|
| Fan-out (`do-in-parallel`-shaped dispatch) re-prefills the parent-accumulated context **per child** — the waste scales linearly with fan-out width, worst exactly where fan-out is most valuable (anthropics/claude-code#81389, open). No fix at any layer. | Claude Code 2.1.220, 2026-07-30 | `claude --version`; re-check the linked issue for a status change |
| Host-dispatched subagents are pinned to the **five-minute** cache TTL regardless of subscription tier or any environment variable; `ENABLE_PROMPT_CACHING_1H` does not apply to them. | Claude Code 2.1.220, 2026-07-30 | `claude --version`; re-check the official caching docs for a subagent-TTL setting |

Neither entry implies a package-side fix exists or is planned — both are
request-construction facts inside the host binary, outside this package's
reach. This package's own scope is measurement and payload size (what it
authors), never subagent request construction (what the host authors).

## See also

- [`cache-economy-refusals`](../../../agents/settings/contexts/cache-economy-refusals.md) —
  the measured cache figures behind the Claude Code note above, plus the
  refusals (no interception proxy, no blanket 1h TTL, no cache-hit auto-tuning)
  recorded so they are not rebuilt.

- [`model-recommendation.md`](model-recommendation.md) — tier routing (the
  capability band behind lever 3).
- [`size-and-scope.md`](size-and-scope.md) — token discipline for the artifacts
  that become the cached prefix.
- [`subagent-orchestration/prompts/README.md`](../../../src/skills/subagent-orchestration/prompts/README.md)
  § Prompt-cache discipline — sibling-uniformity rules and the
  fork-vs-subagent dispatch ordering that follow from this cache economy.
- [`docs/contracts/ai-council-config.md`](../../contracts/ai-council-config.md)
  § `prompt_cache.ttl` — the one surface where this package DOES control a
  cache-control TTL (the council's own Anthropic calls, never host subagents).
- The Claude Code `claude-api` plugin skill (external, not vendored here) — the
  authoritative, versioned API reference these figures derive from; re-check it
  when Anthropic pricing or the caching/batch surface changes.
