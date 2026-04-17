# Phase 4: Activation — Make the Infrastructure Usable

## Current state after Phase 3

Phase 3 delivered five infrastructure layers. Phase 4 connects them into a working system
and activates developer judgment.

## Gap analysis

| Capability | Present | Partial | Missing operationalization |
|---|---|---|---|
| Execution metadata schema | ✅ Schema, linter validation | | |
| Runtime registry + dispatcher | ✅ Discover, dispatch, block | | End-to-end execution flow |
| Runtime hooks + errors | ✅ Before/after chains, error classification | | Hook wiring into real skill execution |
| Tool registry + adapter contract | ✅ Schema, base adapter | Scaffold adapters (no real API calls) | Production-ready adapters with auth, retries, timeouts |
| Tool permissions + audit | ✅ Validation logic | | Audit log persistence, tool-call tracing |
| Structured events | ✅ Event types, emitter | | No emission from real processes, no mandatory schema |
| Metrics aggregation | ✅ Counters, timers | | No data collection in real workflows |
| Structured logger | ✅ JSON logger | | Not wired into any process |
| Feedback collector | ✅ Outcome classification, suggestions | | No real data, no governance target |
| Skill lifecycle | ✅ Health scores, migrations | | Not integrated with feedback/observability |
| Skills with execution blocks | | 0 of ~80 skills tagged | Classification standard + tagging |
| Rule/skill boundary | | `procedural_rule` warning on runtime-safety | Boundary cleanup |
| End-to-end integration | | Components exist separately | Reference workflow connecting all layers |
| Consumable reports | | | CLI views, markdown summaries, CI artifacts |
| Feedback → governance loop | | | Suggestions → issues/backlog/lifecycle |
| Developer judgment | | | Agent challenges weak requests before implementing |
| Execution classification | | | No criteria for manual/assisted/automated decisions |

## What Phase 4 delivers

Four roadmaps that turn infrastructure into a working system:

### Roadmap 1: E2E Integration + Tool Adapters (5 PRs)

Wire all components into a single reference flow:
Skill → Dispatcher → Tool Adapter → Events/Metrics → Feedback → Lifecycle impact.

Harden tool adapters in stages: read-only first → observability → skill integration.
This prevents mixing adapter bugs with skill bugs during integration.

### Roadmap 2: Skill Activation + Boundary Hygiene (4 PRs)

**Starts with a Classification Standard** — clear criteria for manual/assisted/automated
before tagging any skills. Includes explicit guardrails for `automated` (6 mandatory criteria).

Tag existing skills, fix boundary violations.

### Roadmap 3: Consumable Output + Feedback Governance (4 PRs)

Make observability **decision-enabling**: define key questions first, then build reports
that answer them. Mandatory event schema, persistent artifacts, CI summaries.
Close the feedback loop: suggestions → governance actions.

### Roadmap 4: Developer Judgment (5 PRs) ← NEW

Activate the agent's ability to challenge and improve requests before implementing.
`improve-before-implement` rule, `validate-feature-fit` skill, linter heuristics,
reference skill updates, and documentation.

## Recommended execution order

```
Step 1: Execution Classification Standard (Roadmap 2, PR 1)
  ↓
Step 2: Skill Tagging (Roadmap 2, PRs 2-4)
  ↓  ← can start Roadmap 4 in parallel from here
Step 3: E2E Pipeline + Events (Roadmap 1, PRs 1-3)
  ↓
Step 4: Observability operationalization (Roadmap 3, PRs 1-2)
  ↓
Step 5: Tool Adapter activation (Roadmap 1, PRs 4-5)
  ↓
Step 6: CI + Governance + Skill Integration (Roadmap 3, PRs 3-4)
```

Roadmap 4 (Developer Judgment) can run **in parallel** with Steps 2-6 — it has no hard
dependency on the other roadmaps.

## Token cost control

Phase 4 features are the primary token-cost drivers. All outputs respect `.agent-settings`:

**Pipeline-level controls (already present):**
- `runtime_enabled` — entire runtime dormant when `false`
- `observability_reports` — no reports generated when `false`
- `feedback_collection` — no outcomes recorded when `false`

**Granular output controls (new):**
- `runtime_auto_read_reports=false` — reports never auto-loaded into agent context
- `max_report_lines=30` — caps report size to prevent unbounded token growth
- `minimal_runtime_context=true` — only essential metadata in agent context
- `ci_summary_enabled=false` — no CI summaries on PRs
- `feedback_suggestions_in_chat=false` — suggestions persist locally, never shown in chat

**Design principle:** Collect locally → persist to disk → consume only on explicit request.
The agent never auto-reads reports or injects runtime data into chat unless the user opts in.
All defaults are `false`/conservative — zero token overhead out of the box.

**Prompt safety:** Reports, metrics, feedback, and audit logs must NOT be automatically
injected into the agent context. They are only used on explicit request, in targeted
analysis tasks, or in bounded summaries (respecting `max_report_lines`).
Data collection does NOT imply automatic usage by the agent.

Every PR in Phase 4 that produces output must check the relevant setting before emitting.

## Success criteria

Phase 4 is complete when:

- [ ] Execution Classification Standard exists with concrete, testable criteria
- [ ] `task runtime-list` shows ≥20 tagged skills with correct execution metadata
- [ ] No skill tagged `automated` without passing all 6 automated criteria
- [ ] A reference skill runs through the full E2E flow (dispatch → execute → event → feedback)
- [ ] `task lifecycle-health` produces a meaningful report from real data
- [ ] All events conform to the mandatory event schema
- [ ] CI generates observability summaries on PR
- [ ] Feedback suggestions have a defined governance target (backlog, lifecycle, or issue)
- [ ] 0 `procedural_rule` warnings in linter output
- [ ] All tool adapters support at least read-only operations with real API calls
- [ ] Tool adapter calls are audited and observable
- [ ] `improve-before-implement` rule is active and triggers on feature requests
- [ ] At least 2 reference skills have explicit validation/challenge steps
- [ ] Observability data drives automated decisions (deprecation, refactoring candidates)

## Recommended next steps (post-merge)

After merging PR #5, prioritize in this order:

### Step 1: Observability → Decisions (Roadmap 3, PR 4)

The biggest value unlock. Observability is only valuable when it **drives decisions**,
not just when it collects data.

Build automated derivation from collected data:

- Which skills have high failure rates → flag as `needs_review`
- Which skills are never used → candidate for deprecation
- Which skills produce repeated warnings → candidate for refactoring
- Which tool adapters fail consistently → needs hardening

This turns passive data into **actionable governance**.
See `03-consumable-output-roadmap.md` → PR 4 (Feedback Governance).

### Step 2: Developer Judgment (Roadmap 4)

The next big quality lever. The `improve-before-implement` rule ensures the agent
**improves weak requests before coding**, instead of blindly executing.

This is the shift from "efficient executor" to "thoughtful developer":

- Challenge vague or contradictory requirements
- Validate feature fit against existing architecture
- Suggest better approaches when the requested one has known problems
- Respect the user's final decision — challenge ≠ refuse

See `04-developer-judgment-roadmap.md` for the full plan (5 PRs).

**Why this order:** Observability → Decisions gives you the data foundation.
Developer Judgment gives you the behavioral foundation. Together they make the
agent both **informed** (data-driven) and **thoughtful** (judgment-driven).
