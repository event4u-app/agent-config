"""Tests for the README quality linter."""
from __future__ import annotations

import json
import pytest
from pathlib import Path
from unittest.mock import patch

# Import from scripts
import sys
sys.path.insert(0, str(Path(__file__).parent.parent / "scripts"))

from readme_linter import (
    lint_readme,
    detect_repo_context,
    format_text,
    format_json,
    format_markdown,
    RepoContext,
    ReadmeLintResult,
    Issue,
)


@pytest.fixture
def tmp_repo(tmp_path):
    """Create a minimal repo structure."""
    (tmp_path / "composer.json").write_text(json.dumps({
        "name": "vendor/package",
        "type": "library",
        "require": {"php": "^8.2"},
    }))
    return tmp_path


@pytest.fixture
def good_readme(tmp_path):
    """Create a well-structured package README."""
    readme = tmp_path / "README.md"
    readme.write_text("""# my-package

A useful package that solves real problems.

## Requirements

- PHP ^8.2
- Laravel 11.x

## Installation

```bash
composer require vendor/my-package
```

## Usage

```php
$result = MyPackage::doThing();
```

## Development

```bash
task test
```
""")
    return readme


# --- Repo type detection ---

class TestRepoTypeDetection:
    def test_detects_composer_library(self, tmp_repo):
        ctx = detect_repo_context(tmp_repo)
        assert ctx.repo_type == "package"
        assert ctx.has_composer is True

    def test_detects_app_with_artisan(self, tmp_path):
        (tmp_path / "artisan").touch()
        (tmp_path / "composer.json").write_text('{"name": "app"}')
        ctx = detect_repo_context(tmp_path)
        assert ctx.repo_type == "app"

    def test_detects_internal_with_augment(self, tmp_path):
        (tmp_path / ".augment").mkdir()
        ctx = detect_repo_context(tmp_path)
        assert ctx.repo_type == "internal"

    def test_detects_unknown(self, tmp_path):
        ctx = detect_repo_context(tmp_path)
        assert ctx.repo_type == "unknown"

    def test_extracts_taskfile_tasks(self, tmp_path):
        (tmp_path / "Taskfile.yml").write_text("""
version: '3'
tasks:
  test:
    cmd: echo test
  lint:
    cmd: echo lint
""")
        ctx = detect_repo_context(tmp_path)
        assert "test" in ctx.taskfile_tasks
        assert "lint" in ctx.taskfile_tasks

    def test_extracts_npm_scripts(self, tmp_path):
        (tmp_path / "package.json").write_text(json.dumps({
            "name": "pkg",
            "scripts": {"test": "jest", "build": "tsc"},
        }))
        ctx = detect_repo_context(tmp_path)
        assert "test" in ctx.npm_scripts
        assert "build" in ctx.npm_scripts


# --- Check: missing title ---

class TestMissingTitle:
    def test_fails_without_h1(self, tmp_repo):
        readme = tmp_repo / "README.md"
        readme.write_text("Some text without a title\n\n## Section\n")
        result = lint_readme(readme, tmp_repo)
        codes = [i.code for i in result.issues]
        assert "readme_missing_title" in codes

    def test_passes_with_h1(self, tmp_repo, good_readme):
        result = lint_readme(good_readme, tmp_repo)
        codes = [i.code for i in result.issues]
        assert "readme_missing_title" not in codes


# --- Check: missing summary ---

class TestMissingSummary:
    def test_warns_when_no_summary(self, tmp_repo):
        readme = tmp_repo / "README.md"
        readme.write_text("# Title\n## Install\n```bash\ncomposer install\n```\n")
        result = lint_readme(readme, tmp_repo)
        codes = [i.code for i in result.issues]
        assert "readme_missing_summary" in codes

    def test_passes_with_summary(self, tmp_repo, good_readme):
        result = lint_readme(good_readme, tmp_repo)
        codes = [i.code for i in result.issues]
        assert "readme_missing_summary" not in codes


# --- Check: missing installation ---


# --- Check: missing compatibility ---

class TestMissingCompatibility:
    def test_warns_for_package_without_requirements(self, tmp_repo):
        readme = tmp_repo / "README.md"
        readme.write_text("# Pkg\n\nSummary.\n\n## Installation\n\n```bash\ncomposer require x\n```\n")
        result = lint_readme(readme, tmp_repo)
        codes = [i.code for i in result.issues]
        assert "readme_missing_compatibility" in codes

    def test_passes_with_requirements_heading(self, tmp_repo, good_readme):
        result = lint_readme(good_readme, tmp_repo)
        codes = [i.code for i in result.issues]
        assert "readme_missing_compatibility" not in codes

    def test_skips_for_non_package(self, tmp_path):
        (tmp_path / ".augment").mkdir()
        readme = tmp_path / "README.md"
        readme.write_text("# Tool\n\nSummary.\n\n## Installation\n\n```bash\ntask setup\n```\n")
        result = lint_readme(readme, tmp_path)
        codes = [i.code for i in result.issues]
        assert "readme_missing_compatibility" not in codes


# --- Check: generic boilerplate ---

