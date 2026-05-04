---
name: "refine-prompt"
description: "Reconstruct a free-form prompt into actionable AC + assumptions + confidence band before the engine plans — '/work \"…\"', 'baue X', 'ist der Prompt klar genug für die Engine?'."
personas:
  - developer
  - senior-engineer
  - ai-agent
source: package
execution:
  type: assisted
  handler: internal
  allowed_tools: []
---

# Refine Prompt

> Move a free-form prompt from "raw text" to "engine-ready" in one run.
> Produces reconstructed acceptance criteria, explicit assumptions,
> and a confidence band that decides whether the engine proceeds
> silently, halts for confirmation, or refuses to plan.
>
> Sibling of [`refine-ticket`](../refine-ticket/SKILL.md) — same
> reconstruction-of-intent pattern, different input shape. Tickets
> arrive structured (id, title, AC); prompts arrive as one string.

## When to use

- The user invokes `/work "<prompt>"` or pastes a free-form request.
- The dispatcher hits `input.kind="prompt"` in the `refine` step.
- A prompt looks ambiguous, broad, or scope-undefined and the user
  asks "ist das klar genug, um loszulegen?".
- Before any plan/apply step on prompt-driven work — never after.

## When NOT to use (near-misses)

| Phrasing | Route to |
|---|---|
| "refine this ticket" | [`refine-ticket`](../refine-ticket/SKILL.md) |
| "estimate this prompt" | not supported — score then estimate downstream |
| "plan this feature" | `/feature-plan` (downstream) |
| "is this a duplicate?" | `validate-feature-fit` (sub-skill, post-refine) |

`refine-prompt` is the *first* gate on prompt-driven flow. It does not
plan, does not implement, does not write back anywhere.

## Input

Exactly one path: a non-empty raw string carried in
`state.input.data.raw` (built by [`work_engine.resolvers.prompt`](../../templates/scripts/work_engine/resolvers/prompt.py)).
No branch detection, no URL parsing, no clipboard fallback — the
calling command (`/work`) owns prompt capture; this skill only refines.

If `raw` is missing, empty, or whitespace-only the resolver already
raised `PromptResolverError`. The skill never receives that input.

## Procedure

### 1. Read and analyze the prompt

Examine the raw text top to bottom *before* changing anything in
state. Identify the *single* desired outcome in one sentence —
verb + object + observable result. If the prompt names two
unrelated outcomes (e.g. "fix login AND refactor the dashboard"),
record both but flag scope-overload in step 5; the score will
land in `medium` or `low`.

This is an analysis pass, not an execution pass. The skill does
not modify the prompt, infer code changes, or call any tool — it
investigates the input and produces a structured envelope the
dispatcher reads.

### 2. Enumerate explicit constraints

Pull every concrete signal from the prompt verbatim:

- **Files / modules** named in the text (`UserController`,
  `auth.service.ts`, `migrations/2024_…`).
- **Behaviour anchors** — endpoints, routes, commands, fixtures.
- **Hard rules** — "must not break X", "without changing the API",
  "keep backwards compat".

Constraints come from the prompt only. Inferred constraints belong in
step 3 (assumptions), never here.

### 3. Infer reasonable assumptions

Anything the prompt implies but does not state. Examples:

- "fix the login bug" → assumes the bug is in the existing `auth/`
  module (no new auth provider).
- "add caching" → assumes the project's primary cache driver
  (per `.agent-settings.yml` / `config/cache.php`).
- "speed up the export" → assumes "faster" means runtime, not memory.

Each assumption is a single line, prefixed with `assumes:`. The
medium-band halt surfaces them verbatim — no rewording, no
explanations.

### 4. Generate the AC list

Three to seven bullet points. Each bullet is observable and
testable in the project's existing test surface (Pest / Jest /
pytest / etc.). Avoid:

- "works correctly" / "is fast" / "looks better" (untestable)
- "no regressions" (the test suite already covers that)
- "follows best practices" (not an AC)

Anchor each bullet to a constraint from step 2 or an assumption from
step 3 — never both implicit.

### 5. Score confidence

Delegate to [`scripts.work_engine.scoring.confidence`](../../templates/scripts/work_engine/scoring/confidence.py):

