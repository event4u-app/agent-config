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


def test_complete_skill_passes(tmp_path: Path) -> None:
    """A skill with all required and recommended sections should pass cleanly."""
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

## Output format

1. Summary of changes
2. Files modified

## Do NOT

* Do NOT skip checks
""",
    )

    result = lint_file(path)
    assert result.status == "pass"


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
        """---
type: "always"
source: package
---

# Bad Rule

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
        """---
type: "always"
source: package
---

# Good Rule

Never use nested triple backticks.
Prefer plain text for commands.
Always validate before commit.
""",
    )

    result = lint_file(path)
    assert result.status == "pass" or result.status == "pass_with_warnings"
    assert not any(issue.severity == "error" for issue in result.issues)


# --- Rule frontmatter tests ---


def test_rule_missing_frontmatter_fails(tmp_path: Path) -> None:
    path = write_file(
        tmp_path,
        ".augment/rules/no-frontmatter.md",
        """# No Frontmatter Rule

Just some directives.
""",
    )

    result = lint_file(path)
    assert result.status == "fail"
    assert any(issue.code == "missing_frontmatter" for issue in result.issues)


def test_rule_missing_type_fails(tmp_path: Path) -> None:
    path = write_file(
        tmp_path,
        ".augment/rules/no-type.md",
        """---
source: package
---

# No Type Rule

Some directives.
""",
    )

    result = lint_file(path)
    assert result.status == "fail"
    assert any(issue.code == "missing_type" for issue in result.issues)


def test_rule_missing_source_fails(tmp_path: Path) -> None:
    path = write_file(
        tmp_path,
        ".augment/rules/no-source.md",
        """---
type: "always"
---

# No Source Rule

Some directives.
""",
    )

    result = lint_file(path)
    assert result.status == "fail"
    assert any(issue.code == "missing_source" for issue in result.issues)


def test_rule_invalid_type_fails(tmp_path: Path) -> None:
    path = write_file(
        tmp_path,
        ".augment/rules/bad-type.md",
        """---
type: "manual"
source: package
---

# Bad Type Rule

Some directives.
""",
    )

    result = lint_file(path)
    assert result.status == "fail"
    assert any(issue.code == "missing_type" for issue in result.issues)


def test_rule_auto_without_description_fails(tmp_path: Path) -> None:
    path = write_file(
        tmp_path,
        ".augment/rules/auto-no-desc.md",
        """---
type: "auto"
source: project
---

# Auto Rule Without Description

Some directives.
""",
    )

    result = lint_file(path)
    assert result.status == "fail"
    assert any(issue.code == "auto_missing_description" for issue in result.issues)


def test_rule_auto_with_description_passes(tmp_path: Path) -> None:
    path = write_file(
        tmp_path,
        ".augment/rules/auto-with-desc.md",
        """---
type: "auto"
source: project
description: "Apply when working with Docker containers"
---

# Docker Rule

Always run commands inside the container.
""",
    )

    result = lint_file(path)
    assert not any(issue.code == "auto_missing_description" for issue in result.issues)


def test_rule_missing_h1_fails(tmp_path: Path) -> None:
    path = write_file(
        tmp_path,
        ".augment/rules/no-heading.md",
        """---
type: "always"
source: package
---

Some directives without a heading.
""",
    )

    result = lint_file(path)
    assert result.status == "fail"
    assert any(issue.code == "missing_h1" for issue in result.issues)


def test_rule_no_trailing_newline_fails(tmp_path: Path) -> None:
    path = write_file(
        tmp_path,
        ".augment/rules/no-newline.md",
        "---\ntype: \"always\"\nsource: package\n---\n\n# Rule\n\nContent.",
    )

    result = lint_file(path)
    assert any(issue.code == "no_trailing_newline" for issue in result.issues)


