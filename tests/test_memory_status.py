"""Tests for scripts/memory_status.py — file-backed status.

Memory is entirely file-backed (no external backend); status() and
health() are constant. The former package-detection machinery
(`_find_cli`, `_probe_health`, present/misconfigured states) was removed
with the agent-memory package.
"""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "src" / "scripts"))
import memory_status  # noqa: E402


def test_status_is_file_backed():
    r = memory_status.status()
    assert r.status == "file"
    assert r.backend == "file"
    assert r.reason
    assert r.elapsed_ms == 0


def test_status_never_raises():
    # Constant + side-effect-free; refresh flag is a back-compat no-op.
    assert memory_status.status(refresh=True).status == "file"


def test_health_envelope_shape():
    h = memory_status.health()
    assert h["contract_version"] == memory_status.CONTRACT_VERSION
    assert h["status"] == "ok"
    assert h["backend_version"] == "0.0.0-file"
    assert "file-fallback" in h["features"]
