---
type: "auto"
tier: "2a"
alwaysApply: false
description: "New or significantly rewritten skill/rule/command/guideline — mandatory Understand → Research → Draft first"
triggers:
  - phrase: "new skill"
  - phrase: "new rule"
  - phrase: "new command"
  - phrase: "new guideline"
  - phrase: "neue Regel"
  - phrase: "bau mir ein Skill"
routes_to:
  - "guideline:agent-infra/artifact-drafting-protocol-mechanics"
workspaces: [agent-config-maintainer, engineering]
packs: [meta]
# obligation: line 41
obligation_frequency: "per-task"
---

# Artifact Drafting Protocol

```
NEVER START WRITING WITHOUT THE UNDERSTAND → RESEARCH → DRAFT PHASES.
EVERY PHASE ENDS WITH A NUMBERED-OPTIONS PROMPT. NO SILENT PROGRESSION.
ZERO AUTOPILOT. AGENT PROPOSES, HUMAN DECIDES. COMMIT ONLY ON APPROVAL.
```

When the user asks to build or significantly rewrite a **skill, rule,
command, or guideline**, the agent does **not** start writing. It runs
three phases: **Understand → Research → Draft**. Each phase ends with a
numbered-options prompt (per `user-interaction`).

## When this rule fires

Triggers: *"create a new skill/rule/command/guideline"*, *"build me a
skill for …"*, *"refactor this skill from scratch"*, and the DE
equivalents (*"bau mir ein Skill"*, *"neue Regel für …"*).

**Does NOT fire:** typo/frontmatter-only edits, description-only
rewrites with a specific target phrasing, < 10-line edits, or explicit
bypass (*"just write it"*, *"skip protocol"*, *"einfach machen"*).
Fires once per creation task, not once per edit.

## The three phases

**A — Understand** (≤ 5 clarifying questions: problem, trigger surface, should-trigger examples, near-misses, artifact type) · **B — Research** (mandatory four-surface overlap scan; open + skim the 3 nearest matches; extend-vs-create decision) · **C — Draft** (2-3 description variants first, then the body; live size enforcement). Per-phase procedure + the roadmap batch-mode carve-out: the mechanics guideline below.

## Golden rules

- Every phase ends with a numbered-options prompt. No silent progression.
- Zero autopilot — agent proposes, human decides. (In roadmap-run batch
  mode the human decision is the contract acceptance; the per-phase
  prompts are pre-satisfied for the declared batch.)
- At most two propose → reject cycles; then stop.
- Commit only on approval.
- Bypass is legitimate — *"just write it"* drops the protocol immediately.
- An artifact discovered **after** an accepted contract halts by default;
  `late_artifacts: auto-research` is the only declared value that continues,
  capped at three per run (mechanics guideline § Late artifacts).

Body migrated to [`guideline:agent-infra/artifact-drafting-protocol-mechanics`](../docs/guidelines/agent-infra/artifact-drafting-protocol-mechanics.md) (per P4 of `road-to-kernel-and-router.md`) — Phase A/B/C procedure detail + the roadmap-run batch-mode carve-out (Research-once-at-contract-time, batch scope, no `artifact_protocol: skip`) + § Late artifacts (the `halt` default
and the five-step `auto-research` procedure).
Trigger-set above activates this routing on demand, independent of the discipline profile (ADR-110).

Extends (cross-link, don't restate): `ask-when-uncertain`,
`improve-before-implement`, `user-interaction`, `skill-quality`.
