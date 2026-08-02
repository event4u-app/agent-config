---
model_tier: high
name: optimize-deep
pack: meta
tier: 2
visibility: internal
sub: deep
cluster: optimize
skills: [ai-council, roadmap-writing, subagent-orchestration, decision-review]
description: "Autonomous deep-refactoring loop — subagent analysis, verified findings, council, central + sub-roadmaps, PR, then N refinement loops (default 3). E.g. 'run a deep optimization pass'."
argument-hint: "[--loops=N] [--scope=<path>] [--no-external]"
suggestion:
  eligible: false
  rationale: "Cluster sub-command — reached via its cluster head's routing or its explicit /cluster:sub name; not independently suggested (surface-consolidation)."
workspaces:
  - agent-config-maintainer
  - engineering
packs:
  - meta
---

# /optimize-deep

Autonomous deep-improvement loop: **analyze → verify → council → roadmaps →
PR → refine ×N**. The autonomous sibling of [`/optimize project`](project.md)
(which is interview-driven and asks the user); this command answers its own
questions in the AI council and ends with a pull request plus a
council-refined roadmap set.

This is a **coordinator** over existing primitives — it composes, never
reimplements: subagent fan-out analysis, `/analyze:decision`-style decision
challenge, `ai-council` resolution, `/roadmap:create` output shape,
`/create-pr` mechanics.

## When to invoke

- "Deep-analyze this package and build the improvement roadmap" /
  "geh in die Tiefe und erstelle die Refactoring-Roadmap".
- Periodic renewal: question standing decisions after the environment
  changed (new host capabilities, model generation, ecosystem shift).
- A refactoring mandate that should end in a reviewed PR, not a chat answer.

Do NOT invoke for: a single named bug, an interview-style sweep with the
user in the loop (route to `/optimize project`), a code-only analysis
(`/project-analyze`), or agent-layer file tooling (`/optimize` siblings).

## Loop budget

`--loops=N` caps the refinement loops. **Default: 3** (council-locked
2026-08-02: autonomous loops without a fast, trustworthy CI oracle are
compounding-error machines; 3 with a tripwire beats 5 on cost/benefit).
Hard ceiling: 5 — above that, re-invoke deliberately with fresh context.

**Halt-on-spin tripwire (checked after every loop, overrides the budget):**

- A loop ends with no material roadmap delta (no step added, removed,
  re-scoped, or re-ordered) → STOP, the set has converged.
- The council splits on the same question twice → STOP, escalate that
  question to the user instead of burning a third loop on it.
- Any validation target fails 3 consecutive refinement attempts → STOP
  (N=3 budget, `autonomous-execution`).

## Steps

### Step 0 — Preflight (read-only)

1. Live remote state first (`direct-answers` live-state law): fetch,
   open PRs, recently merged work overlapping the scope — never from memory.
2. Create or enter an isolated worktree on a fresh branch off the trunk
   (branch/worktree creation is authorized by invoking this command; every
   Hard-Floor action below stays gated).
3. Honor any repo worktree-seeding convention when seeding the worktree;
   never copy `.agent-settings.yml` into a worktree.
4. Read the lock inventory: honest nulls, DR memories, `later/` resume
   conditions, standing ADRs. These are constraints for Step 4, surfaced —
   never silently relitigated (`decision-revisit-gate`).

### Step 1 — Deep analysis (parallel subagents)

Fan out read-only analysis subagents over the repo's load-bearing surfaces
(token/context cost, execution flows, CI/PR pipeline, routing/activation,
decision debt, archived intelligence) plus — unless `--no-external` —
tree-level deep-dives of named external references (`external-reference-deep-dive`:
file trees + raw files, never README summaries). Each agent returns
structured findings with file:line evidence and an effort estimate.

### Step 2 — Verification gate (non-negotiable)

Hand-verify every damning finding before it may steer the roadmap
(`plausible-mechanism-is-not-evidence`): re-run the grep/measurement the
finding rests on, in this checkout, at this SHA. A finding that fails
verification is dropped with a note. Findings colliding with a recorded
lock are marked and routed to Step 3 only if the mechanism differs
(mechanism-match test) — otherwise honored as locked.

### Step 3 — Council pass

Run the AI council (`council:estimate` → `council:run --confirm`) on the
contested decisions only: priority order, roadmap topology, lock collisions
that pass the mechanism-match test, and the loop count when the user gave
none. Surface the fast-path marker verbatim where the low-impact path
resolves something. High-impact and user-required classes still reach the
user per `ai-council-config` — autonomy never rewires that floor.

### Step 4 — Roadmap set

Author ONE central roadmap (goal, verified findings, locks honored,
sub-roadmap management table, pre-registered success criteria, provenance —
external sources anonymized + `ENC1:`-encrypted per `source-confidentiality`)
plus sub-roadmaps cut along the council's topology. Foundation-class
work (whatever must be true for the rest to be verifiable — typically the
CI oracle) gates the leverage-class work explicitly. Regenerate the
dashboard (`roadmap:progress`) in the same response as any roadmap write.

### Step 5 — Pull request

Push the branch and open the PR per [`/create-pr`](../pr/create.md) — its
mechanics and the always-active PR-surface rules govern the body and reply
shape; do not restate them here.

### Step 6 — Refinement loops (×N, autonomous)

Each loop: (a) re-read the roadmap set with fresh subagent reviewers
(adversarial: hunt over-building, missing evidence, lock violations,
sequencing errors); (b) resolve contested deltas in the council; (c) apply
the surviving deltas to the roadmaps; (d) push to the same PR; (e) evaluate
the tripwire. Loop output is a delta summary in the PR description's
changelog section, not a comment (`no-pr-progress-comments`).

## Output

- The PR URL (literal last line of the closing reply).
- Central + sub-roadmaps on the branch, dashboard regenerated.
- Council artifacts under `agents/runtime/council/` (local-only, auto-pruned).
- A one-paragraph verdict per refinement loop: what changed, what converged.

## Gotchas

- Merge/deploy is where autonomy ends — Step 6 loop pushes go to the
  already-open PR under the invocation's authorization; merging it,
  deploying, or any irreversible external action stays this-turn gated.
- Council spend: estimate first; abort and surface if the configured budget
  guard trips mid-run.
- Subagent cwd pins to the launch dir, not the worktree — pass absolute
  paths into every subagent prompt.
