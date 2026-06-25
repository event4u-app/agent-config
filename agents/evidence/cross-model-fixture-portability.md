# Cross-Model Fixture Portability Audit (T-001)

## Purpose

Read-only inventory, ahead of any cross-model eval smoke, of (a) which eval
fixtures and harness code hardcode single-vendor assumptions that would break on
a non-Anthropic router, and (b) the real coverage denominator — how much of the
skill suite the evals actually exercise. No eval runs, no API calls, no code
changes were made; every count below is fresh command output and every code
claim carries a `file:line`.

## Coverage denominator

| Metric | Value | Source |
|---|---|---|
| Skills | **258** | `ls src/skills \| wc -l` → 258 |
| `triggers.json` fixtures | **37** | `find src -name triggers.json \| wc -l` → 37 |
| `evals.json` behavioral fixtures | **0** | `find src/skills -name evals.json \| wc -l` → 0 |
| Trigger coverage | **37 / 258 = 14.3 %** | computed |
| Behavioral coverage | **0 / 258 = 0 %** | computed |

**Headline finding:** the behavioral / rubric / finding harness
(`run_skill_evals.ts`) is effectively **unused** — `0` `evals.json` files exist.
Any "parity proven" claim today can cover at most the trigger-routing slice
(~14 % of skills) and **0 %** behavioral. Trigger routing answers "did the
right skill get selected"; it says nothing about output quality or finding
behavior.

## Portability port list

Items that hardcode single-vendor behavior and must be abstracted before a
cross-vendor run. Do **not** weaken the Anthropic gate — add per-vendor gates
alongside it.

| # | Item | `file:line` | Issue | Port |
|---|---|---|---|---|
| 1 | Hard key-prefix gate | `src/scripts/skill_trigger_eval.ts:416` (`if (!key.startsWith('sk-ant-'))`) | Rejects any key not `sk-ant-`; non-Anthropic vendors have no such prefix. #1 landmine. | Add per-vendor gate branches (e.g. OpenAI `sk-`, Gemini `AIza…`) selected by `--vendor`; keep the `sk-ant-` branch intact for Anthropic. |
| 2 | `TriggerRouter` interface | `src/scripts/skill_trigger_eval.ts:124` (impls: `MockRouter:129`, `AnthropicRouter:766`) | — (clean seam, not a defect) | **Extension point.** Add `CodexRouter` / `GeminiRouter` implementing `TriggerRouter`; wire selection at the router-construction site `:1013`. |
| 3 | Request shape | `src/scripts/skill_trigger_eval.ts:800-805` (`messages.create({ system, messages:[{role,content}] })`) | Anthropic Messages API call shape; OpenAI/Gemini use different request schemas. | Per-router `route()` builds its own vendor request; the `TriggerRouter` contract already isolates this. |
| 4 | Response-shape parse | `src/scripts/skill_trigger_eval.ts:818` (`_first_text_block` → `response.content[0].text`) | Assumes Anthropic content-block array; OpenAI `choices[].message.content`, Gemini `candidates[].content.parts`. | Each router extracts text in its own `route()` before calling the shared `_parse_would_load`. |
| 5 | Usage-token shape | `src/scripts/skill_trigger_eval.ts:809-811` (`usage.input_tokens` / `output_tokens`) | Anthropic field names; OpenAI uses `prompt_tokens` / `completion_tokens`. | Normalize per-router to the `[loaded, inTok, outTok]` tuple. |
| 6 | Default model id | `src/scripts/skill_trigger_eval.ts:31` (`DEFAULT_MODEL = 'claude-sonnet-4-5'`) | Anthropic model id is the default. | Make default vendor-conditional; require explicit `--model` per vendor. |
| 7 | Output-contract assumption | `src/scripts/skill_trigger_eval.ts:747-754` prompt + `:842` (`data['would_load']`) | The harness mandates a strict `{"would_load":[...]}` JSON reply; weaker instruction-followers may not honor the contract, skewing parity. | Vendor-neutral, but treat off-contract replies as a measured failure mode, not a harness crash; report parse-failure rate per vendor. |

Trigger **fixtures** themselves (`queries[].q` / `trigger` — sample
`src/skills/brand/.../triggers.json`) carry **no** vendor-specific
citation-format, tool-call-shape, or output-format assumptions; the portability
surface is entirely in the harness code (items 1, 3–6), not the fixture data.

## Implication for finding_floor

Because there are **0** behavioral fixtures (`find src/skills -name evals.json`
→ 0), the downstream `finding_floor` work has nothing to calibrate against. The
behavioral grader exists (`run_skill_evals.ts:_grade_assertions:100`, kinds
`contains`, `file_exists`, `rubric`) but `rubric` returns `pass: null` deferred
to a sub-agent grader (`:115-120`) and no fixture invokes it. Therefore
`finding_floor` must **author behavioral eval fixtures first** — there is no
existing behavioral signal to set a floor on.

## Quotable coverage statement

> Consistent across hosts on at most **37 of 258** skills (trigger routing,
> ~14 %); behavioral **0**.
