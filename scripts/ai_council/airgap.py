"""Airgap detection for the AI Council installer / first-run (step-9 P11 · U1).

Probes DNS for the three primary council provider hosts with a short
timeout. If **all** probes fail the environment is treated as airgapped
and the installer is expected to seed ``defaults.member_mode: api`` (the
CLI default would otherwise launch ``codex``/``claude``/``gemini``
binaries that cannot reach their backends).

Why DNS, not HTTP:
- DNS is cheap (UDP, ~1 packet), HTTP probes are billable surface.
- A DNS hit is sufficient to disprove airgap; the actual reachability
  of the host is checked at first use, not here.
- No auth required, no false negatives from corporate proxies that
  block HTTPS but allow DNS.

Public surface:
- ``COUNCIL_PROBE_HOSTS`` — tuple of hosts to probe.
- ``probe_host(host, timeout)`` — single-host probe, returns bool.
- ``detect_airgap(*, hosts, timeout, resolver)`` — returns ``True`` iff
  every host fails. ``resolver`` is injectable for tests.
- ``airgap_banner()`` — the one-liner the installer prints when airgap
  is detected.
"""

from __future__ import annotations

import socket
from collections.abc import Callable, Iterable

COUNCIL_PROBE_HOSTS: tuple[str, ...] = (
    "api.anthropic.com",
    "api.openai.com",
    "generativelanguage.googleapis.com",
)

DEFAULT_TIMEOUT_S: float = 1.0

# Banner string the installer prints when airgap is detected. Wording
# is part of the Phase 11 contract (roadmap step-9 line 147) and is
# asserted by tests/test_airgap_detection.py.
AIRGAP_BANNER: str = (
    "airgapped environment detected — defaulting to mode: api"
)


def airgap_banner() -> str:
    """Return the canonical airgap banner (step-9 P11)."""

    return AIRGAP_BANNER


Resolver = Callable[[str], None]


def _default_resolver(host: str) -> None:
    """Resolve ``host`` via ``socket.getaddrinfo``.

    Raises ``socket.gaierror`` / ``OSError`` on failure. The timeout is
    enforced by the caller via ``socket.setdefaulttimeout`` because
    ``getaddrinfo`` itself has no ``timeout=`` kwarg.
    """

    socket.getaddrinfo(host, None)


def probe_host(
    host: str,
    *,
    timeout: float = DEFAULT_TIMEOUT_S,
    resolver: Resolver | None = None,
) -> bool:
    """Return ``True`` iff ``host`` resolves within ``timeout``.

    Any DNS / socket error is treated as unreachable. Test code can
    inject ``resolver`` to simulate reachability without touching the
    network.
    """

    resolver = resolver or _default_resolver
    previous = socket.getdefaulttimeout()
    try:
        socket.setdefaulttimeout(timeout)
        try:
            resolver(host)
        except (socket.gaierror, OSError):
            return False
        return True
    finally:
        socket.setdefaulttimeout(previous)


def detect_airgap(
    *,
    hosts: Iterable[str] = COUNCIL_PROBE_HOSTS,
    timeout: float = DEFAULT_TIMEOUT_S,
    resolver: Resolver | None = None,
) -> bool:
    """Return ``True`` iff **every** host in ``hosts`` is unreachable.

    A single reachable host is enough to disprove airgap — CLI members
    only need one provider to be usable. Empty ``hosts`` is treated as
    airgap by definition (no providers to reach).
    """

    hosts_list = list(hosts)
    if not hosts_list:
        return True
    for host in hosts_list:
        if probe_host(host, timeout=timeout, resolver=resolver):
            return False
    return True


def recommended_member_mode(
    *,
    hosts: Iterable[str] = COUNCIL_PROBE_HOSTS,
    timeout: float = DEFAULT_TIMEOUT_S,
    resolver: Resolver | None = None,
) -> str:
    """Return ``"api"`` when airgapped, ``"cli"`` otherwise.

    Convenience wrapper for the installer: matches the Phase 8 default
    of ``cli`` and the Phase 11 airgap override of ``api``.
    """

    return "api" if detect_airgap(
        hosts=hosts, timeout=timeout, resolver=resolver,
    ) else "cli"


def main(argv: list[str] | None = None) -> int:
    """CLI entry-point: print recommended mode + banner if airgapped.

    Used by the installer / first-run wrappers (step-9 P11): probe
    the three provider hosts and exit ``0`` with the recommended mode
    on stdout. When airgapped also emit the banner on stderr so the
    installer can surface it without parsing stdout.
    """

    import argparse
    import sys

    parser = argparse.ArgumentParser(
        description="Detect airgap state and print recommended member_mode."
    )
    parser.add_argument(
        "--timeout",
        type=float,
        default=DEFAULT_TIMEOUT_S,
        help=f"per-host DNS timeout in seconds (default: {DEFAULT_TIMEOUT_S})",
    )
    args = parser.parse_args(argv)

    is_airgapped = detect_airgap(timeout=args.timeout)
    mode = "api" if is_airgapped else "cli"
    if is_airgapped:
        print(AIRGAP_BANNER, file=sys.stderr)
    print(mode)
    return 0


if __name__ == "__main__":
    import sys as _sys

    raise SystemExit(main(_sys.argv[1:]))
