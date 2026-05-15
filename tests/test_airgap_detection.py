"""Airgap-detection contract (step-9 P11 · U1).

Tests cover the three required cases from the roadmap:

- all-reachable → ``cli`` (no airgap detected)
- all-unreachable → ``api`` (airgap detected, installer flips default)
- partial-reachable → ``cli`` (a single working host is enough)

Plus a banner-wording sentinel — the roadmap pins the exact string.
"""

from __future__ import annotations

import socket
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from scripts.ai_council.airgap import (  # noqa: E402
    AIRGAP_BANNER,
    COUNCIL_PROBE_HOSTS,
    airgap_banner,
    detect_airgap,
    probe_host,
    recommended_member_mode,
)


def _make_resolver(reachable: set[str]):
    """Return a resolver that succeeds for hosts in ``reachable`` only."""

    def _resolver(host: str) -> None:
        if host not in reachable:
            raise socket.gaierror(f"unreachable: {host}")

    return _resolver


# ── probe_host ─────────────────────────────────────────────────────────


def test_probe_host_returns_true_when_resolver_succeeds() -> None:
    resolver = _make_resolver({"api.openai.com"})
    assert probe_host("api.openai.com", resolver=resolver) is True


def test_probe_host_returns_false_on_gaierror() -> None:
    resolver = _make_resolver(set())
    assert probe_host("api.openai.com", resolver=resolver) is False


def test_probe_host_returns_false_on_oserror() -> None:
    def _boom(host: str) -> None:
        raise OSError("network unreachable")

    assert probe_host("api.openai.com", resolver=_boom) is False


def test_probe_host_restores_default_timeout() -> None:
    """The probe must not leak its timeout into the global socket state."""

    socket.setdefaulttimeout(None)
    try:
        probe_host(
            "api.openai.com",
            timeout=0.5,
            resolver=_make_resolver({"api.openai.com"}),
        )
        assert socket.getdefaulttimeout() is None
    finally:
        socket.setdefaulttimeout(None)


# ── detect_airgap — three roadmap cases ────────────────────────────────


def test_detect_airgap_all_reachable_returns_false() -> None:
    resolver = _make_resolver(set(COUNCIL_PROBE_HOSTS))
    assert detect_airgap(resolver=resolver) is False


def test_detect_airgap_all_unreachable_returns_true() -> None:
    resolver = _make_resolver(set())
    assert detect_airgap(resolver=resolver) is True


@pytest.mark.parametrize("reachable_host", list(COUNCIL_PROBE_HOSTS))
def test_detect_airgap_partial_reachable_returns_false(
    reachable_host: str,
) -> None:
    resolver = _make_resolver({reachable_host})
    assert detect_airgap(resolver=resolver) is False


def test_detect_airgap_empty_hosts_returns_true() -> None:
    """Defensive: no providers to reach == airgapped by definition."""

    resolver = _make_resolver(set(COUNCIL_PROBE_HOSTS))
    assert detect_airgap(hosts=(), resolver=resolver) is True


# ── recommended_member_mode ────────────────────────────────────────────


def test_recommended_member_mode_cli_when_reachable() -> None:
    resolver = _make_resolver({"api.openai.com"})
    assert recommended_member_mode(resolver=resolver) == "cli"


def test_recommended_member_mode_api_when_airgapped() -> None:
    resolver = _make_resolver(set())
    assert recommended_member_mode(resolver=resolver) == "api"


# ── banner contract ────────────────────────────────────────────────────


def test_airgap_banner_matches_roadmap_wording() -> None:
    """Roadmap step-9 line 147 pins the exact banner string."""

    assert AIRGAP_BANNER == (
        "airgapped environment detected — defaulting to mode: api"
    )
    assert airgap_banner() == AIRGAP_BANNER


def test_probe_hosts_covers_three_providers() -> None:
    """Roadmap step-9 line 147 names the three required hosts."""

    assert set(COUNCIL_PROBE_HOSTS) == {
        "api.anthropic.com",
        "api.openai.com",
        "generativelanguage.googleapis.com",
    }
