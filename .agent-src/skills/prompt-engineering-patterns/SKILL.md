---
name: prompt-engineering-patterns
description: "Use when designing production-LLM prompts — few-shot, chain-of-thought, system prompts, templates, self-verification — distinct from prompt-optimizer and refine-prompt."
source: package
domain: product
status: active
workspaces:
  - agent-config-maintainer
packs:
  - meta
lifecycle: active
trust:
  level: core
  confidence: high
  human_review_required: false
install:
  default: true
  removable: false
---

# prompt-engineering-patterns

Production patterns for LLM prompts: few-shot, chain-of-thought, system-prompt design, templating, self-verification. **Distinct surface** from sibling skills:

- [`prompt-optimizer`](../prompt-optimizer/SKILL.md) — polishes a single end-user prompt for ChatGPT / Claude / Gemini.
- [`refine-prompt`](../refine-prompt/SKILL.md) — refines a free-form work prompt into engine-ready acceptance criteria.
- **This skill** — designs prompts that ship inside an application that calls an LLM at runtime.

## When to use

- Designing the system prompt for a new LLM-powered feature.
- Building a few-shot template with dynamic example selection.
- Adding chain-of-thought reasoning to a low-accuracy prompt.
- Reviewing a prompt diff in production code.
- Diagnosing inconsistent LLM outputs that look like prompt drift.

Do NOT use when:

- Polishing a one-off prompt for a chat session — route to `prompt-optimizer`.
- Turning a Jira ticket into engine input — route to `refine-prompt`.
- Tuning a model's weights — this skill is prompt-only, not fine-tuning.

## Decision framework

### Step 1 — Pick the prompt level (progressive disclosure)

```
Start at Level 1; only escalate when measurement says you must.

Level 1  Direct instruction                    "Summarize this article."
Level 2  + constraints (length, format, focus) "...in 3 bullets, key findings only."
Level 3  + reasoning scaffold                  "Read first, identify findings, then summarize."
Level 4  + few-shot examples                   "Like these examples: ..."
Level 5  + self-verification step              "...then check answer against criteria; revise if fails."
```

Escalating without evidence is over-engineering. Each level adds tokens, latency, and a maintenance surface.

### Step 2 — Structure the prompt

Fixed instruction hierarchy — every production prompt fills these slots in order:

```
[System context]   role, expertise, constraints, safety
[Task instruction] what to do, in one sentence
[Examples]         few-shot demonstrations (optional)
[Input data]       the user-supplied content
[Output format]    schema, length, citation rules
```

Stable slots (system, task, format) belong in cached prompt prefixes; volatile slots (examples, input) belong in the per-call portion.

### Step 3 — Pick the few-shot strategy

```
Examples are uniform and small (< 20)         → embed all of them; deterministic.
Examples are large or diverse                 → semantic-similarity retrieval per call.
Edge cases dominate                           → diversity-sampled examples (cluster + pick one per cluster).
Token budget tight                            → fewer, higher-quality examples beats many mediocre.
Examples drift with the data                  → regenerate from a labeled corpus on a schedule, not hand-edited.
```

Bad examples are worse than no examples — the model imitates structure.

### Step 4 — Add chain-of-thought ONLY when measured

CoT improves accuracy on multi-step reasoning, hurts on classification and lookup. Decision rule:

```
Task is multi-step / arithmetic / multi-hop   → add CoT (zero-shot "let's think step by step", or few-shot CoT).
Task is single-step extraction / classify     → CoT adds tokens without lift; skip.
You haven't measured                          → measure first, decide second.
Self-consistency needed (high-stakes answers) → sample N reasoning paths, majority vote.
```

### Step 5 — Build error recovery into the prompt

Production prompts handle their own failure cases:

- Specify the explicit "I don't know" output (don't let the model invent).
- Require a confidence indicator when downstream code needs to gate.
- Define the format for "missing information" so callers can branch.
- For self-verification: specify the criteria, then the revision rule.

### Step 6 — Treat prompts as code

- Version every prompt (file + git, not a wiki page).
- Test on a frozen evaluation set before shipping changes.
- Track P50 / P95 latency, token usage, accuracy, success rate per version.
- A/B test prompt variants behind a flag; never edit a live prompt without a rollback path.

## Procedure: Apply to a new LLM feature

1. **Inspect** the existing prompt (if any) and the eval set; verify a success metric exists (accuracy / consistency / latency / token cost) — refuse to design without it.
2. Draft Level-1 prompt (Step 1) and measure on the eval set.
3. Escalate one level at a time (Step 1) until metric is met or budget runs out.
4. Lock the structure (Step 2), choose few-shot strategy (Step 3), decide CoT (Step 4).
5. Add error-recovery clauses (Step 5).
6. Commit prompt + eval results + chosen version (Step 6); cite this skill.

## Output format

1. Prompt-spec table: slot · content · stable-vs-volatile · cached-vs-per-call.
2. Eval results table: prompt-version · metric · delta-vs-previous.
3. Failure-mode list: trigger · prompt clause that handles it.

## Gotcha

- Few-shot examples leak the model's style — examples that include hedging produce hedging.
- "Let's think step by step" works zero-shot on capable models, fails on smaller models without exemplar reasoning traces.
- Self-consistency (N samples + vote) multiplies cost by N — only on high-stakes paths.
- Cached prompt prefixes only cache when byte-identical — a single reformat busts the cache.
- Prompts that drift across model versions silently regress accuracy when the provider rolls a model update; pin model version OR re-run eval per release.

## Do NOT

- Do NOT escalate to Level 4 / 5 before measuring at lower levels.
- Do NOT mix few-shot examples from different tasks; the model averages them.
- Do NOT add CoT to single-step classification — it hurts.
- Do NOT hand-edit production prompts without versioning + eval.
- Do NOT echo secrets or PII into the prompt — they end up in provider logs.

## Auto-trigger keywords

- prompt engineering
- few-shot learning
- chain-of-thought
- system prompt design
- prompt template
- LLM prompt versioning
- prompt evaluation

## Provenance

- Adopted from: `Microck/ordinary-claude-skills@8f5c83174f7aa683b4ddc7433150471983b93131:skills_all/prompt-engineering-patterns/SKILL.md` (MIT, © 2025 Microck) — restructured into a decision-framework shape; vendor `prompt_optimizer` Python snippets dropped (project-specific to Microck).
- Cross-linked: [`prompt-optimizer`](../prompt-optimizer/SKILL.md), [`refine-prompt`](../refine-prompt/SKILL.md), [`mcp-builder`](../mcp-builder/SKILL.md), [`async-python-patterns`](../async-python-patterns/SKILL.md).
- Provenance registry: `agents/contexts/skills-provenance.yml` (entry: `prompt-engineering-patterns`).
- Iron-Law floor: `verify-before-complete`, `skill-quality`, `non-destructive-by-default`.
