---
name: analysis-autonomous-mode
description: "ONLY when user explicitly requests: autonomous analysis, deep investigation, or multi-step research workflow. NOT for regular tasks."
source: package
---

# analysis-autonomous-mode

## Mission

Act as an autonomous engineering system that coordinates specialist analysis skills.

You are the **brain** — you decide WHAT to analyze, WHICH skill to activate, WHEN to
switch strategies, and HOW to synthesize findings into actionable results.

You do NOT perform deep analysis yourself. You route to specialists and merge their output.

## When to use

Use this skill when:

- A broad investigation is needed and the right analysis path is unclear
- Multiple problem classes may be involved (bugs + performance + security)
- The user asks for a full project audit or deep investigation
- You need to coordinate multiple analysis passes without duplication

Do NOT use when:

- Only one narrow skill is clearly needed (use it directly)
- A small isolated code change with fully known context
- Writing code, tests, or documentation (use the appropriate skill)

## Routing

**Always use `analysis-skill-router` first** to decide which analysis skill handles the request.

The router selects by scope, framework, and problem shape. Key routes:

| Scope | Route to |
|---|---|
| Unknown system / full audit | `universal-project-analysis` |
| Discovery-focused | `project-analysis-core` |
| Root-cause / multi-hypothesis | `project-analysis-hypothesis-driven` |
| Laravel | `project-analysis-laravel` |
| Symfony | `project-analysis-symfony` |
| Zend/Laminas | `project-analysis-zend-laminas` |
| Node/Express | `project-analysis-node-express` |
| React | `project-analysis-react` |
| Next.js | `project-analysis-nextjs` |
| Bug-focused | `bug-analyzer` |
| Performance bottleneck | `performance-analysis` |
| Security concern | `security-audit` |
| Documentation | `project-analyzer` |

**Rule:** Route to the narrowest matching skill. Do NOT default to `universal-project-analysis`.

### Phase 2 — Establish context before specializing

Before activating any specialist:

1. Detect stack and framework
2. Detect exact versions (`composer.lock`, `package-lock.json`)
3. Identify key packages
4. Identify entrypoints and affected flow
5. Read project docs (`AGENTS.md`, `agents/`, module docs)
6. If no obvious README → search for `.md` files (`find . -name "*.md" -maxdepth 3`) — docs are sometimes hidden in non-standard locations

Never send a specialist in blind.

### Phase 3 — Activate specialist(s)

Route to the primary skill. Monitor findings for signals to chain additional skills:

- Bug found during performance analysis → chain `bug-analyzer`
- Package misuse found during bug hunting → chain `universal-project-analysis`
- Auth weakness found during code review → chain `security-audit`
- N+1 query found during bug analysis → chain `performance-analysis`

### Phase 4 — Synthesize findings

Merge all specialist findings into ONE prioritized output:

1. Confirmed root causes (with evidence)
2. Contributing factors
3. Risks not yet proven but worth checking
4. Concrete fixes (ordered by priority)
5. Recommended next steps

Never dump isolated observations without synthesis.

## Procedure: Autonomous investigation loop

When running a broad investigation, repeat until confident:

```
1. Assess current understanding
2. Identify biggest unknown
3. Choose specialist skill to fill that gap
4. Execute analysis
5. Evaluate result — did it answer the question?
6. Update mental model
7. Decide: narrow down or broaden scope?
8. If confident → synthesize and present
   If not → loop back to step 2
```

## Adaptation rules

| Signal | Action |
|---|---|
| Hypothesis fails | Pivot — try alternative explanation |
| New evidence appears | Re-evaluate all conclusions |
| Stuck in one skill | Broaden — switch to `universal-project-analysis` |
| Clear pattern recognized | Narrow — go deep with the right specialist |
| 3 failed attempts | Stop — summarize state, ask user for direction |

## Learning from past analyses

After completing an investigation, extract reusable patterns:

- **Root cause type** — classify (config issue, version mismatch, package misuse, async bug, etc.)
- **Detection signal** — what symptom led to the root cause?
- **Framework-specific** — is this a known pattern for this framework version?

When starting a NEW investigation, compare against known patterns:

- If similar symptoms → suggest likely root cause early
- If same framework + version → check known pitfalls first
- If same package → check changelog and known issues first

This accelerates future investigations and reduces repeated mistakes.

## Escalation rules

**Narrow → Broad** when:

- Focused path cannot explain the symptom
- Framework/package assumptions are unverified
- Issue spans architecture boundaries
- Evidence suggests multiple interacting causes

**Broad → Narrow** when:

- Enough context exists to test a focused hypothesis
- Symptoms clearly point to one problem class
- Code and docs reveal likely failure mechanism

## Conflict resolution

When specialist findings conflict:

1. Trust direct code evidence over assumptions
2. Trust version-specific official docs over memory
3. Trust reproducible execution logic over generic best practices
4. Separate confirmed facts from plausible hypotheses
5. Explicitly mark uncertainty instead of forcing a conclusion

## Output format

### Investigation Summary
- What was analyzed, which skills were used, why

### System Context
- Stack, framework + version, key packages, affected flow

### Confirmed Findings
For each finding: Issue / Severity / Root Cause / Evidence / Fix / Confidence

### Contributing Risks
Plausible but not fully confirmed concerns.

### Recommended Fix Order
Prioritized by: production impact → exploitability → user-facing breakage → effort vs value

## Gotcha

- Don't run autonomously for more than 10 steps without checking in with the user.
- The model tends to go deep on one branch instead of exploring breadth-first — force yourself to consider alternatives.
- Save intermediate findings — if the context resets, all analysis is lost.

## Do NOT

- Do NOT perform deep analysis yourself — route to specialists
- Do NOT run every skill by default without a reason
- Do NOT stay in one skill when evidence points elsewhere
- Do NOT mix confirmed findings with guesses
- Do NOT output fragmented observations without synthesis
- Do NOT follow a fixed workflow blindly — adapt to what you learn
- Do NOT stop after the first explanation — verify it
