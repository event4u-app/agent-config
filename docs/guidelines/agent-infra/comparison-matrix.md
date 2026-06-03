# Multi-Source Comparison Matrix

Reference guideline for Wing-1 deep-thinking work — the cross-source
synthesis lens. Use when analyzing multiple articles, papers, or
perspectives on the same topic: systematically compare claims, evidence
quality, and viewpoints to synthesize an integrated understanding rather
than a stack of independent summaries. Adopted under the
**Reference-Guideline Sunset Policy** and cross-referenced from:

- [`deep-reading-analyst`](../../../.agent-src.uncondensed/skills/deep-reading-analyst/SKILL.md)
  — L4 Research analysis depth (web-search 2–3 related sources, compare,
  synthesize).
- [`critical-thinking`](critical-thinking.md) — per-source argument
  quality feeds the evidence-strength column here.
- [`systems-thinking`](systems-thinking.md) — interdisciplinary matrix
  pairs with cross-domain pattern recognition.

> **Core principle:** Compare to synthesize, not to tally. Weight sources
> by credibility, separate what is settled from what is debated, and name
> your own interpretive bias.

## When to use

- Reading 3+ sources on the same topic.
- Encountering conflicting information across sources.
- Trying to synthesize best practices from competing approaches.
- Building comprehensive understanding before a decision.

## Standard Comparison Matrix

```markdown
# Comparative Analysis: [Topic]

## Sources Overview

| Source | Type | Author Expertise | Date | Bias/Lens |
|--------|------|-----------------|------|-----------|
| [Source 1] | [Article/Paper/Book] | [Credentials] | [Date] | [Perspective] |
| [Source 2] | [...] | [...] | [...] | [...] |
| [Source 3] | [...] | [...] | [...] | [...] |

## Key Claims Matrix

| Claim/Question | Source 1 | Source 2 | Source 3 | Consensus? |
|----------------|----------|----------|----------|------------|
| [Question 1] | [Position] | [Position] | [Position] | ✅/❌ |
| [Question 2] | [Position] | [Position] | [Position] | ✅/❌ |

## Evidence Quality

| Source | Evidence Type | Strength (1-5) | Notes |
|--------|---------------|----------------|-------|
| Source 1 | [Data/Anecdote/Study] | ⭐⭐⭐⭐ | [Assessment] |
| Source 2 | [...] | ⭐⭐⭐ | [...] |
```

## Agreement vs. Disagreement

- **Universal agreement** — points all sources converge on.
- **Partial consensus** — where two align and one diverges.
- **Complete divergence** — where views split, listed per source.

## Synthesized Insights

- **What we know with confidence** — convergent evidence across sources.
- **Open questions** — where sources disagree or lack data.
- **Integrated framework** — synthesis combining the best of each source.
- **Source-specific contributions** — what only each source provides.
- **Recommended reading order** — sequence for someone new to the topic,
  with the reason per step.

## Matrix variants

Pick the shape that fits what the sources actually differ on:

### Method comparison

When sources describe different methods/approaches:

```markdown
| Method | Source | Best For | Limitations | Difficulty | Results |
|--------|--------|----------|-------------|------------|---------|
| [Method A] | [Source 1] | [Use case] | [Weakness] | Easy | [Outcome] |
| [Method B] | [Source 2] | [Use case] | [Weakness] | Hard | [Outcome] |

Recommendation: use [X] when [condition]; combine [X + Y] for [scenario].
```

### Viewpoint spectrum

When sources sit at different positions on a spectrum:

```markdown
[Extreme Position A] ←―――――――――――→ [Extreme Position B]
        ↑                    ↑                    ↑
    [Source 1]          [Source 2]          [Source 3]

Per position: core belief · reasoning · strongest point · weakest point.
My position: where you land after reviewing all perspectives, and why.
```

### Evolution over time

When tracking how understanding of a topic evolved:

```markdown
| Period | Representative Source | Key Insight | What Changed Next |
|--------|----------------------|-------------|-------------------|
| [Era 1] | [Source/Author] | [Prevailing view] | [Paradigm shift] |

Pattern analysis: what stayed constant · what repeatedly changed ·
current frontier.
```

### Interdisciplinary

When the same topic is analyzed from different fields:

```markdown
| Discipline | Source | Core Question | Key Findings | Limitations |
|------------|--------|---------------|--------------|-------------|
| Economics | [Source] | [Question] | [Insight] | [Blind spot] |
| Psychology | [Source] | [Question] | [Insight] | [Blind spot] |

Synthesis: complementary insights · contradictions + resolution ·
blind spots one field fills for another.
```

### Practical / how-to

For how-to content from multiple sources: common steps all sources agree
on, a variations table per aspect, reported results/credibility per
source, then a personalized recommendation for the reader's context.

## Conflict resolution

When sources directly contradict, investigate before picking a winner.
Five common reasons a contradiction is only apparent:

1. **Different definitions** — they define the key term differently;
   not actually contradicting if talking about different things.
2. **Different contexts** — different time/place/population; both can be
   right in their own context.
3. **Different evidence** — quality difference explains the disagreement.
4. **Different values/goals** — different optimization targets lead to
   different conclusions.
5. **One is wrong** — one source has flawed reasoning.

Resolution lands on one of: which source is more reliable for *this*
claim and why · how both can be true depending on context · this remains
unresolved and needs more evidence.

## Pitfalls

- ❌ Forcing false equivalence — not all views are equally valid.
- ❌ Cherry-picking to support a predetermined view.
- ❌ Ignoring publication quality / expertise differences.
- ❌ Over-detailed comparison that misses the forest for the trees.

## Best practices

- ✅ Weight sources by credibility.
- ✅ Look for convergent evidence.
- ✅ Note what is settled vs. debated.
- ✅ Name your own biases in interpretation.

## How to populate

1. Read each source independently first.
2. Identify common themes / questions across sources.
3. Choose the matrix shape based on what you are comparing.
4. Fill in each source's position.
5. Analyze patterns and synthesize — do not stop at the table.

---

## ADOPT citation

Adopted from [`ginobefun/deep-reading-analyst-skill`](https://github.com/ginobefun/deep-reading-analyst-skill) @ commit `26cd7dc9` · `src/deep-reading-analyst/references/comparison_matrix.md` · MIT License.
