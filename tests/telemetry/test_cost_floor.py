"""Phase 3 Step 3 — cost-floor invariants.

The roadmap promises: when ``telemetry.artifact_engagement.enabled``
is false (or absent), the engine **pays nothing**. No telemetry
modules import, no log file is touched, no settings file is parsed
by core engine code.

These are architectural invariants. Each test runs in a fresh
subprocess so module-import side effects from earlier tests cannot
mask a regression.
"""
from __future__ import annotations

import json
import os
import subprocess
import sys
from pathlib import Path

import pytest


REPO_ROOT = Path(__file__).resolve().parents[2]
SCRIPTS_DIR = REPO_ROOT / ".agent-src.uncompressed" / "templates" / "scripts"


def _run_subprocess(snippet: str, env: dict[str, str] | None = None) -> tuple[int, str, str]:
    """Run ``snippet`` in a subprocess with the engine on PYTHONPATH.

    Returns (returncode, stdout, stderr). Subprocess inherits a clean
    PYTHONPATH limited to the engine source so we can detect
    unexpected telemetry imports without false positives.
    """
    env_full = dict(os.environ)
    env_full["PYTHONPATH"] = str(SCRIPTS_DIR)
    env_full["PYTHONDONTWRITEBYTECODE"] = "1"
    if env:
        env_full.update(env)
    proc = subprocess.run(
        [sys.executable, "-c", snippet],
        capture_output=True,
        text=True,
        env=env_full,
        timeout=15,
    )
    return proc.returncode, proc.stdout, proc.stderr


def test_dispatcher_import_does_not_pull_telemetry() -> None:
    """Importing the dispatcher must not transitively import telemetry."""
    snippet = (
        "import json, sys\n"
        "import work_engine.dispatcher  # noqa: F401\n"
        "leaks = sorted(m for m in sys.modules if m.startswith('telemetry'))\n"
        "print(json.dumps(leaks))\n"
    )
    rc, out, err = _run_subprocess(snippet)
    assert rc == 0, f"subprocess failed: {err}"
    leaks = json.loads(out.strip())
    assert leaks == [], (
        f"work_engine.dispatcher must not import telemetry.* but found: {leaks}"
    )


def test_engine_cli_import_does_not_pull_telemetry() -> None:
    """work_engine.cli is the actual entry point — same invariant."""
    snippet = (
        "import json, sys\n"
        "import work_engine.cli  # noqa: F401\n"
        "leaks = sorted(m for m in sys.modules if m.startswith('telemetry'))\n"
        "print(json.dumps(leaks))\n"
    )
    rc, out, err = _run_subprocess(snippet)
    assert rc == 0, f"subprocess failed: {err}"
    leaks = json.loads(out.strip())
    assert leaks == [], (
        f"work_engine.cli must not import telemetry.* but found: {leaks}"
    )


def test_disabled_record_call_creates_no_files(tmp_path: Path) -> None:
    """End-to-end: with disabled settings, record CLI touches no files."""
    settings = tmp_path / "settings.yml"
    log = tmp_path / "engagement.jsonl"
    settings.write_text(
        "telemetry:\n"
        "  artifact_engagement:\n"
        "    enabled: false\n"
        f"    output:\n      path: {log}\n"
    )
    # Snapshot the directory before the call.
    before = {p.name for p in tmp_path.iterdir()}

    snippet = (
        "import sys\n"
        f"sys.argv = ['telemetry_record', '--settings', {str(settings)!r}, "
        "'--task-id', 'cf-1', '--consulted', 'skills:php-coder']\n"
        "import telemetry_record\n"
        "rc = telemetry_record.main(sys.argv[1:])\n"
        "sys.exit(rc)\n"
    )
    rc, out, err = _run_subprocess(snippet)
    assert rc == 0
    assert out == "" and err == ""

    after = {p.name for p in tmp_path.iterdir()}
    assert after == before, f"disabled record altered the directory: {after - before}"
    assert not log.exists(), "disabled record must not create the log file"


def test_disabled_status_does_not_create_log(tmp_path: Path) -> None:
    """status is read-only even when the log path does not exist."""
    settings = tmp_path / "settings.yml"
    log = tmp_path / "deeper" / "nested" / "engagement.jsonl"  # parent missing
    settings.write_text(
        "telemetry:\n"
        "  artifact_engagement:\n"
        "    enabled: false\n"
        f"    output:\n      path: {log}\n"
    )

    snippet = (
        "import json, sys\n"
        f"sys.argv = ['telemetry_status', '--settings', {str(settings)!r}, "
        "'--format', 'json']\n"
        "import telemetry_status\n"
        "rc = telemetry_status.main(sys.argv[1:])\n"
        "sys.exit(rc)\n"
    )
    rc, out, err = _run_subprocess(snippet)
    assert rc == 0
    report = json.loads(out)
    assert report["enabled"] is False
    assert report["log"]["exists"] is False
    assert not log.exists()
    assert not log.parent.exists(), "status must not create log parent dirs"


@pytest.mark.parametrize(
    "rule_path",
    [
        ".agent-src.uncompressed/rules/artifact-engagement-recording.md",
    ],
)
def test_engagement_rule_is_auto_not_always(rule_path: str) -> None:
    """always-on rules are loaded every conversation; this rule must be auto.

    rule-type-governance: never as ``always`` for opt-in observation paths.
    """
    body = (REPO_ROOT / rule_path).read_text()
    head, _, _ = body.partition("\n---\n")
    # head holds the YAML between the opening '---' and the closing one.
    assert 'type: "auto"' in head, f"{rule_path} must declare type: auto"
    assert "alwaysApply: false" in head, f"{rule_path} must set alwaysApply: false"


def test_engagement_rule_declares_cloud_safe_noop() -> None:
    """The cloud-bundle pipeline must skip this rule on Claude.ai Web."""
    body = (
        REPO_ROOT
        / ".agent-src.uncompressed/rules/artifact-engagement-recording.md"
    ).read_text()
    assert "<!-- cloud_safe: noop -->" in body, (
        "rule must declare cloud_safe: noop so cloud-bundle pipeline skips it"
    )
