---
recommended_model: inherit
name: ai-council
description: "Use when polling external AIs (OpenAI, Anthropic) outside the host session for a neutral second opinion on a roadmap, diff, prompt, or file set — or 'cross-check with another model'."
domain: process
meta_skill: true
workspaces:
  - agent-config-maintainer
packs:
  - meta
---

> **Experimental.** AI Council is not yet validated by external users. API costs apply per consultation.

<!-- cloud_safe: degrade -->

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

## When NOT to invoke — necessity self-check

The Phase 6 necessity classifier (see
[`ai-council-config § Necessity classifier`](../../../docs/contracts/ai-council-config.md))
runs as a pre-flight gate inside the CLI and skips the council when
the prompt looks like routine work. Route around it BEFORE the gate
fires so the user never pays the classifier-pause cost on a request
that obviously did not need a council in the first place.

Skip the council and stay in-session for:

* **Bugfix shape** — stack trace, error, crash, failing test, "broken",
  regression. Use `systematic-debugging` or `bug-investigate`.
* **Syntax / format / lint** — `typo`, `formatting`, `lint`, `indent`,
  `import order`, simple rename. Use the language skill directly
  (`php-coder`, `eloquent`, `nextjs-patterns`, etc).
* **Single-file implementation** — "this function", "this method",
  "this file", "one-liner", "small change", "add a getter". Use the
  language skill directly.
* **Documentation lookup** — "what is X", "how does Y work", "example
  of Z", "syntax of W". Use `codebase-retrieval` or the docs skill,
  never the council.

Invoke the council when:

* **Architectural / structural** — system boundaries, coupling,
  refactor strategy, migration plan, rewrite vs redesign.
* **Multi-axis trade-off** — stakeholders disagree; competing
  alternatives need weighing; "pros and cons" is the actual ask.
* **Strategic / direction** — "should we …", "shall we …", roadmap
  shape, long-term technical direction.
* **Explicit ambiguity** — the user wrote "unsure / uncertain /
  ambiguous / second opinion / sanity check".

Agent orchestration MUST call `council_cli` with
`--invocation agent` so the gate can skip silently on routine
requests. User-typed `/council` keeps the default
(`--invocation user_explicit`); the user gets the educational message
+ `--proceed-anyway` override path. Mode `block` ignores
`--proceed-anyway` by design — cost-strict opt-in.

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
THE HOST AGENT IS THE CONVENER, NEVER A REVIEWER.
```

If you find yourself wanting to "frame" the artefact for the council,
stop. Framing is exactly what kills the second-opinion value. Use the
unbiased system prompts in `scripts/ai_council/prompts.py`; do not
roll your own.

The host runs the council and synthesises convergence — it is the
convener, not a reviewer. The reviewer-ban is structural: the host
wrote (or framed) the artefact and cannot critique it independently.
Anonymising the host as "Reviewer C" is worse than excluding it — the
user is told they got an outside vote when they did not. Externals
down → surface and skip; never substitute the host as a reviewer.

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
| `api` | `AnthropicClient` / `OpenAIClient` / `GeminiClient` / `XAIClient` / `PerplexityClient` | yes | provider SDK + key from `~/.event4u/agent-config/<provider>.key` (legacy `~/.config/agent-config/<provider>.key` read as fallback) | shipped |
| `manual` | `ManualClient` | no | `stdout` (prompt block) + `stdin` (user pastes the web-UI reply, terminated by a line containing only `END`) | shipped (Phase 2b) |
| `cli` | `AnthropicCliClient` / `OpenAICliClient` / `GeminiCliClient` | no (subscription-authed) | local subprocess against the vendor CLI (`claude`, `codex`, `gemini`); auth delegated to the CLI's own session, no API key flows through this process | shipped (anthropic/openai/gemini · Phase 3) |

Resolution lives in `scripts/ai_council/modes.py`:
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

- **OpenAI / Codex** — invokes `codex exec --json` and walks the
  newline-delimited JSON event stream, pulling text from
  `item.completed` and tokens from `turn.completed`. Session id
  is preserved.

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
  the CLI is usable from a non-interactive shell.

  ```yaml
  members:
    gemini:
      enabled: true
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
7. **Critically evaluate** every finding before it leaves the host
   (see *Critical evaluation* below). The host is the convener **and**
   the skeptic — never a reviewer of the artefact itself, but always a
   reviewer of the **council's output**.
