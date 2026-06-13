# Six Thinking Hats

Reference guideline for Wing-1 deep-thinking work — Edward de Bono's
six-perspective method for examining ideas through Facts · Feelings ·
Cautions · Benefits · Creativity · Process — one hat at a time, to
separate thinking modes and avoid the cross-talk that derails group
decisions. Adopted under the **Reference-Guideline Sunset Policy** and
cross-referenced from:

- [`deep-reading-analyst`](../../../.agent-src.uncondensed/skills/deep-reading-analyst/SKILL.md)
  — L2 Standard analysis depth (multi-perspective sweep).
- [`ai-council`](../../../.agent-src.uncondensed/skills/ai-council/SKILL.md)
  — multi-model consultation pattern; Six Hats is the per-perspective
  decomposition the council voices use when adjudicating a decision.
- [`/council`](../../../.agent-src.uncondensed/commands/council.md)
  — internal council orchestrator routing to per-hat persona prompts.

> **Core principle:** "Wear one hat at a time." — separating thinking
> modes reduces conflict and ensures comprehensive coverage of facts,
> emotions, risks, value, alternatives, and meta-process.

## When to Use

Ideal for:

- Multi-perspective decision review without role-locking
- Group sessions where parallel thinking is needed
- Avoiding the "this is good but risky" mode-mixing trap
- Pre-mortem on a plan when [`inversion-thinking`](inversion-thinking.md)
  is too narrow (Black hat alone) and you want all six lenses

Do **not** use when the user wants depth on a single dimension (use
[`mental-models`](mental-models.md)) or a structured decision artifact
(use [`scqa-framework`](scqa-framework.md)).

## The Six Hats

### White Hat — Facts & Data

**Focus:** objective information only.

**Questions:**

- What facts do we have?
- What data is available?
- What information is missing?
- What are the numbers?
- How do we verify this?

**Language:** "According to…", "The data shows…", "We know that…",
"We don't know…".

**In content analysis:** extract factual claims · note cited sources ·
identify missing data · separate facts from interpretations.

**Template:**

```markdown
## Known Facts
- [Verifiable fact 1]
- [Verifiable fact 2]

## Missing Information
- [ ] [Gap 1]
- [ ] [Gap 2]

## Data Sources
- [Citation 1]: [Quality rating]
```

### Red Hat — Emotions & Intuition

**Focus:** gut feelings, hunches, intuitive responses.

**Questions:**

- What's my immediate reaction?
- What does my gut say?
- What emotions does this evoke?
- What's my intuition telling me?

**Language:** "I feel that…", "My gut says…", "This makes me
uncomfortable because…", "I'm excited about…".

**In content analysis:** note emotional response while reading ·
identify what triggers strong feelings · trust instincts about
credibility · recognize persuasive emotional appeals in text.

**Template:**

```markdown
## Immediate Reactions
- [Emotion] at [specific part]

## Gut Feelings
- Something feels off about: [intuition]
- Exciting / Compelling: [what resonates]

## Emotional Triggers in Text
- Author uses [emotion] to persuade
```

**Important:** no justification needed. Pure feeling.

### Black Hat — Caution & Risks

**Focus:** critical judgment, potential problems.

**Questions:**

- What could go wrong?
- What are the risks?
- What's unrealistic?
- Where's the weakness?
- What are the downsides?

**Language:** "A problem is…", "This won't work because…", "The risk
here is…", "We're overlooking…".


**In content analysis:** identify logical flaws · note unsupported
claims · point out potential failures · question feasibility ·
consider unintended consequences.

**Template:**

```markdown
## Logical Weaknesses
- [Flaw 1] in reasoning

## Risks If Applied
- Risk: [consequence]
- When it fails: [scenario]

## Missing Considerations
- Doesn't account for: [factor]

## Overly Optimistic Claims
- [Claim] seems unrealistic because [reason]
```

**Important:** critical, not cynical. Necessary for risk assessment.

### Yellow Hat — Benefits & Optimism

**Focus:** positive aspects, value, opportunities.

**Questions:**

- What's the value here?
- What are the benefits?
- Why would this work?
- What's the best-case scenario?
- What opportunities does this create?

**Language:** "The benefit is…", "This could work because…", "The
value here is…", "An opportunity is…".

**In content analysis:** extract valuable insights · identify strong
arguments · note practical applications · find novel perspectives ·
recognize what advances the field.

**Template:**

```markdown
## Key Value Propositions
- Valuable insight: [what's useful]

## Strong Points
- Well-supported: [argument]

## Potential Applications
- Could be used for: [use case]

## Novel Contributions
- New perspective on: [topic]

## Best-Case Outcome
If fully applied: [positive scenario]
```

