---
model_tier: medium
name: orchestrate
tier: 2
cluster: orchestrate
skills: [subagent-orchestration]
description: Run a YAML pipeline defined under `.agent-config/orchestrations/` — chains personas / skills / commands / sub-agents per the orchestration-dsl-v1 contract
suggestion:
  eligible: true
  trigger_description: "run a saved orchestration / pipeline / chain"
  trigger_context: "user names a pipeline file or asks to replay a chain"
workspaces:
  - agent-config-maintainer
packs:
  - meta
---

# orchestrate

## Instructions

Execute a YAML pipeline file from `.agent-config/orchestrations/`
against the current workspace. Pipelines are deterministic chains of
personas, skills, commands, and sub-agents pinned by the
[`orchestration-dsl-v1`](../../docs/contracts/orchestration-dsl-v1.md)
contract.

This command is the **runtime** side of the contract. The schema and
the linter (`scripts/lint_orchestration_dsl.py`) live on the authoring
side; this command reads the same shape and dispatches each step.

### 1. Resolve the pipeline file

- The user passes either a pipeline name (`pr-readiness-check`) or a
  path (`.agent-config/orchestrations/pr-readiness-check.yaml`).
- Resolve to a path under `.agent-config/orchestrations/`. Refuse
  paths outside that directory — pipelines live in one place.
- If the file does not exist, list the available pipelines and stop.

### 2. Validate before run

Run the linter against the resolved file:

```
python3 scripts/lint_orchestration_dsl.py --file <path>
```

Exit code ≠ 0 → surface the linter output and stop. **Never** run
a pipeline that fails its own schema check.

### 3. Collect inputs

For each `inputs[]` entry in the pipeline:

- If the user supplied a value on invocation (`/orchestrate pr-readiness-check diff_target=feature/x`)
  use it.
- Else use the `default` field.
- Else ask **one** question per missing input, in order. Stop after
  the first unanswered required input — pipelines are batch-friendly
  by design, but `ask-when-uncertain` still applies.

### 4. Dispatch the steps

Walk `steps[]` in order. For each step:

| `kind` | Dispatch path |
|---|---|
| `skill` | Invoke the skill identified by `ref` with the resolved `with` block. |
| `command` | Run the slash-command identified by `ref` as if the user had typed it. |
| `persona` | Set `roles.active_role` to `ref` for the next dependent step; does not produce its own `output`. |
| `subagent` | Delegate to [`subagent-orchestration`](../skills/subagent-orchestration/SKILL.md) using `ref` as the mode name. |

Capture each step's output in an in-memory `outputs[step.id]` map.
`${{ inputs.X }}` and `${{ steps.Y.output }}` are substituted via
string replacement only — no expressions, no shell-out.

### 5. Honour `when`

If a step has a `when` field, evaluate it as one of:

- `${{ steps.X.output }} == "<literal>"`
- `steps.X.success` / `steps.X.failure`

Anything else → stop the run with a clear error. The DSL is
deliberately tiny; richer logic belongs in a skill, not in the
pipeline file.

### 6. Halt on hard failure

A step failure ends the pipeline immediately. Surface:

- the failing step id and kind/ref
- the error or non-zero exit
- the steps that ran cleanly before it

Do **not** continue past a failure unless a downstream step has a
`when: steps.X.failure` guard explicitly authorizing it.

### 7. Produce the delivery report

When the pipeline reaches the end of `steps[]`:

- Resolve every `outputs[name]` entry by substituting the captured
  step outputs.
- Print a Markdown delivery report:
  - pipeline name + resolved input values
  - per-step verdict (✅ / ❌, ref, one-line summary)
  - the resolved `outputs:` map at the bottom

### 8. Audit trail

Per [`audit-log-v1`](../../docs/contracts/audit-log-v1.md), append
one JSONL entry per step boundary to the current month's audit file
under `agents/runtime/state/audit/`. Counts + ids only — never the step's
output body.

### 9. What this command does NOT do

- Edit the pipeline file. Authoring is human or skill-driven.
- Commit, push, or open PRs. Those gates live elsewhere.
- Branch or invent steps. The pipeline file is the source of truth.

## See also

- Contract: [`orchestration-dsl-v1.md`](../../docs/contracts/orchestration-dsl-v1.md)
- Linter: `scripts/lint_orchestration_dsl.py`
- Subagent runtime: [`subagent-orchestration`](../skills/subagent-orchestration/SKILL.md)
- Audit emission: [`audit-log-v1.md`](../../docs/contracts/audit-log-v1.md)