8. **Translate validated findings to options.** Convert each finding
   the host accepts (or accepts with modification) into a concrete
   numbered option for the user. Tag every option with the host's
   verdict so the user sees the agent's reasoned position, not the
   council's raw output. The user decides; the council advises; the
   host filters.

## Critical evaluation — convener-skeptic stance

```
COUNCIL CONVERGENCE IS NOT CORRECTNESS.
DO NOT BLINDLY ACCEPT FINDINGS. DO NOT BLINDLY REJECT THEM.
EVERY FINDING GETS A REASONED VERDICT BEFORE IT REACHES THE USER.
```

The council is **uninformed about the codebase, ADRs, locked
contracts, prior decisions, and project history** — it sees only the
artefact + neutrality preamble. That is the source of its diversity
**and** its blind spots. Convergence between members can mean shared
generic best-practice priors, not project-specific correctness.

The host applies a critical lens to **every finding** (convergence
**and** divergence) before surfacing it as a numbered option:

| Check | Question | Tool |
|---|---|---|
| **Codebase fit** | Does the finding match the actual code, files, signatures, conventions? | `view` / `codebase-retrieval` / `grep` |
| **Locked-decision conflict** | Does it contradict an ADR, kernel rule, contract under `docs/contracts/`, or `docs/decisions/`? | `view` |
| **Already addressed** | Is it a generic best-practice already covered by an existing rule, skill, or test? | `view` / `grep` |
| **Cost / benefit** | Is the change worth the diff size, churn, and review cost vs. the marginal benefit? | reasoning |
| **Hallucination** | Does the finding cite a file, function, or behavior that does not exist? | `view` |

Each finding receives one of three verdicts:

- **`accept`** — codebase fits, no locked-decision conflict, benefit clears cost. Surface as a normal numbered option.
- **`accept-with-modification`** — core insight valid, but the proposed shape needs adjusting (wrong file, contradicts ADR detail, scope creep). Surface with the **modified** patch and a one-line note.
- **`reject`** — finding is wrong (hallucinated reference, contradicts a locked decision, already addressed, generic noise). Surface as a **Rejected by host** entry with a one-line reason. Still visible — the user can override.

The verdict is the host's **own** reasoning, not the council's.
Pretending convergence equals correctness, or paraphrasing council
output as host analysis, both breach the [`direct-answers`](../../rules/direct-answers.md)
no-invented-facts rule. When the host cannot reach a confident
verdict on a finding (mixed evidence, ambiguous scope), it surfaces
the finding as `needs-input` with the open question — the user
decides, the host does not guess.

### What this is NOT

- **Not a re-review by the host.** The host did not write the artefact independently and cannot critique it independently — that boundary still holds.
- **Not a vote against the council.** Rejecting a finding requires evidence (file, line, contract reference), not preference.
- **Not silent filtering.** Every finding reaches the user with its verdict and reason. The user can pick a `reject` option and override the host.

## Output path convention

Council artefacts (questions, responses, sessions) are **dev-time
scratch** — gitignored in both the package repo and consumer repos
and auto-pruned after `ai_council.session_retention_days` (default
7). They inform a decision; they are not the durable contract. The
durable contract lives in the roadmap / ADR / skill body that cites
the council's convergence inline.

**Linking to a specific council file is forbidden by
[`no-roadmap-references`](../../rules/no-roadmap-references.md)
(council clause)** — gitignored, not in the cloned repo, gone after
the retention window. Inline the convergence with date + members
instead.

