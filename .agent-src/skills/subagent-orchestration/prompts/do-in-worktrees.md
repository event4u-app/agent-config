# Prompt — do-in-worktrees

Mode reference: [`../SKILL.md`](../SKILL.md) § *6. do-in-worktrees*.
Worktree creation/destruction lives in [`../../using-git-worktrees/SKILL.md`](../../using-git-worktrees/SKILL.md).

## Implementer prompt (per worktree step)

```
You are the implementer for STEP {{step_id}} in a cross-wing chain.
You are running INSIDE a fresh git worktree at {{worktree_path}} on
branch {{branch_name}}. Prior step's open files / branch state cannot
leak into this worktree — that is the whole point.

STEP TYPED INPUT (from prior step's ## Output): {{typed_input}}
STEP DESCRIPTION: {{step_description}}
EXPECTED ## Output (next step's ## Input): {{expected_output_shape}}

CONSTRAINTS:
- Stay inside the worktree path. Do NOT cd to the parent repo.
- Do NOT touch branches other than {{branch_name}}.
- Produce the expected ## Output shape literally — the next worktree's
  implementer consumes it as ## Input.
- Run the chain-end test for THIS step before signaling completion.

ON COMPLETION, return ONE envelope per schemas/subagent-status.json:
  - DONE                — step output produced and validated; evidence[]
                          cites the typed-output file path.
  - DONE_WITH_CONCERNS  — output produced but flag carry-over for next
                          worktree; concerns[] surfaces in next step's
                          dispatch.
  - NEEDS_CONTEXT       — paused; chain pauses until orchestrator
                          answers blocking_question. Other worktrees
                          are NOT running concurrently in this mode.
  - BLOCKED             — step cannot complete; chain halts. The
                          orchestrator decides whether to drop the
                          worktree or rescope.
```

## Chain-end judge prompt (run once after final worktree)

```
You are the chain-end judge. The chain produced N typed outputs, one
per worktree. Validate the final integration PR against the chain's
goal.

CHAIN STEPS: {{step_summaries_array}}
TYPED OUTPUTS: {{outputs_array}}
INTEGRATION PR DIFF: {{integration_diff}}

VERDICT (one envelope, schemas/subagent-status.json):
  - DONE                — chain landed cleanly; evidence[] cites each
                          step's typed output and the integration test
                          run.
  - DONE_WITH_CONCERNS  — chain landed but consolidated concerns[]
                          across steps need follow-up.
  - NEEDS_CONTEXT       — integration is unclear; cite which step(s)
                          need clarification.
  - BLOCKED             — integration is broken; cite the worktree(s)
                          that must be redone. Do NOT silently rewrite.

WORKTREE-LEAK CHECK: scan the integration diff for branch names or
files belonging to a different worktree's step. If found, BLOCKED —
isolation was violated.
```

## Sequential-not-parallel rule

`do-in-worktrees` runs steps sequentially across isolated worktrees.
Parallel concurrent worktrees are `do-in-parallel` with explicit
isolation, not this mode.
