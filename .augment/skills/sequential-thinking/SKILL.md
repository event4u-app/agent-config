---
name: sequential-thinking
description: "ONLY when user explicitly requests: step-by-step reasoning, structured problem decomposition, or iterative analysis. NOT for regular coding tasks."
source: package
---

# sequential-thinking

## When to use

Use this skill when:
- A problem requires multiple interconnected reasoning steps
- The initial scope or approach is uncertain
- You need to filter through complexity to find core issues
- You may need to backtrack or revise earlier conclusions
- You want to explore alternative solution paths
- A decision has significant consequences and needs careful analysis

Do NOT use for:
- Simple queries with direct answers
- Single-step tasks
- Well-understood, routine operations

## Core capabilities

### Iterative reasoning

Break complex problems into sequential thought steps. Each step builds on previous ones
but can also question or revise them.

### Dynamic scope

Start with an estimate of needed steps, but adjust as understanding evolves.
Don't commit to a fixed plan — let the analysis guide the depth.

### Revision tracking

When new information contradicts an earlier conclusion:
1. **Acknowledge** the contradiction explicitly.
2. **Identify** which earlier step needs revision.
3. **Revise** the conclusion with the new evidence.
4. **Propagate** the change to all dependent steps.

### Branch exploration

When multiple approaches seem viable:
1. **Identify** the decision point.
2. **Explore** each branch briefly (2-3 steps).
3. **Compare** outcomes and tradeoffs.
4. **Choose** the best path with reasoning.
5. **Document** why alternatives were rejected.

## Procedure: Sequential thinking

### Step 1: Frame the problem

- What exactly needs to be solved?
- What are the constraints?
- What does success look like?
- What information is missing?

### Step 2: Decompose

- Break into independent sub-problems where possible.
- Identify dependencies between sub-problems.
- Order by dependency (solve prerequisites first).

### Step 3: Solve iteratively

For each sub-problem:
1. **Analyze** — What do we know? What do we need?
2. **Hypothesize** — What's the most likely solution?
3. **Verify** — Does the hypothesis hold against evidence?
4. **Conclude** or **Revise** — Accept or go back to step 1.

### Step 4: Synthesize

- Combine sub-problem solutions into the overall answer.
- Check for contradictions between sub-solutions.
- Verify the combined solution against the original problem.

### Step 5: Validate

- Does the solution actually solve the stated problem?
- Are there edge cases not covered?
- Is the solution proportional to the problem (not over-engineered)?

## When to revise

Revise earlier thinking when:
- New evidence contradicts a previous assumption.
- A sub-problem solution doesn't fit the overall picture.
- The user provides new information that changes the context.
- You realize you were solving the wrong problem.

## When to branch

Explore alternatives when:
- Two approaches seem equally viable.
- The stakes are high (architecture decisions, data migrations).
- The user asks "what if we did X instead?"
- The first approach hits a dead end.

## Integration with other skills

- **bug-analyzer** — Use sequential thinking for complex root cause analysis.
- **feature-planning** — Use for architecture decision exploration (Phase 4).
- **technical-specification** — Use for evaluating alternatives in specs.
- **refactorer** — Use for planning multi-step refactoring safely.

## Anti-patterns

| Anti-pattern | Problem | Fix |
|---|---|---|
| **Premature conclusion** | Jumping to a solution without analysis | Complete at least Steps 1-3 first |
| **Analysis paralysis** | Endless exploration without deciding | Set a step limit, then decide |
| **Ignoring contradictions** | Pushing forward despite conflicting evidence | Stop and revise |
| **Linear-only thinking** | Never considering alternatives | Branch at key decision points |
| **Scope creep** | Problem keeps expanding during analysis | Re-frame and constrain |


## Auto-trigger keywords

- problem solving
- step-by-step
- reasoning
- decomposition

## Output format

1. Numbered reasoning steps with conclusions
2. Final answer or recommendation with confidence level

## Gotcha

- Don't use sequential thinking for simple tasks — it adds latency without value.
- The model tends to generate too many thoughts — cap at 10 unless the problem truly needs more.
- Each thought should build on the previous one — avoid restating the same point in different words.

## Do NOT

- Do NOT use this for simple, well-understood tasks — it adds unnecessary overhead.
- Do NOT call `sequentialthinking` more than **once per task**. If you're calling it repeatedly,
  you're looping — stop and act directly instead.
- Do NOT use `sequentialthinking` as a "thinking proxy" — if the task is "view a file" or
  "run a command", just do it. No thinking step needed.
- Do NOT skip the validation step — always check the solution against the original problem.
- Do NOT ignore contradictions — they are signals, not noise.
- Do NOT commit to a fixed number of steps upfront — let the problem guide the depth.
