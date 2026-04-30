---
type: "auto"
alwaysApply: false
description: "Before pushing to remote or creating a PR in the agent-config package — run all CI checks locally first"
source: package
---

# Package CI Checks

Before **any** push/PR in agent-config: run ALL CI checks locally.

## The Iron Law

```
NEVER push without running ALL CI checks locally first.
```

Every CI pipeline failure is preventable by running these checks before pushing.

## Required checks

### 1. Sync

```bash
bash scripts/compress.sh --check          # .agent-src/ matches .agent-src.uncompressed/
bash scripts/compress.sh --check-hashes   # compression hashes are clean
```

### 2. Consistency

```bash
python3 scripts/check_compression.py   # compressed variants are valid
python3 scripts/check_references.py     # no broken cross-references
python3 scripts/check_portability.py    # no project-specific references in shared files
```

### 3. Linter (0 FAIL required)

```bash
python3 scripts/skill_linter.py --all   # 0 FAIL required
```

### 4. Tests

```bash
python3 -m pytest tests/ --tb=short     # all tests must pass
```

### 5. README

```bash
python3 scripts/readme_linter.py README.md --root .
```

## Quick one-liner

```bash
bash scripts/compress.sh --check && \
bash scripts/compress.sh --check-hashes && \
python3 scripts/check_compression.py && \
python3 scripts/check_references.py && \
python3 scripts/check_portability.py && \
python3 scripts/skill_linter.py --all && \
python3 -m pytest tests/ --tb=short && \
python3 scripts/readme_linter.py README.md --root .
```

## After editing skills/rules in .agent-src.uncompressed/

1. Edit uncompressed file
2. Edit compressed file in `.agent-src/` to match
3. `bash scripts/compress.sh --mark-done {relative-path}` — update hash
4. `bash scripts/compress.sh --check-hashes` — verify

**Skip step 3 → CI WILL fail.**

## After editing scripts/compress.py

Run `python3 -m pytest tests/test_compress.py -v` **immediately** — don't wait.

## Do NOT

- Push "to see if CI passes" — wastes pipeline minutes
- Skip hash checks for "small changes"
- Assume tests pass because linter passes
