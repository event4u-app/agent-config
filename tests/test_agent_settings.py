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



# --- in-project cascade (road-to-portable-runtime-and-update-check P1) -----

def _init_git_dir(repo_root: Path) -> None:
    (repo_root / ".git").mkdir()


def _init_git_file(repo_root: Path) -> None:
    """Simulate a submodule pointer — ``.git`` is a file, not a directory."""
    (repo_root / ".git").write_text("gitdir: ../.git/modules/sub\n", encoding="utf-8")


def test_find_project_root_finds_git_directory(tmp_path: Path) -> None:
    _init_git_dir(tmp_path)
    nested = tmp_path / "sub" / "deep"
    nested.mkdir(parents=True)
    assert ags.find_project_root(nested) == tmp_path.resolve()


def test_find_project_root_finds_git_file_submodule(tmp_path: Path) -> None:
    _init_git_file(tmp_path)
    nested = tmp_path / "sub"
    nested.mkdir()
    assert ags.find_project_root(nested) == tmp_path.resolve()


def test_find_project_root_returns_none_when_no_git(tmp_path: Path) -> None:
    nested = tmp_path / "sub" / "deep"
    nested.mkdir(parents=True)
    # No .git anywhere under tmp_path; walk hits / without finding one.
    assert ags.find_project_root(nested) is None


def test_cascade_disabled_by_default_back_compat(tmp_path: Path) -> None:
    """``cwd=None`` (default) preserves the pre-cascade two-layer contract."""
    _init_git_dir(tmp_path)
    project = _write(tmp_path / "project.yml", "name: ProjectMatze\n")
    user = _write(tmp_path / "user.yml", "ide: vscode\n")
    result = ags.load_agent_settings(project_path=project, user_global_path=user)
    # No cwd → no ancestor walk; only project_path is read.
    assert result == {"name": "ProjectMatze", "ide": "vscode"}


def test_cascade_no_intermediate_file(tmp_path: Path) -> None:
    _init_git_dir(tmp_path)
    _write(tmp_path / ".agent-settings.yml", "name: RootMatze\nide: phpstorm\n")
    deep = tmp_path / "sub" / "deep"
    deep.mkdir(parents=True)
    result = ags.load_agent_settings(
        user_global_path=tmp_path / "no-user.yml", cwd=deep,
    )
    assert result == {"name": "RootMatze", "ide": "phpstorm"}


def test_cascade_one_intermediate_file_deeper_wins(tmp_path: Path) -> None:
    _init_git_dir(tmp_path)
    _write(tmp_path / ".agent-settings.yml", "name: Root\nide: vscode\n")
    sub = tmp_path / "sub"
    sub.mkdir()
    _write(sub / ".agent-settings.yml", "ide: phpstorm\n")
    result = ags.load_agent_settings(
        user_global_path=tmp_path / "no-user.yml", cwd=sub,
    )
    # Intermediate (== cwd here) wins for `ide`; root provides `name`.
    assert result == {"name": "Root", "ide": "phpstorm"}


def test_cascade_cwd_file_only_deeper_wins(tmp_path: Path) -> None:
    _init_git_dir(tmp_path)
    _write(tmp_path / ".agent-settings.yml", "name: Root\nide: vscode\n")
    deep = tmp_path / "a" / "b" / "c"
    deep.mkdir(parents=True)
    _write(deep / ".agent-settings.yml", "ide: nvim\n")
    result = ags.load_agent_settings(
        user_global_path=tmp_path / "no-user.yml", cwd=deep,
    )
    assert result == {"name": "Root", "ide": "nvim"}


