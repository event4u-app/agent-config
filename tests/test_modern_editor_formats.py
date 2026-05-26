"""Pytest matrix for road-to-simplicity-and-everywhere Phase 5 (S25).

Verifies that `scripts/condense.py --generate-tools` emits modern
editor formats with the expected frontmatter shape, and that the
modern + legacy projections stay in parity (same source body).
"""

from __future__ import annotations

from pathlib import Path

import pytest
import yaml

ROOT = Path(__file__).resolve().parent.parent
SOURCE_RULES = ROOT / ".agent-src" / "rules"
SOURCE_COMMANDS = ROOT / ".agent-src" / "commands"

CURSOR_RULES_DIR = ROOT / ".cursor" / "rules"
CURSOR_COMMANDS_DIR = ROOT / ".cursor" / "commands"
WINDSURF_RULES_DIR = ROOT / ".windsurf" / "rules"
WINDSURF_WORKFLOWS_DIR = ROOT / ".windsurf" / "workflows"


def _split_frontmatter(text: str) -> tuple[dict, str]:
    if not text.startswith("---"):
        return {}, text
    end = text.find("\n---", 3)
    if end == -1:
        return {}, text
    raw = text[3:end].strip()
    body = text[end + 4:].lstrip("\n")
    return yaml.safe_load(raw) or {}, body


def _source_rule_files() -> list[Path]:
    return sorted(SOURCE_RULES.glob("*.md"))


def _source_command_files() -> list[Path]:
    if not SOURCE_COMMANDS.exists():
        return []
    return [p for p in sorted(SOURCE_COMMANDS.rglob("*.md")) if p.name != "AGENTS.md"]


def _command_slug(source_file: Path) -> str:
    rel = source_file.relative_to(SOURCE_COMMANDS)
    return "-".join(rel.with_suffix("").parts)


pytestmark = pytest.mark.skipif(
    not (CURSOR_RULES_DIR.exists() and WINDSURF_RULES_DIR.exists()),
    reason="run `python3 scripts/condense.py --generate-tools` first",
)


@pytest.mark.parametrize("source", _source_rule_files(), ids=lambda p: p.stem)
def test_cursor_mdc_frontmatter_shape(source: Path) -> None:
    target = CURSOR_RULES_DIR / f"{source.stem}.mdc"
    assert target.exists(), f"missing {target}"
    meta, body = _split_frontmatter(target.read_text())
    assert "description" in meta
    assert "globs" in meta
    assert "alwaysApply" in meta
    assert isinstance(meta["alwaysApply"], bool)
    assert body.strip(), "body must be non-empty"


@pytest.mark.parametrize("source", _source_rule_files(), ids=lambda p: p.stem)
def test_windsurf_rule_frontmatter_shape(source: Path) -> None:
    target = WINDSURF_RULES_DIR / source.name
    assert target.exists(), f"missing {target}"
    meta, body = _split_frontmatter(target.read_text())
    assert meta.get("trigger") in {"always_on", "model_decision", "manual"}
    assert "description" in meta
    assert "globs" in meta
    assert body.strip(), "body must be non-empty"


@pytest.mark.parametrize("source", _source_rule_files(), ids=lambda p: p.stem)
def test_modern_legacy_body_parity(source: Path) -> None:
    """Modern Cursor `.mdc` + Windsurf `.md` bodies must match source body."""
    src_meta, src_body = _split_frontmatter(source.read_text())
    _, mdc_body = _split_frontmatter((CURSOR_RULES_DIR / f"{source.stem}.mdc").read_text())
    _, ws_body = _split_frontmatter((WINDSURF_RULES_DIR / source.name).read_text())
    assert src_body.strip() == mdc_body.strip(), f"cursor body drift: {source.name}"
    assert src_body.strip() == ws_body.strip(), f"windsurf body drift: {source.name}"


@pytest.mark.parametrize("source", _source_command_files(), ids=lambda p: _command_slug(p))
def test_cursor_command_link_resolves(source: Path) -> None:
    slug = _command_slug(source)
    target = CURSOR_COMMANDS_DIR / f"{slug}.md"
    assert target.exists(), f"missing {target}"
    assert target.is_symlink(), f"{target} should be a symlink"
    assert target.resolve() == source.resolve()


@pytest.mark.parametrize("source", _source_command_files(), ids=lambda p: _command_slug(p))
def test_windsurf_workflow_link_resolves(source: Path) -> None:
    slug = _command_slug(source)
    target = WINDSURF_WORKFLOWS_DIR / f"{slug}.md"
    assert target.exists(), f"missing {target}"
    assert target.is_symlink(), f"{target} should be a symlink"
    assert target.resolve() == source.resolve()


def test_cursor_rules_dir_count_matches_source() -> None:
    src = len(_source_rule_files())
    assert len(list(CURSOR_RULES_DIR.glob("*.mdc"))) == src


def test_windsurf_rules_dir_count_matches_source() -> None:
    src = len(_source_rule_files())
    assert len(list(WINDSURF_RULES_DIR.glob("*.md"))) == src
