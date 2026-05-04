"""Tests for scripts/generate_ownership_matrix.py."""
from __future__ import annotations

import importlib.util
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
SPEC = importlib.util.spec_from_file_location(
    "generate_ownership_matrix",
    REPO_ROOT / "scripts" / "generate_ownership_matrix.py",
)
assert SPEC and SPEC.loader
gom = importlib.util.module_from_spec(SPEC)
sys.modules["generate_ownership_matrix"] = gom
SPEC.loader.exec_module(gom)


def _make_src(tmp_path: Path) -> Path:
    src = tmp_path / ".agent-src.uncompressed"
    for sub in gom.SCAN_DIRS:
        (src / sub).mkdir(parents=True, exist_ok=True)
    return src


def _write(p: Path, content: str) -> None:
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(content, encoding="utf-8")


# --- repo baseline ---------------------------------------------------------

def test_repo_baseline_generates_and_check_passes():
    files, edges, depth3 = gom.build_matrix(REPO_ROOT / ".agent-src.uncompressed")
    assert depth3 == [], "\n".join(depth3)
    # every file has a self-WRITE edge
    self_writes = {e.source for e in edges if e.type == "WRITE"}
    assert self_writes == set(files.keys())
    # at least one load_context edge from the PR #34 rules
    lc = [e for e in edges if e.via == "load_context"]
    assert lc, "expected at least one load_context READ_ONLY edge"


# --- frontmatter parsing ---------------------------------------------------

def test_load_context_edges_emitted(tmp_path):
    src = _make_src(tmp_path)
    _write(src / "rules" / "alpha.md", (
        "---\ntype: \"auto\"\nload_context:\n"
        "  - .agent-src.uncompressed/contexts/foo/bar.md\n---\nbody\n"
    ))
    _write(src / "contexts" / "foo" / "bar.md", "stub\n")
    files, edges, depth3 = gom.build_matrix(src)
    assert depth3 == []
    lc = [e for e in edges if e.via == "load_context"]
    assert len(lc) == 1
    assert lc[0].source == ".agent-src.uncompressed/rules/alpha.md"
    assert lc[0].target == ".agent-src.uncompressed/contexts/foo/bar.md"
    assert lc[0].type == "READ_ONLY"
    assert lc[0].depth == 1


def test_load_context_eager_edges_emitted(tmp_path):
    src = _make_src(tmp_path)
    _write(src / "rules" / "alpha.md", (
        "---\ntype: \"auto\"\nload_context_eager:\n"
        "  - .agent-src.uncompressed/contexts/foo/bar.md\n---\n"
    ))
    _write(src / "contexts" / "foo" / "bar.md", "stub\n")
    _, edges, _ = gom.build_matrix(src)
    eager = [e for e in edges if e.via == "load_context_eager"]
    assert len(eager) == 1


# --- transitive closure ---------------------------------------------------

def test_transitive_depth2_emitted(tmp_path):
    src = _make_src(tmp_path)
    _write(src / "rules" / "r.md", (
        "---\nload_context:\n  - .agent-src.uncompressed/contexts/foo/a.md\n---\n"
    ))
    _write(src / "contexts" / "foo" / "a.md", (
        "---\nload_context:\n  - .agent-src.uncompressed/contexts/foo/b.md\n---\n"
    ))
    _write(src / "contexts" / "foo" / "b.md", "leaf\n")
    files, edges, depth3 = gom.build_matrix(src)
    assert depth3 == []
    transitive = [e for e in edges if e.via == "load_context_transitive"]
    assert len(transitive) == 1
    assert transitive[0].source == ".agent-src.uncompressed/rules/r.md"
    assert transitive[0].target == ".agent-src.uncompressed/contexts/foo/b.md"
    assert transitive[0].depth == 2


def test_depth3_chain_aborts(tmp_path):
    src = _make_src(tmp_path)
    _write(src / "rules" / "r.md", (
        "---\nload_context:\n  - .agent-src.uncompressed/contexts/foo/a.md\n---\n"
    ))
    _write(src / "contexts" / "foo" / "a.md", (
        "---\nload_context:\n  - .agent-src.uncompressed/contexts/foo/b.md\n---\n"
    ))
    _write(src / "contexts" / "foo" / "b.md", (
        "---\nload_context:\n  - .agent-src.uncompressed/contexts/foo/c.md\n---\n"
    ))
    _write(src / "contexts" / "foo" / "c.md", "leaf\n")
    _, _, depth3 = gom.build_matrix(src)
    assert depth3, "expected a depth-3 chain to be flagged"
    assert any("a.md" in c and "b.md" in c and "c.md" in c for c in depth3)


# --- body links -----------------------------------------------------------

def test_body_link_edges(tmp_path):
    src = _make_src(tmp_path)
    _write(src / "rules" / "r.md", (
        "---\ntype: \"auto\"\n---\nSee [other](../skills/s.md) for more.\n"
    ))
    _write(src / "skills" / "s.md", "---\n---\nbody\n")
    _, edges, _ = gom.build_matrix(src)
    body = [e for e in edges if e.via == "body_link"]
    assert len(body) == 1
    assert body[0].target == ".agent-src.uncompressed/skills/s.md"


def test_body_link_to_unknown_target_dropped(tmp_path):
    src = _make_src(tmp_path)
    _write(src / "rules" / "r.md", (
        "---\n---\nSee [outside](../../README.md) and [external](https://example.com/x.md).\n"
    ))
    _, edges, _ = gom.build_matrix(src)
    assert [e for e in edges if e.via == "body_link"] == []


# --- self-WRITE invariant -------------------------------------------------

def test_every_file_has_self_write(tmp_path):
    src = _make_src(tmp_path)
    _write(src / "rules" / "r.md", "---\n---\nx\n")
    _write(src / "skills" / "s.md", "---\n---\ny\n")
    files, edges, _ = gom.build_matrix(src)
    self_writes = {(e.source, e.target) for e in edges if e.type == "WRITE"}
    for rel in files:
        assert (rel, rel) in self_writes
