"""Tests for scripts/lint_one_off_age.py.

Covers the TTL policy from docs/contracts/one-off-script-lifecycle.md:
naming, month directory shape, age windows, frontmatter extension,
180-day cap, and exit-code behaviour.
"""
from __future__ import annotations

import sys
from datetime import date
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT / "scripts"))

import lint_one_off_age as mod  # noqa: E402


def _make_root(tmp_path: Path) -> Path:
    """Create the scripts/_one_off/ skeleton in a tmp root."""
    (tmp_path / "scripts" / "_one_off").mkdir(parents=True)
    return tmp_path


def _write_one_off(root: Path, month: str, slug: str, body: str = "") -> Path:
    d = root / "scripts" / "_one_off" / month
    d.mkdir(parents=True, exist_ok=True)
    p = d / f"_one_off_{slug}.py"
    p.write_text(body or "# one-off\n", encoding="utf-8")
    return p


def test_no_one_off_dir_returns_empty(tmp_path: Path):
    assert mod.scan(tmp_path) == []


def test_fresh_script_is_silent(tmp_path: Path):
    root = _make_root(tmp_path)
    _write_one_off(root, "2026-04", "fresh")
    findings = mod.scan(root, today=date(2026, 4, 15))
    assert findings == []


def test_warn_window(tmp_path: Path):
    root = _make_root(tmp_path)
    _write_one_off(root, "2026-01", "softwin")
    # 2026-01-01 + 75d = 2026-03-17 → in (60, 90] window
    findings = mod.scan(root, today=date(2026, 3, 17))
    assert len(findings) == 1
    assert findings[0].severity == "warn"
    assert findings[0].age_days == 75


def test_hard_fail_past_90_days(tmp_path: Path):
    root = _make_root(tmp_path)
    _write_one_off(root, "2026-01", "stale")
    # 2026-01-01 + 100d → past hard limit
    findings = mod.scan(root, today=date(2026, 4, 11))
    assert len(findings) == 1
    assert findings[0].severity == "fail"


def test_extension_silences_warning(tmp_path: Path):
    root = _make_root(tmp_path)
    body = (
        '"""\n---\nttl_extended_until: 2026-05-01\n'
        'ttl_reason: blocked on PROJ-1\n---\n"""\n'
    )
    _write_one_off(root, "2026-01", "ext", body=body)
    # 75d age, but extension valid until 2026-05-01 (120d from anchor)
    findings = mod.scan(root, today=date(2026, 3, 17))
    assert findings == []


def test_extension_beyond_180_day_cap_fails(tmp_path: Path):
    root = _make_root(tmp_path)
    body = '"""\n---\nttl_extended_until: 2026-08-01\n---\n"""\n'
    # 2026-01-01 to 2026-08-01 = 212 days > 180 cap
    _write_one_off(root, "2026-01", "tooFarExt".lower(), body=body)
    findings = mod.scan(root, today=date(2026, 3, 17))
    assert len(findings) == 1
    assert findings[0].severity == "fail"
    assert "180-day cap" in findings[0].reason


def test_extension_expired_falls_back_to_age(tmp_path: Path):
    root = _make_root(tmp_path)
    body = '"""\n---\nttl_extended_until: 2026-02-15\n---\n"""\n'
    _write_one_off(root, "2026-01", "expired", body=body)
    # extension expired (today > 2026-02-15), age 100d → hard fail
    findings = mod.scan(root, today=date(2026, 4, 11))
    assert len(findings) == 1
    assert findings[0].severity == "fail"


def test_invalid_month_dir_flagged(tmp_path: Path):
    root = _make_root(tmp_path)
    bad = root / "scripts" / "_one_off" / "not-a-month"
    bad.mkdir()
    findings = mod.scan(root)
    assert len(findings) == 1
    assert findings[0].severity == "fail"
    assert "invalid month directory" in findings[0].reason


def test_bad_filename_flagged(tmp_path: Path):
    root = _make_root(tmp_path)
    d = root / "scripts" / "_one_off" / "2026-01"
    d.mkdir(parents=True)
    (d / "not_prefixed.py").write_text("# x\n", encoding="utf-8")
    findings = mod.scan(root)
    assert len(findings) == 1
    assert "filename does not match" in findings[0].reason


def test_readme_in_month_dir_ignored(tmp_path: Path):
    root = _make_root(tmp_path)
    d = root / "scripts" / "_one_off" / "2026-01"
    d.mkdir(parents=True)
    (d / "README.md").write_text("# notes\n", encoding="utf-8")
    findings = mod.scan(root)
    assert findings == []


def test_format_text_clean():
    assert "No one-off-script" in mod.format_text([])


def test_format_text_groups_by_severity():
    findings = [
        mod.Finding("a.py", 100, "fail", "too old"),
        mod.Finding("b.py", 70, "warn", "soft"),
    ]
    out = mod.format_text(findings)
    assert "1 one-off script(s) past hard limit" in out
    assert "1 one-off script(s) in soft window" in out


def test_main_exit_zero_on_clean(tmp_path: Path, monkeypatch):
    monkeypatch.setattr(sys, "argv", ["lint_one_off_age", "--root", str(tmp_path)])
    rc = mod.main()
    assert rc == 0


def test_main_exit_one_on_fail(tmp_path: Path, monkeypatch):
    root = _make_root(tmp_path)
    _write_one_off(root, "2020-01", "ancient")
    monkeypatch.setattr(sys, "argv", ["lint_one_off_age", "--root", str(root)])
    rc = mod.main()
    assert rc == 1
