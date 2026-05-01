"""Tests for `scripts/build_cloud_bundle.py`."""

from __future__ import annotations

import sys
import zipfile
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO_ROOT / "scripts"))

import build_cloud_bundle as bcb  # noqa: E402


def _make_skill(root: Path, name: str, *, desc: str, body: str = "") -> Path:
    sd = root / name
    sd.mkdir(parents=True, exist_ok=True)
    body = body or f"# {name}\n\nUse this skill.\n"
    (sd / "SKILL.md").write_text(
        f'---\nname: {name}\ndescription: "{desc}"\n---\n\n{body}',
        encoding="utf-8",
    )
    return sd


# ---------- parse_skill_md ------------------------------------------------


def test_parse_skill_md_happy_path() -> None:
    text = '---\nname: foo\ndescription: "Use when foo."\n---\n\nbody\n'
    meta, body = bcb.parse_skill_md(text)
    assert meta == {"name": "foo", "description": "Use when foo."}
    assert body.strip() == "body"


def test_parse_skill_md_missing_frontmatter() -> None:
    with pytest.raises(ValueError, match="frontmatter"):
        bcb.parse_skill_md("# heading only\n")


def test_parse_skill_md_missing_description() -> None:
    text = "---\nname: foo\n---\n\nbody\n"
    with pytest.raises(ValueError, match="description"):
        bcb.parse_skill_md(text)


# ---------- enforce_description_budget -----------------------------------


def test_budget_under_limit_unchanged() -> None:
    warnings: list[str] = []
    out, truncated = bcb.enforce_description_budget(
        "short desc", strict=False, warnings=warnings
    )
    assert out == "short desc"
    assert truncated is False
    assert warnings == []


def test_budget_truncates_at_word_boundary() -> None:
    long = "Use when " + ("aaaa bbbb " * 30)  # ~310 chars
    warnings: list[str] = []
    out, truncated = bcb.enforce_description_budget(
        long, strict=False, warnings=warnings
    )
    assert truncated is True
    assert out.endswith("…")
    assert len(out) < bcb.DESC_LIMIT_WEB
    assert " " in out  # word boundary preserved
    assert warnings and "truncated" in warnings[0]


def test_budget_strict_mode_raises() -> None:
    long = "x" * 250
    with pytest.raises(SystemExit, match="strict mode"):
        bcb.enforce_description_budget(long, strict=True, warnings=[])


def test_budget_hard_spec_limit_always_raises() -> None:
    monster = "x" * 1100
    with pytest.raises(SystemExit, match="spec limit"):
        bcb.enforce_description_budget(monster, strict=False, warnings=[])


# ---------- swap_paths / render_skill_md ---------------------------------


def test_swap_paths_replaces_package_internal_only() -> None:
    body = (
        "Edit `.agent-src.uncompressed/skills/foo/SKILL.md` and "
        "see (`.agent-src/rules/x.md`). The `agents/roadmaps/` dir "
        "stays intact."
    )
    out = bcb.swap_paths(body)
    assert "<package-source>/skills/foo/SKILL.md" in out
    assert "<package-source>/rules/x.md" in out
    assert ".agent-src" not in out
    assert "`agents/roadmaps/`" in out  # untouched


def test_render_with_swap_adds_sandbox_note() -> None:
    rendered = bcb.render_skill_md(
        "foo", "Use when foo.", "# foo\nbody\n", swap=True
    )
    assert "name: foo" in rendered
    assert "Cloud sandbox." in rendered
    assert rendered.startswith("---\n")


def test_render_without_swap_omits_sandbox_note() -> None:
    rendered = bcb.render_skill_md(
        "foo", "Use when foo.", "# foo\nbody\n", swap=False
    )
    assert "Cloud sandbox." not in rendered
    assert "name: foo" in rendered


# ---------- build_skill_zip round-trip -----------------------------------


def test_build_skill_zip_round_trip(tmp_path: Path) -> None:
    src = _make_skill(tmp_path / "src", "demo", desc="Use when demo.")
    (src / "references").mkdir()
    (src / "references" / "extra.md").write_text("ref body\n", encoding="utf-8")
    out = tmp_path / "out"
    result = bcb.build_skill_zip(src, out, "T1", strict=False, dry_run=False)
    assert result.status == "ok"
    zip_path = out / "demo.zip"
    assert zip_path.is_file()
    with zipfile.ZipFile(zip_path) as zf:
        names = zf.namelist()
        assert "demo/SKILL.md" in names
        assert "demo/references/extra.md" in names
        skill_md = zf.read("demo/SKILL.md").decode()
        assert "Cloud sandbox." not in skill_md  # T1 → no swap
        assert "name: demo" in skill_md


def test_build_skill_zip_t2_adds_sandbox_note(tmp_path: Path) -> None:
    src = _make_skill(
        tmp_path / "src", "auth", desc="Use when auth.",
        body="See `.agent-src/skills/x/SKILL.md` for context.\n",
    )
    out = tmp_path / "out"
    bcb.build_skill_zip(src, out, "T2", strict=False, dry_run=False)
    with zipfile.ZipFile(out / "auth.zip") as zf:
        skill_md = zf.read("auth/SKILL.md").decode()
    assert "Cloud sandbox." in skill_md
    assert "<package-source>/skills/x/SKILL.md" in skill_md
    assert "`.agent-src/skills/x/" not in skill_md  # swapped


# ---------- build_all gating ---------------------------------------------


def test_build_all_skips_t3h_and_explicit_request_raises(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch,
) -> None:
    src_root = tmp_path / "skills"
    _make_skill(src_root, "safe", desc="Use when safe.")
    _make_skill(src_root, "blocked", desc="Use when blocked.")

    monkeypatch.setattr(bcb, "SOURCE_SKILLS", src_root)
    monkeypatch.setattr(
        bcb,
        "load_tier_map",
        lambda: {
            "safe": {"tier": "T1", "cloud_marker": None, "raw_tier": "T1"},
            "blocked": {"tier": "T3-H", "cloud_marker": None, "raw_tier": "T3-H"},
        },
    )

    built, skipped = bcb.build_all(
        tmp_path / "out", only=None, strict=False, dry_run=False
    )
    assert [r.skill for r in built] == ["safe"]
    assert [r.skill for r in skipped] == ["blocked"]
    assert skipped[0].tier == "T3-H"

    with pytest.raises(SystemExit, match="T3-H"):
        bcb.build_all(
            tmp_path / "out", only="blocked", strict=False, dry_run=False
        )


# ---------- regression: T3-H must stay 0 in shipped sources --------------


def test_no_t3h_in_uncompressed_source() -> None:
    """The shipped uncompressed sources must never reintroduce a T3-H tier.

    Every previously hard-blocked artefact must declare a `cloud_safe: noop`
    or `cloud_safe: degrade` marker so the audit downgrades it.
    """
    sys.path.insert(0, str(REPO_ROOT / "scripts"))
    import audit_cloud_compatibility as audit  # noqa: E402

    summary = audit.summarize(audit.scan())
    assert summary["by_tier"].get("T3-H", 0) == 0, (
        f"T3-H artefacts found in source: {summary['by_tier']}"
    )