def test_cascade_user_global_whitelist_still_applies(tmp_path: Path) -> None:
    _init_git_dir(tmp_path)
    user = _write(
        tmp_path / "user.yml",
        "name: UserMatze\npipelines:\n  ci: true\n",
    )
    _write(tmp_path / ".agent-settings.yml", "ide: vscode\n")
    deep = tmp_path / "sub"
    deep.mkdir()
    result = ags.load_agent_settings(user_global_path=user, cwd=deep)
    # `pipelines.ci` is not whitelisted → silently dropped from user-global.
    assert result == {"name": "UserMatze", "ide": "vscode"}
    assert "pipelines" not in result


def test_cascade_non_root_layer_not_whitelist_filtered(tmp_path: Path) -> None:
    """Non-root in-project layers carry arbitrary keys — they live inside the boundary."""
    _init_git_dir(tmp_path)
    _write(tmp_path / ".agent-settings.yml", "name: Root\n")
    sub = tmp_path / "sub"
    sub.mkdir()
    _write(sub / ".agent-settings.yml", "pipelines:\n  ci: false\nroles:\n  active: dev\n")
    result = ags.load_agent_settings(
        user_global_path=tmp_path / "no-user.yml", cwd=sub,
    )
    assert result["pipelines"] == {"ci": False}
    assert result["roles"] == {"active": "dev"}


def test_cascade_full_chain_deepest_wins(tmp_path: Path) -> None:
    _init_git_dir(tmp_path)
    user = _write(tmp_path / "user.yml", "name: UserName\nide: vscode\n")
    _write(tmp_path / ".agent-settings.yml", "name: RootName\ncost_profile: lean\n")
    mid = tmp_path / "mid"
    mid.mkdir()
    _write(mid / ".agent-settings.yml", "cost_profile: balanced\n")
    deep = mid / "deep"
    deep.mkdir()
    _write(deep / ".agent-settings.yml", "ide: nvim\n")
    result = ags.load_agent_settings(user_global_path=user, cwd=deep)
    # name: root wins over user-global; cost_profile: mid wins over root;
    # ide: deep wins over user-global.
    assert result == {"name": "RootName", "cost_profile": "balanced", "ide": "nvim"}


def test_cascade_submodule_git_file_works(tmp_path: Path) -> None:
    _init_git_file(tmp_path)  # `.git` is a file, not a directory.
    _write(tmp_path / ".agent-settings.yml", "name: SubmoduleRoot\n")
    deep = tmp_path / "sub"
    deep.mkdir()
    result = ags.load_agent_settings(
        user_global_path=tmp_path / "no-user.yml", cwd=deep,
    )
    assert result == {"name": "SubmoduleRoot"}


def test_cascade_no_git_falls_back_to_legacy(tmp_path: Path) -> None:
    """No ``.git`` reached → loader behaves like the legacy two-layer contract."""
    deep = tmp_path / "sub"
    deep.mkdir()
    _write(deep / ".agent-settings.yml", "name: Local\n")
    # No `.git` anywhere → cascade resolves to the single legacy default path.
    result = ags.load_agent_settings(
        project_path=deep / ".agent-settings.yml",
        user_global_path=tmp_path / "no-user.yml",
        cwd=deep,
    )
    assert result == {"name": "Local"}


def test_iter_setting_overrides_groups_by_key(tmp_path: Path) -> None:
    _init_git_dir(tmp_path)
    user = _write(tmp_path / "user.yml", "ide: vscode\n")
    _write(tmp_path / ".agent-settings.yml", "ide: phpstorm\nname: Root\n")
    sub = tmp_path / "sub"
    sub.mkdir()
    _write(sub / ".agent-settings.yml", "ide: nvim\n")
    tuples = list(
        ags.iter_setting_overrides(user_global_path=user, cwd=sub),
    )
    # Three `ide` observations (user-global, root, sub) in order.
    ide_obs = [(v, p) for k, v, p in tuples if k == "ide"]
    assert [v for v, _ in ide_obs] == ["vscode", "phpstorm", "nvim"]
    # The last observation wins — same as load_agent_settings.
    assert ide_obs[-1][1] == sub / ".agent-settings.yml"