class TestGenericBoilerplate:
    def test_warns_on_marketing_language(self, tmp_repo):
        readme = tmp_repo / "README.md"
        readme.write_text("# Pkg\n\nA modern and scalable solution.\n\n## Requirements\n\n- PHP ^8.2\n\n## Installation\n\n```bash\nx\n```\n")
        result = lint_readme(readme, tmp_repo)
        codes = [i.code for i in result.issues]
        assert "readme_generic_boilerplate" in codes

    def test_passes_without_boilerplate(self, tmp_repo, good_readme):
        result = lint_readme(good_readme, tmp_repo)
        codes = [i.code for i in result.issues]
        assert "readme_generic_boilerplate" not in codes


# --- Check: command mismatch ---

class TestCommandMismatch:
    def test_warns_on_unknown_task(self, tmp_path):
        (tmp_path / "Taskfile.yml").write_text("version: '3'\ntasks:\n  test:\n    cmd: echo\n")
        (tmp_path / ".augment").mkdir()
        readme = tmp_path / "README.md"
        readme.write_text("# Tool\n\nSummary.\n\n## Installation\n\n```bash\nsetup\n```\n\nRun `task nonexistent` to start.\n\n## Development\n\ntest\n")
        result = lint_readme(readme, tmp_path)
        codes = [i.code for i in result.issues]
        assert "readme_command_mismatch" in codes

    def test_passes_on_known_task(self, tmp_path):
        (tmp_path / "Taskfile.yml").write_text("version: '3'\ntasks:\n  test:\n    cmd: echo\n  lint:\n    cmd: echo\n")
        (tmp_path / ".augment").mkdir()
        readme = tmp_path / "README.md"
        readme.write_text("# Tool\n\nSummary.\n\n## Installation\n\n```bash\nsetup\n```\n\nRun `task test` and `task lint`.\n\n## Development\n\ntest\n")
        result = lint_readme(readme, tmp_path)
        codes = [i.code for i in result.issues]
        assert "readme_command_mismatch" not in codes


# --- Check: section order ---

class TestSectionOrder:
    def test_warns_when_architecture_before_install(self, tmp_repo):
        readme = tmp_repo / "README.md"
        readme.write_text("# Pkg\n\nSummary.\n\n## Requirements\n\n- PHP\n\n## Architecture\n\nDeep stuff.\n\n## Installation\n\n```bash\nx\n```\n")
        result = lint_readme(readme, tmp_repo)
        codes = [i.code for i in result.issues]
        assert "readme_bad_section_order" in codes

    def test_passes_with_correct_order(self, tmp_repo, good_readme):
        result = lint_readme(good_readme, tmp_repo)
        codes = [i.code for i in result.issues]
        assert "readme_bad_section_order" not in codes


# --- Check: overloaded ---

class TestOverloaded:
    def test_warns_on_very_long_readme(self, tmp_repo):
        readme = tmp_repo / "README.md"
        readme.write_text("# Pkg\n\nSummary.\n\n## Requirements\n\n- PHP\n\n## Installation\n\n```bash\nx\n```\n\n" + "line\n" * 600)
        result = lint_readme(readme, tmp_repo)
        codes = [i.code for i in result.issues]
        assert "readme_overloaded" in codes

    def test_passes_on_normal_readme(self, tmp_repo, good_readme):
        result = lint_readme(good_readme, tmp_repo)
        codes = [i.code for i in result.issues]
        assert "readme_overloaded" not in codes


# --- Output formatting ---

class TestOutputFormatting:
    def test_format_text_pass(self):
        result = ReadmeLintResult("README.md", "package", "pass", [], 100)
        output = format_text(result)
        assert "✅" in output
        assert "No issues found" in output

    def test_format_text_with_issues(self):
        result = ReadmeLintResult("README.md", "package", "fail",
                                   [Issue("error", "readme_missing_title", "No H1")], 10)
        output = format_text(result)
        assert "❌" in output
        assert "readme_missing_title" in output

    def test_format_json(self):
        result = ReadmeLintResult("README.md", "package", "pass", [], 100)
        data = json.loads(format_json(result))
        assert data["repo_type"] == "package"
        assert data["summary"]["error"] == 0

    def test_format_markdown(self):
        result = ReadmeLintResult("README.md", "internal", "pass_with_warnings",
                                   [Issue("warning", "readme_overloaded", "Too long")], 600)
        output = format_markdown(result)
        assert "⚠️ Warnings" in output
        assert "readme_overloaded" in output


# --- Full integration: good README passes ---

class TestGoodReadme:
    def test_good_readme_has_no_errors(self, tmp_repo, good_readme):
        result = lint_readme(good_readme, tmp_repo)
        errors = [i for i in result.issues if i.severity == "error"]
        assert len(errors) == 0, f"Unexpected errors: {[i.code for i in errors]}"
        assert result.status in ("pass", "pass_with_warnings")

class TestMissingInstallation:
    def test_errors_for_package_without_install(self, tmp_repo):
        readme = tmp_repo / "README.md"
        readme.write_text("# Package\n\nSummary text.\n\n## About\nText.\n")
        result = lint_readme(readme, tmp_repo)
        issues = {i.code: i.severity for i in result.issues}
        assert issues.get("readme_missing_installation") == "error"

    def test_passes_with_install_heading(self, tmp_repo, good_readme):
        result = lint_readme(good_readme, tmp_repo)
        codes = [i.code for i in result.issues]
        assert "readme_missing_installation" not in codes
