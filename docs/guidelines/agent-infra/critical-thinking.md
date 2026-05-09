# Critical Thinking

Reference guideline for Wing-1 deep-thinking work — evaluate
arguments by their evidence and logic, not by surface plausibility or
author authority. Identifies fallacies, weighs evidence type,
steelmans before criticizing. Pairs with `first-principles` (which
rebuilds from primitives) and `inversion-thinking` (which negates the
goal). Adopted under the **Reference-Guideline Sunset Policy** and
cross-referenced from:

- [`deep-reading-analyst`](../../../.agent-src.uncompressed/skills/deep-reading-analyst/SKILL.md)
  — L2 Standard / L3 Deep evaluation depth.
- [`receiving-code-review`](../../../.agent-src.uncompressed/skills/receiving-code-review/SKILL.md)
  — steelman bot / human review feedback before changing code.
- [`improve-before-implement`](../../../.agent-src.uncompressed/rules/improve-before-implement.md)
  — challenge weak requirements with evidence-grade analysis.
- [`adversarial-review`](../../../.agent-src.uncompressed/skills/adversarial-review/SKILL.md)
  — paired stress-test on a diff after critique.

> **Core principle:** "Steelman first, criticize second." — attacking
> the strongest version of an argument is the only valid critique.

## Argument Quality Assessment

### Evidence Evaluation Matrix

| Evidence Type | Strength | Red Flags |
|---|---|---|
| Peer-reviewed research | High | Sample size, conflicts of interest |
| Original data | High | Collection methodology, bias |
| Expert consensus | Medium-High | Field consensus vs. single expert |
| Case studies | Medium | Selection bias, generalizability |
| Anecdotes | Low | Not representative |
| *"Studies show…"* (no citation) | Very Low | Vague, unverifiable |

### Logical Fallacy Checklist

**Causal fallacies:**

- [ ] Post hoc (A before B ≠ A caused B).
- [ ] Correlation ≠ causation.
- [ ] Oversimplified cause (single factor explains complex
  phenomenon).

**Evidence fallacies:**

- [ ] Cherry-picking (selective evidence).
- [ ] Survivorship bias (only successful cases visible).
- [ ] Hasty generalization (small sample → broad claim).

**Rhetorical fallacies:**

- [ ] Ad hominem (attack person, not argument).
- [ ] Appeal to authority (without expertise in relevant field).
- [ ] Strawman (misrepresenting opponent's position).
- [ ] Slippery slope (extreme outcome without justification).
- [ ] False dichotomy (only 2 options when more exist).

**Statistical fallacies:**

- [ ] Base rate neglect (ignoring prior probability).
- [ ] Absolute vs. relative risk confusion.
- [ ] Misleading averages (mean hiding distribution).

## Critical Questions Protocol

### Level 1 — Comprehension

- What is the core claim?
- What evidence supports it?
- What are the key assumptions?

### Level 2 — Analysis

- Is the evidence sufficient for the claim?
- Are there logical gaps?
- What's missing from this argument?

### Level 3 — Evaluation

- How strong is this argument overall?
- What would strengthen / weaken it?
- What are alternative explanations?

### Level 4 — Synthesis

- How does this fit with other knowledge?
- Where might the author be correct despite flaws?
- What's the charitable interpretation?

## Source Credibility Assessment

**Author background:**

- Relevant expertise in the field?
- Potential conflicts of interest?
- Track record of accuracy?

**Publication context:**

- Peer-reviewed? Editorial standards?
- Primary source or interpretation?
- Publication date (currency)?

**Motivation analysis:**

- What's the author's goal? (inform / persuade / sell)
- Who benefits from this claim?
- What's the intended audience?

## Counter-Evidence Search

When analyzing strong claims, actively look for:

1. Studies with opposite findings.
2. Expert disagreement.
3. Failed replications.
4. Boundary conditions (when doesn't it work?).

## Balanced Evaluation Template

```markdown
## Argument Strengths
- [What's well-supported]
- [Strong evidence points]

## Argument Weaknesses
- [Logical gaps]
- [Weak or missing evidence]

## Unanswered Questions
- [What the argument doesn't address]

## Conditional Truth
This argument is strongest when: [context]
This argument is weakest when:   [context]
```

## Steelmanning Practice

Before criticizing, construct the **strongest possible version** of
the argument:

1. Fill in logical gaps charitably.
2. Add best possible supporting evidence.
3. Address obvious objections.
4. THEN evaluate this strongest version.

This prevents attacking strawmen and ensures fair evaluation.

---

## ADOPT citation

Adopted from [`ginobefun/deep-reading-analyst-skill`](https://github.com/ginobefun/deep-reading-analyst-skill) @ commit `26cd7dc9` · `src/deep-reading-analyst/references/critical_thinking.md` · MIT License.

