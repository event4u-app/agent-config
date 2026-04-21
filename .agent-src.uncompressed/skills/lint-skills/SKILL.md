---
name: lint-skills
description: "Use when running the package's skill linter against all skills and rules to validate frontmatter, required sections, and execution metadata."
source: package
execution:
  type: assisted
  handler: shell
  timeout_seconds: 120
  allowed_tools: []
  command:
    - python3
    - scripts/skill_linter.py
    - "--all"
---

# lint-skills

## When to use

Use this skill when:

- Validating the shape of every skill and rule in `.agent-src.uncompressed/`
- Verifying execution metadata (`execution.type`, `handler`, `command`) is well-formed
- Checking locally before opening a PR that CI's skill-lint job will pass
- Investigating a reported linter failure on a specific skill or rule

Do NOT use when:

- Linting only one file — call `python3 scripts/skill_linter.py <path>` directly
- Checking cross-references between files — use `check-refs` instead
- Checking compression freshness — use `task sync-check` instead

## Procedure

### 1. Inspect the environment

Confirm `python3` is available and the working directory is the agent-config
repository root — the linter expects to find `.agent-src.uncompressed/skills/`
and related directories relative to `cwd`.

### 2. Dispatch via the runtime layer

Invoke the skill through the runtime dispatcher so the `execution:` block in
this skill's frontmatter governs the call:

```bash
python3 scripts/runtime_dispatcher.py run --skill lint-skills
```

The dispatcher resolves the request, the shell handler runs
`python3 scripts/skill_linter.py --all`, captures stdout/stderr, and returns
a typed `ExecutionResult`.

### 3. Verify the result

Check the returned `ExecutionResult`:

- `status: success` and `exit_code: 0` → all skills and rules are clean
- `exit_code: 1` → warnings only — review `stdout` for the listed warnings
- `exit_code: 2` → errors present — fix the flagged files before continuing
- `status: timeout` → the linter exceeded `timeout_seconds` — investigate
- `status: error` → the interpreter could not launch — check that `python3`
  is on `PATH` and the repository root is the current working directory

## Output format

1. One-line summary: `success | failure | timeout | error`, exit code,
   duration in milliseconds
2. Count of skills and rules the linter inspected, if known
3. List of files with errors (first 10), each with code and message
4. Next action: fix errors, re-run, or surface the raw `stdout` for review

## Gotchas

- The command uses `--all`, which walks the full tree — expect several seconds
  of runtime on a warm repo; bump `timeout_seconds` if the repo has grown
- Running outside the agent-config repo root will make the linter report zero
  skills, which looks like a pass but is actually a no-op
- Warnings (`exit_code: 1`) do not fail CI by default; do not dismiss them as
  "green" when the task is to get to zero warnings

## Do NOT

- Do NOT invoke `scripts/skill_linter.py` directly when the intent is to test
  the runtime path — use the dispatcher so the handler and result object are
  exercised
- Do NOT raise `timeout_seconds` to hide a genuinely slow linter pass —
  investigate the slowdown first
- Do NOT add shell redirection or pipes to `command` — the handler runs
  `subprocess.run` with `shell=False`; only argv form is supported