Three directories, three modes:

| Mode | Path | Format |
|---|---|---|
| **Topic-anchored question** (paired with a roadmap or ADR) | `agents/runtime/council/questions/<topic-slug>.md` | Markdown |
| **Topic-anchored response** (paired with the question above) | `agents/runtime/council/responses/<topic-slug>.json` | JSON from `council:run --output` |
| **Ad-hoc session** (no durable artefact yet) | `agents/runtime/council/sessions/<UTC-timestamp>.json` | JSON from `council:run --output` |

`<topic-slug>` is kebab-case and **must match** the corresponding
roadmap / ADR slug if one exists (e.g. `path-fixes` mirrors the
matching `road-to-<topic-slug>` roadmap under `agents/roadmaps/`).

### Forbidden

- Files at `agents/` root (e.g. `agents/runtime/council/question-foo.md`).
- Dot-prefix scratch (e.g. `agents/.council-question-foo.md`).
- Any other directory below `agents/` (e.g. `agents/scratch/`,
  `agents/evidence/notes/`). Operator scratch belongs under
  `agents/runtime/tmp/` (gitignored).
- Cross-references from any artefact to specific council files —
  see [`no-roadmap-references`](../../rules/no-roadmap-references.md)
  (council clause). Inline the convergence summary instead, with
  date and member list for traceability (`Council (claude-sonnet-4-5
  + gpt-4o, YYYY-MM-DD) reviewed N candidate strategies; converged
  on …`).

### Exempt

