---
model_tier: high
context: large
name: deep-reading-analyst
description: "Deep analysis of articles/long-form via thinking frameworks (SCQA, mental models, inversion) — 'analyze article', 'deep dive', 'extract insights', URL/text wanting depth not summary."
status: active
domain: discovery
workspaces:
  - engineering
packs:
  - engineering-base
---

# deep-reading-analyst

Wing-1 deep-thinking skill for articles, papers, opinion pieces, case studies, and long-form decision documents. Routes the user's content through 8 thinking frameworks at four depth levels (Quick / Standard / Deep / Research) and returns insight tied to the user's **goal**, not framework completion.

## When to use

- User pastes an article URL, paper, or long text and wants depth ("analyze", "deep dive", "extract insights", "help me understand").
- User asks for a specific framework ("apply SCQA to this", "use inversion thinking", "give me the mental models lens").
- User is making a decision and wants pre-mortem / multi-lens analysis on a written proposal.
- User is studying or note-taking on dense material (research papers, strategy memos, books).

Do NOT use when:
- User wants a 3-bullet TL;DR — use `agent-docs-writing` or write a direct summary.
- Content is code or a diff — route to `judge-bug-hunter`, `judge-code-quality`, or `adversarial-review`.
- User wants risk analysis on a code change — route to `adversarial-review` (diff-bound) or `threat-modeling`.
- User wants debugging or incident analysis — route to `bug-analyzer` or `systematic-debugging`.

## Framework Arsenal

| Depth | Time | Frameworks | Reference module |
|---|---|---|---|
| **L1 — Quick** | ~15 min | SCQA, 5W2H | [`scqa-framework`](../../../docs/guidelines/agent-infra/scqa-framework.md), [`5w2h-analysis`](../../../docs/guidelines/agent-infra/5w2h-analysis.md) |
| **L2 — Standard** | ~30 min | L1 + Critical Thinking, Inversion | + [`critical-thinking`](../../../docs/guidelines/agent-infra/critical-thinking.md), [`inversion-thinking`](../../../docs/guidelines/agent-infra/inversion-thinking.md) |
| **L3 — Deep** | ~60 min | L2 + Mental Models, First Principles, Systems Thinking, Six Hats | + [`mental-models`](../../../docs/guidelines/agent-infra/mental-models.md), [`first-principles`](../../../docs/guidelines/agent-infra/first-principles.md), [`systems-thinking`](../../../docs/guidelines/agent-infra/systems-thinking.md), [`six-hats`](../../../docs/guidelines/agent-infra/six-hats.md) |
| **L4 — Research** | 120 min+ | L3 + Cross-source comparison via web search | + [`comparison-matrix`](../../../docs/guidelines/agent-infra/comparison-matrix.md) |

Every framework module is a project-local guideline under `docs/guidelines/agent-infra/`. Nothing is loaded from upstream at runtime.

## Procedure: deep-reading-analyst

### Step 0: Inspect

1. **Detect content type** — article, paper, opinion piece, case study, how-to, strategy memo. Drives auto-suggested frameworks (Step 1).
2. **Detect goal signal** — problem-solving, learning, writing reference, decision-making, curiosity. Drives Step 4 output shape.
3. **Skip if mismatched** — see "Do NOT use when" above; route to the named skill.

### Step 1: Initialize Analysis

Ask the user three things in **one** message (not three turns), per `ask-when-uncertain` Iron Law (one question per turn — these three are bundled into a single numbered-options block):

1. **Goal** — problem-solving · learning · writing · decision-making · curiosity.
2. **Depth** — L1 Quick (15 min) · L2 Standard (30 min) · L3 Deep (60 min) · L4 Research (120 min+).
3. **Framework override** — defaults are auto-suggested by content type (table below); user may name specific frameworks.

If the user does not answer, default to L2 Standard with auto-selected frameworks.

**Auto-suggest matrix:**

