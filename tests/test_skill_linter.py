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
        ".agent-src.uncompressed/skills/example/SKILL.md",
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
        ".agent-src.uncompressed/skills/example/SKILL.md",
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
    # bare_noun_name warning for "example" is expected
    assert result.status in ("pass", "pass_with_warnings")
    assert not any(issue.severity == "error" for issue in result.issues)


def test_vague_validation_fails(tmp_path: Path) -> None:
    path = write_file(
        tmp_path,
        ".agent-src.uncompressed/skills/example/SKILL.md",
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
        ".agent-src.uncompressed/skills/delegator/SKILL.md",
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
        ".agent-src.uncompressed/skills/pure-pointer/SKILL.md",
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
        ".agent-src.uncompressed/skills/concrete-worker/SKILL.md",
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
        ".agent-src.uncompressed/skills/mixed-worker/SKILL.md",
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



# --- Execution quality checks ---


def test_execution_skill_without_analysis_fails(tmp_path: Path) -> None:
    """Execution skill with implementation language but no analysis signals → ERROR."""
    path = write_file(
        tmp_path,
        ".augment/skills/developer-execution/SKILL.md",
        """\
---
name: developer-execution
description: "Implement changes efficiently"
source: package
---

# developer-execution

## When to use

When implementing and fixing code.

## Procedure

1. Implement the change
2. Modify the tests
3. Fix any issues
4. Validate the result
5. Refactor if needed
""",
    )

    result = lint_file(path)
    assert any(issue.code == "missing_analysis_before_action" for issue in result.issues)


def test_execution_skill_with_analysis_passes(tmp_path: Path) -> None:
    """Execution skill that includes analysis signals → no error."""
    path = write_file(
        tmp_path,
        ".augment/skills/developer-execution/SKILL.md",
        """\
---
name: developer-execution
description: "Implement changes with analysis first"
source: package
---

# developer-execution

## When to use

When implementing and fixing code.

## Procedure

1. Analyze the existing code and understand the current behavior
2. Inspect the relevant files and trace the data flow
3. Implement the change
4. Verify with real execution using curl or Playwright
5. Do not retry blindly — analyze errors first
6. If requirements are unclear, ask for clarification
""",
    )

    result = lint_file(path)
    assert not any(issue.code == "missing_analysis_before_action" for issue in result.issues)
    assert not any(issue.code == "missing_real_verification" for issue in result.issues)


def test_execution_skill_with_analysis_section_passes(tmp_path: Path) -> None:
    """Execution skill with analysis section header (not keywords) → no error."""
    path = write_file(
        tmp_path,
        ".augment/skills/developer-validation/SKILL.md",
        """\
---
name: developer-validation
description: "Validate developer workflows"
source: package
---

# developer-validation

## When to use

When implementing validation changes.

## Procedure

### Understand current setup

Check how validation currently works in the project.

### Implement changes

Make the required modifications.

### Verify results

Run the test suite to confirm behavior.
""",
    )

    result = lint_file(path)
    assert not any(issue.code == "missing_analysis_before_action" for issue in result.issues)
    assert not any(issue.code == "missing_real_verification" for issue in result.issues)


def test_execution_skill_without_verification_fails(tmp_path: Path) -> None:
    """Execution skill without verification signals → ERROR."""
    path = write_file(
        tmp_path,
        ".augment/skills/developer-action/SKILL.md",
        """\
---
name: developer-action
description: "Implement code changes"
source: package
---

# developer-action

## When to use

When implementing code changes.

## Procedure

1. Analyze the existing code
2. Understand the current behavior
3. Implement the changes
4. Review the code
""",
    )

    result = lint_file(path)
    assert any(issue.code == "missing_real_verification" for issue in result.issues)


def test_non_execution_skill_skips_checks(tmp_path: Path) -> None:
    """Non-execution skills should not trigger execution quality checks."""
    path = write_file(
        tmp_path,
        ".augment/skills/api-design/SKILL.md",
        """\
---
name: api-design
description: "Design REST APIs"
source: package
---

# api-design

## When to use

When designing API endpoints.

## Procedure

1. Define the resource
2. Choose HTTP methods
""",
    )

    result = lint_file(path)
    assert not any(issue.code == "missing_analysis_before_action" for issue in result.issues)
    assert not any(issue.code == "missing_real_verification" for issue in result.issues)


def test_commands_excluded_from_execution_checks(tmp_path: Path) -> None:
    """Commands should be excluded from execution quality checks entirely."""
    path = write_file(
        tmp_path,
        ".augment/commands/fix-something.md",
        """\
---
name: fix-something
description: "Fix implementation issues"
---

# /fix-something

## Steps

### 1. Implement the fix

Modify the code and fix the issues.
""",
    )

    result = lint_file(path)
    assert not any(issue.code == "missing_analysis_before_action" for issue in result.issues)


def test_guidelines_excluded_from_execution_checks(tmp_path: Path) -> None:
    """Guidelines should be excluded from execution quality checks."""
    path = write_file(
        tmp_path,
        ".augment/guidelines/php/testing.md",
        """\
---
description: "Testing patterns"
---

# Testing Guidelines

## Patterns

- Implement tests using Pest
- Fix flaky tests by analyzing timing
- Validate behavior before committing
""",
    )

    result = lint_file(path)
    assert not any(issue.code == "missing_analysis_before_action" for issue in result.issues)


# --- Type boundary checks ---


def test_guideline_with_executable_procedure_warns(tmp_path: Path) -> None:
    """Guideline with 5+ executable numbered steps → warning."""
    path = write_file(
        tmp_path,
        ".augment/guidelines/php/testing.md",
        """\
---
description: "Testing workflow"
---

# Testing Workflow

1. Run the migrations
2. Create the test file
3. Implement the test cases
4. Execute the test suite
5. Run PHPStan checks
6. Create the PR
""",
    )

    result = lint_file(path)
    assert any(issue.code == "guideline_contains_executable_procedure" for issue in result.issues)


def test_guideline_without_procedure_passes(tmp_path: Path) -> None:
    """Guideline without executable steps → no warning."""
    path = write_file(
        tmp_path,
        ".augment/guidelines/php/naming.md",
        """\
---
description: "Naming conventions"
---

# Naming Conventions

- Use camelCase for variables
- Use PascalCase for classes
- Use snake_case for database columns
""",
    )

    result = lint_file(path)
    assert not any(issue.code == "guideline_contains_executable_procedure" for issue in result.issues)


def test_command_without_skill_references_warns(tmp_path: Path) -> None:
    """Command that doesn't reference any skills → warning."""
    path = write_file(
        tmp_path,
        ".augment/commands/do-stuff.md",
        """\
---
name: do-stuff
description: "Do some stuff"
---

# /do-stuff

## Steps

### 1. Do the thing

Run some commands and make changes.

### 2. Done

Show results.
""",
    )

    result = lint_file(path)
    assert any(issue.code == "command_missing_skill_references" for issue in result.issues)


def test_command_with_skill_references_passes(tmp_path: Path) -> None:
    """Command that references skills → no warning."""
    path = write_file(
        tmp_path,
        ".augment/commands/deploy.md",
        """\
---
name: deploy
skills: [quality-tools, git-workflow]
description: "Deploy the application"
---

# /deploy

## Steps

### 1. Quality check

Use the quality-tools skill to run all checks.

### 2. Push

Push to remote.
""",
    )

    result = lint_file(path)
    assert not any(issue.code == "command_missing_skill_references" for issue in result.issues)


def test_skill_with_vague_validation_warns(tmp_path: Path) -> None:
    """Skill with vague validation → warning."""
    path = write_file(
        tmp_path,
        ".augment/skills/example-task/SKILL.md",
        """\
---
name: example-task
description: "Do example tasks"
source: package
---

# example-task

## When to use

When doing example tasks.

## Procedure

1. Do the thing

## Validation

Check if it works and make sure it's correct.

## Gotcha

Something might break.
""",
    )

    result = lint_file(path)
    assert any(issue.code == "skill_validation_too_generic" for issue in result.issues)


# --- Verification maturity checks ---


def test_backend_skill_without_backend_verification_warns(tmp_path: Path) -> None:
    """Backend execution skill without curl/postman → warning."""
    path = write_file(
        tmp_path,
        ".augment/skills/api-validation/SKILL.md",
        """\
---
name: api-validation
description: "Validate API endpoints"
source: package
---

# api-validation

## When to use

When working with API endpoints and controllers.

## Procedure

1. Analyze the route and controller
2. Check the middleware and service layer
3. Implement changes
4. Review the code
""",
    )

    result = lint_file(path)
    assert any(issue.code == "missing_backend_verification_example" for issue in result.issues)


def test_backend_skill_with_curl_passes(tmp_path: Path) -> None:
    """Backend execution skill mentioning curl → no backend verification warning."""
    path = write_file(
        tmp_path,
        ".augment/skills/api-validation/SKILL.md",
        """\
---
name: api-validation
description: "Validate API endpoints"
source: package
---

# api-validation

## When to use

When working with API endpoints and controllers.

## Procedure

1. Analyze the route and controller
2. Implement changes
3. Verify with curl: `curl -s /api/endpoint | jq '.status'`
""",
    )

    result = lint_file(path)
    assert not any(issue.code == "missing_backend_verification_example" for issue in result.issues)


# --- Governance checks ---


def test_uncompressed_without_compressed_warns(tmp_path: Path) -> None:
    """Uncompressed file without compressed variant → warning."""
    path = write_file(
        tmp_path,
        ".agent-src.uncompressed/rules/orphan-rule.md",
        """\
---
description: "When orphan behavior occurs"
---

# orphan-rule

- Do not leave orphans
""",
    )

    result = lint_file(path, repo_root=tmp_path)
    assert any(issue.code == "compressed_variant_missing" for issue in result.issues)


def test_uncompressed_with_compressed_passes(tmp_path: Path) -> None:
    """Uncompressed file with matching compressed variant → no warning."""
    content = """\
---
description: "When paired behavior occurs"
---

# paired-rule

- Always have a pair
"""
    write_file(tmp_path, ".agent-src.uncompressed/rules/paired-rule.md", content)
    write_file(tmp_path, ".augment/rules/paired-rule.md", content)

    path = tmp_path / ".agent-src.uncompressed" / "rules" / "paired-rule.md"
    result = lint_file(path, repo_root=tmp_path)
    assert not any(issue.code == "compressed_variant_missing" for issue in result.issues)


# --- Runtime execution metadata tests ---


def _make_skill(tmp_path: Path, frontmatter_extra: str = "") -> Path:
    """Helper to create a minimal valid skill with optional frontmatter."""
    content = f"""---
name: test-runtime
description: "Use when testing runtime execution metadata."
source: project
{frontmatter_extra}---

# test-runtime

## When to use

* Testing execution metadata

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
"""
    return write_file(tmp_path, ".agent-src.uncompressed/skills/test-runtime/SKILL.md", content)


def test_execution_manual_type_passes(tmp_path: Path) -> None:
    """Skill with execution.type: manual should pass."""
    path = _make_skill(tmp_path, "execution:\n  type: manual\n")
    result = lint_file(path)
    exec_errors = [i for i in result.issues if i.code.startswith("invalid_execution") or i.code.startswith("automated_")]
    assert len(exec_errors) == 0


def test_execution_assisted_type_passes(tmp_path: Path) -> None:
    """Skill with execution.type: assisted should pass."""
    path = _make_skill(tmp_path, "execution:\n  type: assisted\n  handler: internal\n")
    result = lint_file(path)
    exec_errors = [i for i in result.issues if i.code.startswith("invalid_execution") or i.code.startswith("automated_")]
    assert len(exec_errors) == 0


def test_execution_automated_valid_passes(tmp_path: Path) -> None:
    """Fully valid automated execution block should pass."""
    path = _make_skill(tmp_path, "execution:\n  type: automated\n  handler: shell\n  timeout_seconds: 120\n  safety_mode: strict\n  allowed_tools: []\n")
    result = lint_file(path)
    exec_errors = [i for i in result.issues if i.severity == "error" and "execution" in i.code or "automated" in i.code or "safety" in i.code]
    assert len(exec_errors) == 0


def test_execution_invalid_type_fails(tmp_path: Path) -> None:
    """Invalid execution.type should produce an error."""
    path = _make_skill(tmp_path, "execution:\n  type: dangerous\n")
    result = lint_file(path)
    assert any(i.code == "invalid_execution_type" for i in result.issues)


def test_execution_invalid_handler_fails(tmp_path: Path) -> None:
    """Invalid execution.handler should produce an error."""
    path = _make_skill(tmp_path, "execution:\n  type: manual\n  handler: bash\n")
    result = lint_file(path)
    assert any(i.code == "invalid_execution_handler" for i in result.issues)


def test_execution_automated_without_handler_fails(tmp_path: Path) -> None:
    """Automated without handler should produce an error."""
    path = _make_skill(tmp_path, "execution:\n  type: automated\n  safety_mode: strict\n  allowed_tools: []\n")
    result = lint_file(path)
    assert any(i.code == "automated_missing_handler" for i in result.issues)


def test_execution_automated_handler_none_fails(tmp_path: Path) -> None:
    """Automated with handler: none should produce an error."""
    path = _make_skill(tmp_path, "execution:\n  type: automated\n  handler: none\n  safety_mode: strict\n  allowed_tools: []\n")
    result = lint_file(path)
    assert any(i.code == "automated_missing_handler" for i in result.issues)


def test_execution_automated_without_safety_mode_fails(tmp_path: Path) -> None:
    """Automated without safety_mode should produce an error."""
    path = _make_skill(tmp_path, "execution:\n  type: automated\n  handler: shell\n  allowed_tools: []\n")
    result = lint_file(path)
    assert any(i.code == "automated_missing_safety_mode" for i in result.issues)


def test_execution_automated_without_allowed_tools_warns(tmp_path: Path) -> None:
    """Automated without allowed_tools should produce a warning."""
    path = _make_skill(tmp_path, "execution:\n  type: automated\n  handler: shell\n  safety_mode: strict\n")
    result = lint_file(path)
    assert any(i.code == "automated_missing_allowed_tools" for i in result.issues)


def test_execution_unknown_field_warns(tmp_path: Path) -> None:
    """Unknown field in execution block should produce a warning."""
    path = _make_skill(tmp_path, "execution:\n  type: manual\n  foobar: yes\n")
    result = lint_file(path)
    assert any(i.code == "unknown_execution_field" for i in result.issues)


def test_execution_missing_type_fails(tmp_path: Path) -> None:
    """Execution block without type should produce an error."""
    path = _make_skill(tmp_path, "execution:\n  handler: shell\n")
    result = lint_file(path)
    assert any(i.code == "missing_execution_type" for i in result.issues)


def test_no_execution_block_still_valid(tmp_path: Path) -> None:
    """Skill without execution block should remain valid (backward compatibility)."""
    path = _make_skill(tmp_path)
    result = lint_file(path)
    exec_issues = [i for i in result.issues if "execution" in i.code or "automated" in i.code or "safety" in i.code or "handler" in i.code]
    assert len(exec_issues) == 0


def test_execution_with_allowed_tools_list(tmp_path: Path) -> None:
    """Execution block with allowed_tools list should parse correctly."""
    path = _make_skill(tmp_path, "execution:\n  type: assisted\n  handler: internal\n  allowed_tools:\n    - github\n    - jira\n")
    result = lint_file(path)
    exec_errors = [i for i in result.issues if i.severity == "error" and ("execution" in i.code or "allowed_tools" in i.code)]
    assert len(exec_errors) == 0