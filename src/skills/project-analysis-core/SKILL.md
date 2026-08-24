---
model_tier: high
context: large
name: project-analysis-core
description: "Raw discovery primitives — project discovery, version resolution, docs loading, architecture mapping, execution flow. Called by `universal-project-analysis`. Single-pass scan → `project-analyzer`."
domain: discovery
workspaces:
  - engineering
packs:
  - engineering-base
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

## Improvement mode — check for an existing artefact first

Before a full analysis, ask whether this target has already been analysed:

```bash
npx tsx src/scripts/select_analysis_mode.ts "<target>"
```

`full` → run steps 1-8 as written. `delta` → **read the named artefact first**,
then analyse only what it does not cover: gaps, sections the tree has moved past,
patterns that are new since it was written. The output format is unchanged; the
reading is narrower.

This changes **write economics only**. A concept page is a hypothesis cache,
never truth — the delta path re-verifies every structural claim it carries
forward against a live source, exactly as a full run would
([`source-discovery-gate`](../../rules/source-discovery-gate.md) § v1↔v2
isolation). A cheaper write is not a licence to trust a cached read, and
"the page already says so" is not evidence.

An empty page counts as absent: it carries no conclusions to delta against, so
the router answers `full`.

## Knowledge capture (`convention_detected` events)

An architecture map or stack finding that recurs (a naming convention,
a module boundary, a layering rule) is worth persisting for the team.
Append to the knowledge intake instead of leaving it in the one-off
analysis output (applies to every `project-analysis-*` specialist this
skill hands off to, not just this one):

```bash
npx tsx node_modules/@event4u/agent-config/src/scripts/emit_knowledge_event.ts --type convention_detected \
    --pattern "<pattern>" --evidence "file:line" --sample-size <N> --scope project
```

`/team-knowledge consolidate` turns accumulated events into
`agents/knowledge/concepts/` pages as a reviewed batch.

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
