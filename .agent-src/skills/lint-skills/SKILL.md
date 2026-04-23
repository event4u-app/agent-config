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

- Validate shape of every skill/rule in `.agent-src.uncompressed/`
- Verify `execution:` metadata is well-formed
- Pre-PR local check before CI skill-lint job
- Investigate reported linter failure

NOT: single file (call `skill_linter.py <path>`), cross-refs (use `check-refs`),
compression freshness (use `bash scripts/compress.sh --check`).

## Procedure

1. **Inspect env** — `python3` on PATH, cwd = agent-config repo root (linter
   resolves `.agent-src.uncompressed/skills/` relative to cwd).
2. **Dispatch via runtime** —

   ```bash
   python3 scripts/runtime_dispatcher.py run --skill lint-skills
   ```

   Handler runs `python3 scripts/skill_linter.py --all`, captures stdout/stderr,
   returns typed `ExecutionResult`.
3. **Verify result** —
   - `status: success` + `exit_code: 0` → all clean
   - `exit_code: 1` → warnings only — review stdout
   - `exit_code: 2` → errors — fix flagged files
   - `status: timeout` → investigate slowdown, do not just raise timeout
   - `status: error` → interpreter missing or wrong cwd

## Output

1. One-line summary: status, exit code, duration (ms)
2. Count of skills/rules inspected if known
3. First 10 errored files: code + message
4. Next action: fix, re-run, or surface raw stdout

## Gotcha

- `--all` walks full tree — several seconds; bump `timeout_seconds` if repo grew
- Running outside repo root → zero skills inspected, looks green but is a no-op
- `exit_code: 1` (warnings) does not fail CI — not the same as "clean"

## Do NOT

- Do NOT call `skill_linter.py` directly when the intent is to exercise the
  runtime path — go through the dispatcher
- Do NOT raise `timeout_seconds` to mask slowdowns
- Do NOT add pipes/redirection — handler uses `shell=False`, argv form only

## References

- Skill: `check-refs` — sibling pilot that runs the cross-ref checker
- Rule: `runtime-safety` — execution metadata constraints
- Script: `scripts/skill_linter.py`, `scripts/runtime_dispatcher.py`,
  `scripts/runtime_handler.py`
