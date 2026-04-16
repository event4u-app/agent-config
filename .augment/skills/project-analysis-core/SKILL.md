---
name: project-analysis-core
description: "Use for the universal deep-analysis workflow: project discovery, version resolution, docs loading, architecture mapping, execution flow, and package research."
source: package
---

# project-analysis-core

## When to use

Use this skill when:

* A project or codebase is unknown
* You need a universal deep-analysis workflow
* Framework-specific analysis is not yet clear
* You need to reconstruct the real system before going deeper
* `universal-project-analysis` routes here

Do NOT use when:

* The framework-specific path is already known and should be analyzed directly
* The task is only a small local code question
* The issue is already isolated and needs root-cause analysis more than discovery

## Procedure

### 1. Project discovery

Identify: language, framework, runtime environment, package managers, entrypoints, documentation locations.

Look at:

* `composer.json`, `composer.lock`
* `package.json`, lock files
* bootstrap files
* Dockerfile / compose files
* CI workflows
* README / AGENTS / docs

### 2. Resolve exact versions

Determine exact installed versions.

Priority:

1. lock files
2. manifest constraints
3. CI / Docker evidence
4. framework constants or bootstrap evidence

Validate: framework version is explicit, critical package versions are explicit, uncertainty is marked if no exact version is available.

### 3. Load documentation

For each important framework or package:

* use version-matching docs
* check official docs first
* read upgrade notes if relevant
* separate default behavior from project customizations

### 4. Map architecture

Build a system model:

* entrypoints
* dependency flow
* container / DI structure
* modules and boundaries
* state systems
* external integrations

### 5. Map execution flow

Trace the relevant path: HTTP, CLI, queue, scheduler, events, webhooks.

Check:

* where sync becomes async
* where transactions start/end
* where side effects happen
* where external calls leave the system

### 6. Analyze critical packages

For each critical package:

* where it is used
* whether usage matches docs
* whether config matches version
* whether known issues exist
* who depends on it

### 7. Research real-world evidence

Search for: exact errors, version-specific issues, known package bugs, unusual patterns.

Prioritize:

1. official docs
2. vendor source
3. GitHub issues
4. verified StackOverflow answers
5. blog posts last

### 8. Validate the system model

Check:

* framework and package versions are explicit
* architecture map matches code structure
* execution path is traceable
* docs were matched to actual versions
* next-step specialist skill is clear

## Output format

1. Project summary
2. Stack and versions
3. Architecture map
4. Execution flow overview
5. Critical packages and findings
6. Known uncertainties
7. Recommended next specialist skill

## Gotcha

* If versions are guessed, the whole analysis becomes unreliable.
* If you skip entrypoints, the architecture model will be shallow.
* If you use latest docs instead of installed-version docs, conclusions may be wrong.

## Do NOT

* Do NOT assume framework or package versions
* Do NOT stop after reading only manifests
* Do NOT confuse project custom code with vendor behavior
* Do NOT skip documentation lookup for critical packages
* Do NOT conclude root cause here — route to hypothesis-driven analysis for that
