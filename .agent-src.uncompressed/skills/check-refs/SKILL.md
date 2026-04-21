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

Use this skill when:

- A skill, rule, command, guideline, or context has been renamed or deleted
- Linking a newly added artifact from elsewhere in `.agent-src.uncompressed/`
- Preparing a PR that touches cross-references between agent artifacts
- CI's `check-refs` job failed and the broken reference needs to be located

Do NOT use when:

- Only the body of a single file changed and no names or paths were touched
- Checking frontmatter shape or required sections — use `lint-skills` instead
- Verifying compressed vs uncompressed pairs — use `task sync-check` instead

## Procedure

### 1. Inspect the scope of recent changes

Identify whether any artifact was renamed, moved, or removed since the last
clean run. Cross-reference checks are relevant only when names or paths shift;
pure body edits cannot break references.

### 2. Dispatch via the runtime layer

Invoke the skill through the runtime dispatcher so the `execution:` block in
this skill's frontmatter governs the call:

```bash
python3 scripts/runtime_dispatcher.py run --skill check-refs
```

The dispatcher resolves the request, the shell handler runs
`python3 scripts/check_references.py`, captures stdout/stderr, and returns a
typed `ExecutionResult`.

### 3. Verify the result

Check the returned `ExecutionResult`:

- `exit_code: 0` → all cross-references resolve
- `exit_code: 1` → at least one broken reference — read `stdout` for file,
  line, and the offending ref, then fix the source or update the target
- `status: timeout` → the checker exceeded `timeout_seconds` — investigate
- `status: error` → interpreter or script missing — confirm `python3` and
  `scripts/check_references.py` are available at the repository root

## Output format

1. One-line summary: `success | failure | timeout | error`, exit code,
   duration in milliseconds
2. Count of broken references found, if any
3. First 10 broken references with `file:line → missing-target`
4. Next action: fix references, re-run the skill, or surface `stdout` for
   review

## Gotchas

- The checker is read-only — it never rewrites references, so a clean run
  after a fix must be produced by re-invoking the skill, not by assumption
- Running outside the agent-config repo root makes the checker inspect zero
  files and report a false pass
- Relative links inside comments or fenced code blocks may still be parsed as
  references depending on the checker's current rules; do not suppress a
  broken ref without confirming it is a genuine false positive

## Do NOT

- Do NOT invoke `scripts/check_references.py` directly when the intent is to
  verify the runtime path — always go through the dispatcher so the
  `ExecutionResult` is produced and inspectable
- Do NOT raise `timeout_seconds` to mask a slowdown — investigate which part
  of the tree grew large enough to push past 60 seconds
- Do NOT add piping or redirection to `command` — the handler uses
  `shell=False` and will refuse anything outside pure argv form
