"""Tests for scripts/_cli/cmd_upgrade.py — global self-update command.

The global-mutating steps (npm i -g, agent-config global) are never run:
a fake runner records the planned commands instead.
"""
from __future__ import annotations

import io
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from scripts._cli import cmd_upgrade  # noqa: E402


class _Recorder:
    def __init__(self, rc: int = 0) -> None:
        self.calls: list[list[str]] = []
        self.rc = rc

    def __call__(self, cmd: list[str]) -> int:
        self.calls.append(cmd)
        return self.rc


def test_upgrade_runs_npm_then_global() -> None:
    rec = _Recorder()
    out, err = io.StringIO(), io.StringIO()
    rc = cmd_upgrade.main([], runner=rec, fetcher=lambda: "5.4.0",
                          installed="5.3.0", out=out, err=err)
    assert rc == 0
    assert rec.calls[0] == ["npm", "install", "-g", "@event4u/agent-config@latest"]
    assert rec.calls[1][-1] == "global"  # second step refreshes the global install


def test_upgrade_dry_run_executes_nothing() -> None:
    rec = _Recorder()
    out = io.StringIO()
    rc = cmd_upgrade.main(["--dry-run"], runner=rec, fetcher=lambda: "5.4.0",
                          installed="5.3.0", out=out)
    assert rc == 0
    assert rec.calls == []
    assert "dry run" in out.getvalue()


def test_upgrade_check_reports_only() -> None:
    rec = _Recorder()
    out = io.StringIO()
    rc = cmd_upgrade.main(["--check"], runner=rec, fetcher=lambda: "5.4.0",
                          installed="5.3.0", out=out)
    assert rc == 0
    assert rec.calls == []
    assert "5.4.0" in out.getvalue()


def test_upgrade_check_up_to_date() -> None:
    out = io.StringIO()
    rc = cmd_upgrade.main(["--check"], runner=_Recorder(),
                          fetcher=lambda: "5.3.0", installed="5.3.0", out=out)
    assert rc == 0
    assert "up to date" in out.getvalue()


def test_upgrade_aborts_on_failed_step() -> None:
    rec = _Recorder(rc=1)
    out, err = io.StringIO(), io.StringIO()
    rc = cmd_upgrade.main([], runner=rec, fetcher=lambda: "5.4.0",
                          installed="5.3.0", out=out, err=err)
    assert rc == 1
    assert len(rec.calls) == 1  # stopped after the first (failing) step
    assert "step failed" in err.getvalue()
