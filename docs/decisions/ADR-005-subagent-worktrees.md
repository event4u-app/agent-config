---
adr: 005
status: accepted
date: 2026-05-09
decision: subagent-worktrees-no-auto-merge
supersedes: —
superseded_by: —
phase: road-to-better-skills-and-profiles · A7
---

# ADR-005 — `do-in-worktrees` Mode: No Auto-Merge, Ranked Candidates

## Status

**Accepted** · 2026-05-09.

## Context

`road-to-better-skills-and-profiles` Block A introduces formal personas
and specialist review lenses. Step A7 derives from council iter-1
verdict **CC-OQ1 (a)** — adopt the AgentHub pattern from
`claude-skills` (per-candidate git-worktree isolation) into the
existing `subagent-orchestration` skill **without** weakening the
[`non-destructive-by-default`](../../.agent-src.uncondensed/rules/non-destructive-by-default.md)
Hard Floor.

The AgentHub pattern in its native form is appealing: spawn N
implementer subagents into N worktrees, let a judge rank, **auto-merge
the winner**. The auto-merge step is where the Hard Floor objects:

- A merge into a tracked branch is a destructive operation in the
  agent-authority sense — it rewrites the working copy on a branch
  that the user will later push.
- "Standing autonomy" never lifts the Hard Floor. CC-OQ1 (a) is the
  only variant that survives the floor.

Mode 7 (`do-in-worktrees`) already covered the **chained handoff**
pattern (cross-wing skill chain, each step in its own worktree).
ADR-005 extends mode 7 with a **competitive variant** for parallel
candidate isolation, with three guardrails that make the pattern
Hard-Floor-safe.

## Decision

Augment `subagent-orchestration` mode 7 with the **competitive
variant** under three Hard-Floor-derived rules:

1. **No auto-merge.** The orchestrator never merges a candidate
   branch into the integration branch. The user invokes the merge
   explicitly (e.g. `/finishing-a-development-branch`), or the
   orchestrator hands back with a numbered-options block per
   [`user-interaction`](../../.agent-src.uncondensed/rules/user-interaction.md).
2. **Ranked presentation.** Judge ranks candidates 1..N with a
   one-line justification per rank. The judge does **not** apply
   anything; ranking is the only output.
3. **Loser worktrees stay.** The orchestrator does not delete
   losing worktrees automatically. Cleanup happens via
   [`finishing-a-development-branch`](../../.agent-src.uncondensed/skills/finishing-a-development-branch/SKILL.md)
   on user request, after harvesting any salvageable partial idea.

Mode 7's chained-handoff variant is unchanged. The two variants
share the worktree-isolation primitive but differ in topology
(sequential vs parallel) and selection (linear chain vs ranked).

## Consequences

### Accepted

- The Hard Floor stands. No new override surface; no "auto-merge
  under standing autonomy" branch.
- AgentHub's exploratory benefit is preserved — N candidates run in
  isolation, judge picks a winner, user can compare diffs.
- `using-git-worktrees` remains the mechanics layer; mode 7 is the
  dispatch layer. No duplication.

### Trade-offs

- **Higher final-step cost.** User-driven merge adds one round-trip
  per `do-competitively`-in-worktrees run vs the AgentHub auto-merge
  variant. This is the cost of preserving the Hard Floor.
- **Disk usage.** Loser worktrees persist until the user cleans up.
  The `finishing-a-development-branch` skill carries an explicit
  worktree-prune step to bound this.

## Alternatives considered

- **Variant (b) — auto-merge winner under standing autonomy flag.**
  Rejected. The Hard Floor is non-negotiable and the cost of a
  user round-trip is small compared to the cost of merging the
  wrong candidate. Standing autonomy narrows other rules; it does
  not lift the Hard Floor (per `non-destructive-by-default` § Hard
  Floor catalog).
- **Variant (c) — keep AgentHub as a separate skill, do not touch
  mode 7.** Rejected. The skill would duplicate the worktree
  primitives in `using-git-worktrees` and the dispatch logic in
  `subagent-orchestration`. Mode 7 already exists; extending it is
  cheaper than spawning a parallel skill. Council CC-OQ1 (a)
  agreed: *"adopts AgentHub pattern from claude-skills, respecting
  Hard Floor"*.

## Re-evaluation trigger

Revisit this ADR when:

- A surface-level user-research signal indicates the manual-merge
  round-trip is the bottleneck (≥3 distinct user reports), AND
- A reviewable proposal exists for narrowing the Hard Floor
  (additional gates, audit trail, etc.) that does not weaken the
  prod-data and prod-deploy floors.

Both conditions must hold. Either alone is insufficient.

## References

- `agents/roadmaps/road-to-better-skills-and-profiles.md` § A7
  (council iter-1 CC-OQ1 verdict (a))
- `.agent-src.uncondensed/skills/subagent-orchestration/SKILL.md` § Mode 7
- `.agent-src.uncondensed/skills/using-git-worktrees/SKILL.md` (mechanics layer)
- `.agent-src.uncondensed/rules/non-destructive-by-default.md` § Hard Floor catalog
- `.agent-src.uncondensed/skills/finishing-a-development-branch/SKILL.md` (cleanup path)
