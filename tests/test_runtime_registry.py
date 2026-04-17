"""Tests for the runtime registry."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scripts"))

from runtime_registry import (
    SkillRuntime,
    build_registry,
    discover_skills,
    parse_skill_runtime,
    validate_registry,
)


def write_skill(tmp_path: Path, name: str, frontmatter: str) -> Path:
    """Helper to create a skill file."""
    skill_dir = tmp_path / ".augment.uncompressed" / "skills" / name
    skill_dir.mkdir(parents=True, exist_ok=True)
    path = skill_dir / "SKILL.md"
    content = f"""---
name: {name}
description: "Test skill for {name}"
{frontmatter}---

# {name}

## When to use

* Testing

## Procedure

1. Inspect current state
2. Apply change
3. Validate result

## Output format

1. Result
2. Next step

## Gotchas

* Test gotcha

## Do NOT

* Do NOT skip
"""
    path.write_text(content, encoding="utf-8")
    return path


def test_discover_finds_skills(tmp_path: Path) -> None:
    write_skill(tmp_path, "skill-a", "")
    write_skill(tmp_path, "skill-b", "execution:\n  type: manual\n")
    found = discover_skills(tmp_path)
    assert len(found) == 2


def test_parse_skill_without_execution_returns_none(tmp_path: Path) -> None:
    path = write_skill(tmp_path, "no-exec", "")
    result = parse_skill_runtime(path)
    assert result is None


def test_parse_skill_with_manual_execution(tmp_path: Path) -> None:
    path = write_skill(tmp_path, "manual-skill", "execution:\n  type: manual\n")
    result = parse_skill_runtime(path)
    assert result is not None
    assert result.execution_type == "manual"
    assert result.handler == "none"
    assert result.is_executable is False


def test_parse_skill_with_assisted_execution(tmp_path: Path) -> None:
    path = write_skill(tmp_path, "assisted-skill",
                        "execution:\n  type: assisted\n  handler: internal\n  allowed_tools:\n    - github\n")
    result = parse_skill_runtime(path)
    assert result is not None
    assert result.execution_type == "assisted"
    assert result.handler == "internal"
    assert result.is_executable is True
    assert result.allowed_tools == ["github"]


def test_parse_skill_with_automated_execution(tmp_path: Path) -> None:
    path = write_skill(tmp_path, "auto-skill",
                        "execution:\n  type: automated\n  handler: shell\n  timeout_seconds: 60\n  safety_mode: strict\n  allowed_tools: []\n")
    result = parse_skill_runtime(path)
    assert result is not None
    assert result.execution_type == "automated"
    assert result.handler == "shell"
    assert result.timeout_seconds == 60
    assert result.safety_mode == "strict"
    assert result.is_automated is True


def test_build_registry_only_includes_execution_skills(tmp_path: Path) -> None:
    write_skill(tmp_path, "no-exec", "")
    write_skill(tmp_path, "manual", "execution:\n  type: manual\n")
    write_skill(tmp_path, "assisted", "execution:\n  type: assisted\n  handler: internal\n")
    registry = build_registry(tmp_path)
    assert len(registry) == 2
    names = {s.name for s in registry}
    assert "manual" in names
    assert "assisted" in names
    assert "no-exec" not in names


def test_validate_registry_passes_for_valid(tmp_path: Path) -> None:
    write_skill(tmp_path, "valid-auto",
                "execution:\n  type: automated\n  handler: shell\n  safety_mode: strict\n  allowed_tools: []\n")
    registry = build_registry(tmp_path)
    errors = validate_registry(registry)
    assert len(errors) == 0


def test_validate_registry_catches_automated_without_handler(tmp_path: Path) -> None:
    skill = SkillRuntime(
        name="bad-auto", path="test", description="",
        execution_type="automated", handler="none",
        timeout_seconds=30, safety_mode="strict", allowed_tools=[],
    )
    errors = validate_registry([skill])
    assert any("handler 'none'" in e for e in errors)


def test_validate_registry_catches_automated_without_safety(tmp_path: Path) -> None:
    skill = SkillRuntime(
        name="bad-safety", path="test", description="",
        execution_type="automated", handler="shell",
        timeout_seconds=30, safety_mode=None, allowed_tools=[],
    )
    errors = validate_registry([skill])
    assert any("safety_mode" in e for e in errors)
