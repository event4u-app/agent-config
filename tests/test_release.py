"""Tests for scripts/release.py — pure helpers only.

The orchestration functions (`execute`, `preflight`) are intentionally
not covered here: they mutate git and the network. They're exercised by
`--dry-run` locally and by the actual release workflow in production.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scripts"))
import release as rel  # noqa: E402


# ─── version math ─────────────────────────────────────────────────────────────


class TestBumpVersion:
    @pytest.mark.parametrize(
        ("current", "kind", "expected"),
        [
            ("1.11.0", "major", "2.0.0"),
            ("1.11.0", "minor", "1.12.0"),
            ("1.11.0", "patch", "1.11.1"),
            ("0.0.1", "major", "1.0.0"),
            ("9.99.99", "patch", "9.99.100"),
        ],
    )
    def test_bumps(self, current: str, kind: str, expected: str) -> None:
        assert rel.bump_version(current, kind) == expected

    def test_invalid_version_exits(self) -> None:
        with pytest.raises(SystemExit):
            rel.bump_version("not-a-version", "patch")

    def test_invalid_kind_exits(self) -> None:
        with pytest.raises(SystemExit):
            rel.bump_version("1.0.0", "mega")


# ─── commit classification ────────────────────────────────────────────────────


def _c(subject: str, breaking: bool = False) -> rel.Commit:
    """Build a Commit directly for classification tests."""
    m = rel.CONVENTIONAL_RE.match(subject)
    if m:
        return rel.Commit(
            sha="a" * 40,
            type=m.group("type"),
            scope=m.group("scope"),
            subject=m.group("subject"),
            breaking=breaking or bool(m.group("bang")),
        )
    return rel.Commit(sha="a" * 40, type="other", scope=None, subject=subject, breaking=breaking)


class TestInferBump:
    def test_breaking_wins(self) -> None:
        assert rel.infer_bump([_c("feat!: drop node 18")]) == "major"

    def test_breaking_in_footer(self) -> None:
        c = rel.Commit("a" * 40, "feat", None, "big thing", breaking=True)
        assert rel.infer_bump([c]) == "major"

    def test_feat_is_minor(self) -> None:
        assert rel.infer_bump([_c("feat: add X"), _c("fix: y")]) == "minor"

    def test_only_fix_is_patch(self) -> None:
        assert rel.infer_bump([_c("fix: typo"), _c("docs: readme")]) == "patch"

    def test_empty_is_patch(self) -> None:
        assert rel.infer_bump([]) == "patch"


class TestResolveBump:
    def test_override_wins_over_commits(self) -> None:
        commits = [_c("feat!: breaking")]
        assert rel.resolve_bump("patch", commits) == "patch"

    def test_no_override_uses_infer(self) -> None:
        commits = [rel.Commit("a" * 40, "feat", None, "add X", breaking=False)]
        assert rel.resolve_bump(None, commits) == "minor"

    def test_no_override_empty_commits_is_patch(self) -> None:
        assert rel.resolve_bump(None, []) == "patch"


# ─── changelog rendering ──────────────────────────────────────────────────────


class TestRenderChangelog:
    def test_groups_by_type_in_order(self) -> None:
        commits = [
            _c("feat(api): add endpoint"),
            _c("fix(core): null check"),
            _c("chore: bump deps"),
        ]
        full, body = rel.render_changelog_entry("1.2.0", "1.1.0", commits, "2026-04-24")
        assert "## [1.2.0](https://github.com/" in full
        assert "...1.2.0) (2026-04-24)" in full
        # Features comes before Bug Fixes comes before Chores.
        feat = body.index("### Features")
        fix = body.index("### Bug Fixes")
        chore = body.index("### Chores")
        assert feat < fix < chore

    def test_breaking_heading_first(self) -> None:
        c = rel.Commit("a" * 40, "feat", "api", "drop old route", breaking=True)
        _, body = rel.render_changelog_entry("2.0.0", "1.11.0", [c], "2026-04-24")
        assert body.index("### BREAKING CHANGES") < body.index("### Features") \
            if "### Features" in body else body.startswith("### BREAKING CHANGES")

    def test_scope_formatting(self) -> None:
        c = _c("feat(api): add endpoint")
        _, body = rel.render_changelog_entry("1.2.0", "1.1.0", [c], "2026-04-24")
        assert "* **api:** add endpoint" in body

    def test_no_scope_formatting(self) -> None:
        c = _c("feat: plain subject")
        _, body = rel.render_changelog_entry("1.2.0", "1.1.0", [c], "2026-04-24")
        assert "* plain subject" in body

    def test_unknown_type_goes_to_other(self) -> None:
        c = rel.Commit("a" * 40, "weird", None, "something", False)
        _, body = rel.render_changelog_entry("1.2.0", "1.1.0", [c], "2026-04-24")
        assert "### Other" in body
        assert "* something" in body

    def test_no_prev_tag_uses_plain_heading(self) -> None:
        c = _c("feat: first")
        full, _ = rel.render_changelog_entry("0.1.0", None, [c], "2026-04-24")
        assert full.startswith("## 0.1.0 (2026-04-24)")
        assert "compare/" not in full.splitlines()[0]


# ─── file mutations ───────────────────────────────────────────────────────────


class TestPrependChangelog:
    def test_inserts_above_latest_heading(self, tmp_path: Path) -> None:
        cl = tmp_path / "CHANGELOG.md"
        cl.write_text(
            "# Changelog\n\nIntro.\n\n"
            "## [1.0.0](x) (2026-01-01)\n\n### Features\n\n* older\n",
            encoding="utf-8",
        )
        rel.prepend_changelog(cl, "## [1.1.0](y) (2026-02-02)\n\n### Features\n\n* new\n")
        out = cl.read_text(encoding="utf-8")
        assert out.index("1.1.0") < out.index("1.0.0")
        assert "# Changelog" in out  # intro preserved


    def test_appends_when_no_prior_heading(self, tmp_path: Path) -> None:
        cl = tmp_path / "CHANGELOG.md"
        cl.write_text("# Changelog\n\nNothing yet.\n", encoding="utf-8")
        rel.prepend_changelog(cl, "## [1.0.0](x) (2026-02-02)\n\n* first\n")
        out = cl.read_text(encoding="utf-8")
        assert "# Changelog" in out
        assert "1.0.0" in out


class TestSetPackageVersion:
    def test_updates_version_and_preserves_keys(self, tmp_path: Path) -> None:
        p = tmp_path / "package.json"
        p.write_text(
            json.dumps({"name": "x", "version": "1.0.0", "description": "y"}, indent=4)
            + "\n",
            encoding="utf-8",
        )
        rel.set_package_version(p, "1.1.0")
        data = json.loads(p.read_text(encoding="utf-8"))
        assert data["version"] == "1.1.0"
        assert data["name"] == "x"
        assert data["description"] == "y"
        assert p.read_text(encoding="utf-8").endswith("\n")


class TestSetMarketplaceVersion:
    def test_updates_metadata_version(self, tmp_path: Path) -> None:
        p = tmp_path / "marketplace.json"
        p.write_text(
            json.dumps(
                {"name": "x", "metadata": {"version": "1.0.0", "desc": "y"}}, indent=2
            )
            + "\n",
            encoding="utf-8",
        )
        rel.set_marketplace_version(p, "1.1.0")
        data = json.loads(p.read_text(encoding="utf-8"))
        assert data["metadata"]["version"] == "1.1.0"
        assert data["metadata"]["desc"] == "y"

    def test_creates_metadata_if_missing(self, tmp_path: Path) -> None:
        p = tmp_path / "marketplace.json"
        p.write_text(json.dumps({"name": "x"}, indent=2) + "\n", encoding="utf-8")
        rel.set_marketplace_version(p, "1.1.0")
        data = json.loads(p.read_text(encoding="utf-8"))
        assert data["metadata"]["version"] == "1.1.0"


class TestParseVersion:
    def test_valid(self) -> None:
        assert rel.parse_version("1.2.3") == (1, 2, 3)

    @pytest.mark.parametrize("bad", ["1.2", "v1.2.3", "1.2.3-rc", "1.2.3.4", ""])
    def test_rejects(self, bad: str) -> None:
        with pytest.raises(SystemExit):
            rel.parse_version(bad)
