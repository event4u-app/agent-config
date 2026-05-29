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
        ".agent-src.uncondensed/skills/example/SKILL.md",
        """---
name: example
description: "Use when testing a concrete workflow."
source: project
domain: process
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
        ".agent-src.uncondensed/skills/example/SKILL.md",
        """---
name: example
description: "Use when testing."
source: project
domain: process
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
        ".agent-src.uncondensed/skills/example/SKILL.md",
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
        ".agent-src/rules/bad-rule.md",
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
        ".agent-src/rules/good-rule.md",
        """---
type: "always"
source: package
description: "Always apply these directives when writing or editing content."
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
        ".agent-src/rules/no-frontmatter.md",
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
        ".agent-src/rules/no-type.md",
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


def test_rule_omitted_source_is_defaulted_invalid_fails(tmp_path: Path) -> None:
    """`source` carries the schema default `package` (abstraction-reduction),
    so omitting it is valid — no `missing_source`. An invalid explicit value
    still fails via the schema enum / `invalid_source` check."""
    # Omitted source → the linter must NOT raise missing_source.
    omitted = write_file(
        tmp_path,
        ".agent-src/rules/no-source.md",
        """---
type: "always"
---

# No Source Rule

Some directives.
""",
    )
    result = lint_file(omitted)
    assert not any(issue.code == "missing_source" for issue in result.issues)

    # Invalid explicit source → still rejected.
    bad = write_file(
        tmp_path,
        ".agent-src/rules/bad-source.md",
        """---
type: "always"
source: "bogus"
---

# Bad Source Rule

Some directives.
""",
    )
    result_bad = lint_file(bad)
    assert result_bad.status == "fail"
    assert any(
        issue.code in ("invalid_source", "schema_enum") for issue in result_bad.issues
    )


def test_rule_invalid_type_fails(tmp_path: Path) -> None:
    """A rule with an unknown `type:` value must fail validation.

    The rule type vocabulary is `{always, auto, manual}` (post-Phase 5
    governance pruning). An unknown value like `"sometimes"` is rejected
    by the JSON-schema layer (`schema_enum`); the legacy `TYPE_PATTERN`
    regex emits `missing_type` because it only captures known values.
    Either signal is sufficient to prove the rule was rejected.
    """
    path = write_file(
        tmp_path,
        ".agent-src/rules/bad-type.md",
        """---
type: "sometimes"
source: package
---

# Bad Type Rule

Some directives.
""",
    )

    result = lint_file(path)
    assert result.status == "fail"
    assert any(
        issue.code in {"schema_enum", "invalid_type", "missing_type"}
        for issue in result.issues
    )


def test_rule_auto_without_description_fails(tmp_path: Path) -> None:
    path = write_file(
        tmp_path,
        ".agent-src/rules/auto-no-desc.md",
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
        ".agent-src/rules/auto-with-desc.md",
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


def test_rule_council_depth_standard_rejected(tmp_path: Path) -> None:
    """council_depth only accepts 'deep'; 'standard' is the implicit default
    and must be rejected so artefacts don't waste frontmatter bytes."""
    path = write_file(
        tmp_path,
        ".agent-src/rules/council-depth-standard.md",
        """---
type: "auto"
source: package
description: "Apply when reviewing architecture decisions"
council_depth: standard
---

# Council Depth Standard Rule

Some directives.
""",
    )

    result = lint_file(path)
    assert result.status == "fail"
    assert any(
        issue.code == "schema_enum" and "council_depth" in issue.message
        for issue in result.issues
    ), f"Expected schema_enum error on council_depth, got: {result.issues}"


def test_rule_council_depth_deep_passes(tmp_path: Path) -> None:
    """council_depth: deep is the only accepted value."""
    path = write_file(
        tmp_path,
        ".agent-src/rules/council-depth-deep.md",
        """---
type: "auto"
source: package
description: "Apply when reviewing architecture decisions"
council_depth: deep
---

# Council Depth Deep Rule

Some directives.
""",
    )

    result = lint_file(path)
    assert not any(
        issue.code == "schema_enum" and "council_depth" in issue.message
        for issue in result.issues
    )


def test_rule_missing_h1_fails(tmp_path: Path) -> None:
    path = write_file(
        tmp_path,
        ".agent-src/rules/no-heading.md",
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
        ".agent-src/rules/no-newline.md",
        "---\ntype: \"always\"\nsource: package\n---\n\n# Rule\n\nContent.",
    )

    result = lint_file(path)
    assert any(issue.code == "no_trailing_newline" for issue in result.issues)


