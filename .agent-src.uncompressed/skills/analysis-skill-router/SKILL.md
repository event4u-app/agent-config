---
name: analysis-skill-router
description: "Use when picking which analysis or project-analysis-* skill fits a request — routes by scope, framework, and symptom — even if the user just says 'analyze this' or 'dig into the codebase'."
source: package
---

# analysis-skill-router

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

### 1. Identify request scope

Classify the request as one of:

* full project analysis
* architecture review
* broad multi-layer debugging
* framework-specific deep analysis
* narrow root-cause analysis
* performance/security specialist analysis
* simple local code issue

### 2. Check whether deep analysis is justified

Use deep analysis only if at least one is true:

* the user explicitly asks for broad analysis
* the system is unclear or unknown
* the issue spans multiple layers
* architecture reconstruction is required
* the cause is not local and not obvious

If none apply → do NOT route to a broad analysis skill.

### 3. Detect framework or system type

Check whether the request clearly targets:

* Laravel, Symfony, Zend/Laminas, Node/Express, React, Next.js
* unknown / mixed stack

### 4. Route to the correct skill

#### Broad / unknown system

* full project analysis or unclear stack → `universal-project-analysis`
* unknown system, discovery-focused → `project-analysis-core`

#### Root-cause analysis

* concrete multi-cause problem → `project-analysis-hypothesis-driven`
* bug-focused but not full-project → `bug-analyzer`

#### Backend framework analysis

* Laravel → `project-analysis-laravel`
* Symfony → `project-analysis-symfony`
* Zend/Laminas → `project-analysis-zend-laminas`
* Node/Express → `project-analysis-node-express`

#### Frontend / rendering analysis

* React state/render/hooks issues → `project-analysis-react`
* Next.js SSR/client/cache/hydration issues → `project-analysis-nextjs`

#### Specialist follow-up routing

* performance bottleneck → `performance-analysis`
* security concern → `security-audit`

### 5. Validate routing quality

Check:

* the chosen skill is narrower than the broadest possible option
* full-project analysis is actually justified if selected
* framework-specific skill matches the explicit framework
* no simpler specialist skill was skipped

## Output format

1. Selected skill
2. Reason for selection
3. Why broader alternatives were not chosen
4. Optional chained specialist skills

## Routing heuristics

**Choose `universal-project-analysis` only if:** user explicitly wants full audit, architecture must be reconstructed, stack is unclear, multiple subsystems involved.

**Choose `project-analysis-core` if:** broad discovery needed, framework deep-dive not yet justified.

**Choose `project-analysis-hypothesis-driven` if:** problem is concrete, multiple causes plausible, main job is explanation not discovery.

**Choose framework-specific analysis if:** framework is explicit, failure pattern is framework-shaped.

**Do NOT route broadly if:** one component or file is enough, fix is obvious and local, task is implementation not investigation.

## Examples

**"Analyze this whole Laravel project"** → `universal-project-analysis` → chain `project-analysis-laravel`
**"Hydration mismatch in Next.js"** → `project-analysis-nextjs` (no full-project needed)
**"Bug could be cache, queue, or version mismatch"** → `project-analysis-hypothesis-driven`
**"Change one React component"** → no analysis skill, use implementation skill

## Gotcha

* The most expensive skill is often not the best skill.
* Broad analysis feels safe but reduces sharpness when the problem is already localized.
* Framework-specific routing should happen as early as possible once the framework is explicit.

## Do NOT

* Do NOT default to `universal-project-analysis`
* Do NOT use full-project analysis for normal feature work
* Do NOT choose a generic skill when a framework-specific one clearly fits
* Do NOT route to deep analysis when a simple specialist skill is enough
* Do NOT confuse discovery with root-cause investigation
