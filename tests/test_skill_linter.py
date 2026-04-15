"""Tests for the skill linter MVP."""

import sys
from pathlib import Path

# Add scripts dir to path so we can import skill_linter
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scripts"))

from skill_linter import lint_file  # noqa: E402


def write_file(tmp_path: Path, relative: str, content: str) -> Path:
    path = tmp_path / relative
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")
    return path


def test_valid_skill_passes(tmp_path: Path) -> None:
    path = write_file(
        tmp_path,
        ".augment.uncompressed/skills/example/SKILL.md",
        """---
name: example
description: "Use when testing a concrete workflow."
source: project
---

# example

## When to use

* Testing something specific

## Procedure

1. Inspect current state
2. Apply change
3. Validate result

## Output format

1. Result
2. Next step

## Gotchas

* Missing validation causes weak skills

## Do NOT

* Do NOT skip validation
""",
    )

    result = lint_file(path)
    assert result.status == "pass" or result.status == "pass_with_warnings"
    assert not any(issue.severity == "error" for issue in result.issues)


def test_missing_output_format_fails(tmp_path: Path) -> None:
    path = write_file(
        tmp_path,
        ".augment.uncompressed/skills/example/SKILL.md",
        """---
name: example
description: "Use when testing."
source: project
---

# example

## When to use

* Testing

## Procedure

1. Inspect
2. Change
3. Validate

## Gotchas

* Something breaks

## Do NOT

* Do NOT skip checks
""",
    )

    result = lint_file(path)
    assert result.status == "fail"
    assert any(issue.code == "missing_section" for issue in result.issues)


def test_vague_validation_fails(tmp_path: Path) -> None:
    path = write_file(
        tmp_path,
        ".augment.uncompressed/skills/example/SKILL.md",
        """---
name: example
description: "Use when testing."
source: project
---

# example

## When to use

* Testing

## Procedure

1. Inspect
2. Change
3. Check if it works

## Output format

1. Result
2. Next step

## Gotchas

* Missing validation causes weak skills

## Do NOT

* Do NOT skip validation
""",
    )

    result = lint_file(path)
    assert result.status == "fail"
    assert any(issue.code == "vague_validation" for issue in result.issues)


def test_rule_with_skill_sections_fails(tmp_path: Path) -> None:
    path = write_file(
        tmp_path,
        ".augment/rules/bad-rule.md",
        """# Bad Rule

## Procedure

1. Do this
2. Do that

## Output format

1. Result
""",
    )

    result = lint_file(path)
    assert result.status == "fail"
    assert any(issue.code == "rule_looks_like_skill" for issue in result.issues)


def test_valid_rule_passes(tmp_path: Path) -> None:
    path = write_file(
        tmp_path,
        ".augment/rules/good-rule.md",
        """# Good Rule

Never use nested triple backticks.
Prefer plain text for commands.
Always validate before commit.
""",
    )

    result = lint_file(path)
    assert result.status == "pass" or result.status == "pass_with_warnings"
    assert not any(issue.severity == "error" for issue in result.issues)
