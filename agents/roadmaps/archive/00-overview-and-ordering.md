# Phase 3 Overview and Ordering

**Status: ✅ ALL ROADMAPS COMPLETE**

## Goal

Implement the next five capability layers without breaking the current quality and governance model.

## Current baseline

The package already provides:

- structured skills
- rules, guidelines, and commands
- source-of-truth workflow
- skill linter
- CI guardrails
- quality-oriented governance

## Completed layers

- [x] runtime execution model
- [x] controlled external tool integration
- [x] observability
- [x] aggregated feedback loop
- [x] lifecycle/versioning layer

## Dependency order (all complete)

### 1. Runtime Layer ✅

- execution model, registry, dispatcher, hooks, error handling
- See: `agents/roadmaps/archive/01-runtime-layer-*`

### 2. Tool Integration ✅

- tool registry, GitHub + Jira adapters, base adapter contract, permissions
- See: `agents/roadmaps/archive/02-tool-integration-*`

### 3. Observability ✅

- structured events, metrics aggregation, structured logger
- See: `agents/roadmaps/archive/03-observability-*`

### 4. Feedback Loop ✅

- feedback collector, outcome classification, improvement suggestions
- See: `agents/roadmaps/archive/04-feedback-loop-*`

### 5. Skill Lifecycle ✅

- lifecycle tracking, health scoring, migration suggestions, deprecation detection
- See: `agents/roadmaps/archive/05-skill-lifecycle-*`

## Cross-cutting constraints

These apply to all five roadmaps:

- Source of truth remains `.agent-src.uncompressed/`
- Skills remain governance-first, not free-form automation
- New power must be allowlisted and reviewable
- CI must expand as quality rules expand
- No roadmap may bypass the linter/reviewer quality model

## Global implementation style

For every new layer:

1. define schema / policy first
2. implement minimal runtime behavior second
3. add CI and validation third
4. add observability fourth
5. only then add advanced automation

## Anti-patterns

- adding tool execution before runtime permissions exist
- adding runtime before a schema exists
- adding automation without observability
- adding lifecycle metadata that no tool or process uses
- mixing all five layers into one giant PR
