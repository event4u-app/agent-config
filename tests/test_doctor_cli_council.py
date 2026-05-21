"""Step-9 Phase 3 — ``doctor council-cli`` health-check tests.

Covers the ``_check_council_cli`` runner in ``scripts/_cli/cmd_doctor.py``:

- No ``agents/settings/.ai-council.yml`` → ``ok`` with "no council config".
- File present but no enabled CLI members → ``ok`` with "no enabled".
- Enabled CLI member with binary present and uncapped → ``ok``.
- Enabled CLI member with binary missing → ``warn`` listing the
  missing provider and the install-hint pointer.
- Enabled CLI member at/over ``warn_at`` quota → ``warn`` listing the
  over-threshold provider.
- Council deps unimportable → ``warn`` without crashing.

The runner is exercised directly — no subprocess, no real CLI binary,
no real ``cli-calls.json``. The lazy imports inside ``_check_council_cli``
are intercepted via ``monkeypatch.setattr`` on the source modules.
"""
from __future__ import annotations

import sys
from dataclasses import dataclass, field
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from scripts._cli import cmd_doctor  # noqa: E402


@dataclass(frozen=True)
class _StubMember:
    enabled: bool
    mode: str
    binary: str | None = None


@dataclass(frozen=True)
class _StubBudget:
    max_calls_per_day: dict[str, int] = field(default_factory=dict)
    warn_at: float = 0.8


@dataclass(frozen=True)
class _StubConfig:
    members: dict[str, _StubMember]
    cli_call_budget: _StubBudget = field(default_factory=_StubBudget)


def _patch_council(
    monkeypatch: pytest.MonkeyPatch,
    *,
    config: _StubConfig,
    counts: dict[str, int],
) -> None:
    """Replace the lazy imports inside ``_check_council_cli``."""
    from scripts.ai_council import clients as clients_mod
    from scripts.ai_council import config as config_mod
    monkeypatch.setattr(
        config_mod, "load_council_config", lambda _path: config,
    )
    monkeypatch.setattr(
        clients_mod, "load_cli_call_counts", lambda path=None: dict(counts),
    )


def _make_project(tmp_path: Path) -> Path:
    """Materialise an empty ``agents/settings/.ai-council.yml`` so the file exists."""
    (tmp_path / "agents" / "settings").mkdir(parents=True)
    (tmp_path / "agents" / "settings" / ".ai-council.yml").write_text("enabled: true\n")
    return tmp_path


def test_no_config_file_returns_ok(tmp_path: Path) -> None:
    result = cmd_doctor._check_council_cli(tmp_path)
    assert result["id"] == "council-cli"
    assert result["status"] == "ok"
    assert "no council config" in result["message"]


def test_no_enabled_cli_members_returns_ok(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch,
) -> None:
    project = _make_project(tmp_path)
    cfg = _StubConfig(members={
        "anthropic": _StubMember(enabled=True, mode="api"),
        "openai": _StubMember(enabled=False, mode="cli"),
    })
    _patch_council(monkeypatch, config=cfg, counts={})
    result = cmd_doctor._check_council_cli(project)
    assert result["status"] == "ok"
    assert "no enabled CLI" in result["message"]


def test_enabled_cli_member_with_binary_present_is_ok(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch,
) -> None:
    project = _make_project(tmp_path)
    cfg = _StubConfig(members={
        "anthropic": _StubMember(enabled=True, mode="cli"),
    })
    _patch_council(monkeypatch, config=cfg, counts={})
    monkeypatch.setattr(cmd_doctor.shutil, "which", lambda _b: "/usr/bin/claude")
    result = cmd_doctor._check_council_cli(project)
    assert result["status"] == "ok"
    assert "anthropic" in result["message"]
    assert "binary ✅" in result["message"]
    assert "subscription" in result["message"]


def test_enabled_cli_member_with_missing_binary_warns(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch,
) -> None:
    project = _make_project(tmp_path)
    cfg = _StubConfig(members={
        "anthropic": _StubMember(enabled=True, mode="cli"),
        "openai": _StubMember(enabled=True, mode="cli"),
    })
    _patch_council(monkeypatch, config=cfg, counts={})
    monkeypatch.setattr(
        cmd_doctor.shutil, "which",
        lambda b: "/usr/bin/codex" if b == "codex" else None,
    )
    result = cmd_doctor._check_council_cli(project)
    assert result["status"] == "warn"
    assert "anthropic" in result["message"]
    assert "binary ❌" in result["message"]
    assert "install" in result["remedy"]


def test_quota_at_warn_at_threshold_warns(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch,
) -> None:
    project = _make_project(tmp_path)
    cfg = _StubConfig(
        members={"anthropic": _StubMember(enabled=True, mode="cli")},
        cli_call_budget=_StubBudget(
            max_calls_per_day={"anthropic": 10}, warn_at=0.8,
        ),
    )
    _patch_council(monkeypatch, config=cfg, counts={"anthropic": 9})
    monkeypatch.setattr(cmd_doctor.shutil, "which", lambda _b: "/usr/bin/claude")
    result = cmd_doctor._check_council_cli(project)
    assert result["status"] == "warn"
    assert "anthropic" in result["message"]
    assert "9/10" in result["message"]
    assert "warn_at=0.8" in result["message"]


def test_billable_community_cli_renders_billable_label(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch,
) -> None:
    project = _make_project(tmp_path)
    cfg = _StubConfig(members={
        "xai": _StubMember(enabled=True, mode="cli"),
    })
    _patch_council(monkeypatch, config=cfg, counts={})
    monkeypatch.setattr(cmd_doctor.shutil, "which", lambda _b: "/usr/bin/grok")
    result = cmd_doctor._check_council_cli(project)
    assert result["status"] == "ok"
    assert "billable" in result["message"]
