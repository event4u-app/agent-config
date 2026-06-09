"""Tests for the AI-video smoke-trace harness (src/scripts/ai-video/smoke-trace.sh).

CI-for-the-CI: prove the dry-run harness runs without network/spend and writes a
well-formed trace (valid JSON, expected fields, phase records, artifact-path
validated). Live mode is the maintainer's Hard-Floor step and is not exercised here.
"""

from __future__ import annotations

import json
import shutil
import subprocess
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent
HARNESS = ROOT / "src" / "scripts" / "ai-video" / "smoke-trace.sh"

pytestmark = pytest.mark.skipif(
    not (shutil.which("jq") and shutil.which("bash")),
    reason="smoke-trace harness needs bash + jq",
)


def _run(tmp_path: Path, provider: str):
    res = subprocess.run(
        ["bash", str(HARNESS), "--provider", provider, "--out", str(tmp_path)],
        capture_output=True, text=True, cwd=ROOT,
    )
    traces = list(tmp_path.glob(f"{provider}-dry-run-*.json"))
    assert traces, f"no trace written for {provider}: {res.stderr}"
    return res, json.loads(traces[0].read_text())


@pytest.mark.parametrize("provider", ["gemini-veo", "fal", "replicate", "sora"])
def test_dry_run_writes_valid_trace(tmp_path, provider):
    res, trace = _run(tmp_path, provider)
    assert res.returncode == 0, res.stderr
    assert trace["provider"] == provider
    assert trace["mode"] == "dry-run"
    assert trace["success"] is True
    # the v2 fetch/dry-run stdout shape was captured + the path passed the trust boundary
    assert trace["video_path"]
    assert trace["artifact_path_validated"] == "true"
    assert trace["cost_estimate"] not in (None, "")
    names = [p["name"] for p in trace["phases"]]
    assert "dry-run" in names


def test_unknown_provider_errors(tmp_path):
    res = subprocess.run(
        ["bash", str(HARNESS), "--provider", "no-such-adapter", "--out", str(tmp_path)],
        capture_output=True, text=True, cwd=ROOT,
    )
    assert res.returncode != 0
    assert "no adapter" in (res.stderr + res.stdout).lower()
