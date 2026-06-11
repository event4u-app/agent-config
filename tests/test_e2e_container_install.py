#!/usr/bin/env python3
"""Containerized e2e for the installer + browser-wizard apply path.

Builds the `installer-e2e` image (python3 + node + a freshly built dist/) and
runs both apply scenarios inside it. The container has NO host PYTHONPATH /
venv leakage — the exact condition under which the field bug surfaced: the
browser wizard finished but nothing was installed, because the global-scope
apply spawned `install.py` without PYTHONPATH, the migrate-to-global import
failed, and the whole install aborted.

Scenarios (both asserted by tests/fixtures/installer-e2e/run-scenarios.sh):
  A. `install.py --apply-payload` in a clean env, legacy `.claude/` present.
  B. The real `createApp` wizard server, driven over HTTP (POST
     /api/v1/wizard/apply).

Slow + Docker-bound: NOT part of the default `task test` suite. Run via
`task test-installer-e2e` or directly:
  python3 -m pytest tests/test_e2e_container_install.py -v -m docker
"""

from __future__ import annotations

import os
import shutil
import subprocess
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parent.parent
DOCKERFILE = REPO_ROOT / "tests" / "fixtures" / "installer-e2e.Dockerfile"
IMAGE_TAG = "agent-config-installer-e2e:test"

# Opt-in only. The default `task test` (`pytest tests/ -n auto`) must NOT build
# this multi-minute image (and would do so per xdist worker). Run via
# `task test-installer-e2e`, which sets AGENT_CONFIG_E2E_DOCKER=1.
pytestmark = [
    pytest.mark.docker,
    pytest.mark.skipif(
        os.environ.get("AGENT_CONFIG_E2E_DOCKER") != "1",
        reason="container e2e is opt-in; set AGENT_CONFIG_E2E_DOCKER=1 (task test-installer-e2e)",
    ),
]


def _docker_available() -> bool:
    if shutil.which("docker") is None:
        return False
    try:
        proc = subprocess.run(  # noqa: S603 — fixed args
            ["docker", "info"],
            capture_output=True,
            text=True,
            timeout=30,
        )
    except (subprocess.TimeoutExpired, OSError):
        return False
    return proc.returncode == 0


@pytest.fixture(scope="module")
def installer_image() -> str:
    if not _docker_available():
        pytest.skip("docker daemon not available")
    build = subprocess.run(  # noqa: S603 — fixed args
        [
            "docker", "build",
            "-f", str(DOCKERFILE),
            "-t", IMAGE_TAG,
            str(REPO_ROOT),
        ],
        capture_output=True,
        text=True,
        timeout=900,
    )
    if build.returncode != 0:
        pytest.fail(
            f"installer-e2e image build failed (rc={build.returncode}):\n"
            f"{build.stdout[-4000:]}\n{build.stderr[-4000:]}"
        )
    return IMAGE_TAG


def test_installer_and_wizard_apply_in_container(installer_image: str) -> None:
    """Both apply scenarios install a populated tree inside the container."""
    run = subprocess.run(  # noqa: S603 — fixed args
        ["docker", "run", "--rm", installer_image],
        capture_output=True,
        text=True,
        timeout=300,
    )
    combined = run.stdout + "\n" + run.stderr
    assert run.returncode == 0, f"container e2e failed (rc={run.returncode}):\n{combined}"
    assert "Scenario A: PASS" in run.stdout, combined
    assert "Scenario B: PASS" in run.stdout, combined
    assert "ALL CONTAINER E2E SCENARIOS PASSED" in run.stdout, combined
