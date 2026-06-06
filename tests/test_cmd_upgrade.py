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


_STALE_WRAPPER = "#!/usr/bin/env bash\n# old fallback-less wrapper\nexit 127\n"


def test_upgrade_refreshes_stale_project_wrapper(tmp_path: Path) -> None:
    """Run from a consumer root with an old wrapper → it gets re-stamped."""
    (tmp_path / "package.json").write_text('{"name": "some-app"}')
    wrapper = tmp_path / "agent-config"
    wrapper.write_text(_STALE_WRAPPER)
    out = io.StringIO()
    rc = cmd_upgrade.main([], runner=_Recorder(), fetcher=lambda: "5.4.0",
                          installed="5.3.0", project_root=tmp_path, out=out)
    assert rc == 0
    refreshed = wrapper.read_text(encoding="utf-8")
    assert "globally-installed" in refreshed  # canonical template content
    assert "npx --yes" in refreshed           # global/npx fallback present
    assert "old fallback-less wrapper" not in refreshed  # stale body replaced
    assert "refreshed stale project wrapper" in out.getvalue()


def test_upgrade_does_not_create_wrapper_where_none_exists(tmp_path: Path) -> None:
    """No existing wrapper → upgrade never creates one (install-only action)."""
    (tmp_path / "package.json").write_text('{"name": "some-app"}')
    out = io.StringIO()
    rc = cmd_upgrade.main([], runner=_Recorder(), fetcher=lambda: "5.4.0",
                          installed="5.3.0", project_root=tmp_path, out=out)
    assert rc == 0
    assert not (tmp_path / "agent-config").exists()


def test_upgrade_leaves_source_repo_wrapper_untouched(tmp_path: Path) -> None:
    """The agent-config checkout itself is never re-stamped by upgrade."""
    (tmp_path / "dist/agent-src").mkdir(parents=True)  # source-repo signal
    wrapper = tmp_path / "agent-config"
    wrapper.write_text(_STALE_WRAPPER)
    out = io.StringIO()
    rc = cmd_upgrade.main([], runner=_Recorder(), fetcher=lambda: "5.4.0",
                          installed="5.3.0", project_root=tmp_path, out=out)
    assert rc == 0
    assert wrapper.read_text(encoding="utf-8") == _STALE_WRAPPER
