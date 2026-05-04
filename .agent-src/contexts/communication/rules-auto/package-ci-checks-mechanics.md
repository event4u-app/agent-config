# Package CI checks — mechanics

The five required local-CI checks, the quick one-liner, and the
post-edit workflow rules for the
[`package-ci-checks`](../../../rules/package-ci-checks.md) rule. The
Iron Law, the activation trigger, and the "Do NOT" list live in the
rule; this file is the lookup material when an agent is about to
push or open a PR in the `agent-config` package repo.

## Required checks (in order)

Run all of these before pushing — they match the GitHub Actions workflows exactly:

### 1. Sync check

```bash
bash scripts/compress.sh --check          # .agent-src/ matches .agent-src.uncompressed/
bash scripts/compress.sh --check-hashes   # compression hashes are clean
```

**Common failure:** Edited uncompressed file but forgot `bash scripts/compress.sh --mark-done {path}`.

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
bash scripts/compress.sh --check && \
bash scripts/compress.sh --check-hashes && \
python3 scripts/check_compression.py && \
python3 scripts/check_references.py && \
python3 scripts/check_portability.py && \
python3 scripts/skill_linter.py --all && \
python3 -m pytest tests/ --tb=short && \
python3 scripts/readme_linter.py README.md --root .
```

## After editing skills/rules

When you edit a file in `.agent-src.uncompressed/`:

1. Edit the uncompressed file
2. Edit the compressed file in `.agent-src/` to match
3. Run `bash scripts/compress.sh --mark-done {relative-path}` to update the hash
4. Verify with `bash scripts/compress.sh --check-hashes`

**If you skip step 3, the CI pipeline WILL fail.**

## After editing `scripts/compress.py`

Changes to `compress.py` often break existing tests in `tests/test_compress.py`.
Always run `python3 -m pytest tests/test_compress.py -v --tb=short` immediately
after changing `compress.py` — don't wait until the end.
