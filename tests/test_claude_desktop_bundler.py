"""Tests for ``scripts/_lib/claude_desktop_bundler.py`` (Phase 4).

Covers the ``build_skill_bundles()`` contract:
- ZIP generation for one synthetic skill folder
- SKILL.md + sibling files included
- ``__pycache__`` and ``.git*`` excluded
- idempotency via the ``.sha256`` sidecar
- ``force=True`` rewrites a bundle even when content unchanged
- skills missing ``SKILL.md`` are skipped
"""
from __future__ import annotations

import sys
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT / "src" / "scripts"))

from scripts._lib import claude_desktop_bundler  # noqa: E402


def _make_skill(
    package_root: Path,
    name: str,
    *,
    skill_md: str = "# skill\n",
    extras: dict[str, str] | None = None,
    junk: dict[str, str] | None = None,
) -> Path:
    """Create a fake skill folder under ``<package_root>/dist/agent-src/skills/``."""
    skill_dir = package_root / "dist/agent-src" / "skills" / name
    skill_dir.mkdir(parents=True)
    (skill_dir / "SKILL.md").write_text(skill_md, encoding="utf-8")
    for rel, content in (extras or {}).items():
        target = skill_dir / rel
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(content, encoding="utf-8")
    for rel, content in (junk or {}).items():
        target = skill_dir / rel
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(content, encoding="utf-8")
    return skill_dir


def test_bundle_generated_for_single_skill(tmp_path: Path) -> None:
    pkg = tmp_path / "pkg"
    _make_skill(pkg, "demo-skill", skill_md="# demo\n", extras={"helper.py": "x = 1\n"})
    dest = tmp_path / "bundles"

    written = claude_desktop_bundler.build_skill_bundles(pkg, dest)

    zip_path = dest / "demo-skill.zip"
    sha_path = dest / "demo-skill.sha256"
    assert written == [zip_path]
    assert zip_path.exists()
    assert sha_path.exists()
    with zipfile.ZipFile(zip_path) as zf:
        names = sorted(zf.namelist())
    assert names == ["SKILL.md", "helper.py"]


def test_excludes_pycache_and_dotgit(tmp_path: Path) -> None:
    pkg = tmp_path / "pkg"
    _make_skill(
        pkg,
        "noisy-skill",
        extras={"keep.md": "ok\n"},
        junk={
            "__pycache__/cache.pyc": "binary",
            "__pycache__/nested.txt": "trash",
            ".gitignore": "*.log\n",
            "stale.pyc": "compiled",
        },
    )
    dest = tmp_path / "bundles"

    claude_desktop_bundler.build_skill_bundles(pkg, dest)

    with zipfile.ZipFile(dest / "noisy-skill.zip") as zf:
        names = sorted(zf.namelist())
    assert names == ["SKILL.md", "keep.md"]


def test_idempotent_second_call_writes_nothing(tmp_path: Path) -> None:
    pkg = tmp_path / "pkg"
    _make_skill(pkg, "stable-skill")
    dest = tmp_path / "bundles"

    first = claude_desktop_bundler.build_skill_bundles(pkg, dest)
    zip_mtime_first = (dest / "stable-skill.zip").stat().st_mtime_ns

    second = claude_desktop_bundler.build_skill_bundles(pkg, dest)
    zip_mtime_second = (dest / "stable-skill.zip").stat().st_mtime_ns

    assert len(first) == 1
    assert second == []
    assert zip_mtime_first == zip_mtime_second


def test_content_change_rewrites_bundle(tmp_path: Path) -> None:
    pkg = tmp_path / "pkg"
    skill_dir = _make_skill(pkg, "evolving")
    dest = tmp_path / "bundles"
    claude_desktop_bundler.build_skill_bundles(pkg, dest)

    (skill_dir / "SKILL.md").write_text("# v2\n", encoding="utf-8")
    written = claude_desktop_bundler.build_skill_bundles(pkg, dest)

    assert written == [dest / "evolving.zip"]
    with zipfile.ZipFile(dest / "evolving.zip") as zf:
        assert zf.read("SKILL.md").decode("utf-8") == "# v2\n"


def test_force_rewrites_unchanged_bundle(tmp_path: Path) -> None:
    pkg = tmp_path / "pkg"
    _make_skill(pkg, "force-me")
    dest = tmp_path / "bundles"
    claude_desktop_bundler.build_skill_bundles(pkg, dest)

    written = claude_desktop_bundler.build_skill_bundles(pkg, dest, force=True)
    assert written == [dest / "force-me.zip"]


def test_skill_without_skill_md_is_skipped(tmp_path: Path) -> None:
    pkg = tmp_path / "pkg"
    not_a_skill = pkg / "dist/agent-src" / "skills" / "orphan"
    not_a_skill.mkdir(parents=True)
    (not_a_skill / "notes.md").write_text("no SKILL.md here\n", encoding="utf-8")
    dest = tmp_path / "bundles"

    written = claude_desktop_bundler.build_skill_bundles(pkg, dest)

    assert written == []
    assert not (dest / "orphan.zip").exists()


def test_missing_skills_dir_returns_empty(tmp_path: Path) -> None:
    pkg = tmp_path / "empty-pkg"
    pkg.mkdir()
    dest = tmp_path / "bundles"

    written = claude_desktop_bundler.build_skill_bundles(pkg, dest)
    assert written == []
    assert not dest.exists() or not any(dest.iterdir())


