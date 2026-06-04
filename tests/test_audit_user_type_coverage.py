"""Tests for Block D · D3 (audit_user_type_coverage).

User-types are CLI-only (no skill-level ``user-types:`` frontmatter)
so coverage = file inventory + `--user-type=<id>` references found in
docs / commands / skills. Sibling pattern to
``test_audit_persona_coverage.py``.
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "src" / "scripts"))

from skill_tools.audit_user_type_coverage import audit  # noqa: E402


def _user_type(user_types_dir: Path, slug: str) -> None:
    f = user_types_dir / f"{slug}.md"
    f.parent.mkdir(parents=True, exist_ok=True)
    f.write_text(
        "---\n"
        f"id: {slug}\n"
        "kind: user-type\n"
        '---\nbody\n',
        encoding="utf-8",
    )


def _doc(search_root: Path, name: str, body: str) -> None:
    f = search_root / name
    f.parent.mkdir(parents=True, exist_ok=True)
    f.write_text(body, encoding="utf-8")


def test_user_type_with_zero_references_is_never_referenced(tmp_path: Path) -> None:
    user_types, search = tmp_path / "ut", tmp_path / "src"
    search.mkdir()
    _user_type(user_types, "lonely")
    rows = audit(user_types, search)
    lonely = next(r for r in rows if r["user_type"] == "lonely")
    assert lonely["references"] == 0
    assert lonely["status"] == "never-referenced"


def test_user_type_with_one_reference_is_ok(tmp_path: Path) -> None:
    user_types, search = tmp_path / "ut", tmp_path / "src"
    _user_type(user_types, "field-crew")
    _doc(
        search,
        "commands/refine-ticket.md",
        "Use `--user-type=field-crew` to load the field-crew lens.\n",
    )
    rows = audit(user_types, search)
    fc = next(r for r in rows if r["user_type"] == "field-crew")
    assert fc["references"] == 1
    assert fc["status"] == "ok"


def test_orphan_reference_to_missing_user_type(tmp_path: Path) -> None:
    user_types, search = tmp_path / "ut", tmp_path / "src"
    user_types.mkdir()
    _doc(
        search,
        "commands/refine-ticket.md",
        "Example: `--user-type=typo-name` (this id does not exist).\n",
    )
    rows = audit(user_types, search)
    typo = next(r for r in rows if r["user_type"] == "typo-name")
    assert typo["status"] == "orphan"
    assert typo["references"] == 1


def test_references_inside_user_types_dir_are_excluded(tmp_path: Path) -> None:
    """README inside `user-types/` documents the flag in example form —
    must not inflate the reference count of its own ids."""
    user_types = tmp_path / "ut"
    _user_type(user_types, "field-crew")
    # README sits inside the user-types dir AND mentions the flag.
    _doc(
        user_types,
        "README.md",
        "Example: `--user-type=field-crew`\n",
    )
    rows = audit(user_types, user_types)  # search root == user-types dir
    fc = next(r for r in rows if r["user_type"] == "field-crew")
    # The own-dir reference is filtered out; status stays
    # never-referenced because no outside doc cites it.
    assert fc["references"] == 0
    assert fc["status"] == "never-referenced"


def test_multiple_references_counted(tmp_path: Path) -> None:
    user_types, search = tmp_path / "ut", tmp_path / "src"
    _user_type(user_types, "field-crew")
    _doc(search, "a.md", "`--user-type=field-crew`\n")
    _doc(search, "b.md", "`--user-type=field-crew` and `--user-type=field-crew`\n")
    rows = audit(user_types, search)
    fc = next(r for r in rows if r["user_type"] == "field-crew")
    assert fc["references"] == 3
    assert fc["status"] == "ok"


def test_template_subdir_is_skipped(tmp_path: Path) -> None:
    """`_template/user-type.md` is scaffolding, not a real user-type."""
    user_types = tmp_path / "ut"
    (user_types / "_template").mkdir(parents=True)
    (user_types / "_template" / "user-type.md").write_text(
        "---\nid: TEMPLATE\nkind: user-type\n---\n",
        encoding="utf-8",
    )
    rows = audit(user_types, tmp_path / "src")
    slugs = {r["user_type"] for r in rows}
    assert "TEMPLATE" not in slugs


def test_missing_dirs_safe(tmp_path: Path) -> None:
    rows = audit(tmp_path / "nope-ut", tmp_path / "nope-src")
    assert rows == []