```python
from work_engine.scoring.confidence import score
result = score(raw=prompt_raw, ac=reconstructed_ac, assumptions=assumptions)
# result.band ∈ {"high", "medium", "low"}
# result.score ∈ [0.0, 1.0]
# result.dimensions: dict[str, int]   # 0–2 per dimension
# result.reasons: list[str]            # human-readable rationale
```

The rubric (5 dimensions × 0–2, sum / 10) and band thresholds
(`high ≥ 0.8`, `medium 0.5–0.79`, `low < 0.5`) are owned by
`confidence.py`. Do not re-derive them in prose.

## Band-action mapping

The `refine` dispatcher step in `directives/backend/refine.py` reads
the score and returns one of three outcomes — the skill does not
decide the action, only produces the inputs.

| Band | Outcome | What the user sees |
|---|---|---|
| `high` | `SUCCESS` | Silent proceed; AC + assumptions land in the delivery report |
| `medium` | `PARTIAL` | Assumptions report halt: numbered list of `assumes:` lines + AC, user confirms or edits |
| `low` | `BLOCKED` | One clarifying question (per [`ask-when-uncertain`](../../rules/ask-when-uncertain.md) Iron Law) |

## Output format

The skill emits a structured envelope; the dispatcher renders it.
Required fields, in order:

1. **Goal** — single sentence, verb + object + observable result
2. **Acceptance criteria** — numbered list, 3–7 entries, each
   anchored to a step-2 constraint or a step-3 assumption
3. **Assumptions** — bullet list, each line prefixed `assumes:`
4. **Confidence** — band + score + per-dimension breakdown from
   `work_engine.scoring.confidence`

The shape below is the rendered surface for `medium` / `low`
halts; for `high` the same envelope lands in the delivery report
without a halt.

````markdown
## Reconstructed prompt

**Goal:** <one sentence, verb + object + observable result>

**Acceptance criteria:**
1. <bullet>
2. <bullet>
3. <bullet>

**Assumptions:**
- assumes: <line>
- assumes: <line>

**Confidence:** medium (0.62) — goal_clarity 2 · scope_boundary 1 · ac_evidence 2 · stack_data 1 · reversibility 0
````

For `low`, the question replaces the AC list:

```
> The prompt does not name <missing dimension>.
>
> 1. <option that resolves the gap>
> 2. <alternative resolution>
> 3. <skip / abandon>
```

## Gotchas

- The model invents AC that *sound* observable but aren't anchored
  in the prompt or a concrete file. Every AC must trace to a step-2
  constraint or a step-3 assumption — no free-floating bullets.
- Assumptions are not commitments. The medium-band halt is the
  user's chance to flip them; the skill never asserts an assumption
  as fact.
- The scorer is heuristic, not LLM-based. Token count is not a
  signal — a 200-word prompt can score `low` if the goal is vague,
  and a 20-word prompt can score `high` if scope is unambiguous.
- UI-shaped prompts ("redesign the dashboard", "make the form
  prettier") score `low` on `stack_data` until R3 lands the UI
  directive set; band-action is a pointer to R3, not a refusal.

## Do NOT

- Do NOT call this skill on `input.kind="ticket"` — that path runs
  through [`refine-ticket`](../refine-ticket/SKILL.md).
- Do NOT auto-confirm assumptions on the user's behalf in the
  medium-band halt. The halt is the contract.
- Do NOT stack multiple clarifying questions in the low-band halt.
  Iron Law: one question per turn.
- Do NOT mutate `state.input.data.raw`. The original prompt stays
  verbatim for replay; reconstructed output lands in
  `data.reconstructed_ac` and `data.assumptions`.
- Do NOT re-derive band thresholds in prose. They live in
  `confidence.py` and only there.

## See also

- [`refine-ticket`](../refine-ticket/SKILL.md) — sibling for ticket-shaped input
- [`work_engine.resolvers.prompt`](../../templates/scripts/work_engine/resolvers/prompt.py) — envelope builder
- [`work_engine.scoring.confidence`](../../templates/scripts/work_engine/scoring/confidence.py) — rubric + band thresholds
- [`ask-when-uncertain`](../../rules/ask-when-uncertain.md) — one-question-per-turn Iron Law
- [`artifact-drafting-protocol`](../../rules/artifact-drafting-protocol.md) — this skill was drafted under it
