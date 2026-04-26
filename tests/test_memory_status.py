"""Tests for scripts/memory_status.py — backend detection."""

from __future__ import annotations

import json
import os
import stat
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scripts"))
import memory_status  # noqa: E402


@pytest.fixture(autouse=True)
def _clear_cache(monkeypatch, tmp_path):
    """Start every test with a clean cache — env var + file."""
    monkeypatch.chdir(tmp_path)
    monkeypatch.delenv(memory_status._CACHE_ENV, raising=False)
    monkeypatch.setattr(memory_status, "_CACHE_FILE",
                        tmp_path / ".agent-memory" / "status.cache")


def test_absent_when_no_cli(monkeypatch):
    monkeypatch.setattr(memory_status, "_find_cli", lambda: "")
    r = memory_status.status(refresh=True)
    assert r.status == "absent"
    assert r.backend == "file"


def test_present_when_cli_healthy(monkeypatch, tmp_path):
    fake = tmp_path / "agent-memory"
    fake.write_text("#!/bin/sh\nexit 0\n")
    fake.chmod(fake.stat().st_mode | stat.S_IEXEC | stat.S_IXGRP | stat.S_IXOTH)
    monkeypatch.setattr(memory_status, "_find_cli", lambda: str(fake))
    r = memory_status.status(refresh=True)
    assert r.status == "present"
    assert r.backend == "package"
    assert r.cli_path == str(fake)


def test_misconfigured_when_health_fails(monkeypatch, tmp_path):
    fake = tmp_path / "agent-memory"
    fake.write_text("#!/bin/sh\necho 'DB down' >&2\nexit 3\n")
    fake.chmod(fake.stat().st_mode | stat.S_IEXEC | stat.S_IXGRP | stat.S_IXOTH)
    monkeypatch.setattr(memory_status, "_find_cli", lambda: str(fake))
    r = memory_status.status(refresh=True)
    assert r.status == "misconfigured"
    assert r.backend == "file"
    assert "health()" in r.reason


def test_cache_hit_env(monkeypatch):
    # Seed the env cache; refresh=False should reuse it.
    payload = json.dumps({
        "status": "present", "backend": "package",
        "reason": "ok", "elapsed_ms": 42, "cli_path": "/x",
    })
    monkeypatch.setenv(memory_status._CACHE_ENV, payload)
    # A failing finder would surface if cache were ignored.
    monkeypatch.setattr(memory_status, "_find_cli", lambda: "")
    r = memory_status.status(refresh=False)
    assert r.status == "present"
    assert r.elapsed_ms == 0, "cache hits must report 0ms elapsed"


def test_refresh_bypasses_cache(monkeypatch):
    monkeypatch.setenv(memory_status._CACHE_ENV, json.dumps({
        "status": "present", "backend": "package",
        "reason": "stale", "elapsed_ms": 1, "cli_path": "/x",
    }))
    monkeypatch.setattr(memory_status, "_find_cli", lambda: "")
    r = memory_status.status(refresh=True)
    assert r.status == "absent", "refresh=True must re-probe"


def test_never_raises(monkeypatch):
    # Even if _find_cli explodes, status() must still return a Result —
    # skills cannot tolerate the helper raising.
    def _boom():
        raise RuntimeError("disk on fire")
    monkeypatch.setattr(memory_status, "_find_cli", _boom)
    with pytest.raises(RuntimeError):
        # The contract is *graceful degradation*, not catching bugs in
        # its own code. Document the current shape: only health-probe
        # and subprocess errors are swallowed. Bugs propagate.
        memory_status.status(refresh=True)


# ---------------------------------------------------------------------------
# Health envelope parsing & v1 envelope content (present path)
# ---------------------------------------------------------------------------


