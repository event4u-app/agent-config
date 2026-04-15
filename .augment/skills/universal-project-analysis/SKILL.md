---
name: universal-project-analysis
description: "ONLY when user explicitly requests: full project analysis, deep codebase audit, or comprehensive architecture review. Routes to core and framework-specific analysis skills."
source: package
---

# universal-project-analysis

## When to use

Use this skill when:

* The user explicitly requests full project analysis
* The user wants a deep codebase audit
* The user wants a comprehensive architecture review
* The system is large, unclear, or spans multiple layers
* `analysis-autonomous-mode` routes here for broad understanding

Do NOT use when:

* The task is a normal feature implementation
* Only a small isolated file or snippet needs review
* The issue is already narrow and should go directly to a specialist skill

## Mission

Act as the top-level investigation router for deep project understanding.

This skill does NOT perform every deep-dive itself.

It does this:

* determines whether a full-project analysis is justified
* chooses the right analysis mode
* detects the stack and framework
* routes to the correct specialist analysis skills
* defines the required output for deep investigations

## Core principles

1. Never assume — verify against code, config, docs, and evidence
2. Version dictates behavior
3. Packages are external systems — research them, do not guess
4. Full analysis must be hypothesis-aware
5. Broad understanding comes before narrow conclusions
6. Use specialist skills when framework or problem shape is clear

## Thinking model

Always think in this order:

1. Observe
2. Understand
3. Verify
4. Route
5. Investigate
6. Conclude

## Analysis modes

### Exploration mode

Use when the system is unknown.
Goal: understand structure, identify major components, find investigation paths, detect where specialist skills are needed.

### Investigation mode

Use when there is a concrete issue inside a large or unclear system.
Goal: isolate the affected area, route into deeper hypothesis-driven analysis, validate likely root causes.

### Optimization mode

Use when the system works but may be inefficient or over-complex.
Goal: map hot paths, identify expensive boundaries, chain into performance or architecture specialists.

## Procedure

### 1. Confirm full-project scope

Check whether the request really needs broad analysis.
Use this skill only if the user wants: full project understanding, architecture reconstruction, deep multi-layer debugging, broad audit across modules or systems.
If not: route to the narrower specialist skill instead.

### 2. Discover the project

Identify: language, framework, runtime environment, package managers, major entrypoints, documentation locations.
Look at: package manifests, lock files, bootstrap files, Docker/CI config, README/AGENTS/docs folders.

### 3. Choose the primary path

Route based on what you find:

* unknown or mixed system → `project-analysis-core`
* issue/root-cause heavy situation → `project-analysis-hypothesis-driven`
* Laravel → `project-analysis-laravel`
* Symfony → `project-analysis-symfony`
* Zend/Laminas → `project-analysis-zend-laminas`
* Node/Express → `project-analysis-node-express`

### 4. Chain specialist skills

Add specialist skills only where needed:

* bottleneck found → `performance-analysis`
* security concern found → `security-audit`
* bug isolated → `bug-analyzer`

### 5. Consolidate findings

Combine: system overview, routed specialist findings, verified risks, validated conclusions, next investigation steps.

### 6. Validate analysis quality

Check:

* full-project analysis was actually necessary
* stack/framework detection is explicit
* routed skills match the discovered system
* uncertain points are marked clearly
* conclusions are evidence-based

## Output format

1. Investigation summary
2. Detected stack and framework
3. Chosen analysis mode
4. Routed specialist skills
5. Consolidated findings
6. Risks and next steps

## Integration with other skills

Primary downstream skills:

* `project-analysis-core`
* `project-analysis-hypothesis-driven`
* `project-analysis-laravel`
* `project-analysis-symfony`
* `project-analysis-zend-laminas`
* `project-analysis-node-express`

Optional specialist chaining:

* `bug-analyzer`
* `performance-analysis`
* `security-audit`

## Gotcha

* This skill must remain a real router, not a giant framework encyclopedia.
* Do not keep long framework-specific deep dives here.
* Do not use full-project analysis for normal feature work.

## Do NOT

* Do NOT analyze everything here directly if a specialist skill exists
* Do NOT skip stack/framework detection
* Do NOT present broad guesses as conclusions
* Do NOT turn this skill into a useless pointer-only file
