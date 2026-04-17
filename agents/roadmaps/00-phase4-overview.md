# Phase 4: Activation — Make the Infrastructure Usable

## Current state after Phase 3

Phase 3 delivered five infrastructure layers. Phase 4 connects them into a working system.

## Gap analysis

| Capability | Present | Partial | Missing operationalization |
|---|---|---|---|
| Execution metadata schema | ✅ Schema, linter validation | | |
| Runtime registry + dispatcher | ✅ Discover, dispatch, block | | End-to-end execution flow |
| Runtime hooks + errors | ✅ Before/after chains, error classification | | Hook wiring into real skill execution |
| Tool registry + adapter contract | ✅ Schema, base adapter | Scaffold adapters (no real API calls) | Production-ready adapters with retries |
| Tool permissions + audit | ✅ Validation logic | | Audit log persistence, tool-call tracing |
| Structured events | ✅ Event types, emitter | | No emission from real processes yet |
| Metrics aggregation | ✅ Counters, timers | | No data collection in real workflows |
| Structured logger | ✅ JSON logger | | Not wired into any process |
| Feedback collector | ✅ Outcome classification, suggestions | | No real data, no governance target |
| Skill lifecycle | ✅ Health scores, migrations | | Not integrated with feedback/observability |
| Skills with execution blocks | | 0 of ~80 skills tagged | Classification + tagging |
| Rule/skill boundary | | `procedural_rule` warning on runtime-safety | Boundary cleanup |
| End-to-end integration | | Components exist separately | Reference workflow connecting all layers |
| Consumable reports | | | CLI views, markdown summaries, CI artifacts |
| Feedback → governance loop | | | Suggestions → issues/backlog/lifecycle |

## What Phase 4 delivers

Three roadmaps that turn infrastructure into a working system:

### Roadmap 1: End-to-End Integration (4 PRs)

Wire all components into a single reference flow:
Skill → Dispatcher → Tool Adapter → Events/Metrics → Feedback → Lifecycle impact.

This is the highest priority — without it, the components remain disconnected.

### Roadmap 2: Skill Activation + Boundary Hygiene (4 PRs)

Tag existing skills with execution metadata.
Fix the `procedural_rule` boundary issue.
Verify the full registry with real skill data.

### Roadmap 3: Consumable Output + Feedback Governance (4 PRs)

Make observability visible: CLI reports, CI summaries, markdown dashboards.
Close the feedback loop: suggestions → governance actions (issues, lifecycle flags, skill backlog).

## Dependency order

```
Roadmap 1 (E2E Integration)
    ↓
Roadmap 2 (Skill Activation)  ←  needs working E2E flow to verify
    ↓
Roadmap 3 (Reports + Feedback Governance)  ←  needs real data from tagged skills
```

## Success criteria

Phase 4 is complete when:

- [ ] `task runtime-list` shows ≥20 tagged skills with correct execution metadata
- [ ] A reference skill runs through the full E2E flow (dispatch → execute → event → feedback)
- [ ] `task lifecycle-health` produces a meaningful report from real data
- [ ] CI generates observability summaries on PR
- [ ] Feedback suggestions have a defined governance target (backlog, lifecycle, or issue)
- [ ] 0 `procedural_rule` warnings in linter output
- [ ] All tool adapters support at least read-only operations with real API calls
