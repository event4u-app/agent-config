# Systems Thinking

Reference guideline for Wing-1 deep-thinking work — Donella Meadows'
parts-and-relationships lens. Understand a system by mapping
components, interconnections, purpose, and boundaries; then trace
feedback loops, leverage points, and cross-domain archetypes that
reveal where intervention has the highest impact. Adopted under the
**Reference-Guideline Sunset Policy** and cross-referenced from:

- [`deep-reading-analyst`](../../../.agent-src.uncondensed/skills/deep-reading-analyst/SKILL.md)
  — L3 Deep analysis depth.
- [`mental-models`](mental-models.md) — Munger's lattice; systems
  thinking is one of the strongest engineering / biology lenses.
- [`first-principles`](first-principles.md) — pairs with system
  rebuild after assumption strip.
- [`six-hats`](six-hats.md) — apply Yellow / Black on identified
  leverage points.

> **Core principle:** "The system is more than the sum of parts."
> — Donella Meadows. Behavior emerges from interactions, not
> components.

## Key System Elements

1. **Components (elements)** — the individual parts of the system.
2. **Relationships (interconnections)** — how components influence
   each other.
3. **Purpose (function)** — what the system is designed to achieve.
4. **Boundaries** — what's inside vs. outside the system.

## Causal Loop Analysis

### Reinforcing loop (positive feedback)

Creates exponential growth or collapse.

```
A increases → B increases → A increases further → ...
```

**Examples:**

- Network effects: more users → more value → more users.
- Panic: fear → selling → price drop → more fear.
- Expertise: skill → opportunities → more practice → more skill.

**Symbol:** R (Reinforcing).

### Balancing loop (negative feedback)

Creates stability and resistance to change.

```
A increases → B increases → A decreases → B decreases → ...
```

**Examples:**

- Thermostat: temp up → heating off → temp down → heating on.
- Supply / demand: price up → demand down → price down.
- Homeostasis: blood sugar up → insulin up → blood sugar down.

**Symbol:** B (Balancing).

## Mapping Template

```markdown
## System Components
- Component A: [Role / function]
- Component B: [Role / function]
- Component C: [Role / function]

## Key Relationships

[A] ──+──> [B]  (A increases B)
       |
       └──-──> [C]  (A decreases C)

## Feedback Loops

### Loop 1: [Name] (R / B)
A → B → C → A
Effect: [Exponential growth / Stabilization]

## System Behavior Over Time

Current state: [X]
If X increases: [Trace effects through system]
If X decreases: [Trace effects through system]
```

## Leverage Points

Donella Meadows' hierarchy, strongest to weakest:

1. **Paradigms** — mental models underlying the system.
2. **Goals** — purpose of the system.
3. **System structure** — feedback loop architecture.
4. **Delays** — response time between cause and effect.
5. **Balancing loops** — strength of stabilizing forces.
6. **Reinforcing loops** — strength of amplifying forces.
7. **Information flows** — who knows what, when.
8. **Rules** — incentives, constraints.
9. **Buffers** — stabilizing stocks.
10. **Stock-flow structures** — physical components.
11. **Parameters** — numbers (least effective).

**Insight:** most people tweak parameters (#11), but changing
paradigms (#1) is far more powerful.


## Cross-Domain Pattern Recognition

### Tragedy of the Commons

- Environment: overfishing.
- Digital: bandwidth congestion.
- Social: public resource depletion.
- Organizational: shared resource competition.

### Network Effects

- Technology: social media platforms.
- Economics: currency adoption.
- Language: English as lingua franca.
- Standards: USB-C adoption.

### Limits to Growth

- Biology: population dynamics.
- Business: market saturation.
- Personal: skill plateaus.
- Resources: oil production peak.

## Analysis Questions

### Structure

- What are the key components?
- What connects them?
- Where are the feedback loops?

### Behavior

- What patterns emerge over time?
- What's amplifying? (reinforcing loops)
- What's stabilizing? (balancing loops)

### Dynamics

- What happens if X increases 10x?
- Where are delays causing problems?
- What's the bottleneck?

### Boundaries

- What's outside this system but affects it?
- Where do we draw the line?
- What external factors matter?

## Systems Archetypes

| Archetype | Pattern | Example |
|---|---|---|
| **Shifting the burden** | Short-term fix undermines long-term solution | Painkillers (symptom) vs. fixing posture (cause) |
| **Escalation** | Both sides respond to each other, spiraling up | Arms race · price wars · social-media arguments |
| **Success to the successful** | Winner gets compounding advantages | Bestseller lists · platform dominance |
| **Fixes that fail** | Initial solution creates worse problem | Antibiotic resistance · induced traffic demand |
| **Growth and underinvestment** | Growth stalls because capacity wasn't built | Startup success → can't scale → service degrades |

## Application to Content Analysis

When reading about any topic:

1. **Map the system** — list elements mentioned, draw connections.
2. **Identify loops** — what reinforces growth / decline? what
   creates balance / limits?
3. **Predict dynamics** — if X changes, what cascades follow? where
   in 1 year? 5 years?
4. **Find leverage** — where is the author intervening? are there
   better leverage points?
5. **Connect to other domains** — what similar patterns exist
   elsewhere? can solutions from other fields apply?

## Cross-Domain Analysis Template

```markdown
## Concept in Article
[Core idea from content]

## Similar Patterns In:

**Economics:**  [How this shows up]
**Biology:**    [How this shows up]
**Psychology:** [How this shows up]
**Technology:** [How this shows up]
**History:**    [How this shows up]

## Transferable Insights
If this pattern exists across domains, then:
- [Universal principle 1]
- [Universal principle 2]
```

## Pitfalls

- **Over-complicating** — not everything needs a full system map.
- **Analysis paralysis** — perfect map vs. good-enough understanding.
- **Ignoring human agency** — people can change system rules.
- **Determinism** — systems have probability, not certainty.
- **Closed thinking** — real systems have open boundaries.

**Balance:** use systems thinking to understand dynamics, not to
predict perfectly.

---

## ADOPT citation

Adopted from [`ginobefun/deep-reading-analyst-skill`](https://github.com/ginobefun/deep-reading-analyst-skill) @ commit `26cd7dc9` · `src/deep-reading-analyst/references/systems_thinking.md` · MIT License.
