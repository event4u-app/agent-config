---
type: "auto"
tier: "mechanical-already"
alwaysApply: false
description: "Before pushing to remote or creating a PR in the agent-config package — run all CI checks locally first"
source: package
load_context:
  - .agent-src.uncompressed/contexts/communication/rules-auto/package-ci-checks-mechanics.md
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

## Required checks — see mechanics

Five checks must pass locally before push, in this order:

1. **Sync** — `compress.sh --check` and `--check-hashes`.
2. **Consistency** — `check_compression.py`, `check_references.py`, `check_portability.py`.
3. **Linter** — `skill_linter.py --all`, 0 FAIL required.
4. **Tests** — `pytest tests/`.
5. **README** — `readme_linter.py`.

The full command snippets, common-failure notes per step, the quick
chained one-liner, and the post-edit workflow ("after editing
skills/rules", "after editing `scripts/compress.py`") all live in
[`contexts/communication/rules-auto/package-ci-checks-mechanics.md`](../contexts/communication/rules-auto/package-ci-checks-mechanics.md).
Pull it whenever pre-push verification is needed.

## Do NOT

- Do NOT push "to see if CI passes" — that wastes pipeline minutes
- Do NOT skip hash checks because "I only changed one file"
- Do NOT assume tests pass because linter passes — they check different things
