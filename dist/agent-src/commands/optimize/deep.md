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
argument-hint: "[--mode=plan|execute] [--loops=N] [--scope=<path>] [--no-external]"
limits:
  mode_default: plan
  max_iterations: 3
  hard_ceiling: 5
  no_gain_stop: 2
  target_metric: required
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

## Enforced limits (release-truth Phase 4)

The frontmatter `limits:` block is the machine-readable pin
(`tests/scripts/optimize_deep_limits.test.ts` fails when flow and pin
drift); the flow steps below are the enforcement — each limit is a step
the run MUST execute, not advice. The reviews' P0 this closes: an
autonomous deep-refactoring loop shipped without technically enforced
limits.

### Execution mode — plan-only default

`--mode=plan` is the **default**: run Steps 0–4 only — analyze, verify,
council, author the roadmap set in the worktree — then present the plan
plus the predicted delta on the target metric and STOP. No push, no PR, no
refinement loop, no edit outside the worktree's roadmap drafts.
`--mode=execute` must be **explicitly present in the invocation** to enter
Steps 5–6; treat its absence as plan mode even when conversation momentum
suggests otherwise. An execute-mode run still respects every gate below.

### Pre-registered target metric — required before loop 1

Before Step 5 may run (and therefore before any refinement loop), the
central roadmap MUST carry a `Target metric` block naming ONE measurable
metric (e.g. always-loaded token budget, gate wall-clock, red-test count),
its **measured baseline at the branch SHA** (command output pasted, not
asserted), and the predicted direction. No block → REFUSE to enter Step 5
with: `target metric not pre-registered — record it in the central roadmap
first`. Loops never move the goalposts: the metric named before loop 1 is
the metric every loop is scored against.

### Loop budget

`--loops=N` caps the refinement loops. **Default: 3** (council-locked
2026-08-02: autonomous loops without a fast, trustworthy CI oracle are
compounding-error machines; 3 with a tripwire beats 5 on cost/benefit).
Hard ceiling: 5 — a larger `--loops` value is clamped to 5 with a warning;
above that, re-invoke deliberately with fresh context.

**Halt-on-spin tripwire (checked after every loop, overrides the budget):**

- A loop ends with no material roadmap delta (no step added, removed,
  re-scoped, or re-ordered) → STOP, the set has converged.
- **Two consecutive loops deliver no measurable gain on the pre-registered
  target metric (re-measured per loop, Step 6e) → STOP** — spinning without
  gain is the failure the metric exists to catch.
- The council splits on the same question twice → STOP, escalate that
  question to the user instead of burning a third loop on it.
- Any validation target fails 3 consecutive refinement attempts → STOP
  (N=3 budget, `autonomous-execution`).

### Hard exclusions — never inside this command

- **Kernel rules:** the run NEVER edits a kernel rule (`is_kernel_rule` in
  `src/scripts/_lib/kernel_rules.ts`; the `block-kernel-rule-writes`
  PreToolUse guard denies the write anyway). A finding that wants a
  kernel-rule change is recorded in the roadmap as a **proposal routed to
  the kernel slow-rollout process** (`contexts/authority/kernel-rule-edits.md`:
  own PR, ≥ 24 h soak) — the refusal names that process, never edits.
- **Public contracts:** no change to a `docs/contracts/` surface marked
  `stability: stable` without explicit user approval this run — record as a
  proposal otherwise.
- **Commit / push / PR floors:** unchanged — the invocation authorizes the
  worktree branch and (execute mode) pushes to the run's own PR; merge,
  deploy, and every Hard-Floor action stay this-turn gated.

## Steps

### Step 0 — Preflight (read-only)

1. Live remote state first (`direct-answers` live-state law): fetch,
   open PRs, recently merged work overlapping the scope — never from memory.
2. Create or enter an isolated worktree on a fresh branch off the trunk
   (branch/worktree creation is authorized by invoking this command; every
   Hard-Floor action below stays gated).
3. Seed it per the
   [`using-git-worktrees` § 4b allow/deny list](../../../../skills/using-git-worktrees/SKILL.md#4b-seed-the-worktree--allow--deny-list)
   — symlink or fully install dependencies, copy or regenerate the generated
   projections, regenerate build output, and never copy `.agent-settings.yml`
   into a worktree.
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

### Step 5 — Pull request (execute mode only)

**Gate first:** `--mode=execute` present in the invocation AND the
`Target metric` block recorded (§ Enforced limits) — otherwise STOP here
and present the plan (plan mode's defined end state). Then push the branch
and open the PR per [`/create-pr`](../pr/create.md) — its mechanics and the
always-active PR-surface rules govern the body and reply shape; do not
restate them here.

### Step 6 — Refinement loops (×N, execute mode only)

Each loop: (a) re-read the roadmap set with fresh subagent reviewers
(adversarial: hunt over-building, missing evidence, lock violations,
sequencing errors); (b) resolve contested deltas in the council; (c) any
delta resting on a NEW factual claim re-enters the Step-2 verification gate
before application — reviewer assertions are findings, not facts; (d) apply
the surviving deltas to the roadmaps; (e) **re-measure the pre-registered
target metric at the new SHA and record the value in the loop verdict** —
this is the per-loop verification the no-gain tripwire consumes; (f) push
to the same PR; (g) evaluate the tripwire (§ Enforced limits — including
the two-consecutive-no-gain stop). Loop output is a delta summary in the PR
description's changelog section, not a comment (`no-pr-progress-comments`).

## Output

- The PR URL (literal last line of the closing reply).
- Central + sub-roadmaps on the branch, dashboard regenerated.
- Council artifacts under `agents/runtime/council/` (local-only, auto-pruned).
- A one-paragraph verdict per refinement loop: what changed, what converged.

## Removal is one of the outputs

An optimization pass that only ever adds is not an optimization pass. Every
refinement loop asks the removal question as deliberately as the addition one:
**is there an artifact here that should stop existing?**

The disposition and the six simplify signals are specified once, in
[`decision-review` § Removal is a disposition](../../skills/decision-review/SKILL.md);
this command applies them rather than restating them. The fork that matters
here: a rule the agent consistently fails to follow gets **structural
enforcement or deletion**, never a louder restatement — and non-adherence is the
trigger, not low frequency.

## Gotchas

- Merge/deploy is where autonomy ends — Step 6 loop pushes go to the
  already-open PR under the invocation's authorization; merging it,
  deploying, or any irreversible external action stays this-turn gated.
- Council spend: estimate first; abort and surface if the configured budget
  guard trips mid-run.
- Subagent cwd pins to the launch dir, not the worktree — pass absolute
  paths into every subagent prompt.
