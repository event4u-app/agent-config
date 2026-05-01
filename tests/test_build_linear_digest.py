"""Tests for `scripts/build_linear_digest.py`.

Phase 3 Step 4 deliverable for road-to-universal-distribution.md.
Round-trips a fixture rule set, verifies no broken `[link](path)`
survives the link-normaliser, and asserts every digest stays under
the per-field byte budget.
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO_ROOT / "scripts"))

import build_linear_digest as bld  # noqa: E402

# Linear does not publish a hard cap on agent-guidance fields. 100 KB is
# the conservative ceiling we ship; tighten in CI via --max-bytes once
# the actual cap is researched (Open Question #1 in the roadmap).
LINEAR_PER_FIELD_BUDGET = 100_000


# ---------- pure transforms ----------------------------------------------


def test_strip_frontmatter_removes_yaml_block() -> None:
    text = '---\ntype: "always"\nalwaysApply: true\n---\n\n# Heading\nbody\n'
    out = bld.strip_frontmatter(text)
    assert out.startswith("# Heading")
    assert "alwaysApply" not in out


def test_demote_h1_only_first_heading() -> None:
    text = "# Title\n\nbody\n\n# Other H1 should stay\n"
    out = bld.demote_h1(text)
    assert out.startswith("## Title")
    # Only the first H1 is demoted; subsequent H1s are unchanged.
    assert "\n# Other H1 should stay" in out


def test_normalize_links_strips_internal_paths() -> None:
    text = "See [scope-control](../rules/scope-control.md) and [docs](docs/x.md)."
    out = bld.normalize_links(text)
    assert out == "See scope-control and docs."


def test_normalize_links_preserves_external_urls() -> None:
    text = "Read [the spec](https://example.com/spec) and [local](./x.md)."
    out = bld.normalize_links(text)
    assert "[the spec](https://example.com/spec)" in out
    assert "[local](./x.md)" not in out
    assert "local" in out


def test_strip_section_removes_named_h2() -> None:
    text = (
        "# Title\n\n"
        "## Keep this\n\nBody A\n\n"
        "## Drop this\n\nBody B\n\n"
        "## Keep that\n\nBody C\n"
    )
    out, found = bld.strip_section(text, "Drop this")
    assert found is True
    assert "Body B" not in out
    assert "Body A" in out and "Body C" in out


def test_strip_section_returns_false_on_unknown_title() -> None:
    text = "## Real section\n\nbody\n"
    out, found = bld.strip_section(text, "Nonexistent")
    assert found is False
    assert out == text


# ---------- end-to-end build ---------------------------------------------


def test_default_build_emits_three_files(tmp_path: Path) -> None:
    rc = bld.main(["--out-dir", str(tmp_path)])
    assert rc == 0
    for layer in ("workspace", "team", "personal"):
        f = tmp_path / f"{layer}.md"
        assert f.is_file(), f"{layer}.md missing"
        assert f.stat().st_size > 0


def test_workspace_digest_under_linear_field_budget(tmp_path: Path) -> None:
    rc = bld.main(["--out-dir", str(tmp_path),
                   "--max-bytes", str(LINEAR_PER_FIELD_BUDGET)])
    assert rc == 0, "workspace digest exceeded the per-field byte budget"


def test_team_and_personal_far_under_budget(tmp_path: Path) -> None:
    bld.main(["--out-dir", str(tmp_path)])
    team_size = (tmp_path / "team.md").stat().st_size
    personal_size = (tmp_path / "personal.md").stat().st_size
    # Sanity bounds — these layers should stay tiny by design.
    assert team_size < 30_000, f"team digest ballooned to {team_size}"
    assert personal_size < 5_000, f"personal stub ballooned to {personal_size}"


def test_no_internal_markdown_links_survive(tmp_path: Path) -> None:
    bld.main(["--out-dir", str(tmp_path)])
    text = (tmp_path / "workspace.md").read_text(encoding="utf-8")
    # Match [text](anything-not-http(s)) — the path-link form the digest
    # MUST sanitise. External http(s) links are still allowed.
    pattern = re.compile(r"\[[^\]]+\]\((?!https?://)[^)]+\)")
    leaks = pattern.findall(text)
    assert leaks == [], f"internal links survived sanitisation: {leaks[:3]}"


def test_strict_missing_flags_drift(tmp_path: Path, monkeypatch) -> None:
    """If a strip_sections title doesn't match, --strict-missing exits 4."""
    fake_workspace = [
        bld.RuleEntry("ask-when-uncertain", "degraded",
                      strip_sections=["NoSuchSectionEverExists"]),
    ]
    monkeypatch.setattr(bld, "WORKSPACE", fake_workspace)
    monkeypatch.setattr(bld, "TEAM", [])
    monkeypatch.setattr(bld, "PERSONAL", [])
    rc = bld.main(["--out-dir", str(tmp_path), "--strict-missing"])
    assert rc == 4, "drift in strip_sections must trigger non-zero exit"


def test_missing_rule_file_returns_three(tmp_path: Path, monkeypatch) -> None:
    monkeypatch.setattr(bld, "WORKSPACE",
                        [bld.RuleEntry("does-not-exist")])
    monkeypatch.setattr(bld, "TEAM", [])
    monkeypatch.setattr(bld, "PERSONAL", [])
    rc = bld.main(["--out-dir", str(tmp_path)])
    assert rc == 3
