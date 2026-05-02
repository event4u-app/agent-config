---
name: ai-council
description: "Use when polling external AIs (OpenAI, Anthropic) outside the host session for a neutral second opinion on a roadmap, diff, prompt, or file set — or 'cross-check with another model'."
source: package
---

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

- `max_input_tokens` — sum of input tokens across all members.
- `max_output_tokens` — sum of output tokens across all members.
- `max_calls` — maximum number of council members per invocation.

If a cap fires mid-fan-out, the unfinished members get a
`CouncilResponse` with `error="cost_budget_exceeded"`. Do not retry
silently. Surface the partial result and ask the user.

## See also

- `/council` command — the user-facing entry point.
- `subagent-orchestration` skill — internal multi-agent variant (no
  network, no spend, but no diversity of weights either).
- `scripts/ai_council/prompts.py` — neutrality preamble + per-mode
  system prompts.
- `scripts/ai_council/bundler.py` — redaction pattern set + size
  guard.
- `docs/customization.md` § `ai_council.*` — settings reference.
