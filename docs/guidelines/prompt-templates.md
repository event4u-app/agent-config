# Prompt Templates

Reference catalogue of prompt structures the [`prompt-optimizer`](../../.agent-src.uncompressed/skills/prompt-optimizer/SKILL.md)
skill picks from during the **Develop** step of the 4-D methodology.
Cited by the [`refine-prompt`](../../.agent-src.uncompressed/skills/refine-prompt/SKILL.md)
skill in `mini` mode for stack-aware shaping.

Templates are tools, not dogma. Pick by request type, not by upstream
whitelist — see the [Rejection note](#rejection-note) at the bottom.

## When-to-pick rubric

| Request shape | First-choice template | Fallback |
|---|---|---|
| One-shot technical change (refactor, lint fix) | **RTF** | File-Scope |
| Multi-file refactor across a codebase | **File-Scope** | RTF |
| Marketing / brand / tone-heavy copy | **CO-STAR** | CRISPE |
| Mixed-audience explainer (technical + lay) | **CRISPE** | CO-STAR |
| Step-by-step explainer / tutorial | **RISEN** | Few-Shot |
| Pattern-heavy task (classification, extraction) | **Few-Shot** | RISEN |
| Multi-step reasoning or math | **CoT** | ReAct |
| Tool-using agent (web search, file ops) | **ReAct** | CoT |
| Image AI (Midjourney, SD, DALL·E) | **Visual Descriptor** | Reference-Image-Edit |
| Image edit from a source image | **Reference-Image-Edit** | Visual Descriptor |
| ComfyUI / node-graph image workflows | **ComfyUI** | Visual Descriptor |
| Reverse-engineer an existing good prompt | **Prompt Decompiler** | — |
| Honest critical feedback on a finished artifact (post, design, naming, proposal) — any domain | **Honest Sparring Partner** | CRISPE |

## Text templates

### RTF — Role · Task · Format
Smallest viable structure. Three lines: who the AI is, what to do,
how the output should look. Best for one-shot technical asks.

### CO-STAR — Context · Objective · Style · Tone · Audience · Response
Six-slot structure originally from the Singapore GovTech prompt
study. Best for copy where audience and tone carry the message.

### RISEN — Role · Input · Steps · Expectation · Narrowing
Step-explicit shape. Best for tutorials, walkthroughs, and any
output where the reader follows the prompt's structure.

### CRISPE — Capacity · Role · Insight · Statement · Personality · Experiment
Six-slot, persona-heavy. Best when the *voice* matters more than
the structure (creative writing, explainers with a strong narrator).

### CoT — Chain-of-Thought
Append "Think step by step" or "Reason aloud before answering" to
any base template. Best for multi-step reasoning, math, planning.
Pairs well with RTF or RISEN.

### Few-Shot
Two to five worked examples inline before the actual ask. Best for
classification, extraction, format-mimicking. Costs tokens — keep
examples minimal and representative.

### File-Scope
Codebase-aware variant of RTF. Names the files in scope, the
allowed-edit list, and the "do not touch" list explicitly. Best for
agent-driven refactors where blast radius matters.

```
Role: senior TypeScript engineer
Files in scope: src/auth/*.ts, tests/auth/*.ts
Do not modify: src/db/*, package.json, tsconfig.json
Task: migrate from jsonwebtoken to jose; keep the exported API stable
Format: unified diff
```

### ReAct — Reason + Act
Interleaved thought / action / observation loop. Best for agents
with tools — web search, file ops, shell. Each cycle:

```
Thought: <why I need this next step>
Action: <tool call>
Observation: <result>
... repeat ...
Final Answer: <synthesis>
```

### Honest Sparring Partner
Domain-agnostic stance template for getting honest critical feedback on
a finished artifact — blog post, design draft, naming decision, business
proposal, care-plan, marketing copy. Works for any role (engineer,
graphic designer, nurse, founder) because the role slot is filled by
the user's actual profession, not hard-coded.

Five-slot shape:

```
Role: <user's domain> — e.g. graphic designer, geriatric nurse, founder
Stance: honest sparring partner, not yes-man. Push back when something
        is weak; acknowledge when something is solid; stay silent when
        there is nothing substantive to add. No flattery openings, no
        artificial criticism for its own sake.
Context-fit: ask ONE clarifying question only if real context is missing
             (role, audience, constraint). Otherwise answer directly.
Artifact: <the finished thing — paste, link, or describe>
Ask: <what kind of reaction the user wants — "does the argument hold?",
     "is the naming clear?", "would this land with audience X?">
```

**Anti-pattern this rejects:** "what do you honestly think?" prompts that
either default to praise ("looks great!") or default to manufactured
criticism ("here are 5 problems...") regardless of whether the work
warrants either reaction. The stance slot makes the honest-when-warranted
contract explicit.

**Package equivalents** — inside this agent-config, the
[`adversarial-review`](../../.agent-src.uncompressed/skills/adversarial-review/SKILL.md)
skill implements the same stance via an Attack-Defend-Revise loop and is
the right tool when the user submits finished work for a critical take.
This template is for **end-users prompting their own LLM** (ChatGPT,
Claude, Gemini) outside this package.

## Image templates

### Visual Descriptor
Subject · style · composition · lighting · medium · mood · technical
parameters (aspect ratio, resolution). Best for Midjourney, Stable
Diffusion, DALL·E from a blank canvas.

### Reference-Image-Edit
Source image reference + change set + preservation set. Names what
to change, what to keep, and the desired output framing. Best for
inpainting, style transfer, character consistency.

### ComfyUI
Node-graph-aware. Names the workflow nodes (KSampler, CLIPTextEncode,
VAEDecode) and the parameter intent per node rather than the
parameter values. Best for advanced SD pipelines.

## Reverse template

### Prompt Decompiler
Given an existing good output, reconstruct the prompt that would
produce it. Used to mine prompts from public LLM artifacts. Not a
shaping template — a forensic one.

## Rejection note

Upstream `nidhinjs/prompt-master` claims that only five techniques
are "safe" for production prompting:

- few-shot
- role assignment
- structured output
- constraint-based
- chain-of-thought

This package **rejects** that whitelist. CO-STAR, RISEN, CRISPE,
ReAct, and the image-AI templates above are first-class. The
"5 safe" framing came from a single benchmark on a single LLM
generation — it does not generalise. See AI Council session
`agents/runtime/council/responses/prompt-master-mini.json` (2026-05-17) for the analysis behind this rejection. <!-- council-ref-allowed: ADR decision trace -->

The right gate is request-type fit, not technique-whitelist
membership.

## See also

- [`prompt-optimizer`](../../.agent-src.uncompressed/skills/prompt-optimizer/SKILL.md) — engine-outbound; cites this catalogue in its Develop step
- [`refine-prompt`](../../.agent-src.uncompressed/skills/refine-prompt/SKILL.md) — engine-inbound; uses templates in `mini` mode for stack-aware shaping
- [`prompt-engineering-patterns`](../../.agent-src.uncompressed/skills/prompt-engineering-patterns/SKILL.md) — production-LLM prompt patterns (sibling skill, not a catalogue)
- AI Council session: `agents/runtime/council/responses/prompt-master-mini.json` (2026-05-17) <!-- council-ref-allowed: ADR decision trace -->
