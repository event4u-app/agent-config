"""Contract tests for ``scripts/_lib/agent_settings.py``.

Covers the loader contract from road-to-portable-dev-preferences P1:

* Tolerance branches: missing project, missing user-global, both
  missing, both present, malformed YAML.
* Whitelist filtering: non-whitelisted user-global keys silently
  ignored; ``verbose=True`` surfaces them via ``logging.info``.
* Project always wins over user-global; nested dicts merge per-key.
* Type coercion preserved (booleans, strings, ints, lists).
* Read-only invariant: loader never creates or writes files.
"""
from __future__ import annotations

import logging
from pathlib import Path
from textwrap import dedent

import pytest

from scripts._lib import agent_settings as ags


def _write(path: Path, body: str) -> Path:
    path.write_text(dedent(body), encoding="utf-8")
    return path


# --- tolerance branches -----------------------------------------------------

def test_both_files_missing_returns_defaults(tmp_path: Path) -> None:
    result = ags.load_agent_settings(
        project_path=tmp_path / "missing-project.yml",
        user_global_path=tmp_path / "missing-user.yml",
    )
    assert result == {}


def test_missing_project_yields_user_global_whitelisted(tmp_path: Path) -> None:
    user = _write(tmp_path / "user.yml", "name: Matze\nide: vscode\n")
    result = ags.load_agent_settings(
        project_path=tmp_path / "missing.yml",
        user_global_path=user,
    )
    assert result == {"name": "Matze", "ide": "vscode"}


def test_missing_user_global_yields_project(tmp_path: Path) -> None:
    project = _write(tmp_path / "project.yml", "name: Project\npipelines:\n  ci: true\n")
    result = ags.load_agent_settings(
        project_path=project,
        user_global_path=tmp_path / "missing.yml",
    )
    assert result == {"name": "Project", "pipelines": {"ci": True}}


def test_malformed_yaml_falls_back_to_other_side(tmp_path: Path) -> None:
    project = _write(tmp_path / "project.yml", "name: ProjectOnly\n")
    bad = _write(tmp_path / "user.yml", ": : : bad\n  - unclosed [\n")
    result = ags.load_agent_settings(project_path=project, user_global_path=bad)
    assert result == {"name": "ProjectOnly"}


def test_empty_yaml_treated_as_missing(tmp_path: Path) -> None:
    empty_user = _write(tmp_path / "user.yml", "")
    project = _write(tmp_path / "project.yml", "ide: nvim\n")
    result = ags.load_agent_settings(project_path=project, user_global_path=empty_user)
    assert result == {"ide": "nvim"}


# --- whitelist filtering ----------------------------------------------------

def test_non_whitelisted_user_global_keys_silently_ignored(tmp_path: Path) -> None:
    user = _write(
        tmp_path / "user.yml",
        """
        name: Matze
        pipelines:
          skill_improvement: true
        roles:
          active_role: developer
        """,
    )
    result = ags.load_agent_settings(
        project_path=tmp_path / "missing.yml",
        user_global_path=user,
    )
    assert result == {"name": "Matze"}
    assert "pipelines" not in result
    assert "roles" not in result


def test_verbose_logs_ignored_user_global_keys(
    tmp_path: Path, caplog: pytest.LogCaptureFixture,
) -> None:
    user = _write(
        tmp_path / "user.yml",
        "name: Matze\npipelines:\n  ci: true\nroles:\n  active: dev\n",
    )
    with caplog.at_level(logging.INFO, logger=ags.logger.name):
        ags.load_agent_settings(
            project_path=tmp_path / "missing.yml",
            user_global_path=user,
            verbose=True,
        )
    joined = " ".join(r.message for r in caplog.records)
    assert "pipelines.ci" in joined
    assert "roles.active" in joined
    assert "name" not in joined.split("ignored")[-1].split(":")[-1]


