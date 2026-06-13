# 5W2H Analysis

Reference guideline for Wing-1 deep-thinking work — the 5W2H systematic
questioning method (What · Why · Who · When · Where · How · How-much) for
comprehensive understanding of any topic, problem, or plan. Adopted under
the **Reference-Guideline Sunset Policy** (see frontmatter `upstream` /
`refresh_trigger` keys) and cross-referenced from:

- [`deep-reading-analyst`](../../../.agent-src.uncondensed/skills/deep-reading-analyst/SKILL.md)
  — L1 Quick analysis depth.
- [`refine-ticket`](../../../.agent-src.uncondensed/skills/refine-ticket/SKILL.md)
  — completeness check on a Jira / Linear ticket before estimation.
- [`bug-investigate`](../../../.agent-src.uncondensed/commands/bug-investigate.md)
  — gap analysis on an incident report before forming a hypothesis.

> **Core principle:** "Quality of decisions equals quality of questions
> asked." — 5W2H captures essence in seven dimensions.

## When to Use

Ideal for:

- 📋 Quickly understanding complete article information
- 🔍 Discovering information gaps and omissions
- 📊 Evaluating plan feasibility
- 💼 Analyzing business cases and proposals
- 📝 Organizing complex information
- ✅ Verifying information completeness

Do **not** use when the user wants depth on a single dimension (use
[`mental-models`](mental-models.md)) or pre-mortem on failure paths
(use [`inversion-thinking`](inversion-thinking.md)).

## The 7 Questions in Detail

### W1: What (Content)

**Core questions:**

1. What is the main topic?
2. What are the key claims / conclusions?
3. What solutions are proposed?
4. What core concepts are involved?
5. What are the expected outcomes?

**Deep inquiry:** What is the real problem? What is missing? What
could go wrong? What are the alternatives?

### W2: Why (Reasons)

**Core questions:**

1. Why discuss this topic now?
2. Why is this solution effective?
3. Why not choose other approaches?
4. Why should the audience care?
5. Why this timing?

**Five Whys technique** — ask "why" five times to reach root cause:

```
Problem: [Surface issue]
→ Why 1: [First layer]
  → Why 2: [Second layer]
    → Why 3: [Third layer]
      → Why 4: [Fourth layer]
        → Why 5: [Root cause] ← Real issue
```

### W3: Who (People)

**Core questions:**

1. Who is the target audience?
2. Who are the stakeholders?
3. Who is responsible for execution?
4. Who benefits? Who loses?
5. Whose expertise / cases are cited?
6. Who is the author? (potential biases?)

**Deep analysis:** stakeholder mapping · decision-makers vs. executors
· who has veto power.

### W4: When (Timing)

**Core questions:**

1. When to start?
2. What is the timeline / schedule?
3. When will results appear?
4. How time-sensitive is this?
5. When are key decisions needed?
6. What is the historical context?

**Time-trap identification:** unrealistic time expectations · missing
key milestones · buffer time considered.

### W5: Where (Context)

**Core questions:**

1. Where does this apply? (geography, industry, organization)
2. Where is execution happening?
3. Where to get resources?
4. What are the limitations / constraints?
5. What is the scope of impact?

**Context dependency:** does it work in different environments? ·
cultural differences · scale considerations.

### H1: How (Methods)

**Core questions:**

1. What are the specific steps?
2. What tools / methods are used?
3. How to measure progress?
4. How to handle obstacles?
5. How to ensure quality?
6. How to get started?

**Process mapping:**

```
[Start] → [Step 1] → [Decision Point]
                         ↓ Yes / ↓ No
                    [Step 2A]  [Step 2B]
                         ↓         ↓
                    [Step 3] ← [Converge]
                         ↓
                    [End]
```

### H2: How Much (Metrics)

**Core questions:**

1. What is the cost? (money, time, opportunity, learning)
2. How many resources needed?
3. What is the expected ROI?
4. What is the scale / magnitude?
5. How big are the risks?
6. What are the target metrics?

**ROI analysis:**

```
Investment:
- Direct costs:   [$]
- Indirect costs: [$]
- Total:          [$]

Returns:
- Expected benefit: [$]
- Timeframe:        [X months]
- ROI = (Benefit - Cost) / Cost × 100%

Worth it?: [Yes / No]
```

## Complete Analysis Template

### Quick version (15 min)

```markdown
# 5W2H Quick Analysis: [Article Title]

**What**:     [One-line topic and solution]
**Why**:      [Core motivation and value]
**Who**:      [Target audience and executors]
**When**:     [Timeline and urgency]
**Where**:    [Applicability and context]
**How**:      [Key steps (3–5)]
**How much**: [Main costs and expected returns]

## Gap Analysis

Missing information: [List unanswered questions from 5W2H]
Key risks:           [Risks based on missing info]
```

### Deep version (60 min)

```markdown
# 5W2H Deep Analysis: [Article Title]

## 📋 What — Content Analysis
[Detailed breakdown…]

## 🎯 Why — Reason Analysis
[Detailed breakdown…]
[Five Whys analysis]

## 👥 Who — People Analysis
[Detailed breakdown…]
[Stakeholder map]

## ⏰ When — Time Analysis
[Detailed breakdown…]
[Timeline visualization]

## 🌍 Where — Context Analysis
[Detailed breakdown…]
[Applicability matrix]

## 🔧 How — Method Analysis
[Detailed breakdown…]
[Process flowchart]

## 💰 How Much — Cost-Benefit Analysis
[Detailed breakdown…]
[ROI calculation]

## 📊 Overall Assessment

### Information completeness
- ✅ Clearly answered:   [X / 7]
- ⚠️  Partially answered: [List]
- ❌ Completely missing: [List]

### Feasibility score
Based on 5W2H completeness: [X / 10]

### Risk level
Based on missing info: [High / Medium / Low]

### Action recommendations
1. [Specific recommendation based on analysis]
2. [Information needed to supplement]
3. [Priority actions to take]
```

## Integration with Other Frameworks

### + Critical Thinking

```
5W2H              → Identify missing information
Critical Thinking → Evaluate quality of existing information
```

### + SCQA

```
SCQA  → Understand problem framework
5W2H  → Analyze solution completeness
```

### + Inversion

```
5W2H      → Forward analysis of plan
Inversion → For each W / H, ask "what if it's missing?"
```

---

## ADOPT citation

Adapted from an external reference.