| Content type | Default frameworks |
|---|---|
| Strategy / business article | SCQA + Mental Models + Inversion |
| Research paper | 5W2H + Critical Thinking + Systems Thinking |
| How-to guide | SCQA + 5W2H + First Principles |
| Opinion piece | Critical Thinking + Inversion + Six Hats |
| Case study | SCQA + Mental Models + Systems Thinking |

### Step 2: Structural Understanding (always run)

Regardless of depth, open with two short blocks:

**2A — Basic structure.**

```markdown
📄 Type: [article/paper/report]
🎯 Core thesis: [one sentence]
Structure:
├─ Argument 1 → [key support]
├─ Argument 2 → [key support]
└─ Argument 3 → [key support]
Key concepts: [3–5 terms with one-line definitions]
```

**2B — SCQA breakdown.** Apply the four-element decomposition from [`scqa-framework`](../../../docs/guidelines/agent-infra/scqa-framework.md):

```markdown
**S (Situation)**: [context the article establishes]
**C (Complication)**: [problem identified]
**Q (Question)**: [core question]
**A (Answer)**: [main solution / conclusion]
Structure quality — clarity / logic / completeness: [★★★☆☆]
```

**2C — 5W2H gap check** (L1+). Quick scan: which of *What, Why, Who, When, Where, How, How much* are well-covered, partial, or missing? Flag the 1–2 most critical gaps.

### Step 3: Apply Frameworks (depth-gated)

Load only the frameworks the user's depth bought. Each framework follows the same pattern: **load reference module → apply lens → produce one fixed-shape block**.

**L2 additions:**

- **Critical Thinking** ([`critical-thinking`](../../../docs/guidelines/agent-infra/critical-thinking.md)) — argument strength score (X/10), strengths, weaknesses, logical fallacies detected.
- **Inversion** ([`inversion-thinking`](../../../docs/guidelines/agent-infra/inversion-thinking.md)) — pre-mortem on the article's recommendation: "how would this fail?", missing risk factors, mitigations.

**L3 additions:**

- **Mental Models** ([`mental-models`](../../../docs/guidelines/agent-infra/mental-models.md)) — pick 3–5 models from different disciplines (physics, biology, psychology, economics, math), apply each lens, surface cross-model patterns.
- **First Principles** ([`first-principles`](../../../docs/guidelines/agent-infra/first-principles.md)) — strip to fundamental truths, validate each core assumption, rebuild from base.
- **Systems Thinking** ([`systems-thinking`](../../../docs/guidelines/agent-infra/systems-thinking.md)) — map relationships, feedback loops, leverage points.
- **Six Hats** ([`six-hats`](../../../docs/guidelines/agent-infra/six-hats.md)) — White (facts), Red (feelings), Black (cautions), Yellow (benefits), Green (creativity), Blue (process).

**L4 addition:**

- **Cross-source comparison** ([`comparison-matrix`](../../../docs/guidelines/agent-infra/comparison-matrix.md)) — web-search 2–3 related sources, compare SCQA across sources, identify consensus vs divergence, synthesize integrated perspective.

### Step 4: Synthesize by Goal

Output shape is **driven by Step 0 goal**, not by frameworks applied. Pick exactly one of the four blocks below.

**For problem-solving:** Applicable solutions (2–3 from content) → Application plan with timed action steps → Success metrics → Risk mitigations from Inversion.

**For learning:** Core concepts (definition + example) → Mental models gained → Connections to prior knowledge → First Principles fundamental question → 3 verification questions (understanding / application / evaluation).

**For writing reference:** Key arguments + evidence (with paragraph citations) → Quotable insights with context → Critical analysis (strengths for citing, limitations for balanced discussion) → Alternative perspectives from Mental Models → Gaps and counterfactuals.

**For decision-making:** Options presented → Multi-model evaluation (economic + risk + systems lens) → Six Hats decision analysis → Scenario analysis (best / worst / most likely) → Synthesized recommendation.

