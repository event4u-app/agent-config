---
model_tier: medium
name: worktree-verify
pack: engineering-base
tier: 2
visibility: internal
cluster: worktree
sub: verify
skills: [worktree-lifecycle, verify-completion-evidence]
description: Run the scoped verification for a worktree's declared change — narrow probes matched to the diff, never the full CI pipeline
suggestion:
  eligible: true
  trigger_description: "verify the worktree change, prove this worktree is ready"
  trigger_context: "a governed worktree with committed changes but no verification evidence attached"
workspaces:
  - agent-config-maintainer
packs:
  - meta
---

# /worktree verify
## Instructions

Produce fresh, scoped verification evidence for ONE worktree's declared
change. Narrow probes only — this command never runs the full CI
pipeline locally (`roadmap-ci-steps-policy` / `quality.local_auto_run`
default: remote CI on the PR is the gate).

### 1. Resolve target + scope

Target worktree = the current one, or the path/branch given as arg.
Read its `.worktree-scope.md` (`owns:` paths + task line) per
[`worktree-lifecycle § Scope lock`](../../../skills/worktree-lifecycle/SKILL.md#2-scope-lock).
No scope lock → stop and route to `/worktree create` step 3 first.

### 2. Scope-conformance check

```bash
git diff --name-only "$(git merge-base HEAD <base>)"..HEAD
```

Paths outside `owns:` → surface as scope creep (`scope-control`) before
verifying anything; the evidence must describe the declared change.

### 3. Pick the narrowest probes

Map the diff to probes per `verify-completion-evidence` (claim →
command): the single test filter for touched behavior, the
type-checker/linter scoped to changed files, a `curl`/spec run for a
touched endpoint. Never substitute `task ci` / the meta-pipeline for a
targeted probe.

### 4. Run fresh + record

Run the probes now (no cached/earlier results — `verify-before-complete`),
capture command + exit code + output tail, and append the evidence to
the worktree's `.worktree-scope.md` under a `## Verification evidence`
heading (command, date, result) so `/worktree status` can report it.

### 5. Report

Use the [`worktree-lifecycle § Output format`](../../../skills/worktree-lifecycle/SKILL.md#output-format):
evidence section carries the probe commands + tails; verdict states
whether checklist item 3 (evidence attached) now passes.

### Rules

- **Do NOT commit or push.** Evidence lives in the untracked scope note.
- Red probe → report it plainly and stop; never downgrade to a weaker
  probe to get green (N=3 budget per `autonomous-execution`).
