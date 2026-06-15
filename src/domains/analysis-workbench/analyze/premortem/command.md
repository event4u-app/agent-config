---
model_tier: inherit
name: analyze-premortem
pack: analysis-workbench
tier: 2
visibility: internal
cluster: analyze
sub: premortem
skills: [premortem]
description: Forward-looking imagined-failure analysis before committing to a heavy or irreversible plan — enumerate failure stories, score each mode, derive early-warning signals and guardrails.
suggestion:
  eligible: true
  trigger_description: "premortem, what if this fails, imagine failure, stress-test this plan, what could go wrong"
  trigger_context: "user wants to anticipate failure modes before committing to a plan"
workspaces:
  - engineering
packs:
  - analysis-workbench
---

# /analyze:premortem

Forward-looking imagined-failure sub-command in the `/analyze` cluster.
Loads and runs the
[`premortem`](../../../../skills/premortem/SKILL.md) skill.

## Instructions

### 1. Gather the plan to stress-test

Ask the user (in their language) for:

- A one-sentence summary of the plan: *"We are doing X for outcome Y,
  touching Z."*
- The prospective-failure horizon (default: 6 months post-launch).
- Any known constraints, irreversibilities, or high-coordination
  surfaces worth front-loading.

If the plan cannot be summarised in one sentence, stop and ask for
scope clarification before proceeding. An un-summarisable plan is not
reviewable.

### 2. Run the premortem skill

Delegate to
[`premortem`](../../../../skills/premortem/SKILL.md) verbatim:

1. **Set the prospective-failure frame** — "Assume total failure at
   horizon H. What went wrong?"
2. **Enumerate failure stories** — cover people, process, technical,
   external, and timing angles. Each story is a short narrative in past
   tense. Invoke `adversarial-review` to attack the plan's assumptions.
   Invoke `risk-officer` to assign L × I scores — do not re-implement
   L × I inline.
3. **Derive early-warning signals and preventive guardrails** — one
   observable signal and one actionable guardrail per top failure mode.
   If no practical guardrail exists, mark it `accept` with rationale.

### 3. Optional memory write-back

If the analysis surfaces a pattern worth preserving for future plans:

1. Dedup pre-check: call `retrieve()` over the same key-space (plan
   type, affected paths, decision area) per
   [`analysis-memory-loop.md § 2`](../../../../docs/contracts/analysis-memory-loop.md).
   - **Match found** → propose a `frequency` / `supersedes` update.
   - **No match** → draft a new `historical-patterns` candidate.

2. Draft the candidate:

```jsonc
{
  "type":              "historical-patterns",
  "summary":           "<one-line pattern: failure mode to watch for>",
  "evidence_paths":    ["<path/to/plan-doc>"],
  "decision_surface":  ["<area1>", "<area2>"],
  "last_validated":    "<today-YYYY-MM-DD>",
  "review_after_days": 90,
  "applicable_scope":  "project"
}
```

3. Surface the candidate to the user and ask:

> 1. Propose this candidate to `/memory propose` (recommended)
> 2. Refine before proposing — suggest changes
> 3. Skip memory candidate for now

**Empfehlung:** 1

### Rules

- Do NOT commit, push, or open a PR.
- Do NOT auto-promote — `/memory propose` is the intake.
- Do NOT re-implement L × I scoring — delegate to `risk-officer`.
- Failure stories must be grounded in the actual plan's structure —
  no invented strawmen.
- Label all scenarios as prospective (imagined future), not predictions.

## See also

- [`premortem`](../../../../skills/premortem/SKILL.md)
- [`analysis-memory-loop.md`](../../../../docs/contracts/analysis-memory-loop.md)
- [`/analyze`](../command.md) — cluster orchestrator
