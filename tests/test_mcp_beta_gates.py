"""MCP Beta promotion gate evidence — Phase 3 of road-to-surface-discipline.

Each test asserts that the artefact named by
`docs/contracts/mcp-beta-criteria.md` for the matching gate exists. A
gate is **red** until the artefact is in tree and the test flips to a
real assertion. Pending gates surface via ``pytest.skip`` so the suite
runs clean while still making the missing evidence visible (count of
skipped tests = count of red gates).

The doctor check ``mcp-beta-readiness`` (Phase 3 Step 5) consumes this
file's pass / skip / fail breakdown to compute its verdict.
"""
from __future__ import annotations

from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parent.parent


def _exists(rel: str) -> bool:
    return (REPO_ROOT / rel).exists()


# ---------------------------------------------------------------------------
# Gate 1 — External-client end-to-end run
# ---------------------------------------------------------------------------

def test_mcp_beta_gate_1_external_client_transcript() -> None:
    """At least one external-client transcript under tests/mcp/external-clients/."""
    transcripts = REPO_ROOT / "tests" / "mcp" / "external-clients"
    if not transcripts.exists():
        pytest.skip(
            "pending: mcp-beta-gate-1 — "
            "no tests/mcp/external-clients/ directory yet "
            "(see docs/contracts/mcp-beta-criteria.md § Gate 1)",
        )
    files = list(transcripts.glob("*.jsonl")) + list(transcripts.glob("*.md"))
    assert files, (
        "Gate 1 red: tests/mcp/external-clients/ exists but has no "
        "*.jsonl or *.md transcripts"
    )


# ---------------------------------------------------------------------------
# Gate 2 — Bearer-auth coverage
# ---------------------------------------------------------------------------

def test_mcp_beta_gate_2_bearer_auth_suite() -> None:
    """tests/mcp/auth/ must cover the four bearer-auth cases."""
    auth_dir = REPO_ROOT / "tests" / "mcp" / "auth"
    if not auth_dir.exists():
        pytest.skip(
            "pending: mcp-beta-gate-2 — "
            "no tests/mcp/auth/ directory yet "
            "(see docs/contracts/mcp-beta-criteria.md § Gate 2)",
        )
    cases = {p.stem for p in auth_dir.glob("test_*.py")}
    required = {
        "test_bearer_happy_path",
        "test_bearer_401_missing",
        "test_bearer_401_expired",
        "test_bearer_401_rotated",
    }
    missing = required - cases
    assert not missing, f"Gate 2 red: missing auth cases {sorted(missing)}"


# ---------------------------------------------------------------------------
# Gate 3 — Lite/Full parity smoke suite
# ---------------------------------------------------------------------------

def test_mcp_beta_gate_3_parity_smoke_suite() -> None:
    """Parity tests cover prompts/list, prompts/get, resources/list, resources/read."""
    parity = REPO_ROOT / "tests" / "mcp" / "parity"
    if not parity.exists():
        pytest.skip(
            "pending: mcp-beta-gate-3 — "
            "no tests/mcp/parity/ directory yet "
            "(see docs/contracts/mcp-beta-criteria.md § Gate 3)",
        )
    primitives = {p.stem for p in parity.glob("test_*.py")}
    required = {
        "test_prompts_list_parity",
        "test_prompts_get_parity",
        "test_resources_list_parity",
        "test_resources_read_parity",
    }
    missing = required - primitives
    assert not missing, f"Gate 3 red: missing parity tests {sorted(missing)}"


# ---------------------------------------------------------------------------
# Gate 4 — Health endpoint under load
# ---------------------------------------------------------------------------

def test_mcp_beta_gate_4_healthz_load_smoke() -> None:
    """k6/wrk script + worker `/healthz` envelope contract test."""
    if not _exists("tests/mcp/load/healthz.k6.js"):
        pytest.skip(
            "pending: mcp-beta-gate-4 — "
            "tests/mcp/load/healthz.k6.js missing "
            "(see docs/contracts/mcp-beta-criteria.md § Gate 4)",
        )
    if not _exists("tests/mcp/load/test_healthz_envelope.py"):
        pytest.skip(
            "pending: mcp-beta-gate-4 — "
            "tests/mcp/load/test_healthz_envelope.py missing",
        )


# ---------------------------------------------------------------------------
# Gate 5 — Abuse / rate-limit plan
# ---------------------------------------------------------------------------

def test_mcp_beta_gate_5_rate_limit_contract() -> None:
    """Rate-limit doc + enforcement contract test."""
    if not _exists("docs/contracts/mcp-rate-limit.md"):
        pytest.skip(
            "pending: mcp-beta-gate-5 — "
            "docs/contracts/mcp-rate-limit.md not authored yet "
            "(see docs/contracts/mcp-beta-criteria.md § Gate 5)",
        )
    if not _exists("tests/mcp/rate-limit"):
        pytest.skip(
            "pending: mcp-beta-gate-5 — "
            "tests/mcp/rate-limit/ enforcement suite missing",
        )


# ---------------------------------------------------------------------------
# Gate 6 — Lite ↔ Full no-drift
# ---------------------------------------------------------------------------

def test_mcp_beta_gate_6_no_drift_workflow() -> None:
    """Nightly no-drift workflow file and recent successful run evidence."""
    if not _exists(".github/workflows/mcp-no-drift.yml"):
        pytest.skip(
            "pending: mcp-beta-gate-6 — "
            ".github/workflows/mcp-no-drift.yml not authored yet "
            "(see docs/contracts/mcp-beta-criteria.md § Gate 6)",
        )