### Step 5: Knowledge Activation (always end here)

Regardless of goal, close with three fixed blocks:

```markdown
## 🎯 Top 3 takeaways
1. **[Insight]** — Why it matters: [...] · One action: [specific, time-bound]
2. **[Insight]** — Why it matters: [...] · One action: [specific, time-bound]
3. **[Insight]** — Why it matters: [...] · One action: [specific, time-bound]

## 💡 Quick win — one tiny, specific action for the next 24 hours.

## 🧭 Frameworks used
✅ SCQA  ✅ 5W2H  ✅ Critical  ✅ Inversion
□ Mental Models  □ First Principles  □ Systems  □ Six Hats
```

### Step 6: Validate

1. Every claim is faithful to the source — no misrepresentation, facts distinguished from opinions.
2. Frameworks applied **purposefully**, not force-fit — drop a framework that adds no insight rather than padding the output.
3. Output ends with concrete, actionable steps — no analysis-without-application.
4. Specific citations (paragraph numbers, quotes) where the source supports them.

## Output format

1. **Structural block (Step 2)** — type / thesis / structure tree / key concepts / SCQA / 5W2H gaps.
2. **Framework blocks (Step 3)** — one fixed-shape block per framework the depth bought.
3. **Goal-shaped synthesis (Step 4)** — problem-solving / learning / writing / decision-making.
4. **Knowledge activation (Step 5)** — top 3 takeaways · quick win · frameworks-used checkboxes.

## Gotcha

- The model tends to **apply every framework** even at L1 — respect the depth budget; skip frameworks the user did not buy.
- The model tends to **summarize** instead of analyze when the user pastes long text — go deep on 1–3 points, not shallow on all of them.
- Inversion drifts into adversarial code review — this skill targets **decisions and arguments**, not diffs. Route diff stress-tests to `adversarial-review` / `judge-bug-hunter`.
- Mental Models drifts into name-dropping — pick 3–5, apply each lens *concretely* to the article's claims, drop models that yield no new insight.
- L4 cross-source comparison drifts into a literature review — keep it to 2–3 sources, focus on consensus / divergence / unique value.
- Output without action steps is a failure mode — every Step-4 synthesis must end with timed, concrete actions tied to the user's goal.

## Do NOT

- Do NOT force-apply all frameworks at the user's chosen depth — drop ones that add no insight.
- Do NOT copy text verbatim from the source — always reword for the user's understanding.
- Do NOT use academic jargon without one-line definitions in the "key concepts" block.
- Do NOT skip Step 5 — the takeaways + quick win are the load-bearing output, not optional decoration.
- Do NOT route code reviews, diff stress-tests, or incident debugging through this skill.

## Reference modules

- [`scqa-framework`](../../../docs/guidelines/agent-infra/scqa-framework.md) — situation / complication / question / answer decomposition.
- [`5w2h-analysis`](../../../docs/guidelines/agent-infra/5w2h-analysis.md) — completeness check (7 questions).
- [`critical-thinking`](../../../docs/guidelines/agent-infra/critical-thinking.md) — argument quality / fallacy detection.
- [`inversion-thinking`](../../../docs/guidelines/agent-infra/inversion-thinking.md) — pre-mortem on decisions, distinct from `adversarial-review`.
- [`mental-models`](../../../docs/guidelines/agent-infra/mental-models.md) — Munger's multi-discipline toolkit.
- [`first-principles`](../../../docs/guidelines/agent-infra/first-principles.md) — fundamental-truth extraction.
- [`systems-thinking`](../../../docs/guidelines/agent-infra/systems-thinking.md) — feedback loops + leverage points.
- [`six-hats`](../../../docs/guidelines/agent-infra/six-hats.md) — White / Red / Black / Yellow / Green / Blue protocol.
- [`comparison-matrix`](../../../docs/guidelines/agent-infra/comparison-matrix.md) — cross-source synthesis (L4 only).
