"""Tests for ``src/scripts/lint_role_experiences.py`` status coupling.

Locks the two-tier beta gate added 2026-06-08 (AI-council convergence):
``beta`` / ``stable`` require a non-null ``recruit_session_ref``;
``draft`` / ``beta-internal`` may keep it ``null``. An unknown status value
is rejected.
"""
from __future__ import annotations

import importlib.util
import sys
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parents[1]
MODULE_PATH = REPO_ROOT / "src" / "scripts" / "lint_role_experiences.py"


def _load():
    spec = importlib.util.spec_from_file_location("lint_role_experiences", MODULE_PATH)
    assert spec and spec.loader
    mod = importlib.util.module_from_spec(spec)
    sys.modules["lint_role_experiences"] = mod
    spec.loader.exec_module(mod)
    return mod


LINT = _load()

_BODY = """
# Role experience — Test

> Scaffold.

## Three first tasks

1. **Task one** — does a thing.
2. **Task two** — does another.
3. **Task three** — does a third.
"""


def _make_role(tmp_path: Path, status: str, ref) -> Path:
    role = tmp_path / "testrole"
    (role / "prompts").mkdir(parents=True)
    ref_line = "null" if ref is None else ref
    fm = (
        "---\n"
        "role: testrole\n"
        "display_name: Test\n"
        "tagline: t\n"
        "recommended_packs: [core]\n"
        "install_path_hint: x\n"
        f"recruit_session_ref: {ref_line}\n"
        f"status: {status}\n"
        "---\n"
    )
    (role / "index.md").write_text(fm + _BODY, encoding="utf-8")
    (role / "skills.yml").write_text("skills: []\n", encoding="utf-8")
    for i in range(5):
        (role / "prompts" / f"p{i}.md").write_text(
            "---\nname: p\nintent: i\ninputs: x\noutput_shape: y\nskill_hint: z\n---\nbody\n",
            encoding="utf-8",
        )
    return role


def _lint(role: Path) -> list[str]:
    failures: list[str] = []
    LINT.lint_role(role, set(), failures)
    return failures


def test_beta_internal_with_null_ref_passes(tmp_path):
    assert _lint(_make_role(tmp_path, "beta-internal", None)) == []


def test_draft_with_null_ref_passes(tmp_path):
    assert _lint(_make_role(tmp_path, "draft", None)) == []


def test_beta_with_null_ref_fails(tmp_path):
    failures = _lint(_make_role(tmp_path, "beta", None))
    assert any("recruit_session_ref" in f for f in failures)


def test_stable_with_null_ref_fails(tmp_path):
    failures = _lint(_make_role(tmp_path, "stable", None))
    assert any("recruit_session_ref" in f for f in failures)


def test_beta_with_ref_passes(tmp_path):
    role = _make_role(tmp_path, "beta", "agents/recruit-sessions/01-x.md")
    assert _lint(role) == []


def test_unknown_status_fails(tmp_path):
    failures = _lint(_make_role(tmp_path, "gamma", None))
    assert any("not in" in f for f in failures)
