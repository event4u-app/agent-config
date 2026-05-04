"""Feedback-channel regression tests for the universal hook dispatcher.

Asserts the contract in `docs/contracts/hook-architecture-v1.md`
§ "Feedback channel": the dispatcher writes one
`<concern>.json` per concern that ran, plus a `summary.json` rollup,
under `agents/state/.dispatcher/<session_id>/`. This is the surface
that prevents the Council Round 2 "silent success" failure mode where
exit-code reduction hides a `warn` behind a `block`.

Each test runs `dispatch_hook.main()` in-process (after chdir-ing to
a tmp workspace) against a tmp manifest that points at the fixture
concern scripts under `tests/hooks/fixtures/`. Concerns themselves
are real subprocess invocations — the dispatcher contract is end-to-end.
"""
from __future__ import annotations

import json
import os
import sys
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO_ROOT / "scripts" / "hooks"))

import dispatch_hook  # noqa: E402

FIXTURE_DIR = Path("tests/hooks/fixtures")


def _write_manifest(path: Path, mapping: dict[str, list[str]],
                    fail_closed: dict[str, bool] | None = None) -> None:
    """Build a minimal manifest YAML from {concern_name: relative_script}."""
    fail_closed = fail_closed or {}
    lines = ["schema_version: 1", "concerns:"]
    for name, script in mapping.items():
        lines.append(f"  {name}:")
        lines.append(f"    script: {script}")
        lines.append(f"    fail_closed: {'true' if fail_closed.get(name) else 'false'}")
    lines += [
        "platforms:",
        "  augment:",
        f"    stop: [{', '.join(mapping.keys())}]",
    ]
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def _invoke(tmp_path: Path, manifest: Path, session_id: str | None) -> int:
    """Run dispatch_hook.main() with workspace_root = tmp_path."""
    payload = {"session_id": session_id} if session_id else {}
    cwd_before = Path.cwd()
    stdin_before = sys.stdin
    try:
        os.chdir(tmp_path)
        from io import StringIO
        sys.stdin = StringIO(json.dumps(payload))
        return dispatch_hook.main([
            "--platform", "augment",
            "--event", "stop",
            "--manifest", str(manifest),
        ])
    finally:
        sys.stdin = stdin_before
        os.chdir(cwd_before)


def _feedback_dir(workspace: Path, session_id: str) -> Path:
    return workspace / "agents" / "state" / ".dispatcher" / session_id


def test_feedback_dir_created_with_per_concern_files(tmp_path: Path) -> None:
    """One JSON per concern, plus summary.json."""
    manifest = tmp_path / "manifest.yaml"
    _write_manifest(manifest, {
        "allow_one": str(FIXTURE_DIR / "concern_allow.py"),
        "warn_one":  str(FIXTURE_DIR / "concern_warn.py"),
    })
    rc = _invoke(tmp_path, manifest, session_id="sess-001")
    assert rc == dispatch_hook.EXIT_WARN

    fb = _feedback_dir(tmp_path, "sess-001")
    assert fb.is_dir()
    assert (fb / "allow_one.json").is_file()
    assert (fb / "warn_one.json").is_file()
    assert (fb / "summary.json").is_file()

    allow = json.loads((fb / "allow_one.json").read_text())
    warn = json.loads((fb / "warn_one.json").read_text())
    assert allow["decision"] == "allow"
    assert allow["reason"] == "fixture allow"
    assert allow["severity"] == "allow"
    assert allow["exit_code"] == 0
    assert isinstance(allow["duration_ms"], int)
    assert warn["decision"] == "warn"
    assert warn["severity"] == "warn"
    assert warn["exit_code"] == 2


def test_summary_carries_reduced_severity_and_concern_list(tmp_path: Path) -> None:
    """summary.json carries final_exit_code + final_severity + ordered concerns."""
    manifest = tmp_path / "manifest.yaml"
    _write_manifest(manifest, {
        "warn_one":  str(FIXTURE_DIR / "concern_warn.py"),
        "block_one": str(FIXTURE_DIR / "concern_block.py"),
    })
    rc = _invoke(tmp_path, manifest, session_id="sess-002")
    assert rc == dispatch_hook.EXIT_BLOCK  # block dominates warn

    summary = json.loads(
        _feedback_dir(tmp_path, "sess-002").joinpath("summary.json").read_text()
    )
    assert summary["schema_version"] == 1
    assert summary["session_id"] == "sess-002"
    assert summary["platform"] == "augment"
    assert summary["event"] == "stop"
    assert summary["final_exit_code"] == dispatch_hook.EXIT_BLOCK
    assert summary["final_severity"] == "block"
    names = [c["concern"] for c in summary["concerns"]]
    assert names == ["warn_one", "block_one"]
    severities = [c["severity"] for c in summary["concerns"]]
    assert severities == ["warn", "block"]


def test_silent_concern_infers_severity_from_exit_code(tmp_path: Path) -> None:
    """A concern that exits 0 with empty stdout still gets a feedback entry
    whose decision/severity are inferred from the exit code."""
    manifest = tmp_path / "manifest.yaml"
    _write_manifest(manifest, {
        "silent": str(FIXTURE_DIR / "concern_silent.py"),
    })
    rc = _invoke(tmp_path, manifest, session_id="sess-003")
    assert rc == dispatch_hook.EXIT_ALLOW

    entry = json.loads(
        _feedback_dir(tmp_path, "sess-003").joinpath("silent.json").read_text()
    )
    assert entry["decision"] == "allow"
    assert entry["severity"] == "allow"
    assert entry["reason"] is None


def test_session_id_fallback_on_empty_envelope(tmp_path: Path) -> None:
    """No session_id in envelope → dispatcher generates `dispatch-<ts>-<pid>`."""
    manifest = tmp_path / "manifest.yaml"
    _write_manifest(manifest, {
        "allow_one": str(FIXTURE_DIR / "concern_allow.py"),
    })
    rc = _invoke(tmp_path, manifest, session_id=None)
    assert rc == dispatch_hook.EXIT_ALLOW

    dispatcher_dir = tmp_path / "agents" / "state" / ".dispatcher"
    assert dispatcher_dir.is_dir()
    children = [p.name for p in dispatcher_dir.iterdir() if p.is_dir()]
    assert len(children) == 1, f"expected one fallback session dir, got {children}"
    assert children[0].startswith("dispatch-")


def test_session_id_path_traversal_is_neutralised(tmp_path: Path) -> None:
    """`/`, `\\`, and `..` in session_id MUST collapse to `_` so the
    feedback dir cannot escape `agents/state/.dispatcher/`."""
    manifest = tmp_path / "manifest.yaml"
    _write_manifest(manifest, {
        "allow_one": str(FIXTURE_DIR / "concern_allow.py"),
    })
    rc = _invoke(tmp_path, manifest, session_id="../etc/passwd")
    assert rc == dispatch_hook.EXIT_ALLOW
    dispatcher_dir = tmp_path / "agents" / "state" / ".dispatcher"
    children = sorted(p.name for p in dispatcher_dir.iterdir() if p.is_dir())
    assert children == ["__/etc/passwd".replace("/", "_")] or all(
        ".." not in c and "/" not in c for c in children
    )
    # Hard assertion: no parent-escape escapees on disk.
    assert not (tmp_path / "agents" / "state" / "etc").exists()
    assert not (tmp_path / "etc").exists()
