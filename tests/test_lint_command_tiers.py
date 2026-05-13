"""Tests for ``scripts/lint_command_tiers.py``.

Exercises the four cases the gate must enforce:

  - clean pass (every command has a valid tier)
  - missing tier
  - invalid tier value
  - empty commands dir (treated as failure — bootstrap accident)

Plus a regression test against the real repo so the production tree
stays green from this commit forward (Phase 4 Step 5 of
``agents/roadmaps/road-to-distribution-maturity.md``).
"""
from __future__ import annotations

import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scripts"))

from lint_command_tiers import lint  # noqa: E402

REPO = Path(__file__).resolve().parent.parent
REAL_COMMANDS_DIR = REPO / ".agent-src.uncompressed" / "commands"


def _write_cmd(
    root: Path,
    rel: str,
    *,
    tier: str | None,
    name: str | None = None,
) -> Path:
    path = root / rel
    path.parent.mkdir(parents=True, exist_ok=True)
    lines = ["---"]
    if name is not None:
        lines.append(f"name: {name}")
    if tier is not None:
        lines.append(f"tier: {tier}")
    lines += [
        "description: fixture command",
        "---",
        "",
        "# Fixture",
        "",
        "Body.",
        "",
    ]
    path.write_text("\n".join(lines), encoding="utf-8")
    return path


def test_clean_pass(tmp_path: Path, capsys: pytest.CaptureFixture[str]) -> None:
    _write_cmd(tmp_path, "alpha.md", tier="0", name="alpha")
    _write_cmd(tmp_path, "beta.md", tier="1", name="beta")
    _write_cmd(tmp_path, "nested/gamma.md", tier="2", name="gamma")

    rc = lint(tmp_path)

    assert rc == 0
    captured = capsys.readouterr()
    assert "3 commands" in captured.out


def test_missing_tier_fails(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    _write_cmd(tmp_path, "good.md", tier="0", name="good")
    _write_cmd(tmp_path, "bad.md", tier=None, name="bad")

    rc = lint(tmp_path)

    assert rc == 1
    captured = capsys.readouterr()
    assert "1 missing" in captured.err
    assert "bad.md" in captured.err


def test_invalid_tier_fails(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    _write_cmd(tmp_path, "good.md", tier="1", name="good")
    _write_cmd(tmp_path, "wrong.md", tier="3", name="wrong")
    _write_cmd(tmp_path, "alpha.md", tier="critical", name="alpha")

    rc = lint(tmp_path)

    assert rc == 1
    captured = capsys.readouterr()
    assert "2 invalid" in captured.err
    assert "wrong.md" in captured.err
    assert "alpha.md" in captured.err


def test_empty_dir_fails(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    (tmp_path / "commands").mkdir()
    rc = lint(tmp_path / "commands")
    assert rc == 1
    assert "no commands found" in capsys.readouterr().err


def test_missing_dir_fails(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    rc = lint(tmp_path / "does-not-exist")
    assert rc == 1
    assert "no commands dir" in capsys.readouterr().err


def test_agents_md_companions_ignored(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    # An AGENTS.md sub-doc must NOT trigger the lint, even without a tier.
    _write_cmd(tmp_path, "AGENTS.md", tier=None, name=None)
    _write_cmd(tmp_path, "real.md", tier="2", name="real")

    rc = lint(tmp_path)

    assert rc == 0
    assert "1 commands" in capsys.readouterr().out


@pytest.mark.skipif(
    not REAL_COMMANDS_DIR.is_dir(),
    reason="commands dir absent — repo layout test only",
)
def test_real_repo_passes() -> None:
    """The production command tree is tier-clean from this commit."""
    assert lint(REAL_COMMANDS_DIR, quiet=True) == 0
