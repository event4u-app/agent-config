---
name: file-lint-status
description: "Use when a user supplies a filename and wants a lint check followed by a status print. Two-step utility skill — no trade-off between actions."
status: active
---

# file-lint-status

## When to use

Use this skill when:
- The user provides a filename and asks for lint validation plus status output.
- A wrapper task needs a deterministic two-step pass over a single file.

Do NOT use when:
- The user wants multi-file batch lint — route to `lint-skills` skill.
- The user wants to *fix* lint failures, not report them — route to `quality-fix`.

## Procedure: file-lint-status

### Step 1: Lint

1. Resolve the filename to an absolute path.
2. Invoke `python3 scripts/skill_linter.py {path}`.
3. Capture exit code and stdout.

### Step 2: Status

1. Map exit code: `0` → `pass`, non-zero → `fail`.
2. Print `{path}: {status}` on a single line.
3. Print stdout verbatim if status is `fail`.

## Output format

1. **Status line** — `{path}: pass` or `{path}: fail`.
2. **Failure detail** (only when `fail`) — verbatim linter stdout.

## Gotcha

- The model tends to add a numbered-options block "What next?" after the status print — there is no trade-off, so omit.
- Don't assume the file exists — `skill_linter.py` exits non-zero on missing path.

## Do NOT

- Do NOT prompt for confirmation between Step 1 and Step 2.
- Do NOT add a `## Summary` or `## Status` block after the output.
- Do NOT introduce branching options when the two steps are sequential and uncontested.

## Frugality Standards

Per the [Frugality Charter](../../contexts/communication/frugality-charter.md),
this writer applies the default-terse standard: no narrative intros,
no preview-then-confirm gates, no numbered options without a real
trade-off.

Pre-save self-check:
1. Does every body section start with the obligation, not an intro?
2. Are numbered options absent — Step 1 → Step 2 is sequential, no trade-off?
3. Is the charter linked, not restated?
4. Does the output skip `## Summary` / `## Status` post-action blocks?
5. Does the procedure avoid `Let me` / `Found it` / `OK` openers?
