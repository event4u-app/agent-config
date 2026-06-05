---
adr: 048
status: accepted
date: 2026-06-03
decision: command-justification-rule
supersedes: —
superseded_by: —
phase: v6.0.0 · D structural restructure
type: decision
---

# ADR-048 — Command justification: a command earns a top-level slot in exactly three cases

## Status

**Accepted** · 2026-06-03. Authored as Phase 7 / Step 20b of
[`road-to-6.0.0-d-structural-restructure`](../../agents/roadmaps/archive/road-to-6.0.0-d-structural-restructure.md)
(feedback-5/7: "the rule that ends every future discussion"). **Locks** the
"Command justification" section already captured in
[`command-clusters.md`](../contracts/command-clusters.md#command-justification--a-command-must-earn-a-top-level-slot)
— the contract text itself defers its dedicated ADR to "the 6.0.0-D structural
rollout"; this is that ADR. Composes with
[`ADR-041`](ADR-041-controlled-command-verbs.md) (a new verb still needs an ADR)
and [`ADR-046`](ADR-046-thin-command-principle.md) (demoted behavior survives as
a skill).

## Context

The command surface re-bloats one well-meaning addition at a time. Across the
6.0.0-D council passes (anthropic/claude-sonnet-4-5 + openai/gpt-4o, 2026-06-03)
two failure modes were named: **125 commands overwhelms** (no one can find the
daily five) and **~29 commands buries features** (product-surfaces like `council`
/ `research` vanish as skills and lose discoverability). The defensible target is
a small, justified set — every top-level command earns its slot or becomes a
skill the agent triggers by task.

## Decision

A new command earns a top-level slot in **exactly three** cases. Everything else
is a **skill**.

1. **Flow-entry** — a daily starting point of a flow the user TYPES to begin
   work: `work`, `git-commit`, `git-pr-create`, `ticket-implement`,
   `feature-plan`, `review-changes`, `fix-ci`, `test-run`, `bug-fix`.

2. **State-query** — a read-only check typed many times a day: `agent-status`,
   `session-status`, `project-health`, `profile-show`, `analytics-show`.

3. **Product-surface** — a FEATURE the user starts deliberately (not daily, but
   consciously): `council`, `challenge-me`, `research`, `roadmap`,
   `video-storyboard`. Burying these as skills destroys discoverability; a skill
   is `code-review` / `git-workflow` / `testing`, never `council` / `research`.

If none of the three applies, it is a **skill**. Skills trigger automatically by
task, so each of the following does NOT need a top-level command:

- a **sub-action** of a flow (a phase, not a front door);
- a **one-off / setup-once** operation;
- a **pipeline stage**;
- a **destructive op** — a skill **with a mandatory confirmation gate**
  (destructive ≠ command; the confirm covers the mis-parse risk);
- a **system / admin op** — the `agent-admin` platform surface, which is **NOT a
  flow** (it is system administration, not user work).

Two corollaries:

- **Sibling variants become a flag, never a second command** — `git-commit
  --in-chunks` not `git-commit-in-chunks`; `roadmap --step` not a separate
  `roadmap-process-step`. `roadmap` with no scope defaults to processing the
  WHOLE roadmap (that is why you write one).
- **A new verb still needs an ADR** per ADR-041. This ADR governs *whether*
  something is a command; ADR-041 governs *what verb* it may use.

**Sweet spot ≈ 40–50 visible commands** (≈15 workflow + ≈10 status/admin +
≈15–20 product features) — not 125, not ~29.

## Consequences

- **Positive.** "Should X be a command?" has a deterministic answer: run the
  three-case test; if it fails, X is a skill. A proposed `jira-comment` — not
  flow-entry, not state-query, not a product-surface — is a skill. Done.
- **Positive.** Product-surface features stay discoverable as commands; pure
  implementation helpers stay out of the surface as task-triggered skills.
- **Negative / accepted.** Aggressive demotion to skills depends on reliable
  task→skill routing; that is handled at conversion time (6.1) via a confirmation
  gate on each new skill, not by a telemetry wait. Nothing is lost — a demoted
  command's behavior stays reachable as a task-triggered skill.
- **Negative / accepted.** "Daily" and "deliberately started" are judgement
  calls; the contract + this ADR set the frame, review applies it.

## Alternatives considered

- **No justification rule (additive surface).** Rejected: that is the 125-command
  bloat the rebuild exists to undo.
- **Maximally aggressive (~29 commands, everything else a skill).** Rejected:
  buried real product-surface features and hurt discoverability (feedback-7).
- **A precision-admin command category for destructive ops.** Rejected (maintainer
  line): a destructive op is a skill with a mandatory confirmation gate; the
  confirm covers mis-parse risk, so it does not need a top-level slot.

## References

- [`command-clusters.md` § Command justification](../contracts/command-clusters.md#command-justification--a-command-must-earn-a-top-level-slot) — the locked contract text.
- [`ADR-041`](ADR-041-controlled-command-verbs.md) — controlled verb allowlist (a new verb needs an ADR).
- [`ADR-046`](ADR-046-thin-command-principle.md) — demoted behavior survives as a composed skill.
- [`agents/reports/command-classification-6.0.0-d.md`](../../agents/reports/command-classification-6.0.0-d.md) — the 150-command classification applying this rule.
