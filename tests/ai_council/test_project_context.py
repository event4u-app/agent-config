"""Coverage for ai_council.project_context.detect_project_context."""

from __future__ import annotations

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from scripts.ai_council.project_context import (  # noqa: E402
    REPO_PURPOSE_MAX_CHARS,
    ProjectContext,
    detect_project_context,
)


def _write_json(path: Path, data: dict) -> None:
    path.write_text(json.dumps(data), encoding="utf-8")


def test_empty_directory_returns_dirname_only(tmp_path: Path) -> None:
    ctx = detect_project_context(tmp_path)
    # Manifest-derived fields stay None; the directory name is still useful.
    assert ctx.name == tmp_path.resolve().name
    assert ctx.stack is None
    assert ctx.repo_purpose is None
    assert ctx.is_empty() is False  # name fell back to dirname


def test_composer_only_picks_name_and_php_version(tmp_path: Path) -> None:
    _write_json(tmp_path / "composer.json", {"name": "vendor/pkg", "require": {"php": "^8.2"}})
    ctx = detect_project_context(tmp_path)
    assert ctx.name == "vendor/pkg"
    assert ctx.stack is not None
    assert "PHP ^8.2" in ctx.stack


def test_composer_with_laravel_adds_framework_label(tmp_path: Path) -> None:
    _write_json(tmp_path / "composer.json", {
        "name": "vendor/app",
        "require": {"php": "^8.2", "laravel/framework": "^11.0"},
    })
    ctx = detect_project_context(tmp_path)
    assert ctx.stack is not None
    assert "Laravel" in ctx.stack
    assert "PHP" in ctx.stack


def test_package_only_picks_name_and_node_engine(tmp_path: Path) -> None:
    _write_json(tmp_path / "package.json", {"name": "@scope/pkg", "engines": {"node": ">=20"}})
    ctx = detect_project_context(tmp_path)
    assert ctx.name == "@scope/pkg"
    assert ctx.stack is not None
    assert "Node" in ctx.stack


def test_package_with_react_adds_framework_label(tmp_path: Path) -> None:
    _write_json(tmp_path / "package.json", {
        "name": "ui",
        "dependencies": {"react": "^18.0"},
    })
    ctx = detect_project_context(tmp_path)
    assert ctx.stack is not None
    assert "React" in ctx.stack


def test_both_manifests_present_composer_name_wins(tmp_path: Path) -> None:
    _write_json(tmp_path / "composer.json", {"name": "vendor/pkg"})
    _write_json(tmp_path / "package.json", {"name": "@scope/pkg"})
    ctx = detect_project_context(tmp_path)
    assert ctx.name == "vendor/pkg"


def test_neither_manifest_no_readme_returns_dirname_and_nones(tmp_path: Path) -> None:
    ctx = detect_project_context(tmp_path)
    assert ctx.name == tmp_path.resolve().name
    assert ctx.stack is None
    assert ctx.repo_purpose is None


def test_missing_readme_leaves_purpose_none(tmp_path: Path) -> None:
    _write_json(tmp_path / "composer.json", {"name": "vendor/pkg"})
    ctx = detect_project_context(tmp_path)
    assert ctx.repo_purpose is None


def test_readme_with_prose_paragraph_is_extracted(tmp_path: Path) -> None:
    (tmp_path / "README.md").write_text(
        "# My Project\n\nA universal orchestrator for agent workflows.\n"
        "Ships skills, rules, commands.\n\n## Install\n\n```\n./install\n```\n",
        encoding="utf-8",
    )
    ctx = detect_project_context(tmp_path)
    assert ctx.repo_purpose is not None
    assert "universal orchestrator" in ctx.repo_purpose
    assert "Install" not in ctx.repo_purpose


def test_readme_with_only_headings_returns_none_purpose(tmp_path: Path) -> None:
    (tmp_path / "README.md").write_text("# Heading\n\n## Subheading\n", encoding="utf-8")
    ctx = detect_project_context(tmp_path)
    assert ctx.repo_purpose is None


def test_readme_with_only_badges_returns_none_purpose(tmp_path: Path) -> None:
    (tmp_path / "README.md").write_text(
        "# Heading\n\n[![CI](https://example.com/badge.svg)](https://example.com)\n"
        "![Logo](logo.png)\n",
        encoding="utf-8",
    )
    ctx = detect_project_context(tmp_path)
    assert ctx.repo_purpose is None


def test_readme_truncated_at_max_chars(tmp_path: Path) -> None:
    body = "x " * (REPO_PURPOSE_MAX_CHARS + 50)
    (tmp_path / "README.md").write_text(f"# H\n\n{body}\n", encoding="utf-8")
    ctx = detect_project_context(tmp_path)
    assert ctx.repo_purpose is not None
    assert len(ctx.repo_purpose) <= REPO_PURPOSE_MAX_CHARS
    assert ctx.repo_purpose.endswith("…")


def test_corrupt_composer_falls_back_silently(tmp_path: Path) -> None:
    (tmp_path / "composer.json").write_text("{not valid json", encoding="utf-8")
    ctx = detect_project_context(tmp_path)
    # No exception, no name from manifest, dirname fallback still works.
    assert ctx.name == tmp_path.resolve().name
    assert ctx.stack is None


def test_dataclass_is_empty_when_all_none() -> None:
    assert ProjectContext().is_empty() is True
    assert ProjectContext(name="x").is_empty() is False
