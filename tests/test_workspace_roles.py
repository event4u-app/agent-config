"""Tests for ``packages/core/installer/python/workspace_roles.py``.

Covers role + task discovery used by the workspace launcher (Phase 4).
"""

from __future__ import annotations

import importlib.util
import sys
from pathlib import Path

import pytest


REPO_ROOT = Path(__file__).resolve().parents[1]
MODULE_PATH = REPO_ROOT / "packages" / "core" / "installer" / "python" / "workspace_roles.py"


def _load():
    spec = importlib.util.spec_from_file_location("workspace_roles", MODULE_PATH)
    assert spec and spec.loader
    mod = importlib.util.module_from_spec(spec)
    sys.modules["workspace_roles"] = mod
    spec.loader.exec_module(mod)
    return mod


@pytest.fixture
def roles_root(tmp_path):
    root = tmp_path / "roles"
    (root / "galabau").mkdir(parents=True)
    (root / "galabau" / "index.md").write_text(
        "---\n"
        "title: Galabau\n"
        "explain_default: plain\n"
        "---\n"
        "\n"
        "Hands-on landscape contractor identity.\n"
        "\n"
        "## First tasks\n"
        "- offer-spring-cleanup — Frühjahrsangebot schreiben\n"
        "- email-customer — Kundenmail formulieren\n"
        "\n"
        "## Skills\n"
        "Not a tasks list.\n",
        encoding="utf-8",
    )
    (root / "galabau" / "skills.yml").write_text(
        "schema: role-skills/v0\n"
        "skills:\n"
        "  - tailwind-engineer\n"
        "  - laravel\n",
        encoding="utf-8",
    )
    (root / "consultant").mkdir()
    (root / "consultant" / "index.md").write_text(
        "---\ntitle: Consultant\n---\n\nStrategy identity.\n"
        "\n## Tasks\n- brief — Brief schreiben\n",
        encoding="utf-8",
    )
    return root


def test_list_roles_finds_index_md_dirs(roles_root):
    mod = _load()
    assert mod.list_roles(root=roles_root) == ["consultant", "galabau"]


def test_load_role_parses_frontmatter_and_tasks(roles_root):
    mod = _load()
    r = mod.load_role("galabau", root=roles_root)
    assert r is not None
    assert r.title == "Galabau"
    assert r.explain_default == "plain"
    assert [t.slug for t in r.tasks] == ["offer-spring-cleanup", "email-customer"]
    assert r.tasks[0].title.startswith("Frühjahrs")
    assert r.skills == ["tailwind-engineer", "laravel"]
    assert "landscape contractor" in r.identity


def test_load_role_unknown_returns_none(roles_root):
    mod = _load()
    assert mod.load_role("missing", root=roles_root) is None


def test_load_role_without_skills_file(roles_root):
    mod = _load()
    r = mod.load_role("consultant", root=roles_root)
    assert r is not None
    assert r.skills == []
    assert [t.slug for t in r.tasks] == ["brief"]


def test_list_tasks_returns_role_tasks(roles_root):
    mod = _load()
    tasks = mod.list_tasks("galabau", root=roles_root)
    assert len(tasks) == 2
    assert tasks[0].slug == "offer-spring-cleanup"


def test_list_tasks_unknown_role_empty(roles_root):
    mod = _load()
    assert mod.list_tasks("missing", root=roles_root) == []


def test_list_roles_empty_when_root_missing(tmp_path):
    mod = _load()
    assert mod.list_roles(root=tmp_path / "absent") == []


def test_frontmatter_parser_handles_no_frontmatter():
    mod = _load()
    meta, body = mod._parse_frontmatter("just a body\n")
    assert meta == {}
    assert body == "just a body\n"
