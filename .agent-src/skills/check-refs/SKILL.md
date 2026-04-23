---
name: check-refs
description: "Use when verifying cross-references between skills, rules, commands, guidelines, and context documents are not broken after edits, renames, or deletions."
source: package
execution:
  type: assisted
  handler: shell
  timeout_seconds: 60
  allowed_tools: []
  command:
    - python3
    - scripts/check_references.py
---

# check-refs

## When to use

- Skill/rule/command/guideline/context renamed, moved, or deleted
- Linking newly added artifact from elsewhere in `.agent-src.uncompressed/`
- Pre-PR when changes touch cross-references
- CI `check-refs` job failed and target ref needs locating

NOT: body-only edits, frontmatter shape (use `lint-skills`), compressed pairs
(use `bash scripts/compress.sh --check`).

## Procedure

1. **Inspect scope** — confirm at least one rename/move/remove since last clean
   run. Body-only edits cannot break refs.
2. **Dispatch via runtime** —

   ```bash
   python3 scripts/runtime_dispatcher.py run --skill check-refs
   ```

   Handler runs `python3 scripts/check_references.py`, captures stdout/stderr,
   returns typed `ExecutionResult`.
3. **Verify result** —
   - `exit_code: 0` → all refs resolve
   - `exit_code: 1` → broken refs — read stdout for `file:line → target`
   - `status: timeout` → investigate, do not raise limit blindly
   - `status: error` → interpreter or script missing, or wrong cwd

## Output

1. One-line summary: status, exit code, duration (ms)
2. Count of broken refs if any
3. First 10 broken refs: `file:line → missing-target`
4. Next action: fix, re-run, or surface raw stdout

## Gotcha

- Checker is read-only — clean re-run must be produced by re-invoking, not
  assumed
- Running outside repo root → zero files inspected, false pass
- Refs inside fenced code blocks may still be parsed — verify a "false
  positive" before suppressing it

## Do NOT

- Do NOT call `check_references.py` directly when the intent is to exercise
  the runtime path — go through the dispatcher
- Do NOT raise `timeout_seconds` to mask a real slowdown
- Do NOT add pipes/redirection — handler uses `shell=False`, argv form only

## References

- Skill: `lint-skills` — sibling pilot for skill/rule shape
- Rule: `runtime-safety` — execution metadata constraints
- Script: `scripts/check_references.py`, `scripts/runtime_dispatcher.py`,
  `scripts/runtime_handler.py`