def test_curation_restricts_to_named_skills(tmp_path: Path) -> None:
    pkg = tmp_path / "pkg"
    _make_skill(pkg, "alpha")
    _make_skill(pkg, "beta")
    _make_skill(pkg, "gamma")
    dest = tmp_path / "bundles"

    written = claude_desktop_bundler.build_skill_bundles(
        pkg, dest, curation=["alpha", "gamma"]
    )

    bundle_names = sorted(p.name for p in written)
    assert bundle_names == ["alpha.zip", "gamma.zip"]
    assert not (dest / "beta.zip").exists()


def _make_command(
    package_root: Path,
    rel_path: str,
    *,
    body: str = "# command\n",
) -> Path:
    """Create a fake command file under ``<package_root>/dist/agent-src/commands/``."""
    target = package_root / "dist/agent-src" / "commands" / rel_path
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(body, encoding="utf-8")
    return target


def test_command_bundle_generated_for_top_level_command(tmp_path: Path) -> None:
    pkg = tmp_path / "pkg"
    _make_command(pkg, "commit.md", body="# /commit\n\nDo the commit thing.\n")
    dest = tmp_path / "bundles"

    written = claude_desktop_bundler.build_command_bundles(pkg, dest)

    zip_path = dest / "commit.zip"
    assert written == [zip_path]
    assert zip_path.exists()
    assert (dest / "commit.sha256").exists()
    with zipfile.ZipFile(zip_path) as zf:
        names = sorted(zf.namelist())
        assert names == ["SKILL.md"]
        assert zf.read("SKILL.md").decode("utf-8") == "# /commit\n\nDo the commit thing.\n"


def test_nested_command_flattens_slug(tmp_path: Path) -> None:
    pkg = tmp_path / "pkg"
    _make_command(pkg, "council/default.md", body="# council default\n")
    _make_command(pkg, "council/pr.md", body="# council pr\n")
    dest = tmp_path / "bundles"

    written = claude_desktop_bundler.build_command_bundles(pkg, dest)

    names = sorted(p.name for p in written)
    assert names == ["council-default.zip", "council-pr.zip"]


def test_command_skips_cluster_agents_md(tmp_path: Path) -> None:
    pkg = tmp_path / "pkg"
    _make_command(pkg, "council/AGENTS.md", body="# cluster doc\n")
    _make_command(pkg, "council/default.md", body="# default\n")
    dest = tmp_path / "bundles"

    written = claude_desktop_bundler.build_command_bundles(pkg, dest)

    assert [p.name for p in written] == ["council-default.zip"]
    assert not (dest / "council-AGENTS.zip").exists()


def test_command_skipped_when_skill_with_same_name_exists(tmp_path: Path) -> None:
    pkg = tmp_path / "pkg"
    _make_skill(pkg, "condense", skill_md="# real skill\n")
    _make_command(pkg, "condense.md", body="# command shadow\n")
    _make_command(pkg, "research.md", body="# research\n")
    dest = tmp_path / "bundles"

    written = claude_desktop_bundler.build_command_bundles(pkg, dest)

    names = sorted(p.name for p in written)
    assert names == ["research.zip"]
    assert not (dest / "condense.zip").exists()


def test_command_bundle_idempotent_second_call(tmp_path: Path) -> None:
    pkg = tmp_path / "pkg"
    _make_command(pkg, "stable.md")
    dest = tmp_path / "bundles"

    first = claude_desktop_bundler.build_command_bundles(pkg, dest)
    mtime_first = (dest / "stable.zip").stat().st_mtime_ns
    second = claude_desktop_bundler.build_command_bundles(pkg, dest)
    mtime_second = (dest / "stable.zip").stat().st_mtime_ns

    assert len(first) == 1
    assert second == []
    assert mtime_first == mtime_second


def test_command_force_rewrites_unchanged_bundle(tmp_path: Path) -> None:
    pkg = tmp_path / "pkg"
    _make_command(pkg, "force-me.md")
    dest = tmp_path / "bundles"
    claude_desktop_bundler.build_command_bundles(pkg, dest)

    written = claude_desktop_bundler.build_command_bundles(pkg, dest, force=True)
    assert written == [dest / "force-me.zip"]


def test_command_content_change_rewrites_bundle(tmp_path: Path) -> None:
    pkg = tmp_path / "pkg"
    source = _make_command(pkg, "evolving.md", body="# v1\n")
    dest = tmp_path / "bundles"
    claude_desktop_bundler.build_command_bundles(pkg, dest)

    source.write_text("# v2\n", encoding="utf-8")
    written = claude_desktop_bundler.build_command_bundles(pkg, dest)

    assert written == [dest / "evolving.zip"]
    with zipfile.ZipFile(dest / "evolving.zip") as zf:
        assert zf.read("SKILL.md").decode("utf-8") == "# v2\n"


def test_command_missing_dir_returns_empty(tmp_path: Path) -> None:
    pkg = tmp_path / "empty-pkg"
    pkg.mkdir()
    dest = tmp_path / "bundles"

    written = claude_desktop_bundler.build_command_bundles(pkg, dest)
    assert written == []
    assert not dest.exists() or not any(dest.iterdir())


def test_command_curation_restricts_to_named_slugs(tmp_path: Path) -> None:
    pkg = tmp_path / "pkg"
    _make_command(pkg, "alpha.md")
    _make_command(pkg, "beta.md")
    _make_command(pkg, "gamma.md")
    dest = tmp_path / "bundles"

    written = claude_desktop_bundler.build_command_bundles(
        pkg, dest, curation=["alpha", "gamma"]
    )

    names = sorted(p.name for p in written)
    assert names == ["alpha.zip", "gamma.zip"]
    assert not (dest / "beta.zip").exists()