def test_rule_double_blank_lines_warns(tmp_path: Path) -> None:
    path = write_file(
        tmp_path,
        ".agent-src/rules/double-blanks.md",
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
        ".agent-src.uncondensed/skills/delegator/SKILL.md",
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
        ".agent-src.uncondensed/skills/pure-pointer/SKILL.md",
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
        ".agent-src.uncondensed/skills/concrete-worker/SKILL.md",
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
        ".agent-src.uncondensed/skills/mixed-worker/SKILL.md",
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
        ".agent-src/skills/developer-execution/SKILL.md",
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
        ".agent-src/skills/developer-execution/SKILL.md",
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
        ".agent-src/skills/developer-validation/SKILL.md",
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
        ".agent-src/skills/developer-action/SKILL.md",
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
        ".agent-src/skills/api-design/SKILL.md",
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
        ".agent-src/commands/fix-something.md",
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


def test_cluster_head_command_exempt_from_no_steps(tmp_path: Path) -> None:
    """Cluster-head command (frontmatter cluster:) does NOT fire no_steps
    even without explicit Step sections — road-to-feedback-followups P2.1."""
    path = write_file(
        tmp_path,
        ".agent-src.uncondensed/commands/research.md",
        """\
---
name: research
cluster: research
description: "Preliminary research scaffolder."
---

# /research

Routes to downstream skills for the research workflow.

## Trigger

`/research <topic>`

## Workflow

Free-form prose without numbered step headings.
""",
    )

    result = lint_file(path)
    assert not any(issue.code == "no_steps" for issue in result.issues)


def test_non_cluster_command_without_steps_still_warns(tmp_path: Path) -> None:
    """A command without delegation signal AND without step structure
    STILL fires no_steps — exemption is narrow (cluster heads only)."""
    path = write_file(
        tmp_path,
        ".agent-src.uncondensed/commands/leaf-cmd.md",
        """\
---
name: leaf-cmd
description: "A standalone command without delegation."
---

# /leaf-cmd

## Trigger

`/leaf-cmd`

## Notes

Free-form prose without any step structure.
""",
    )

    result = lint_file(path)
    assert any(issue.code == "no_steps" for issue in result.issues)


def test_command_with_step_n_subheadings_passes_no_steps(tmp_path: Path) -> None:
    """Commands using ``### Step N`` sub-headings should NOT fire no_steps —
    the linter recognizes both ``### N.`` and ``### Step N`` patterns."""
    path = write_file(
        tmp_path,
        ".agent-src.uncondensed/commands/has-steps.md",
        """\
---
name: has-steps
description: "Command with step-prefixed sub-headings."
---

# /has-steps

## Workflow

### Step 1 — Inspect

Look at the input.

### Step 2 — Act

Apply the change.
""",
    )

    result = lint_file(path)
    assert not any(issue.code == "no_steps" for issue in result.issues)


def test_guidelines_excluded_from_execution_checks(tmp_path: Path) -> None:
    """Guidelines should be excluded from execution quality checks."""
    path = write_file(
        tmp_path,
        "docs/guidelines/php/testing.md",
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
        "docs/guidelines/php/testing.md",
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
        "docs/guidelines/php/naming.md",
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
        ".agent-src/commands/do-stuff.md",
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
        ".agent-src/commands/deploy.md",
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
        ".agent-src/skills/example-task/SKILL.md",
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
        ".agent-src/skills/api-validation/SKILL.md",
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
        ".agent-src/skills/api-validation/SKILL.md",
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


def test_uncondensed_without_condensed_warns(tmp_path: Path) -> None:
    """Uncondensed file without condensed variant → warning."""
    path = write_file(
        tmp_path,
        ".agent-src.uncondensed/rules/orphan-rule.md",
        """\
---
description: "When orphan behavior occurs"
---

# orphan-rule

- Do not leave orphans
""",
    )

    result = lint_file(path, repo_root=tmp_path)
    assert any(issue.code == "condensed_variant_missing" for issue in result.issues)


def test_uncondensed_with_condensed_passes(tmp_path: Path) -> None:
    """Uncondensed file with matching condensed variant → no warning."""
    content = """\
---
description: "When paired behavior occurs"
---

# paired-rule

- Always have a pair
"""
    write_file(tmp_path, ".agent-src.uncondensed/rules/paired-rule.md", content)
    write_file(tmp_path, ".agent-src/rules/paired-rule.md", content)

    path = tmp_path / ".agent-src.uncondensed" / "rules" / "paired-rule.md"
    result = lint_file(path, repo_root=tmp_path)
    assert not any(issue.code == "condensed_variant_missing" for issue in result.issues)


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
    return write_file(tmp_path, ".agent-src.uncondensed/skills/test-runtime/SKILL.md", content)


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


def _reset_role_contract_cache() -> None:
    import skill_linter
    skill_linter._ROLE_CONTRACT_SLUGS_CACHE = None


def test_role_contract_ref_unknown_slug_warns(tmp_path: Path) -> None:
    """Command that references a non-existent mode anchor should warn."""
    _reset_role_contract_cache()
    path = write_file(
        tmp_path,
        ".agent-src.uncondensed/commands/bogus-ref.md",
        """---
name: bogus-ref
description: test
disable-model-invocation: true
---

# Bogus

See [contract](docs/guidelines/agent-infra/role-contracts.md#notamode).

## Steps

1. Do it.
""",
    )
    result = lint_file(path)
    assert any(i.code == "unknown_role_contract" for i in result.issues)


def test_role_contract_ref_known_slug_passes(tmp_path: Path) -> None:
    """Command referencing a real mode anchor should NOT trigger the warn."""
    _reset_role_contract_cache()
    path = write_file(
        tmp_path,
        ".agent-src.uncondensed/commands/good-ref.md",
        """---
name: good-ref
description: test
disable-model-invocation: true
---

# Good

See [contract](docs/guidelines/agent-infra/role-contracts.md#developer).

## Steps

1. Do it.
""",
    )
    result = lint_file(path)
    assert not any(i.code == "unknown_role_contract" for i in result.issues)


# --- Output-schema drift (road-to-trigger-evals Phase 3.5) ---

from skill_linter import lint_output_schema, parse_output_schema  # noqa: E402


_OUTPUT_TEMPLATE_SKILL = """---
name: frozen-skill
description: "Use when producing a fixed-shape report."
source: project
---

# frozen-skill

## When to use

* When the output must match a frozen contract.

## Procedure

1. Inspect ticket text
2. Apply template
3. Validate headers match schema

## Output template

````markdown
## Refined ticket

<body>

## Top-5 risks

1. …

## Persona voices

- Developer — …
````

## Output format

1. Refined ticket block wrapped in a copyable markdown box.
2. Top-5 risks as numbered list.
3. Persona voices one paragraph each.

## Gotchas

* Headers may drift during refactors — the schema catches it.

## Do NOT

* Do NOT rename frozen headers without updating the schema.
"""


def _write_skill_with_schema(
    tmp_path: Path, schema_text: str, skill_text: str = _OUTPUT_TEMPLATE_SKILL,
) -> Path:
    skill_path = write_file(
        tmp_path,
        ".agent-src.uncondensed/skills/frozen-skill/SKILL.md",
        skill_text,
    )
    write_file(
        tmp_path,
        ".agent-src.uncondensed/skills/frozen-skill/evals/output-schema.yml",
        schema_text,
    )
    return skill_path


def test_output_schema_absent_is_noop(tmp_path: Path) -> None:
    """Skills without the sibling schema must not trigger the check."""
    skill_path = write_file(
        tmp_path,
        ".agent-src.uncondensed/skills/frozen-skill/SKILL.md",
        _OUTPUT_TEMPLATE_SKILL,
    )
    result = lint_file(skill_path)
    assert not any(i.code == "output_schema_drift" for i in result.issues)


def test_output_schema_all_headers_present_passes(tmp_path: Path) -> None:
    schema = (
        'version: 1\n'
        'required_headers:\n'
        '  - "Refined ticket"\n'
        '  - "Top-5 risks"\n'
        '  - "Persona voices"\n'
    )
    skill_path = _write_skill_with_schema(tmp_path, schema)
    result = lint_file(skill_path)
    assert not any(i.code == "output_schema_drift" for i in result.issues)


def test_output_schema_missing_header_fails(tmp_path: Path) -> None:
    """Removing a frozen header from the template must be a hard error."""
    schema = (
        'version: 1\n'
        'required_headers:\n'
        '  - "Refined ticket"\n'
        '  - "Top-5 risks"\n'
        '  - "Persona voices"\n'
        '  - "Orchestration notes"\n'  # not present in the sample skill
    )
    skill_path = _write_skill_with_schema(tmp_path, schema)
    result = lint_file(skill_path)
    drift = [i for i in result.issues if i.code == "output_schema_drift"]
    assert len(drift) == 1
    assert drift[0].severity == "error"
    assert "Orchestration notes" in drift[0].message
    assert result.status == "fail"


def test_output_schema_empty_required_headers_is_noop(tmp_path: Path) -> None:
    schema = 'version: 1\nrequired_headers:\n'
    skill_path = _write_skill_with_schema(tmp_path, schema)
    result = lint_file(skill_path)
    assert not any(i.code == "output_schema_drift" for i in result.issues)


def test_output_schema_unknown_keys_are_ignored(tmp_path: Path) -> None:
    """Forward-compat: extra top-level keys must not break the parser."""
    schema = (
        'version: 2\n'
        'future_key: "something"\n'
        'required_headers:\n'
        '  - "Refined ticket"\n'
        '  - "Top-5 risks"\n'
        '  - "Persona voices"\n'
    )
    skill_path = _write_skill_with_schema(tmp_path, schema)
    result = lint_file(skill_path)
    assert not any(i.code == "output_schema_drift" for i in result.issues)


def test_parse_output_schema_comments_and_blank_lines() -> None:
    parsed = parse_output_schema(
        '# comment\n'
        'version: 1\n'
        '\n'
        'required_headers:\n'
        '  # inline list comment\n'
        '  - "Alpha"\n'
        '  - Beta\n'
    )
    assert parsed["version"] == 1
    assert parsed["required_headers"] == ["Alpha", "Beta"]


def test_lint_output_schema_requires_skill_md(tmp_path: Path) -> None:
    """Non-SKILL.md files must not trigger the sibling lookup."""
    other = write_file(
        tmp_path,
        ".agent-src.uncondensed/skills/frozen-skill/NOTES.md",
        "# notes",
    )
    # Also create a schema that WOULD match if the lookup misfired
    write_file(
        tmp_path,
        ".agent-src.uncondensed/skills/frozen-skill/evals/output-schema.yml",
        'version: 1\nrequired_headers:\n  - "Never appears"\n',
    )
    assert lint_output_schema(other, "# notes") == []


def test_output_schema_repo_refine_ticket_passes() -> None:
    """Regression guard: the real refine-ticket schema must stay green."""
    repo_root = Path(__file__).resolve().parent.parent
    skill_path = (
        repo_root / ".agent-src.uncondensed" / "skills"
        / "refine-ticket" / "SKILL.md"
    )
    if not skill_path.exists():
        return  # Tolerate running against a stripped checkout
    result = lint_file(skill_path, repo_root=repo_root)
    assert not any(i.code == "output_schema_drift" for i in result.issues)


def test_output_schema_repo_estimate_ticket_passes() -> None:
    """Regression guard: the real estimate-ticket schema must stay green."""
    repo_root = Path(__file__).resolve().parent.parent
    skill_path = (
        repo_root / ".agent-src.uncondensed" / "skills"
        / "estimate-ticket" / "SKILL.md"
    )
    if not skill_path.exists():
        return
    result = lint_file(skill_path, repo_root=repo_root)
    assert not any(i.code == "output_schema_drift" for i in result.issues)



# --- Senior-tier required-block tests (skill-quality.md § Senior-Tier Required Structure) ---


SENIOR_SKILL_TEMPLATE = """---
name: example
description: "Use when prioritizing the backlog. Product cognition for the senior PO — produces opportunity-tree.md."
source: project
tier: senior
---

# example

## When to use

* Prioritizing competing opportunities

## Procedure

1. Inspect current backlog
2. Apply ICE scoring
3. Validate evidence rank

## Output format

1. opportunity-tree.md
2. prioritization-table.md

## Gotchas

* Scoring without evidence rank inflates ICE

## Do NOT

* Do NOT skip the evidence-rank column
{extra_blocks}"""


SENIOR_RELATED_BLOCK = """
## Related Skills

**WHEN to use this**
- Backlog prioritization with competing opportunities
- Opportunity-tree decomposition

**WHEN NOT to use this**
- Single-feature scoping — route to [`refine-ticket`](../refine-ticket/SKILL.md)
- Estimation only — route to [`estimate-ticket`](../estimate-ticket/SKILL.md)
"""

SENIOR_PROACTIVE_BLOCK = """
## When the agent should load this

- "should we build feature X or Y first"
- "what's the ICE on this backlog"
- "how do I split this epic into shippable slices"
"""

SENIOR_OUTPUT_BLOCK = """
## Output

1. **opportunity-tree.md** — markdown tree, root = north-star metric
2. **prioritization-table.md** — markdown table, columns = opportunity / ICE / evidence
"""


def test_senior_skill_with_all_blocks_passes(tmp_path: Path) -> None:
    """Senior-tier skill with all four required blocks lints clean."""
    extra = SENIOR_RELATED_BLOCK + SENIOR_PROACTIVE_BLOCK + SENIOR_OUTPUT_BLOCK
    path = write_file(
        tmp_path,
        ".agent-src.uncondensed/skills/example/SKILL.md",
        SENIOR_SKILL_TEMPLATE.format(extra_blocks=extra),
    )
    result = lint_file(path)
    senior_codes = {
        "missing_senior_related_skills",
        "missing_senior_related_when",
        "missing_senior_related_when_not",
        "missing_senior_proactive_triggers",
        "missing_senior_output_artifacts",
    }
    assert not any(i.code in senior_codes for i in result.issues)


def test_senior_skill_missing_related_skills_fails(tmp_path: Path) -> None:
    extra = SENIOR_PROACTIVE_BLOCK + SENIOR_OUTPUT_BLOCK
    path = write_file(
        tmp_path,
        ".agent-src.uncondensed/skills/example/SKILL.md",
        SENIOR_SKILL_TEMPLATE.format(extra_blocks=extra),
    )
    result = lint_file(path)
    assert any(
        i.code == "missing_senior_related_skills" and i.severity == "error"
        for i in result.issues
    )


def test_senior_skill_missing_when_not_list_fails(tmp_path: Path) -> None:
    truncated_related = """
## Related Skills

**WHEN to use this**
- Backlog prioritization
"""
    extra = truncated_related + SENIOR_PROACTIVE_BLOCK + SENIOR_OUTPUT_BLOCK
    path = write_file(
        tmp_path,
        ".agent-src.uncondensed/skills/example/SKILL.md",
        SENIOR_SKILL_TEMPLATE.format(extra_blocks=extra),
    )
    result = lint_file(path)
    assert any(
        i.code == "missing_senior_related_when_not" and i.severity == "error"
        for i in result.issues
    )


def test_senior_skill_missing_proactive_triggers_fails(tmp_path: Path) -> None:
    extra = SENIOR_RELATED_BLOCK + SENIOR_OUTPUT_BLOCK
    path = write_file(
        tmp_path,
        ".agent-src.uncondensed/skills/example/SKILL.md",
        SENIOR_SKILL_TEMPLATE.format(extra_blocks=extra),
    )
    result = lint_file(path)
    assert any(
        i.code == "missing_senior_proactive_triggers" and i.severity == "error"
        for i in result.issues
    )


def test_senior_skill_missing_output_artifacts_fails(tmp_path: Path) -> None:
    """Senior skill with only `## Output format` lacks the artifact-declaration `## Output` block."""
    extra = SENIOR_RELATED_BLOCK + SENIOR_PROACTIVE_BLOCK
    path = write_file(
        tmp_path,
        ".agent-src.uncondensed/skills/example/SKILL.md",
        SENIOR_SKILL_TEMPLATE.format(extra_blocks=extra),
    )
    result = lint_file(path)
    assert any(
        i.code == "missing_senior_output_artifacts" and i.severity == "error"
        for i in result.issues
    )


def test_non_senior_skill_skips_senior_checks(tmp_path: Path) -> None:
    """Mid-tier / untiered skills are exempt from senior-tier block checks (forward-only)."""
    path = write_file(
        tmp_path,
        ".agent-src.uncondensed/skills/example/SKILL.md",
        SENIOR_SKILL_TEMPLATE.replace("tier: senior\n", "").format(extra_blocks=""),
    )
    result = lint_file(path)
    senior_codes = {
        "missing_senior_related_skills",
        "missing_senior_related_when",
        "missing_senior_related_when_not",
        "missing_senior_proactive_triggers",
        "missing_senior_output_artifacts",
    }
    assert not any(i.code in senior_codes for i in result.issues)



# ── Persona schema (Block A2) ─────────────────────────────────────


CORE_PERSONA_TEMPLATE = """---
id: {id}
role: Test Role
description: "Lens for testing the persona schema."
tier: {tier}
mode: developer
version: "1.0"
source: package
---

# Test Role

## Focus

One paragraph framing the lens.

## Mindset

- Default assumption.
- Skepticism point.

## Unique Questions

- Question one.
- Question two.
- Question three.

## Output Expectations

Bullets, short.

## Anti-Patterns

- Do NOT do X.
{extra}
"""


SPECIALIST_EXTRA = """
## Critical Rules

- Rule one.
- Rule two.

## Workflows

1. Step one.
2. Step two.
"""


def test_core_persona_passes_with_5_sections(tmp_path: Path) -> None:
    path = write_file(
        tmp_path,
        ".agent-src.uncondensed/personas/test-core.md",
        CORE_PERSONA_TEMPLATE.format(id="test-core", tier="core", extra=""),
    )
    result = lint_file(path)
    assert not any(i.code == "missing_section" for i in result.issues)


def test_specialist_persona_requires_critical_rules_and_workflows(tmp_path: Path) -> None:
    path = write_file(
        tmp_path,
        ".agent-src.uncondensed/personas/test-spec.md",
        CORE_PERSONA_TEMPLATE.format(id="test-spec", tier="specialist", extra=""),
    )
    result = lint_file(path)
    missing = {i.message for i in result.issues if i.code == "missing_section"}
    assert any("Critical Rules" in m for m in missing)
    assert any("Workflows" in m for m in missing)


def test_specialist_persona_passes_with_7_sections(tmp_path: Path) -> None:
    path = write_file(
        tmp_path,
        ".agent-src.uncondensed/personas/test-spec.md",
        CORE_PERSONA_TEMPLATE.format(id="test-spec", tier="specialist", extra=SPECIALIST_EXTRA),
    )
    result = lint_file(path)
    assert not any(i.code == "missing_section" for i in result.issues)


def test_specialist_size_budget_warns_above_100(tmp_path: Path) -> None:
    body = CORE_PERSONA_TEMPLATE.format(id="test-spec", tier="specialist", extra=SPECIALIST_EXTRA)
    # Pad to > 100 lines.
    body = body + ("\n<!-- pad -->" * 80)
    path = write_file(
        tmp_path,
        ".agent-src.uncondensed/personas/test-spec.md",
        body,
    )
    result = lint_file(path)
    assert any(i.code == "size_budget" for i in result.issues)


def test_persona_invalid_tier_fails(tmp_path: Path) -> None:
    path = write_file(
        tmp_path,
        ".agent-src.uncondensed/personas/test-bad.md",
        CORE_PERSONA_TEMPLATE.format(id="test-bad", tier="reviewer", extra=""),
    )
    result = lint_file(path)
    assert any(i.code == "invalid_tier" for i in result.issues)


def test_persona_id_must_match_filename(tmp_path: Path) -> None:
    path = write_file(
        tmp_path,
        ".agent-src.uncondensed/personas/test-core.md",
        CORE_PERSONA_TEMPLATE.format(id="other-id", tier="core", extra=""),
    )
    result = lint_file(path)
    assert any(i.code == "id_filename_mismatch" for i in result.issues)


def test_format_json_emits_valid_payload_for_empty_results() -> None:
    """Regression: --changed --format json with no matching files must still
    produce parseable JSON so PR-summary workflows don't fail with
    'Could not parse lint results'."""
    import json as _json

    from skill_linter import format_json

    payload = _json.loads(format_json([]))
    assert payload["summary"] == {
        "pass": 0,
        "pass_with_warnings": 0,
        "fail": 0,
        "total": 0,
    }
    assert payload["results"] == []



# --- Wing-3 GTM context-spine slot tests (adr-gtm-context-spine.md) ---


_WING3_SPINE_TEMPLATE = """---
name: spine-test
description: "Use when testing the Wing-3 context-spine slots authorized by adr-gtm-context-spine.md."
source: project
domain: product
tier: senior
context_spine: [{slots}]
---

# spine-test

## When to use

- Wing-3 spine validation

## Procedure

1. Inspect agents/context-spine/channel-stage.md if present
2. Apply funnel-stage cognition to the brief
3. Validate against ICP from customer-segment slot

## Related Skills

**WHEN to use this**
- GTM cognition tests

**WHEN NOT to use this**
- Off-wing cognition — route to other skills

## When the agent should load this

- "validate the wing-3 spine"

## Output

1. **spine-validation.md** — slot read trace, one section per declared slot

## Output format

1. spine-validation.md
2. trace-log.md

## Gotchas

- Test fixture only — do not ship

## Do NOT

- Do NOT retrofit existing off-wing skills with these slots
"""


def test_wing3_spine_slots_all_three_pass(tmp_path: Path) -> None:
    """Senior skill declaring all three Wing-3 slots lints clean (adr-gtm-context-spine.md)."""
    path = write_file(
        tmp_path,
        ".agent-src.uncondensed/skills/spine-test/SKILL.md",
        _WING3_SPINE_TEMPLATE.format(
            slots="channel-stage, funnel-stage, customer-segment"
        ),
    )
    result = lint_file(path)
    assert not any(
        i.code in {"unknown_context_spine_slot", "schema_validation_error"}
        and i.severity == "error"
        for i in result.issues
    )


def test_wing3_spine_mixed_with_cross_wing_passes(tmp_path: Path) -> None:
    """Mixed cross-wing (product) + Wing-3 (channel-stage) declaration is valid."""
    path = write_file(
        tmp_path,
        ".agent-src.uncondensed/skills/spine-test/SKILL.md",
        _WING3_SPINE_TEMPLATE.format(slots="product, channel-stage"),
    )
    result = lint_file(path)
    assert not any(
        i.code in {"unknown_context_spine_slot", "schema_validation_error"}
        and i.severity == "error"
        for i in result.issues
    )


def test_unknown_spine_slot_rejected(tmp_path: Path) -> None:
    """Unknown slot value fails schema validation — guard against slot-sprawl."""
    path = write_file(
        tmp_path,
        ".agent-src.uncondensed/skills/spine-test/SKILL.md",
        _WING3_SPINE_TEMPLATE.format(slots="product, made-up-slot"),
    )
    result = lint_file(path)
    assert any(
        i.severity == "error" and (
            "context_spine" in i.message or "made-up-slot" in i.message
        )
        for i in result.issues
    )


# --- Wing-3 cognition-boundary linter tests (G2, council Q7 / iter-2 OQ3) ---


def _wing3_skill(slots: str, procedure: str, related: str = "", do_not: str = "") -> str:
    """Build a senior Wing-3 skill body with configurable procedure / carve-outs."""
    related_block = related or (
        "**WHEN to use this**\n- GTM cognition framing\n\n"
        "**WHEN NOT to use this**\n- Off-wing engineering work\n"
    )
    do_not_block = do_not or "- Do NOT retrofit existing off-wing skills"
    return f"""---
name: wing3-test
description: "Use when applying Wing-3 GTM cognition framing to a brief."
source: project
domain: product
tier: senior
context_spine: [{slots}]
---

# wing3-test

## When to use

- Wing-3 cognition framing for a brief

## Procedure

{procedure}

## Related Skills

{related_block}

## When the agent should load this

- "frame this for Wing-3 cognition"

## Output

1. **cognition-brief.md** — JTBD framing + segment ICP + funnel stage

## Output format

1. cognition-brief.md
2. trace-log.md

## Gotchas

- Wing-3 boundary failure mode example

## Do NOT

{do_not_block}
"""


def test_wing3_vendor_in_body_fires(tmp_path: Path) -> None:
    """Naming a vendor in the procedure body triggers vendor-independence."""
    procedure = (
        "1. Frame the JTBD.\n"
        "2. We integrate with Salesforce CRM to score leads.\n"
        "3. Validate against ICP.\n"
    )
    path = write_file(
        tmp_path,
        ".agent-src.uncondensed/skills/wing3-test/SKILL.md",
        _wing3_skill("channel-stage, product", procedure),
    )
    result = lint_file(path)
    assert any(i.code == "wing3_vendor_independence" for i in result.issues)


def test_wing3_vendor_in_do_not_carved_out(tmp_path: Path) -> None:
    """Vendor name inside ## Do NOT block does NOT trip the linter."""
    procedure = (
        "1. Frame the JTBD.\n"
        "2. Score the lead against the segment ICP.\n"
        "3. Validate against the funnel stage.\n"
    )
    do_not = "- Do NOT route to Salesforce-specific configuration flows"
    path = write_file(
        tmp_path,
        ".agent-src.uncondensed/skills/wing3-test/SKILL.md",
        _wing3_skill("channel-stage", procedure, do_not=do_not),
    )
    result = lint_file(path)
    assert not any(i.code == "wing3_vendor_independence" for i in result.issues)


def test_wing3_vendor_in_when_not_carved_out(tmp_path: Path) -> None:
    """Vendor name inside **WHEN NOT to use this** does NOT trip the linter."""
    procedure = (
        "1. Frame the JTBD.\n"
        "2. Score the lead against the segment ICP.\n"
        "3. Validate against the funnel stage.\n"
    )
    related = (
        "**WHEN to use this**\n- Cognition framing for a Wing-3 brief\n\n"
        "**WHEN NOT to use this**\n- Configuring HubSpot or Marketo pipelines\n"
    )
    path = write_file(
        tmp_path,
        ".agent-src.uncondensed/skills/wing3-test/SKILL.md",
        _wing3_skill("funnel-stage", procedure, related=related),
    )
    result = lint_file(path)
    assert not any(i.code == "wing3_vendor_independence" for i in result.issues)


def test_wing3_saas_url_fires_agent_operability(tmp_path: Path) -> None:
    """External SaaS URL in body triggers agent-operability."""
    procedure = (
        "1. Frame the JTBD.\n"
        "2. Pull contact records from https://api.intercom.io/v2/contacts.\n"
        "3. Validate the segment.\n"
    )
    path = write_file(
        tmp_path,
        ".agent-src.uncondensed/skills/wing3-test/SKILL.md",
        _wing3_skill("customer-segment", procedure),
    )
    result = lint_file(path)
    assert any(i.code == "wing3_agent_operability" for i in result.issues)


def test_wing3_channel_tactic_fires_channel_agnosticism(tmp_path: Path) -> None:
    """Channel-specific tactical prescription triggers channel-agnosticism."""
    procedure = (
        "1. Frame the JTBD.\n"
        "2. Draft a cold email template tuned to the persona.\n"
        "3. Validate the framing against ICP.\n"
    )
    path = write_file(
        tmp_path,
        ".agent-src.uncondensed/skills/wing3-test/SKILL.md",
        _wing3_skill("channel-stage", procedure),
    )
    result = lint_file(path)
    assert any(i.code == "wing3_channel_agnosticism" for i in result.issues)


def test_wing3_stack_locked_fires_transferability(tmp_path: Path) -> None:
    """Stack-locked install instruction triggers transferability."""
    procedure = (
        "1. Frame the JTBD.\n"
        "2. Then run npm install acme-segmentation to wire it up.\n"
        "3. Validate.\n"
    )
    path = write_file(
        tmp_path,
        ".agent-src.uncondensed/skills/wing3-test/SKILL.md",
        _wing3_skill("customer-segment", procedure),
    )
    result = lint_file(path)
    assert any(i.code == "wing3_transferability" for i in result.issues)


def test_wing3_clean_cognition_skill_passes_boundaries(tmp_path: Path) -> None:
    """Stack-agnostic, vendor-free cognition skill triggers none of the four checks."""
    procedure = (
        "1. Frame the JTBD against the customer segment.\n"
        "2. Score positioning against the funnel stage.\n"
        "3. Validate the framing with the proof-line owner.\n"
    )
    path = write_file(
        tmp_path,
        ".agent-src.uncondensed/skills/wing3-test/SKILL.md",
        _wing3_skill("channel-stage, funnel-stage, customer-segment", procedure),
    )
    result = lint_file(path)
    boundary_codes = {
        "wing3_agent_operability", "wing3_vendor_independence",
        "wing3_transferability", "wing3_channel_agnosticism",
    }
    assert not any(i.code in boundary_codes for i in result.issues)


def test_wing3_boundary_dormant_for_off_wing_skills(tmp_path: Path) -> None:
    """Skill without a Wing-3 slot is NOT subject to boundary checks even if
    its body mentions Salesforce — off-wing skills stay free of GTM guards.
    """
    body = """---
name: off-wing-test
description: "Use when integrating with Salesforce as part of off-wing engineering."
source: project
domain: process
---

# off-wing-test

## When to use

- Salesforce integration outside Wing-3

## Procedure

1. Wire the Salesforce SDK into the integration layer.
2. Apply the schema mapping.
3. Validate the round-trip.

## Output format

1. integration-report.md
2. validation-log.md

## Gotchas

- Schema drift between Salesforce orgs

## Do NOT

- Do NOT call the API without rate-limit guards
"""
    path = write_file(
        tmp_path,
        ".agent-src.uncondensed/skills/off-wing-test/SKILL.md",
        body,
    )
    result = lint_file(path)
    boundary_codes = {
        "wing3_agent_operability", "wing3_vendor_independence",
        "wing3_transferability", "wing3_channel_agnosticism",
    }
    assert not any(i.code in boundary_codes for i in result.issues)


# --- Wing-4 cognition-boundary linter tests (J2, council Q7) ---


def _wing4_skill(slots: str, procedure: str, related: str = "", do_not: str = "") -> str:
    """Build a senior Wing-4 skill body with configurable procedure / carve-outs."""
    related_block = related or (
        "**WHEN to use this**\n- Money/Strategy/Ops cognition framing\n\n"
        "**WHEN NOT to use this**\n- Off-wing engineering work\n"
    )
    do_not_block = do_not or "- Do NOT retrofit existing off-wing skills"
    return f"""---
name: wing4-test
description: "Use when applying Wing-4 Money/Strategy/Ops cognition framing."
source: project
domain: process
tier: senior
context_spine: [{slots}]
---

# wing4-test

## When to use

- Wing-4 cognition framing for a brief

## Procedure

{procedure}

## Related Skills

{related_block}

## When the agent should load this

- "frame this for Wing-4 cognition"

## Output

1. **finance-brief.md** — runway frame + fiscal cadence + stage posture

## Output format

1. finance-brief.md
2. trace-log.md

## Gotchas

- Wing-4 boundary failure mode example

## Do NOT

{do_not_block}
"""


def test_wing4_vendor_in_body_fires(tmp_path: Path) -> None:
    """Naming a vendor in the procedure body triggers vendor-independence."""
    procedure = (
        "1. Frame the fiscal cadence.\n"
        "2. We pull P&L data from QuickBooks for the close window.\n"
        "3. Validate against runway model.\n"
    )
    path = write_file(
        tmp_path,
        ".agent-src.uncondensed/skills/wing4-test/SKILL.md",
        _wing4_skill("fiscal-period, product", procedure),
    )
    result = lint_file(path)
    assert any(i.code == "wing4_vendor_independence" for i in result.issues)


def test_wing4_vendor_in_do_not_carved_out(tmp_path: Path) -> None:
    """Vendor name inside ## Do NOT block does NOT trip the linter."""
    procedure = (
        "1. Frame the fiscal cadence.\n"
        "2. Read the close-window cognition.\n"
        "3. Validate against the runway model.\n"
    )
    do_not = "- Do NOT route to QuickBooks-specific configuration flows"
    path = write_file(
        tmp_path,
        ".agent-src.uncondensed/skills/wing4-test/SKILL.md",
        _wing4_skill("fiscal-period", procedure, do_not=do_not),
    )
    result = lint_file(path)
    assert not any(i.code == "wing4_vendor_independence" for i in result.issues)


def test_wing4_saas_url_fires_agent_operability(tmp_path: Path) -> None:
    """External SaaS URL in body triggers agent-operability."""
    procedure = (
        "1. Frame the cap-table model.\n"
        "2. Pull shareholder records from https://api.carta.com/v1/holders.\n"
        "3. Validate the ownership math.\n"
    )
    path = write_file(
        tmp_path,
        ".agent-src.uncondensed/skills/wing4-test/SKILL.md",
        _wing4_skill("org-stage", procedure),
    )
    result = lint_file(path)
    assert any(i.code == "wing4_agent_operability" for i in result.issues)


def test_wing4_stage_threshold_fires_stage_agnosticism(tmp_path: Path) -> None:
    """Hardcoded stage-specific runway threshold triggers stage-agnosticism."""
    procedure = (
        "1. Frame the runway cognition.\n"
        "2. Every plan must keep at least 18 months of runway in reserve.\n"
        "3. Validate the burn-trajectory against the model.\n"
    )
    path = write_file(
        tmp_path,
        ".agent-src.uncondensed/skills/wing4-test/SKILL.md",
        _wing4_skill("org-stage", procedure),
    )
    result = lint_file(path)
    assert any(i.code == "wing4_stage_agnosticism" for i in result.issues)


def test_wing4_stack_locked_fires_transferability(tmp_path: Path) -> None:
    """Stack-locked install instruction triggers transferability."""
    procedure = (
        "1. Frame the runway cognition.\n"
        "2. Then run pip install runway-model to wire it up.\n"
        "3. Validate.\n"
    )
    path = write_file(
        tmp_path,
        ".agent-src.uncondensed/skills/wing4-test/SKILL.md",
        _wing4_skill("fiscal-period", procedure),
    )
    result = lint_file(path)
    assert any(i.code == "wing4_transferability" for i in result.issues)


def test_wing4_regulatory_regime_passes(tmp_path: Path) -> None:
    """Naming a regulatory regime (GDPR / HIPAA / SOC2) is a cognition-relevant
    constraint, not a vendor — it must NOT trip vendor-independence."""
    procedure = (
        "1. Read the regulatory-regime slot for active regimes.\n"
        "2. For GDPR data, scope data-residency requirements per the slot.\n"
        "3. For HIPAA, scope the breach-notification timer per the slot.\n"
    )
    path = write_file(
        tmp_path,
        ".agent-src.uncondensed/skills/wing4-test/SKILL.md",
        _wing4_skill("regulatory-regime", procedure),
    )
    result = lint_file(path)
    boundary_codes = {
        "wing4_agent_operability", "wing4_vendor_independence",
        "wing4_transferability", "wing4_stage_agnosticism",
    }
    assert not any(i.code in boundary_codes for i in result.issues)


def test_wing4_clean_cognition_skill_passes_boundaries(tmp_path: Path) -> None:
    """Stack-agnostic, vendor-free, stage-agnostic cognition skill passes."""
    procedure = (
        "1. Frame the runway cognition against the org-stage slot.\n"
        "2. Score scenarios against the fiscal-period cadence.\n"
        "3. Validate the framing with the finance-partner persona.\n"
    )
    path = write_file(
        tmp_path,
        ".agent-src.uncondensed/skills/wing4-test/SKILL.md",
        _wing4_skill("fiscal-period, org-stage, regulatory-regime", procedure),
    )
    result = lint_file(path)
    boundary_codes = {
        "wing4_agent_operability", "wing4_vendor_independence",
        "wing4_transferability", "wing4_stage_agnosticism",
    }
    assert not any(i.code in boundary_codes for i in result.issues)


def test_wing4_boundary_dormant_for_off_wing_skills(tmp_path: Path) -> None:
    """Skill without a Wing-4 slot is NOT subject to Wing-4 boundary checks
    even if its body mentions QuickBooks — off-wing skills stay free.
    """
    body = """---
name: off-wing-w4-test
description: "Use when integrating with QuickBooks as part of off-wing engineering."
source: project
domain: process
---

# off-wing-w4-test

## When to use

- QuickBooks integration outside Wing-4

## Procedure

1. Wire the QuickBooks SDK into the integration layer.
2. Apply the schema mapping.
3. Validate the round-trip.

## Output format

1. integration-report.md
2. validation-log.md

## Gotchas

- Schema drift between QuickBooks orgs

## Do NOT

- Do NOT call the API without rate-limit guards
"""
    path = write_file(
        tmp_path,
        ".agent-src.uncondensed/skills/off-wing-w4-test/SKILL.md",
        body,
    )
    result = lint_file(path)
    boundary_codes = {
        "wing4_agent_operability", "wing4_vendor_independence",
        "wing4_transferability", "wing4_stage_agnosticism",
    }
    assert not any(i.code in boundary_codes for i in result.issues)



# --- procedural_rule heuristic refinements (Phase A) ---


def test_procedural_rule_ignores_skill_link_pointer(tmp_path: Path) -> None:
    """A rule that merely points at a `*-workflow` skill via a markdown link
    must not flip `procedural_rule`. The keyword `workflow` lives inside the
    link target and is stripped before counting."""
    path = write_file(
        tmp_path,
        ".agent-src/rules/pointer-rule.md",
        """---
type: "always"
source: package
description: "Always honour the workflow boundary."
---

# Pointer Rule

When you need the procedure, see [git-workflow](../skills/git-workflow/SKILL.md)
or [symfony-workflow](../skills/symfony-workflow/SKILL.md) — the skills own the
procedure; this rule only states the obligation.
""",
    )
    result = lint_file(path)
    assert not any(i.code == "procedural_rule" for i in result.issues)


def test_procedural_rule_ignores_code_span_keyword(tmp_path: Path) -> None:
    """Keyword inside an inline code span (`skill:procedure-x`) must not count."""
    path = write_file(
        tmp_path,
        ".agent-src/rules/code-span-rule.md",
        """---
type: "always"
source: package
description: "Always reference the canonical procedure pointer."
---

# Code Span Rule

The canonical pointer is `skill:git-procedure` and the lookup is
`skill:symfony-workflow`. Honour both. Never bypass either reference.
""",
    )
    result = lint_file(path)
    assert not any(i.code == "procedural_rule" for i in result.issues)


def test_procedural_rule_fires_on_real_procedure(tmp_path: Path) -> None:
    """A rule with prose keywords *and* numbered steps *and* no iron-law
    block is mis-classified as procedure — the heuristic must still fire."""
    path = write_file(
        tmp_path,
        ".agent-src/rules/looks-procedural.md",
        """---
type: "always"
source: package
description: "Always run the procedure when the workflow demands it."
---

# Looks Procedural

Follow this procedure when the workflow needs it:

1. Run the linter
2. Read the workflow output
3. Apply the procedure fix
4. Verify the workflow passes
""",
    )
    result = lint_file(path)
    assert any(i.code == "procedural_rule" for i in result.issues)


def test_procedural_rule_quiet_when_iron_law_block_present(tmp_path: Path) -> None:
    """Even with keywords + ordered steps, an Iron-Law block signals the
    artefact is a rule (verbatim imperative), so `procedural_rule` is suppressed."""
    path = write_file(
        tmp_path,
        ".agent-src/rules/iron-law-rule.md",
        """---
type: "always"
source: package
description: "Always honour the iron-law workflow constraint."
---

# Iron Law Rule

```
NEVER BYPASS THE PROCEDURE. ALWAYS RUN THE WORKFLOW.
NEVER COMMIT WITHOUT VERIFICATION. ALWAYS READ THE OUTPUT.
```

When the workflow fires, follow this procedure:

1. Run the workflow linter
2. Read the procedure output
3. Apply the workflow fix
""",
    )
    result = lint_file(path)
    assert not any(i.code == "procedural_rule" for i in result.issues)


# --- has_inspect_step verb-list expansion (Phase A) ---


def test_inspect_step_accepts_read_verb(tmp_path: Path) -> None:
    """`Read existing X` is a legitimate inspect step."""
    path = write_file(
        tmp_path,
        ".agent-src.uncondensed/skills/read-verb/SKILL.md",
        """---
name: read-verb
description: "Use when reading existing code before mutating."
source: project
domain: process
---

# read-verb

## When to use

* Before touching shared code

## Procedure

1. Read existing callers in the module
2. Apply the change
3. Validate the result

## Output

A short summary of caller impact.
""",
    )
    result = lint_file(path)
    assert not any(i.code == "missing_inspect_step" for i in result.issues)


def test_inspect_step_accepts_examine_verb(tmp_path: Path) -> None:
    """`Examine X` is a legitimate inspect step."""
    path = write_file(
        tmp_path,
        ".agent-src.uncondensed/skills/examine-verb/SKILL.md",
        """---
name: examine-verb
description: "Use when examining the current setup."
source: project
domain: process
---

# examine-verb

## When to use

* Before changing config

## Procedure

1. Examine the current configuration
2. Plan the diff
3. Apply the patch

## Output

The applied diff.
""",
    )
    result = lint_file(path)
    assert not any(i.code == "missing_inspect_step" for i in result.issues)


def test_inspect_step_still_fires_when_no_orientation_verb(tmp_path: Path) -> None:
    """A procedure that jumps straight to mutation must still be flagged."""
    path = write_file(
        tmp_path,
        ".agent-src.uncondensed/skills/no-inspect/SKILL.md",
        """---
name: no-inspect
description: "Use when there is no inspection step."
source: project
domain: process
---

# no-inspect

## When to use

* Sometimes

## Procedure

1. Apply the patch
2. Push the commit
3. Hope it works

## Output

The pushed commit hash.
""",
    )
    result = lint_file(path)
    assert any(i.code == "missing_inspect_step" for i in result.issues)


def test_router_routes_to_missing_skipped_for_trust_core(tmp_path: Path) -> None:
    """Rules pinned at `trust.level: core` skip the Phase 4 migration hint.

    Trust-tier carve-out: a non-kernel rule that is nonetheless declared
    authoritative (``trust.level: core``) may legitimately keep its body
    inline without a ``routes_to:`` delegation. The linter must not emit
    ``router_routes_to_missing`` for that shape.
    """
    path = write_file(
        tmp_path,
        ".agent-src.uncondensed/rules/trust-core-rule.md",
        """---
type: auto
description: "Use when something specific happens — core-trust authoritative rule"
triggers:
  - keyword: "foo"
trust:
  level: core
  confidence: high
  human_review_required: false
---

# trust-core-rule

```
IRON LAW
DO THE THING. ALWAYS.
```

Body lives inline because trust.level=core makes the rule authoritative.
""",
    )
    result = lint_file(path)
    assert not any(i.code == "router_routes_to_missing" for i in result.issues), \
        [i.code for i in result.issues]


def test_router_routes_to_missing_still_fires_without_trust_core(tmp_path: Path) -> None:
    """Non-core rules still get the Phase 4 migration hint when routes_to: is absent."""
    path = write_file(
        tmp_path,
        ".agent-src.uncondensed/rules/regular-auto-rule.md",
        """---
type: auto
description: "Use when something specific happens — regular auto rule"
triggers:
  - keyword: "foo"
trust:
  level: advisory
  confidence: medium
  human_review_required: false
---

# regular-auto-rule

Body that should migrate to a skill in Phase 4.
""",
    )
    result = lint_file(path)
    assert any(i.code == "router_routes_to_missing" for i in result.issues), \
        [i.code for i in result.issues]

