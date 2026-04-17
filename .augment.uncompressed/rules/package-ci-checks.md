---
type: "auto"
alwaysApply: false
description: "Before pushing to remote or creating a PR in the agent-config package — run all CI checks locally first"
source: package
---

# Package CI Checks

## When this applies

Before **any** push to remote or PR creation in the **agent-config** package.
This rule is specific to this package — it does NOT apply to consumer projects.

## The Iron Law

```
NEVER push without running ALL CI checks locally first.
```

Every CI pipeline failure is preventable by running these checks before pushing.

## Required checks (in order)

Run all of these before pushing — they match the GitHub Actions workflows exactly:

### 1. Sync check

```bash
task sync-check            # .augment/ matches .augment.uncompressed/
task sync-check-hashes     # compression hashes are clean
```

**Common failure:** Edited uncompressed file but forgot `task sync-mark-done`.

### 2. Consistency checks

```bash
python3 scripts/check_compression.py   # compressed variants are valid
python3 scripts/check_references.py     # no broken cross-references
python3 scripts/check_portability.py    # no project-specific references in shared files
```

**Common failure:** Changed code-blocks in uncompressed but didn't re-compress.

### 3. Linter

```bash
python3 scripts/skill_linter.py --all   # 0 FAIL required
```

**Common failure:** New skill missing analysis/verification sections.

### 4. Tests

```bash
python3 -m pytest tests/ --tb=short     # all tests must pass
```

**Common failure:** Changed `compress.py` behavior without updating test expectations.

### 5. README

```bash
python3 scripts/readme_linter.py README.md --root .
```

## Quick one-liner

Run all checks in sequence — stops on first failure:

```bash
task sync-check && task sync-check-hashes && \
python3 scripts/check_compression.py && \
python3 scripts/check_references.py && \
python3 scripts/check_portability.py && \
python3 scripts/skill_linter.py --all && \
python3 -m pytest tests/ --tb=short && \
python3 scripts/readme_linter.py README.md --root .
```

## After editing skills/rules

When you edit a file in `.augment.uncompressed/`:

1. Edit the uncompressed file
2. Edit the compressed file in `.augment/` to match
3. Run `task sync-mark-done -- {relative-path}` to update the hash
4. Verify with `task sync-check-hashes`

**If you skip step 3, the CI pipeline WILL fail.**

## After editing `scripts/compress.py`

Changes to `compress.py` often break existing tests in `tests/test_compress.py`.
Always run `python3 -m pytest tests/test_compress.py -v --tb=short` immediately
after changing `compress.py` — don't wait until the end.

## Do NOT

- Do NOT push "to see if CI passes" — that wastes pipeline minutes
- Do NOT skip hash checks because "I only changed one file"
- Do NOT assume tests pass because linter passes — they check different things
