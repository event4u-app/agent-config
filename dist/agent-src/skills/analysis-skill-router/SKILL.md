---
model_tier: high
name: analysis-skill-router
description: "Use when picking which analysis or project-analysis-* skill fits a request — routes by scope, framework, and symptom — even if the user just says 'analyze this' or 'dig into the codebase'."
domain: discovery
workspaces:
  - agent-config-maintainer
packs:
  - meta
---

# analysis-skill-router

A chooser, not a worker. It answers exactly one question — *which skill* — and
then gets out of the way. How to actually carry out the work belongs to
whichever skill this picks; a chooser that also explains the work reads like
its own fallback target, which is the defect this file was cut back from.

## When to use

Use this skill when:

* A request may need deep analysis
* It is unclear which analysis skill should be used
* Multiple analysis skills could plausibly apply
* The stack/framework is known but the correct analysis path is unclear
* `analysis-autonomous-mode` needs a routing decision

Do NOT use when:

* The correct specialist skill is already obvious
* The task is not an analysis task
* The task is normal implementation work without investigation needs

## Procedure

### 1. Classify the scope

Pick one: full project · architecture review · broad multi-layer debugging ·
framework-specific deep dive · narrow root cause · performance/security
specialist · simple local issue.

**Broad scope requires a reason.** At least one must hold, or the answer is a
narrow specialist: the user asked for breadth · the system is unknown · the
issue spans layers · architecture must be reconstructed · the cause is
non-local.

### 2. Detect the framework

Laravel · Symfony · Zend/Laminas · Node/Express · React · Next.js · unknown or
mixed.

### 3. Read the decision table

| Signal | Route to |
|---|---|
| Full audit, or unclear stack | `universal-project-analysis` |
| Unknown system, discovery-focused | `project-analysis-core` |
| Concrete problem, several plausible causes | `project-analysis-hypothesis-driven` |
| Bug-focused, not full-project | `bug-analyzer` |
| Laravel | `project-analysis-laravel` |
| Symfony | `project-analysis-symfony` |
| Zend/Laminas | `project-analysis-zend-laminas` |
| Node/Express | `project-analysis-node-express` |
| React state / render / hooks | `project-analysis-react` |
| Next.js SSR / cache / hydration | `project-analysis-nextjs` |
| Bottleneck | `performance-analysis` |
| Security concern | `security-audit` |

Tie-break: **the narrowest row that still covers the request wins.**

## Output format

1. The selected skill.
2. The signal from step 1–2 that selected it.
3. Why the next-broader row lost, when one was plausible.
4. Any skill to chain afterwards — or "none".

One or two lines total. A routing verdict longer than the request it routes is
itself a routing failure.

## Examples

| Request | Route |
|---|---|
| "Analyze this whole Laravel project" | `universal-project-analysis`, chain `project-analysis-laravel` |
| "Hydration mismatch in Next.js" | `project-analysis-nextjs` — no full-project step |
| "Could be cache, queue, or a version mismatch" | `project-analysis-hypothesis-driven` |
| "Change one React component" | none — implementation skill |

## Gotcha

* **Size adjectives read as scope.** "Our *whole* Laravel app is slow" picks the
  broad row on the word "whole", and the audit then spends its passes
  rediscovering a stack the request already named. The step-2 framework signal
  outranks size words — those are how frustration sounds, not scope.
* **Breadth feels safe and costs sharpness.** The most expensive choice is
  rarely the best one once the problem is already localised.
* **Steps 1 and 2 disagreeing is a question, not a tie-break.** Ask which the
  user meant instead of picking the broader row to be safe.

## Do NOT

* Do NOT default to `universal-project-analysis`
* Do NOT choose a generic skill when a framework-specific row fits
* Do NOT confuse discovery with root-cause investigation
* Do NOT re-import procedure, validation checklists, or output contracts from
  the skills in the table — that is what this file was cut back from
