"""Tests for scripts/check_context_paths.py."""
from __future__ import annotations

import importlib.util
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
SPEC = importlib.util.spec_from_file_location(
    "check_context_paths",
    REPO_ROOT / "scripts" / "check_context_paths.py",
)
assert SPEC and SPEC.loader
ccp = importlib.util.module_from_spec(SPEC)
sys.modules["check_context_paths"] = ccp
SPEC.loader.exec_module(ccp)


def _make_fake_root(tmp_path: Path) -> Path:
    """Build a minimal fake repo with the four scan dirs."""
    for d in (
        ".agent-src.uncompressed/contexts",
        ".agent-src.uncompressed/rules",
        ".agent-src.uncompressed/skills",
        ".agent-src.uncompressed/commands",
    ):
        (tmp_path / d).mkdir(parents=True, exist_ok=True)
    return tmp_path


def _ctx(root: Path, rel: str, body: str = "stub") -> Path:
    p = root / ".agent-src.uncompressed" / "contexts" / rel
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(body, encoding="utf-8")
    return p


def _rule(root: Path, name: str, body: str) -> Path:
    p = root / ".agent-src.uncompressed" / "rules" / f"{name}.md"
    p.write_text(body, encoding="utf-8")
    return p


# --- repo baseline (regression guard) --------------------------------------

def test_repo_baseline_is_clean():
    """The shipped repo must not have context-path violations."""
    violations = ccp.scan(REPO_ROOT)
    assert violations == [], "\n".join(f"{v.kind}: {v.file}" for v in violations)


# --- happy path: locked sub-tree, referenced ------------------------------

def test_subtree_file_referenced_is_clean(tmp_path):
    root = _make_fake_root(tmp_path)
    _ctx(root, "judges/persona-voice-rubric.md")
    _rule(root, "demo", "see contexts/judges/persona-voice-rubric.md\n")
    assert ccp.scan(root) == []


# --- path violations -------------------------------------------------------

def test_root_file_not_grandfathered_fails(tmp_path):
    root = _make_fake_root(tmp_path)
    _ctx(root, "rogue.md")
    _rule(root, "demo", "loads contexts/rogue.md\n")  # referenced, but path bad
    kinds = {v.kind for v in ccp.scan(root)}
    assert "root-not-grandfathered" in kinds


def test_out_of_tree_subtree_fails(tmp_path):
    root = _make_fake_root(tmp_path)
    _ctx(root, "made-up/foo.md")
    _rule(root, "demo", "loads contexts/made-up/foo.md\n")
    kinds = {v.kind for v in ccp.scan(root)}
    assert "out-of-tree" in kinds


def test_grandfathered_root_file_is_allowed(tmp_path):
    root = _make_fake_root(tmp_path)
    _ctx(root, "model-recommendations.md")
    _rule(root, "demo", "see contexts/model-recommendations.md\n")
    kinds = {v.kind for v in ccp.scan(root)}
    assert "root-not-grandfathered" not in kinds
    assert "out-of-tree" not in kinds


# --- collisions ------------------------------------------------------------

def test_basename_collision_fails(tmp_path):
    root = _make_fake_root(tmp_path)
    _ctx(root, "judges/shared.md")
    _ctx(root, "analysis/shared.md")
    _rule(root, "demo", "uses contexts/judges/shared.md and contexts/analysis/shared.md\n")
    kinds = [v.kind for v in ccp.scan(root)]
    assert kinds.count("collision") == 2


# --- orphans ---------------------------------------------------------------

def test_unreferenced_context_is_orphan(tmp_path):
    root = _make_fake_root(tmp_path)
    _ctx(root, "judges/lonely.md")
    kinds = {v.kind for v in ccp.scan(root)}
    assert "orphan" in kinds


def test_self_reference_does_not_save_orphan(tmp_path):
    root = _make_fake_root(tmp_path)
    _ctx(root, "judges/selfref.md", body="link: contexts/judges/selfref.md\n")
    kinds = {v.kind for v in ccp.scan(root)}
    assert "orphan" in kinds


def test_reference_from_another_context_satisfies(tmp_path):
    root = _make_fake_root(tmp_path)
    _ctx(root, "judges/a.md", body="see contexts/judges/b.md\n")
    _ctx(root, "judges/b.md")
    _rule(root, "demo", "loads contexts/judges/a.md\n")
    assert ccp.scan(root) == []


def test_full_path_reference_form_satisfies(tmp_path):
    root = _make_fake_root(tmp_path)
    _ctx(root, "judges/foo.md")
    _rule(root, "demo", "load_context:\n  - .agent-src.uncompressed/contexts/judges/foo.md\n")
    assert ccp.scan(root) == []


def test_short_path_reference_form_satisfies(tmp_path):
    root = _make_fake_root(tmp_path)
    _ctx(root, "judges/foo.md")
    _rule(root, "demo", "loads judges/foo.md\n")
    assert ccp.scan(root) == []