def test_namespace_partial_whitelist_only_keeps_listed_paths(tmp_path: Path) -> None:
    user = _write(
        tmp_path / "user.yml",
        "personal:\n  bot_icon: '🤖'\n  autonomy: medium\n  theme: dark\n",
    )
    result = ags.load_agent_settings(
        project_path=tmp_path / "missing.yml",
        user_global_path=user,
    )
    assert result == {"personal": {"bot_icon": "🤖", "autonomy": "medium"}}
    assert "theme" not in result["personal"]


# --- merge precedence -------------------------------------------------------

def test_project_wins_over_user_global_on_overlap(tmp_path: Path) -> None:
    project = _write(tmp_path / "project.yml", "name: ProjectMatze\nide: phpstorm\n")
    user = _write(tmp_path / "user.yml", "name: UserMatze\nide: vscode\n")
    result = ags.load_agent_settings(project_path=project, user_global_path=user)
    assert result["name"] == "ProjectMatze"
    assert result["ide"] == "phpstorm"


def test_user_global_fills_gaps_where_project_silent(tmp_path: Path) -> None:
    project = _write(tmp_path / "project.yml", "name: ProjectMatze\n")
    user = _write(tmp_path / "user.yml", "ide: vscode\ncost_profile: lean\n")
    result = ags.load_agent_settings(project_path=project, user_global_path=user)
    assert result == {"name": "ProjectMatze", "ide": "vscode", "cost_profile": "lean"}


def test_nested_dicts_merge_per_key(tmp_path: Path) -> None:
    project = _write(tmp_path / "project.yml", "personal:\n  bot_icon: '🦊'\n")
    user = _write(
        tmp_path / "user.yml",
        "personal:\n  bot_icon: '🤖'\n  autonomy: high\n",
    )
    result = ags.load_agent_settings(project_path=project, user_global_path=user)
    # Project wins on bot_icon; user-global fills autonomy.
    assert result["personal"] == {"bot_icon": "🦊", "autonomy": "high"}


# --- type preservation -----------------------------------------------------

def test_value_types_preserved_through_merge(tmp_path: Path) -> None:
    project = _write(
        tmp_path / "project.yml",
        "pipelines:\n  ci: true\n  retries: 3\n  channels:\n    - slack\n    - email\n",
    )
    user = _write(tmp_path / "user.yml", "cost_profile: lean\n")
    result = ags.load_agent_settings(project_path=project, user_global_path=user)
    assert result["pipelines"]["ci"] is True
    assert result["pipelines"]["retries"] == 3
    assert result["pipelines"]["channels"] == ["slack", "email"]
    assert result["cost_profile"] == "lean"


# --- read-only invariant ----------------------------------------------------

def test_loader_never_creates_files(tmp_path: Path) -> None:
    project = tmp_path / "missing-project.yml"
    user = tmp_path / "missing-user.yml"
    before = set(tmp_path.iterdir())
    ags.load_agent_settings(project_path=project, user_global_path=user)
    assert set(tmp_path.iterdir()) == before
    assert not project.exists()
    assert not user.exists()


def test_loader_does_not_mutate_input_files(tmp_path: Path) -> None:
    project = _write(tmp_path / "project.yml", "name: KeepMe\n")
    user = _write(tmp_path / "user.yml", "ide: vscode\n")
    project_before = project.read_text(encoding="utf-8")
    user_before = user.read_text(encoding="utf-8")
    ags.load_agent_settings(project_path=project, user_global_path=user)
    assert project.read_text(encoding="utf-8") == project_before
    assert user.read_text(encoding="utf-8") == user_before


# --- default paths ----------------------------------------------------------

def test_defaults_resolve_when_neither_argument_given(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.chdir(tmp_path)
    monkeypatch.setattr(
        ags, "DEFAULT_USER_GLOBAL_FILE", tmp_path / "no-such-file.yml",
    )
    assert ags.load_agent_settings() == {}


# --- whitelist constants ---------------------------------------------------

def test_mergeable_keys_are_documented_exact_paths() -> None:
    # Locking the whitelist in a test prevents accidental drift; adding a
    # key requires an ADR per the roadmap.
    assert ags.MERGEABLE_KEYS == (
        "name",
        "ide",
        "cost_profile",
        "personal.bot_icon",
        "personal.autonomy",
        "caveman.speak_scope",
    )
