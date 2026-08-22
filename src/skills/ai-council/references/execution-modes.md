# ai-council — execution and degradation modes

> Mode body of the [`ai-council`](../SKILL.md) skill (router-head retrofit,
> 2026-08-20). Content moved VERBATIM from SKILL.md — load this file when the
> mode table in SKILL.md routes here.

## Execution modes

A council member can run in one of three transports. The neutrality
preamble is identical across all of them — only the path the bytes
travel changes.

| Mode | Client | Billable | Transport | Status |
|---|---|---|---|---|
| `api` | `AnthropicClient` / `OpenAIClient` / `GeminiClient` / `XAIClient` / `PerplexityClient` | yes | provider SDK + key from `~/.event4u/agent-config/<provider>.key` (legacy `~/.config/agent-config/<provider>.key` read as fallback) | shipped |
| `manual` | `ManualClient` | no | `stdout` (prompt block) + `stdin` (user pastes the web-UI reply, terminated by a line containing only `END`) | shipped (Phase 2b) |
| `cli` | `AnthropicCliClient` / `OpenAICliClient` / `GeminiCliClient` | no (subscription-authed) | local subprocess against the vendor CLI (`claude`, `codex`, `gemini`); auth delegated to the CLI's own session, no API key flows through this process | shipped (anthropic/openai/gemini · Phase 3) |

Resolution lives in `scripts/ai_council/modes.ts`:
`resolve_mode(name, invocation_mode, member_settings, global_mode)`
with precedence **invocation flag > per-member setting > global
setting > default (`manual`)**. Whitespace-and-case insensitive; empty
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

### CLI-mode UX

`mode: cli` runs the council through the vendor's local CLI
instead of the API. Authentication is delegated — the user logs
into each CLI once (`claude login`, `codex login`, `gemini`), and
the orchestrator inherits the subscription. No API key flows
through this process. `billable=False`, so the cost gate is
bypassed; the local `cli_call_budget.max_calls_per_day.<provider>`
quota (state at `~/.event4u/agent-config/cli-calls.json`, daily
UTC reset) is the only per-day brake.

Three vendor CLIs are wired:

- **Anthropic / Claude** — invokes `claude --print --output-format json`
  and parses the standard envelope (`result` + `usage` + `session_id`
  + `total_cost_usd`). Token counts and reported cost survive to
  `metadata` for audit.

  ```yaml
  members:
    anthropic:
      enabled: true
      mode: cli
      model: claude-sonnet-4-5
  ```

- **OpenAI / Codex** — invokes `codex exec --json -` with the prompt piped on
  stdin, and walks the newline-delimited JSON event stream, pulling text from
  `item.completed` and tokens from `turn.completed`. Session id is preserved.
  Unlike the Anthropic client, there is **no separate system-prompt channel**:
  `codex exec` has no `--system` flag, so a system prompt is prepended to the
  user prompt in the same payload.

  ```yaml
  members:
    openai:
      enabled: true
      mode: cli
      model: gpt-5
  ```

- **Google / Gemini** — invokes `gemini --output-format json` with
  the prompt piped on stdin, parses the `response` + `stats.models.<m>.tokens`
  envelope. OAuth consent must be granted once interactively before
  the CLI is usable from a non-interactive shell. Like Codex and unlike Claude,
  it has **no system-prompt flag** — `--system` is rejected outright with
  `Unknown argument: system` — so the system prompt is prepended to the piped
  payload.

  Two caveats before enabling it, both measured 2026-08-12 and neither resolved.
  The CLI's own `--help` says `-p/--prompt` is what selects non-interactive
  mode, and this invocation passes neither `-p` nor the `query` positional;
  whether piped stdin alone keeps it headless is **unestablished**. And the
  free tier now refuses this client outright with `IneligibleTierError`, so a
  round-trip could not be completed here at all. Enable it only if you can
  confirm both on your own account.

  ```yaml
  members:
    gemini:
      enabled: false   # see the two caveats above before flipping this
      mode: cli
      model: gemini-2.5-pro
  ```

Auth-failure stderr from any vendor CLI surfaces as
`error="auth_expired"` with the original stderr tail in
`metadata.stderr_tail` so the user knows to re-login. A missing
binary at construction time fails fast with `CouncilDisabledError`
naming the binary and the YAML override path — never silently
substitutes.

`xai` + `perplexity` accept `mode: cli` from Phase 4 onward, but
their community CLIs DO consume the API key and DO NOT bypass
per-token billing — the contract doc warns explicitly.

Both take a single `-p <prompt>` and have no second channel, so the system
prompt is folded into that same value. Until 2026-08-12 it was **discarded**,
and these two members answered every question with no role, no neutrality
framing and no output contract while the run counted the reply as a peer
verdict. Two consequences worth knowing: their whole prompt travels on argv, so
a very large one can fail with `os_error: E2BIG` (the response carries a `hint`
saying so), and because their CLIs report no usage block, the input side of
their cost is an estimate rather than a provider figure.

### Cost-gate bypass for non-billable members

`ExternalAIClient.billable` is the contract. Clients with
`billable=False` (`ManualClient`, `AnthropicCliClient`,
`OpenAICliClient`, `GeminiCliClient`) bypass the cost gate entirely —
the orchestrator skips the
projection check, the `on_overrun` callback, and the USD-budget
short-circuit for that member, but still records the response's
token counts (from the manual-paste length heuristic or the
provider's reply, when available) for observability. Mixed runs
(one cli + one api) gate only the api members.

## Degradation modes

How the council behaves when fewer than two billable members are
reachable. The orchestrator never silently substitutes — degradation
is visible to the user.

| Reachable | Behaviour | Independence |
|---|---|---|
| **2+** | Full fan-out, multi-round debate. Default. | High — cross-provider diversity. |
| **1** | Single-voice critique with a degraded-run warning. Multi-round mode lets the model see its own anonymised reply, but convergence ≠ correctness. | Low — shared blind spots. |
| **0** | Council skipped. Surface the failure, proceed without external review. **Never** substitute the host or an unrequested manual pass. | None. |

Rejected anti-patterns (council convergence, 2026-05-06): persona
prompts (same model, same blind spots, more cost), temperature
spread (noise, not signal), host-as-fallback (Iron Law breach).
Supported single-provider strategy is **sibling models on the same
provider** (e.g. Sonnet ↔ Opus, gpt-4o ↔ o1) — different training
cutoffs / reasoning architectures within one provider family. Cost
is real (siblings price-tier higher); explicit opt-in per invocation,
not a default.

