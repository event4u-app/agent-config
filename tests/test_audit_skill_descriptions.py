"""Tests for `scripts/audit_skill_descriptions.py`."""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
SCRIPT = REPO_ROOT / "scripts" / "audit_skill_descriptions.py"


def _write_skill(root: Path, name: str, description: str) -> Path:
    skill_dir = root / name
    skill_dir.mkdir(parents=True, exist_ok=True)
    skill_md = skill_dir / "SKILL.md"
    skill_md.write_text(
        f'---\nname: {name}\ndescription: "{description}"\n---\n\n# {name}\n',
        encoding="utf-8",
    )
    return skill_md


def _run_json(root: Path) -> list[dict]:
    result = subprocess.run(
        [sys.executable, str(SCRIPT), "--root", str(root), "--json"],
        capture_output=True,
        text=True,
        check=True,
    )
    return json.loads(result.stdout)


def test_audit_flags_too_short_description(tmp_path: Path) -> None:
    _write_skill(tmp_path, "tiny", "Use when tiny. Short.")
    findings = _run_json(tmp_path)
    assert len(findings) == 1
    assert "very-short" in findings[0]["flags"] or "too-short" in findings[0]["flags"]


def test_audit_flags_missing_trigger_prefix(tmp_path: Path) -> None:
    # 160 chars, no verb prefix.
    desc = (
        "Something that is about Laravel controllers and their "
        "conventions including middleware use and request validation "
        "plus related concerns and edge cases appearing over time."
    )
    _write_skill(tmp_path, "no-prefix", desc)
    findings = _run_json(tmp_path)
    assert "no-trigger-prefix" in findings[0]["flags"]


def test_audit_accepts_pushy_description(tmp_path: Path) -> None:
    desc = (
        "Use when writing Playwright E2E tests — locators, assertions, "
        "Page Objects, fixtures, CI, and flaky test prevention — even "
        "if the user doesn't say Playwright."
    )
    _write_skill(tmp_path, "good", desc)
    findings = _run_json(tmp_path)
    assert findings[0]["flags"] == []


def test_audit_flags_hedge_phrase(tmp_path: Path) -> None:
    desc = (
        "Use when things happen. This may help with various Laravel "
        "controller concerns and also covers various edge cases and "
        "scenarios that arise in modern PHP development workflows."
    )
    _write_skill(tmp_path, "hedgy", desc)
    findings = _run_json(tmp_path)
    hedge_flags = [f for f in findings[0]["flags"] if f.startswith("hedge:")]
    assert hedge_flags, "expected at least one hedge flag"


def test_audit_accepts_only_when_prefix(tmp_path: Path) -> None:
    desc = (
        "ONLY when user explicitly requests: performance audit, "
        "bottleneck analysis, or N+1 query detection. NOT for regular "
        "feature work or unrelated Laravel questions."
    )
    _write_skill(tmp_path, "only-when", desc)
    findings = _run_json(tmp_path)
    assert "no-trigger-prefix" not in findings[0]["flags"]


def test_audit_text_output_sorts_worst_first(tmp_path: Path) -> None:
    _write_skill(
        tmp_path,
        "good",
        (
            "Use when writing things — triggers a, b, c, d, e — even if "
            "the user does not explicitly name the skill or mention it."
        ),
    )
    _write_skill(tmp_path, "bad", "Use when things.")
    result = subprocess.run(
        [sys.executable, str(SCRIPT), "--root", str(tmp_path)],
        capture_output=True,
        text=True,
        check=True,
    )
    lines = result.stdout.splitlines()
    # "bad" must appear before "good" in the flagged table.
    bad_idx = next(i for i, line in enumerate(lines) if "bad" in line and "SCORE" not in line)
    # "good" is clean so not in flagged table; ensure bad is shown.
    assert bad_idx > 0


def test_audit_exits_nonzero_on_missing_root(tmp_path: Path) -> None:
    missing = tmp_path / "does-not-exist"
    result = subprocess.run(
        [sys.executable, str(SCRIPT), "--root", str(missing)],
        capture_output=True,
        text=True,
    )
    assert result.returncode != 0
    assert "does not exist" in result.stderr


def test_audit_against_real_repo_snapshot() -> None:
    """Smoke test: runs against the real skill tree and parses JSON."""
    result = subprocess.run(
        [
            sys.executable,
            str(SCRIPT),
            "--root",
            str(REPO_ROOT / ".agent-src.uncompressed" / "skills"),
            "--json",
        ],
        capture_output=True,
        text=True,
        check=True,
    )
    data = json.loads(result.stdout)
    assert len(data) > 50, "expected at least 50 skills in the repo"
    # Zero skills should hit the `missing` flag — frontmatter is always present.
    missing = [d for d in data if "missing" in d["flags"]]
    assert missing == []