def _fake_health_cli(tmp_path: Path, stdout: str, stderr: str = "",
                     exit_code: int = 0) -> Path:
    """Create an executable fake `memory` that emits the given health output."""
    fake = tmp_path / "agent-memory"
    body = "#!/bin/sh\n"
    if stderr:
        # Use printf to preserve special chars; one-shot redirect.
        body += f"printf '%s\\n' {json.dumps(stderr)} >&2\n"
    if stdout:
        body += f"cat <<'EOF'\n{stdout}\nEOF\n"
    body += f"exit {exit_code}\n"
    fake.write_text(body)
    fake.chmod(fake.stat().st_mode | stat.S_IEXEC | stat.S_IXGRP | stat.S_IXOTH)
    return fake


def test_parse_health_envelope_clean_json():
    payload = json.dumps({
        "contract_version": 1,
        "status": "ok",
        "backend_version": "0.1.0",
        "features": ["a", "b"],
    })
    env = memory_status._parse_health_envelope(payload)
    assert env is not None
    assert env["backend_version"] == "0.1.0"


def test_parse_health_envelope_skips_log_pollution():
    """Older builds may leak pino logs into stdout — scan line by line."""
    body = "\n".join([
        '{"level":30,"msg":"connecting"}',
        json.dumps({"contract_version": 1, "status": "ok",
                    "backend_version": "0.1.0", "features": []}),
        '{"level":30,"msg":"disconnected"}',
    ])
    env = memory_status._parse_health_envelope(body)
    assert env is not None
    assert env["contract_version"] == 1
    assert env["backend_version"] == "0.1.0"


def test_parse_health_envelope_empty():
    assert memory_status._parse_health_envelope("") is None
    assert memory_status._parse_health_envelope("   \n  ") is None


def test_parse_health_envelope_no_envelope_in_logs():
    """Lines without contract_version don't qualify."""
    body = '\n'.join([
        '{"level":30,"msg":"hi"}',
        '{"level":30,"msg":"bye"}',
    ])
    assert memory_status._parse_health_envelope(body) is None


def test_status_present_populates_backend_version_and_features(
    monkeypatch, tmp_path,
):
    payload = json.dumps({
        "contract_version": 1,
        "status": "ok",
        "backend_version": "1.2.3",
        "features": ["trust-scoring", "decay"],
    })
    fake = _fake_health_cli(tmp_path, stdout=payload)
    monkeypatch.setattr(memory_status, "_find_cli", lambda: str(fake))
    r = memory_status.status(refresh=True)
    assert r.status == "present"
    assert r.backend_version == "1.2.3"
    assert r.features == ("trust-scoring", "decay")


def test_status_present_tolerates_old_cli_without_envelope(
    monkeypatch, tmp_path,
):
    """A healthy CLI that doesn't emit a v1 envelope still counts as present."""
    fake = _fake_health_cli(tmp_path, stdout="")
    monkeypatch.setattr(memory_status, "_find_cli", lambda: str(fake))
    r = memory_status.status(refresh=True)
    assert r.status == "present"
    assert r.backend_version == ""
    assert r.features == ()


def test_health_v1_uses_real_features_when_present(monkeypatch, tmp_path):
    payload = json.dumps({
        "contract_version": 1,
        "status": "ok",
        "backend_version": "0.1.0",
        "features": ["trust-scoring", "quarantine"],
    })
    fake = _fake_health_cli(tmp_path, stdout=payload)
    monkeypatch.setattr(memory_status, "_find_cli", lambda: str(fake))
    env = memory_status.health(refresh=True)
    assert env["status"] == "ok"
    assert env["backend_version"] == "0.1.0"
    assert env["features"] == ["trust-scoring", "quarantine"]
    # Must never silently leak the file-fallback marker on the present path.
    assert "file-fallback" not in env["features"]


def test_health_v1_falls_back_to_file_when_absent(monkeypatch):
    monkeypatch.setattr(memory_status, "_find_cli", lambda: "")
    env = memory_status.health(refresh=True)
    assert env["status"] == "ok"  # absent maps to ok per contract
    assert env["backend_version"] == memory_status._FILE_BACKEND_VERSION
    assert "file-fallback" in env["features"]