def test_rule_double_blank_lines_warns(tmp_path: Path) -> None:
    path = write_file(
        tmp_path,
        ".augment/rules/double-blanks.md",
        """---
type: "always"
source: package
---

# Rule


Some content after double blank.
""",
    )

    result = lint_file(path)
    assert any(issue.code == "double_blank_lines" for issue in result.issues)



# --- Pointer-only / guideline-dependent skill detection ---


def test_pointer_only_skill_warns(tmp_path: Path) -> None:
    """A skill that delegates most work to guidelines should trigger pointer_only_skill warning."""
    path = write_file(
        tmp_path,
        ".augment.uncompressed/skills/delegator/SKILL.md",
        """---
name: delegator
description: "Use when delegating to guidelines."
source: project
---

# delegator

## When to use

* When you need to follow guidelines

## Procedure

1. See guideline `foo/bar.md` for the full workflow
2. Check the documentation for details and refer to the rule

## Output format

1. Result
2. Summary

## Gotchas

* May miss context

## Do NOT

* Do NOT skip reading the guideline
""",
    )

    result = lint_file(path)
    assert any(issue.code == "pointer_only_skill" for issue in result.issues)


def test_guideline_dependent_skill_errors(tmp_path: Path) -> None:
    """A skill that is effectively just pointers should trigger guideline_dependent_skill error."""
    path = write_file(
        tmp_path,
        ".augment.uncompressed/skills/pure-pointer/SKILL.md",
        """---
name: pure-pointer
description: "Use when pointing to docs."
source: project
---

# pure-pointer

## When to use

* When you need guidance

## Procedure

See guideline `a.md` for the approach.
Refer to the documentation of skill `b`.
Follow the rule `c.md` for constraints.
Consult the guideline `d.md` for edge cases.

## Output format

1. Result
2. Summary

## Gotchas

* Context may be missing

## Do NOT

* Do NOT guess
""",
    )

    result = lint_file(path)
    assert any(issue.code == "guideline_dependent_skill" for issue in result.issues)


def test_strong_self_contained_skill_no_pointer_warning(tmp_path: Path) -> None:
    """A skill with concrete actions should NOT trigger pointer warnings."""
    path = write_file(
        tmp_path,
        ".augment.uncompressed/skills/concrete-worker/SKILL.md",
        """---
name: concrete-worker
description: "Use when running a concrete analysis workflow."
source: project
---

# concrete-worker

## When to use

* When you need to analyze code quality

## Procedure

1. Inspect the current codebase structure
2. Run the linter to detect issues
3. Extract relevant error messages
4. Create a fix for each detected issue
5. Validate that all fixes resolve the errors
6. Generate a summary report

## Output format

1. List of issues found
2. Fixes applied
3. Validation results

## Gotchas

* Linter may report false positives

## Do NOT

* Do NOT auto-fix without validation
""",
    )

    result = lint_file(path)
    assert not any(issue.code == "pointer_only_skill" for issue in result.issues)
    assert not any(issue.code == "guideline_dependent_skill" for issue in result.issues)


def test_guideline_heavy_but_acceptable_skill(tmp_path: Path) -> None:
    """A skill that references guidelines but has enough own actions should not warn."""
    path = write_file(
        tmp_path,
        ".augment.uncompressed/skills/mixed-worker/SKILL.md",
        """---
name: mixed-worker
description: "Use when reviewing code with guideline references."
source: project
---

# mixed-worker

## When to use

* When reviewing code quality

## Procedure

1. Inspect the file structure and detect issues
2. Run the linter to validate code style
3. See guideline `coding.md` for naming conventions
4. Create fixes for each detected issue
5. Execute tests to verify behavior
6. Generate a detailed report with findings

## Output format

1. Issues found
2. Fixes applied

## Gotchas

* Some guidelines may conflict

## Do NOT

* Do NOT skip testing
""",
    )

    result = lint_file(path)
    assert not any(issue.code == "pointer_only_skill" for issue in result.issues)
    assert not any(issue.code == "guideline_dependent_skill" for issue in result.issues)
