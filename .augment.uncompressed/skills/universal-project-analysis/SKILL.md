---
name: universal-project-analysis
description: "ONLY when user explicitly requests: full project analysis, deep codebase audit, or comprehensive architecture review. Routes to core and framework-specific analysis skills."
source: package
---

# universal-project-analysis

## When to use

Use this skill when:

* The user explicitly requests a full project analysis
* The user wants a deep codebase audit
* The user wants a comprehensive architecture review
* The system is large, unclear, or spans multiple layers
* `analysis-autonomous-mode` routes here for broad understanding

Do NOT use when:

* The task is normal feature work
* Only a small isolated code area needs review
* The issue is already narrow enough for a specialist skill
* A framework-specific analysis skill can be called directly

## Mission

Act as the top-level router for deep project investigation.

This skill must:

* confirm whether full-project analysis is justified
* identify the stack and framework
* choose the correct analysis mode
* route to the right specialist analysis skills
* define the required output for broad project investigations

This skill must NOT become:

* a giant framework encyclopedia
* a shallow pointer-only file
* a replacement for framework-specific deep-dive skills

## Core principles

1. Never assume — verify against code, config, docs, and evidence
2. Version dictates behavior
3. Broad understanding comes before narrow conclusions
4. Use framework-specific skills once the stack is known
5. Use hypothesis-driven analysis when root cause is unclear
6. Mark uncertainty explicitly

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
Goal: understand structure, identify major components, detect investigation paths, choose the next specialist skill.

### Investigation mode

Use when there is a concrete issue inside a large or unclear system.
Goal: isolate the affected area, route into root-cause analysis, verify likely causes with evidence.

### Optimization mode

Use when the system works but may be inefficient or over-complex.
Goal: identify hot paths, find expensive boundaries, route into architecture or performance specialists.

## Procedure

### 1. Confirm scope

Check whether full-project analysis is really needed.
Use this skill only if the user wants: broad system understanding, architecture reconstruction, deep multi-layer debugging, broad audit across modules or runtime boundaries.
If not: route to the narrower specialist skill directly.

### 2. Discover the project

Identify: language, framework, runtime environment, package managers, major entrypoints, documentation locations.
Look at: package manifests, lock files, bootstrap files, Docker/CI config, README/AGENTS/docs.

### 3. Choose the primary route

* unknown or mixed system → `project-analysis-core`
* concrete root-cause problem → `project-analysis-hypothesis-driven`
* Laravel → `project-analysis-laravel`
* Symfony → `project-analysis-symfony`
* Zend/Laminas → `project-analysis-zend-laminas`
* Node/Express → `project-analysis-node-express`

### 4. Chain specialists where needed

* bottleneck found → `performance-analysis`
* security concern found → `security-audit`
* bug isolated → `bug-analyzer`

### 5. Consolidate findings

Combine: system overview, framework-specific findings, verified risks, explicit uncertainties, next investigation steps.

### 6. Validate analysis quality

Check:

* full-project analysis was actually justified
* framework detection is explicit
* chosen specialist skills match the discovered stack
* uncertainties are marked
* conclusions are evidence-based

## Routing map

### Universal analysis skills

* `project-analysis-core`
* `project-analysis-hypothesis-driven`

### Framework-specific deep dives

* `project-analysis-laravel`
* `project-analysis-symfony`
* `project-analysis-zend-laminas`
* `project-analysis-node-express`

### Optional downstream specialists

* `bug-analyzer`
* `performance-analysis`
* `security-audit`

## When to add a new framework analysis skill

A framework gets its own `project-analysis-*` skill ONLY if:

* it has its own lifecycle that creates unique debugging patterns
* it produces failure classes that `project-analysis-core` cannot explain
* debugging it requires framework-specific mental models (not just API knowledge)

Examples that qualify: Laravel, Symfony, Express, React, Next.js.
Examples that do NOT qualify: Tailwind, small utility libraries, CSS frameworks, simple state libs.

## Output format

1. Investigation summary
2. Detected stack and framework
3. Chosen analysis mode
4. Routed specialist skills
5. Consolidated findings
6. Risks and next steps

## Gotcha

* This skill must remain a real orchestration skill.
* Do not move long framework-specific deep dives back into this file.
* Do not let this skill become a generic "analyze everything" bucket.

## Do NOT

* Do NOT analyze everything here directly if a specialist skill exists
* Do NOT skip framework detection
* Do NOT present broad guesses as conclusions
* Do NOT turn this into a shallow pointer-only file
* Do NOT duplicate framework-specific deep-dive content here
