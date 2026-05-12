"""Tests for ``scripts/_cli/cmd_export.py``.

Phase 1.7 of road-to-global-first-install.md — covers the export
contract (Phase 1.5):

- ``--list`` enumerates every registered tool.
- Missing ``--tool`` / ``--output`` exit with code 2 (argument errors).
- Unknown tool id exits 2 with a directive error.
- Write succeeds and rounds-trips content to the chosen output path.
- Idempotent re-run (matching content) exits 0 without rewriting.
- Drift refusal (existing file, content differs) exits 1 without
  ``--force``; ``--force`` overrides and writes the new content.
"""
from __future__ import annotations

import io
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from scripts._cli import cmd_export  # noqa: E402


def _run(argv, cwd: Path):
    out = io.StringIO()
    err = io.StringIO()
    # cmd_export resolves --output relative to cwd via Path.cwd(); we
    # mimic that by chdir-ing during the call.
    import os

    prev = os.getcwd()
    os.chdir(cwd)
    try:
        rc = cmd_export.main(argv, out=out, err=err)
    finally:
        os.chdir(prev)
    return rc, out.getvalue(), err.getvalue()


def test_list_prints_every_tool(tmp_path: Path) -> None:
    rc, out, _ = _run(["--list"], tmp_path)
    assert rc == 0
    for tool_id in cmd_export.EXPORT_REGISTRY:
        assert tool_id in out


def test_missing_tool_exits_2(tmp_path: Path) -> None:
    rc, _, err = _run(["--output", str(tmp_path / "x.md")], tmp_path)
    assert rc == 2
    assert "--tool is required" in err


def test_missing_output_exits_2(tmp_path: Path) -> None:
    rc, _, err = _run(["--tool", "agents-md"], tmp_path)
    assert rc == 2
    assert "--output is required" in err


def test_unknown_tool_exits_2(tmp_path: Path) -> None:
    rc, _, err = _run(
        ["--tool", "nope", "--output", str(tmp_path / "x.md")], tmp_path
    )
    assert rc == 2
    assert "unknown tool" in err


def test_export_writes_content(tmp_path: Path) -> None:
    out_path = tmp_path / "AGENTS.md"
    rc, out, _ = _run(["--tool", "agents-md", "--output", str(out_path)], tmp_path)
    assert rc == 0
    assert out_path.exists()
    assert out_path.read_text(encoding="utf-8").strip() != ""
    assert "exported to" in out


def test_export_idempotent_on_matching_content(tmp_path: Path) -> None:
    out_path = tmp_path / "AGENTS.md"
    _run(["--tool", "agents-md", "--output", str(out_path)], tmp_path)
    rc, out, _ = _run(["--tool", "agents-md", "--output", str(out_path)], tmp_path)
    assert rc == 0
    assert "already exported" in out


def test_export_refuses_drift_without_force(tmp_path: Path) -> None:
    out_path = tmp_path / "AGENTS.md"
    out_path.write_text("hand-edited\n", encoding="utf-8")
    rc, _, err = _run(
        ["--tool", "agents-md", "--output", str(out_path)], tmp_path
    )
    assert rc == 1
    assert "refusing to overwrite" in err
    # untouched
    assert out_path.read_text(encoding="utf-8") == "hand-edited\n"


def test_export_force_overrides_drift(tmp_path: Path) -> None:
    out_path = tmp_path / "AGENTS.md"
    out_path.write_text("hand-edited\n", encoding="utf-8")
    rc, _, _ = _run(
        ["--tool", "agents-md", "--output", str(out_path), "--force"], tmp_path
    )
    assert rc == 0
    assert out_path.read_text(encoding="utf-8") != "hand-edited\n"
