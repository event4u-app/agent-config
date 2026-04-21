---
name: do-in-steps
skills: [subagent-orchestration, verify-before-complete]
description: Execute an ordered plan step by step with a judge gate between steps — stops on first failed verdict
disable-model-invocation: true
---

# do-in-steps

## Instructions

### 1. Confirm the plan

The user invoked `/do-in-steps` pointing to a plan (agents/plans/ file,
roadmap phase, or inline list). Confirm:

- N steps, numbered
- Each step has a clear acceptance criterion
- Dependencies between steps are explicit

If any step is vague, **stop** and ask before running anything.

### 2. Resolve model pairing

Same as `/do-and-judge`:

- `subagent_implementer_model` → session model by default
- `subagent_judge_model` → one tier up by default

Stop if both resolve to the same model in the same context.

### 3. Run the loop

For each step `i` from 1 to N:

1. **Implement step i** in the current session
2. **Run the judge** on the diff for step i alone, with the plan's
   step-i acceptance criterion as the check target
3. **Apply or revise**:
   - `apply` → commit step i, run targeted tests, move to step i+1
   - `revise` → hand back the issue list, re-implement step i (max 2 retries)
   - `reject` → **stop the whole loop**, report which step and why

### 4. Stop conditions

The loop exits cleanly only when **all N steps pass judgment**. Any
other outcome is a stop:

- A step rejected → stop at that step
- Revision ceiling hit on any step → stop at that step
- User interrupts → stop immediately

On stop, report the last verified state so the user can resume.

### 5. Final verification

After step N passes judgment, run `verify-before-complete` across the
whole changeset — targeted tests + full suite + quality pipeline.
Never declare the plan "done" without this gate.

### 6. Report

```
Mode:       do-in-steps
Steps:      <passed>/<total>  (stopped at step <K>? yes/no)
Implementer: <resolved model>
Judge:      <resolved model>
Revisions:  step-by-step count
Evidence:   final test + quality output
Next step:  <commit / open PR / resume from step K>
```

## Safety gates

- Never skip a step because the next one looks easier
- Never apply a revised step without the judge re-verdicting
- Never declare complete without final `verify-before-complete`
- A failing step never cascades silently — stop, report, hand back

## See also

- [`subagent-orchestration`](../skills/subagent-orchestration/SKILL.md)
- [`verify-before-complete`](../skills/verify-before-complete/SKILL.md)
- [`/do-and-judge`](do-and-judge.md) — single-change variant