**Important:** be realistic but generous. Find genuine value.

### Green Hat — Creativity & Alternatives

**Focus:** new ideas, possibilities, innovations.

**Questions:**

- What else is possible?
- How else could we think about this?
- What's a creative alternative?
- What if we combined X with Y?
- What's unconventional?

**Language:** "What if…", "Another way to look at it…", "We could
also…", "An alternative is…".

**In content analysis:** extend the author's ideas further · generate
alternatives to proposed solutions · combine with other frameworks ·
apply to new domains · challenge assumptions creatively.

**Template:**

```markdown
## Extensions of Ideas
- Taking [concept] further: [new application]

## Alternative Approaches
Instead of [author's method], what if: [alternative]

## Creative Combinations
- [Idea from text] + [other framework] = [new insight]

## Unconventional Applications
- Apply this to [unexpected domain]

## "What If" Scenarios
- What if [assumption] were reversed?
```

**Important:** no criticism in green-hat mode. All ideas welcome.

### Blue Hat — Process & Meta-Thinking

**Focus:** managing thinking, overview, conclusions.

**Questions:**

- What have we covered?
- What thinking mode do we need now?
- What's the summary?
- What's next?
- How should we think about this?

**Language:** "We've covered…", "The next step is…", "In summary…",
"We need to focus on…".

**In content analysis:** decide which hats to use when · synthesize
findings from all hats · determine next steps · plan learning
strategy · monitor the analysis process.

**Template:**

```markdown
## Analysis Process
1. White: Gathered facts
2. Red: Noted reactions
3. Black: Identified risks
4. Yellow: Found value
5. Green: Generated alternatives

## Synthesis
Combining all perspectives:
- [Integrated insight]

## Next Steps
- [ ] Further research: [area]
- [ ] Practical test: [action]
- [ ] Deep dive: [topic]

## Time Investment
Worth [X] time because [reason]
```

**Important:** Blue hat organizes the other hats. It's the conductor.

## Usage Patterns

| Pattern | Sequence |
|---|---|
| **Quick evaluation (15 min)** | White → Red → Yellow → Black → Blue |
| **Deep analysis (60 min)** | White → Red → Black → Yellow → Green → Blue → revisit any → Blue |
| **Problem-solving** | White → Red → Green → Yellow → Black → Green → Blue |
| **Decision-making** | White → Yellow → Black → Red → Blue |

## Rules of Engagement

1. **One hat at a time** — don't mix modes.
2. **Everyone wears the same hat** — parallel thinking (if group).
3. **Separate person from hat** — you're not "the critical person",
   you're wearing the Black hat.
4. **Time-box** — set limits per hat.
5. **Blue hat controls** — decides sequence and timing.

## Common Mistakes

- ❌ **Mixing hats** — *"This is good (yellow) but risky (black)."*
  ✅ **Separate:** Yellow session: *"This is good because X."* Then
  Black session: *"The risk is Y."*
- ❌ **Judging feelings** — *"That's irrational"* during Red hat.
  ✅ **Accept feelings:** all emotions noted without judgment.
- ❌ **Weak yellow** — *"I guess there's some value…"*.
  ✅ **Genuine optimism:** really find the good.
- ❌ **Staying too long** — 30 min per hat.
  ✅ **Move on:** 5–10 min per hat is usually sufficient.

## Application to Reading

**When to use which hat:**

- **Understanding stage:** White (facts), Red (reactions).
- **Evaluation stage:** Black (critique), Yellow (value).
- **Application stage:** Green (ideas), Blue (synthesis).

**Full cycle:**

1. White: what does the text actually say?
2. Red: how do I feel about it?
3. Black: what's wrong with it?
4. Yellow: what's right with it?
5. Green: what else could we do with this?
6. Blue: so what? Now what?

## Integration with Other Frameworks

- **After [`first-principles`](first-principles.md):** use hats to
  evaluate the rebuilt argument.
- **After [`systems-thinking`](systems-thinking.md):** use Yellow /
  Black on leverage points.
- **Before [`critical-thinking`](critical-thinking.md):** use Red to
  surface biases.
- **During synthesis:** use Blue to organize findings.

## Output Format

```markdown
# Six Hats Analysis: [Content Title]

## White: Facts
[Objective data]

## Red: Feelings
[Emotional response]

## Black: Cautions
[Risks and weaknesses]

## Yellow: Benefits
[Value and opportunities]

## Green: Possibilities
[Creative extensions]

## Blue: Conclusions
[Synthesis and next steps]
```

---

## ADOPT citation

Adapted from an external reference.