- `agents/evidence/audits/` — historical audit bundles. The canonical
  council dirs are gitignored; audit bundles are tracked,
  cohesive narratives that may include council artefacts as
  part of their evidence trail (e.g. `audits/2026-05-14-north-star/`
  bundling its triggering question, raw responses, and synthesis
  alongside the audit's findings). The layout linter
  (`scripts/check_council_layout.py`) skips this directory.

`scripts/check_council_layout.py` is the mechanical check for the
output path convention — wire it into the package's CI pipeline so
violations break the build.

## Output format

Every council reply MUST contain, in this order:

1. **Header line** with mode, member count, and total token cost.
2. **One section per member**, titled `### <provider> · <model>`,
   containing the member's verbatim output.
3. **Convergence / Divergence summary** — bullet list, every claim
   attributed by provider name.
4. **Host verdict per finding** — one row per finding with `accept`
   / `accept-with-modification` / `reject` / `needs-input` plus a
   one-line reason citing host evidence (file:line, ADR, contract).
   See *Critical evaluation* above.
5. **User-facing options** — numbered block per `user-interaction`,
   carrying the host verdict in each option, with "discard council
   input" always present as an option.

The host agent NEVER ships council output as its own reasoning, and
NEVER ships the host verdict as council output. Provider attribution
stays visible in the per-member sections; host verdicts stay
attributed to the host.

## Synthesis templates (lens-aware)

The **Convergence / Divergence** slot in `council:render` output is
populated with a lens-specific synthesis prompt. The host agent reads
this prompt and writes the summary in the shape it dictates. The five
templates live in `scripts/ai_council/prompts.py::_SYNTHESIS_TABLE`
and are exposed via `synthesis_template(mode)`.

**R4 Q4 split** — decision lenses get a structured Karpathy-style
template; creative lenses stay open-ended prose (bare slot):

| Lens | Class | Synthesis sections |
|---|---|---|
| `default` | decision | Agreement · Clashes · Blind spots · Recommendation · Next step |
| `pr` | decision | Consensus · Conflicts · Must-fix before merge · Recommendation |
| `analysis` | decision | Top-10 by consensus · Supporting · Outliers |
| `design` | creative | *(no template — open prose passthrough)* |
| `optimize` | creative | *(no template — open prose passthrough)* |

Input modes (`prompt` / `roadmap` / `diff` / `files`) inherit the
`default` decision template — they are bundling shapes, not lenses.

**Source citations:**
* Template shape — Round 2 council verdict
  (`agents/runtime/council/sessions/2026-05-14-ai-council-redesign/round-1.md`,
  Opus's lens-adaptive synthesis proposal).
* Decision/creative split — Round 4 Q4 verdict
  (`agents/runtime/council/sessions/2026-05-14-ai-council-redesign/round-3-responses.json`).
  R4 reframed `optimize` as creative because perf trade-offs resist
  pre-templated shape — Performance-wins / Trade-offs /
  Implementation-order is too rigid for the variety of optimize-lens
  artefacts. R4 reframed `design` for the same reason — design
  critiques are inherently narrative.

### `--prose-synthesis` escape hatch (R4 Q4)

Both `council:run` and `council:render` accept symmetric escape-hatch
flags on top of the lens table:

* `--prose-synthesis` — force creative-lens passthrough (bare slot)
  regardless of lens. Use when the user on `default`/`pr`/`analysis`
  prefers a narrative recommendation over the structured template.
* `--no-prose-synthesis` — force the `default` structured template
  even on a creative lens. Use when a `design` or `optimize` artefact
  has a one-shot need for Karpathy-style structure.

The flag is mutually exclusive — picking one disables the other on
the same invocation. When `council:run` records either flag in the
output JSON, `council:render` honours it unless the renderer is
called with an explicit flag of its own.

### Renderer lens resolution

`council:render <responses.json>` resolves the active lens in this
order: explicit `--prompt-mode` flag > `prompt_mode` field in the
payload > `mode` field in the payload > `None` (default decision
template). The `--prose-synthesis` / `--no-prose-synthesis` flag
overrides the table regardless of how the lens resolved.

## Do NOT

- Do NOT paraphrase council output into the host agent's voice — strip
  attribution and you've stripped the value.
- Do NOT surface council findings to the user without a host verdict
  — convergence ≠ correctness, and the user deserves the agent's
  reasoned filter, not a raw forward.
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
| Forward council convergence to the user as numbered options without a host verdict. | Convergence ≠ correctness; the council never saw the codebase. | Apply the *Critical evaluation* lens; tag every finding `accept` / `accept-with-modification` / `reject` / `needs-input` with one-line reason. |
| Reject a finding on preference, not evidence. | "I don't like this" is not a verdict. | Cite the file, line, ADR, or contract that justifies the rejection — or surface as `needs-input`. |
| Paraphrase council output into the host's own analysis to defend a verdict. | Strips attribution, breaches `direct-answers` no-invented-facts. | Verdict cites host evidence (file:line); council output stays attributed in the per-member sections. |

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

The default round count comes from `defaults.min_rounds` in
`agents/settings/.ai-council.yml` (default `2` so members critique each other
at least once before convergence). The host agent does **not** ask
"how many rounds?" when the requested count is `<= min_rounds` —
the settings owner already made that decision. Ask only when a
genuinely complex artefact justifies more depth than the default.

### Deep-reasoning tier (`council_depth: deep`)

Architecture review, refactoring proposals, and bug-diagnosis runs
benefit from an extra critique round. The deep tier is opt-in per
artefact:

1. The consuming **rule, skill, or command** declares
   `council_depth: deep` in its frontmatter. The schema accepts
   **only `deep`** — `standard` is the implicit default and is
   rejected by the linter (every frontmatter byte costs context
   window; see `scripts/schemas/{rule,skill,command}.schema.json`).
   To return an artefact to default depth, **delete the key**.
2. The **host agent** reads that frontmatter when it dispatches the
   council and passes `--depth deep` to `council_cli`. If multiple
   active artefacts disagree, **deep wins** (max policy).
3. The **CLI** floors the round count at
   `max(ai_council.deep_min_rounds, ai_council.min_rounds)` —
   defaults to `3` and `2` respectively. Lowering `deep_min_rounds`
   below `min_rounds` has no effect (defensive max).

The CLI itself has no knowledge of frontmatter; the contract is the
flag. Resolution chain (highest priority first):

```
--rounds N           → explicit, any value (user override)
--depth deep         → max(deep_min_rounds, min_rounds)
(no flag)            → min_rounds (default 2)
```

| Property | Behaviour |
|---|---|
| Default count | `ai_council.min_rounds` (default `2`). Override per-invocation with `rounds:N` (or `--rounds N` to the CLI). |
| Deep floor | `ai_council.deep_min_rounds` (default `3`). Activated by `council_depth: deep` in artefact frontmatter (host translates to `--depth deep`) or explicit `--depth deep` on the CLI. Floored at `min_rounds`. |
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

### Manual-mode parity

The orchestrator drives rounds the same way for `api` and `manual`
transports. One round = one full pass over every enabled member,
top-to-bottom, then `_augment_for_next_round()` folds the
anonymised critiques into the round-N+1 user prompt. For manual
mode this means: emit the round-1 block for member A → user
pastes A's reply → next member B → user pastes B's reply → host
agent consolidates round 1 → emit the round-2 block (now carrying
the anonymised round-1 critiques) for member A → … and so on
until the configured round count is reached. ManualClient's
internal "more feedback" follow-up loop (1 / 2 / 3 menu) is
**inside** a single member's chat thread and is orthogonal to the
orchestrator-level rounds.

### `/council debate` sub-command (progressive disclosure)

`/council debate <artefact> [--rounds N] [--continue-as-debate <session>]`
runs an **interactive** multi-round critique with a confirmation gate
between every round so the user can stop the spend at any point.

| Property | Behaviour |
|---|---|
| Round flow | Same orchestrator as `rounds:N` (`run_debate()`), but each round prints its responses then pauses on a y/n prompt before launching the next round. |
| Cost gate | After every round the CLI prints `Spent so far: $X · Next round: ~$Y · Cap: $Z`. `n` exits cleanly with partial results; `y` continues. |
| Hard cap | If the projected next-round cost would breach `max_total_usd`, `run_debate()` raises `DebateCapExceeded` and the CLI exits with the partial transcript. No silent overrun. |
| `--continue-as-debate` | Seeds round 1 from an existing `/council default` (or analysis lens) session. No round-1 API calls are billed; round 2+ run normally. Member list must match. |
| Session files | One file per round under `agents/runtime/council/sessions/<slug>/debate-round-NN.md`. |
| Anonymisation | Identical to `rounds:N`. The continue-as-debate path also anonymises the seeded round-1 responses when building the round-2 prompt. |

Use this when the artefact is genuinely contentious and the user
wants to control depth interactively. For a fire-and-forget
multi-round run, prefer `consult(..., rounds=N)` or `--rounds N` on
`/council default`.


## Karpathy peer-review (opt-in)

After the final deliberation round, an optional **anonymous peer-review
pass** lets each member critique the *other* members' responses for
blind spots before synthesis. Inspired by Andrej Karpathy's "ask the
strongest models to review each other anonymously" pattern; see his
[talks / threads on inter-model critique](https://karpathy.ai/) and the
internal verdict in
`agents/runtime/council/sessions/2026-05-14-ai-council-redesign/round-2.md`
(R2 split: one approve-as-flag, one reject-as-default → opt-in only).

Pipeline order when every feature is active:

```
deliberation rounds → peer-review → consensus-scoring → synthesis
```

Activation — two equivalent paths:

* CLI: `--peer-review` on `council:estimate` or `council:run`.
* Config: `ai_council.peer_review.enabled: true` in
  `agents/settings/.ai-council.yml`. Default is `false`.

Mechanics:

1. The final deliberation round's outputs are anonymised into
   `Response-A`, `Response-B`, … in stable input order. Provider /
   model identity is stripped (Iron-Law neutrality holds); empty or
   errored deliberation responses are skipped.
2. Each member receives an N−1 view (its own response filtered out)
   plus the Karpathy prompt: *strongest response*, *weakest blind
   spot*, *what did everyone miss*, *refinement*.
3. The N critiques flow back into synthesis through a
   "Peer-Review-Surfaced Blind Spots" addendum on the lens template.
4. **Advisor preserve-persona (R4 Q3, hard-coded):** when the
   deliberation was an advisor-mode run (Phase 6), anonymisation
   strips provider identity but **preserves the advisor persona
   label**. Peer-review renders as `Response A (Contrarian)`, never
   `Response A (Anthropic Opus)`. Plain-member runs strip identity
   entirely.

Cost — adds exactly N billable calls (one per member) at the same
per-call cost as a deliberation call. The `council:estimate` table
surfaces the delta as a `+peer-review: +N calls (~+$X)` row.

Needs ≥ 2 distinct deliberation outputs; below that the round is a
no-op and nothing extra is billed. Self-review is structurally
impossible — a member never sees its own response.

## Thinking-style advisors (replace-mode)

Phase 6 introduces five **advisor personas** that the council can adopt
in *replace-mode*: an enabled advisor substitutes its bound member's
plain call with the same provider running the advisor's persona prompt.
Total call count stays the same as a plain run — only the system prompt
swaps. Five advisors mirror the tenfoldmarc set, each a substantial
persona file (not a tagline):

| Advisor | Default bound member | Focus |
|---|---|---|
| **Contrarian** | `anthropic` | strongest counterargument, hidden assumptions |
| **First-Principles** | `anthropic` | strip metaphor, derive from physics / math / cost |
| **Expansionist** | `openai` | adjacent opportunities, second-order effects |
| **Outsider** | `openai` | naive-but-sharp questions, beginner's-mind probes |
| **Executor** | `anthropic` | what ships this quarter, what blocks delivery |

Activation — edit `agents/settings/.ai-council.yml` and flip the advisor's
`enabled: true`. Optional `model: <name>` overrides the bound member's
default model. Validation rule: an advisor referencing a disabled
member fails closed at config load — never silently skipped.

```yaml
advisors:
  contrarian:
    enabled: true        # ← swap anthropic's plain call for contrarian
    member: anthropic
    # model: claude-opus-4   # optional pin
```

`council:estimate` surfaces every active swap on a dedicated line above
the cost table:

```
council:estimate · mode=prompt · members=2 (billable=2)
  advisor: Contrarian on anthropic via claude-sonnet-4-5
anthropic/claude-sonnet-4-5: ~991 in + 256 out  =  $0.0068
openai/gpt-4o: ~208 in + 256 out  =  $0.0031
```

Cost-bounded guarantee — replace-mode never adds calls. The advisor
persona prompt is larger than a plain prompt (~1k extra input tokens
per swap), so the per-call estimate widens slightly. Output tokens and
call count are unaffected.

Peer-review interaction — when peer-review fires on an advisor-mode
run, anonymisation **preserves the advisor persona label** while
stripping provider identity: `Response A (Contrarian)` instead of bare
`Response A`. See §Karpathy peer-review point 4 for the contract.

One-per-provider invariant — two enabled advisors targeting the same
member is a config error (replace-mode runs exactly one advisor per
provider; the call plan never doubles up by accident).

## Decision-replay artefact (Phase 9, audit trail)

Every session that runs consensus scoring drops a
`decision-replay.md` next to the saved `responses.json`. Pure
projection of the consensus block plus the final-round per-member
texts — **no extra model calls, no extra spend**. Surfaces, per top
finding: verdict band (Strong/Moderate/Weak), evidence-quality bucket
(H/M/L), agree/dissent split, and one key argument per member.

Two render modes:

* **Full** (default) — per-member arguments attributed to
  `provider:model`. Reasoning is traceable, vendor identity is
  visible.
* **Redacted** — verdict + evidence-quality + counts only. Use for
  surfaces where attributing reasoning to a specific model would leak
  vendor-preference signal.

Toggles (config, see `ai-council-config § Decision-replay artefact`):

* `ai_council.decision_replay.enabled` — master switch (default
  `true`).
* `ai_council.decision_replay.include_member_arguments` — flip to
  `false` for redacted-by-default.
* `ai_council.lenses.<lens>.decision_replay.*` — per-lens override
  beats the global block.

CLI:

* Written automatically by `council run` whenever the lens triggers
  consensus scoring.
* `council replay <responses.json>` re-renders from a saved session;
  `--redact-member-arguments` / `--include-member-arguments` flip the
  view independent of config. Useful for sharing a redacted variant
  of an already-paid run.

## Lightweight-QA fast-path (Phase 11)

Low-impact questions classified by Phase 10's impact router can route
to a restricted fast-path instead of the full debate loop. The
trade-off is explicit: **1 round · ≤2 members · $0.05/answer · 2500
tokens**. No advisors, no peer-review, no consensus scoring — the goal
is a quick answer with a transparency marker, not a deliberation.

### Iron Law

`high_impact` and `user_required` **never** route to the fast-path,
regardless of config. Schema validation rejects the override. The
fast-path only activates when:

1. `ai_council.enabled: true` AND
2. `decision_resolution.low_impact.mode: council` AND
3. At least one member has `participate_low_impact: true` (default
   `false` — explicit opt-in per member).

Default route for `low_impact` is **`agent`** — nothing reaches the
council without an explicit two-knob opt-in (flip the class to
`council` *and* mark at least one member `participate_low_impact: true`).
See [`ai-council-config § Low-impact council opt-in`](../../../docs/contracts/ai-council-config.md#low-impact-council-opt-in)
for the worked YAML example, validation behaviour, and unavailable-marker
contract.

### Output marker (always surfaced)

* **Resolved** — `> Resolved via low-impact council (anthropic): <one-line answer>`
* **Split** — `> Low-impact council split — escalating to user (anthropic: X / openai: Y):`
* **Aborted** — `> Low-impact council aborted (token cap) — escalating to user:`

The marker is mandatory: the agent never silently substitutes a
fast-path verdict for its own answer.

### Session artefact

Every fast-path attempt appends one line to
`agents/runtime/council/sessions/<date>-<slug>/low-impact-resolutions.md`:

```
2025-05-14T10:00:00Z | resolved | members=2/2 | members(anthropic, openai) cost=$0.0034 | Q=Service vs Repository for this read path?
```

Append-only, one line per resolution. The parser tolerates free-form
section headers around the canonical lines, so the artefact may grow
human notes without breaking aggregation.

### `council replay --low-impact-stats`

Re-projection of the session log into a summary block:

```
$ council replay agents/runtime/council/sessions/2025-05-14-foo/responses.json --low-impact-stats
# Low-impact fast-path · session summary

- attempts: 4
- status: aborted=1 · resolved=2 · split=1
- members: anthropic=4 · openai=3
- total cost: $0.0096
```

No model calls — pure parse of the markdown log. Returns 0 when the
session had no fast-path entries (a clean session is not an error).

## See also

- `/council` command — the user-facing entry point.
- `subagent-orchestration` skill — internal multi-agent variant (no
  network, no spend, but no diversity of weights either).
- `scripts/ai_council/prompts.py` — neutrality preamble + per-mode
  system prompts.
- `scripts/ai_council/advisors.py` — replace-mode planning + persona
  resolution.
- `scripts/ai_council/bundler.py` — redaction pattern set + size
  guard.
- `docs/customization.md` § `ai_council.*` — settings reference.
- `docs/contracts/ai-council-config.md` § advisors — schema + precedence
  contract.
- `docs/contracts/ai-council-config.md` § Decision-replay artefact —
  Phase 9 audit trail contract + redaction modes.
- `scripts/ai_council/replay.py` — pure projection renderer (no model
  calls).
