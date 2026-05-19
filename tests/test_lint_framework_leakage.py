"""Tests for ``scripts/lint_framework_leakage.py``.

Covers the framework-neutrality linter contract from
``.agent-src.uncompressed/rules/framework-neutrality-in-generic-skills.md``:
detection of PHP/Laravel/etc. patterns in generic skills/rules/commands,
the carve-out filename exemption, allowlist semantics, and the
auto-cross-stack heuristic.
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT / "scripts"))

import lint_framework_leakage as mod  # noqa: E402


def _make_tree(tmp_path: Path, files: dict[str, str]) -> Path:
    """Create a mock .agent-src.uncompressed/ subtree under tmp_path."""
    for rel, body in files.items():
        p = tmp_path / rel
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(body, encoding="utf-8")
    return tmp_path


def _run(monkeypatch, tmp_path: Path, *paths: str, extra: list[str] | None = None):
    """Invoke linter main() with REPO_ROOT pointed at tmp_path."""
    monkeypatch.setattr(mod, "REPO_ROOT", tmp_path)
    monkeypatch.setattr(mod, "ALLOWLIST_FILE", tmp_path / "_allow.json")
    argv = ["--paths", *paths]
    if extra:
        argv = extra + argv
    return mod.main(argv)


def _capture(capsys):
    cap = capsys.readouterr()
    return cap.out, cap.err


def test_clean_file_passes(tmp_path, monkeypatch, capsys):
    _make_tree(tmp_path, {
        "skills/code-refactoring/SKILL.md": "# Code Refactoring\n\nGeneric advice.\n",
    })
    rc = _run(monkeypatch, tmp_path, "skills")
    assert rc == 0
    out, _ = _capture(capsys)
    assert "0 hits across 0 files" in out


def test_formrequest_in_generic_fails(tmp_path, monkeypatch, capsys):
    _make_tree(tmp_path, {
        "skills/api-endpoint/SKILL.md": (
            "# API Endpoint\n\nUse a FormRequest for validation.\n"
        ),
    })
    rc = _run(monkeypatch, tmp_path, "skills")
    assert rc == 1
    out, _ = _capture(capsys)
    assert "FormRequest" in out
    assert "1 hits across 1 files" in out


def test_formrequest_in_carve_out_passes(tmp_path, monkeypatch, capsys):
    _make_tree(tmp_path, {
        "skills/laravel-validation/SKILL.md": (
            "# Laravel Validation\n\nUse a FormRequest for validation.\n"
        ),
    })
    rc = _run(monkeypatch, tmp_path, "skills")
    assert rc == 0


def test_phpstan_mandate_fails(tmp_path, monkeypatch, capsys):
    _make_tree(tmp_path, {
        "rules/verify-before-complete.md": (
            "# Verify\n\nAlways run PHPStan before claiming done.\n"
        ),
    })
    rc = _run(monkeypatch, tmp_path, "rules")
    assert rc == 1


def test_allowlisted_line_passes(tmp_path, monkeypatch, capsys):
    _make_tree(tmp_path, {
        "skills/refine-prompt/SKILL.md": (
            "# Refine\n\nLine 2\nUses FormRequest here.\n"
        ),
        "_allow.json": json.dumps({
            "version": 1,
            "entries": [{
                "file": "skills/refine-prompt/SKILL.md",
                "lines": [4],
                "reason": "documented",
            }],
        }),
    })
    rc = _run(monkeypatch, tmp_path, "skills")
    assert rc == 0
    out, _ = _capture(capsys)
    assert "1 allowlisted" in out


def test_allowlist_whole_file_passes(tmp_path, monkeypatch):
    _make_tree(tmp_path, {
        "commands/optimize/augmentignore.md": (
            "# x\n\nFormRequest line\nPHPStan line\n"
        ),
        "_allow.json": json.dumps({
            "version": 1,
            "entries": [{
                "file": "commands/optimize/augmentignore.md",
                "lines": "*",
                "reason": "per-stack rules",
            }],
        }),
    })
    rc = _run(monkeypatch, tmp_path, "commands")
    assert rc == 0


def test_json_output_shape(tmp_path, monkeypatch, capsys):
    _make_tree(tmp_path, {
        "skills/foo/SKILL.md": "# Foo\n\nUses FormRequest here.\n",
    })
    rc = _run(monkeypatch, tmp_path, "skills", extra=["--json"])
    assert rc == 1
    out, _ = _capture(capsys)
    data = json.loads(out)
    assert data["version"] == 1
    assert isinstance(data["hits"], list)
    assert data["summary"]["total_hits"] >= 1
    assert "files" in data["summary"]
    assert "allowlisted" in data["summary"]


def test_quiet_mode_only_prints_summary(tmp_path, monkeypatch, capsys):
    _make_tree(tmp_path, {
        "skills/foo/SKILL.md": "# Foo\n\nUses FormRequest here.\n",
    })
    rc = _run(monkeypatch, tmp_path, "skills", extra=["--quiet"])
    assert rc == 1
    out, _ = _capture(capsys)
    # Strip leading/trailing whitespace and verify only the summary remains.
    stripped = out.strip()
    assert re.match(
        r"^\d+ hits across \d+ files \(\d+ allowlisted\)$", stripped
    ), f"unexpected quiet output: {stripped!r}"


def test_multistack_table_with_2_ecosystems_passes(tmp_path, monkeypatch):
    _make_tree(tmp_path, {
        "skills/onboard/SKILL.md": (
            "# Onboard\n\n"
            "Detect stack:\n"
            "- composer.json → PHP project\n"
            "- package.json → Node project\n"
        ),
    })
    rc = _run(monkeypatch, tmp_path, "skills")
    assert rc == 0


def test_unknown_path_argument_errors(tmp_path, monkeypatch):
    _make_tree(tmp_path, {"skills/x/SKILL.md": "# x\n"})
    with pytest.raises(SystemExit) as exc:
        _run(monkeypatch, tmp_path, "does-not-exist")
    assert exc.value.code == 2
