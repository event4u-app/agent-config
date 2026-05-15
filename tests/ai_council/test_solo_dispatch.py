"""Solo-member dispatch contract — step-9 P9 (U2)."""

from __future__ import annotations

import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from scripts.ai_council.config import MemberConfig, RoutingConfig  # noqa: E402
from scripts.ai_council.solo_dispatch import (  # noqa: E402
    AUTH_CACHE_TTL_SECONDS,
    AuthCache,
    FORCE_FULL_ENV,
    force_full_council,
    select_solo_member,
)


def _member(name: str, *, enabled: bool = True) -> MemberConfig:
    return MemberConfig(
        name=name,
        enabled=enabled,
        model="m",
        api_key_ref="env:X",
        mode="cli",
    )


def _routing(chain: tuple[str, ...], timeout: int = 3) -> RoutingConfig:
    return RoutingConfig(
        solo_member_fallback_chain=chain,
        auth_check_timeout_seconds=timeout,
    )


# ── happy path ──────────────────────────────────────────────────────────────


def test_first_member_valid_wins() -> None:
    cache = AuthCache()
    routing = _routing(("anthropic", "openai"))
    members = {"anthropic": _member("anthropic"), "openai": _member("openai")}
    calls: list[tuple[str, int]] = []

    def probe(name: str, timeout: int) -> bool:
        calls.append((name, timeout))
        return True

    pick = select_solo_member(
        routing, members, auth_cache=cache, probe=probe, now=100.0, env={},
    )
    assert pick == "anthropic"
    assert calls == [("anthropic", 3)]


def test_first_invalid_falls_back_to_second() -> None:
    cache = AuthCache()
    routing = _routing(("anthropic", "openai"))
    members = {"anthropic": _member("anthropic"), "openai": _member("openai")}
    verdicts = {"anthropic": False, "openai": True}

    pick = select_solo_member(
        routing,
        members,
        auth_cache=cache,
        probe=lambda n, _t: verdicts[n],
        now=100.0,
        env={},
    )
    assert pick == "openai"


def test_all_invalid_returns_none() -> None:
    cache = AuthCache()
    routing = _routing(("anthropic", "openai"))
    members = {"anthropic": _member("anthropic"), "openai": _member("openai")}

    pick = select_solo_member(
        routing, members, auth_cache=cache,
        probe=lambda n, _t: False, now=100.0, env={},
    )
    assert pick is None


def test_disabled_member_is_skipped() -> None:
    cache = AuthCache()
    routing = _routing(("anthropic", "openai"))
    members = {
        "anthropic": _member("anthropic", enabled=False),
        "openai": _member("openai"),
    }
    calls: list[str] = []

    pick = select_solo_member(
        routing, members, auth_cache=cache,
        probe=lambda n, _t: calls.append(n) or True,
        now=100.0, env={},
    )
    assert pick == "openai"
    assert calls == ["openai"]


def test_missing_member_is_skipped() -> None:
    cache = AuthCache()
    routing = _routing(("ghost", "openai"))
    members = {"openai": _member("openai")}

    pick = select_solo_member(
        routing, members, auth_cache=cache,
        probe=lambda n, _t: True, now=100.0, env={},
    )
    assert pick == "openai"


# ── cache behaviour ─────────────────────────────────────────────────────────


def test_cache_hit_avoids_probe() -> None:
    cache = AuthCache()
    cache.set("anthropic", valid=True, now=100.0)
    routing = _routing(("anthropic",))
    members = {"anthropic": _member("anthropic")}
    calls: list[str] = []

    pick = select_solo_member(
        routing, members, auth_cache=cache,
        probe=lambda n, _t: calls.append(n) or True,
        now=100.0, env={},
    )
    assert pick == "anthropic"
    assert calls == []  # cache hit, probe skipped


def test_cache_negative_hit_skips_member() -> None:
    cache = AuthCache()
    cache.set("anthropic", valid=False, now=100.0)
    routing = _routing(("anthropic", "openai"))
    members = {"anthropic": _member("anthropic"), "openai": _member("openai")}

    pick = select_solo_member(
        routing, members, auth_cache=cache,
        probe=lambda n, _t: True, now=100.0, env={},
    )
    assert pick == "openai"


def test_cache_entry_expires() -> None:
    cache = AuthCache()
    cache.set("anthropic", valid=True, now=100.0)
    routing = _routing(("anthropic",))
    members = {"anthropic": _member("anthropic")}
    probed: list[str] = []

    pick = select_solo_member(
        routing, members, auth_cache=cache,
        probe=lambda n, _t: probed.append(n) or True,
        now=100.0 + AUTH_CACHE_TTL_SECONDS + 1, env={},
    )
    assert pick == "anthropic"
    assert probed == ["anthropic"]


# ── timeout / errors ────────────────────────────────────────────────────────


def test_probe_exception_treated_as_invalid() -> None:
    cache = AuthCache()
    routing = _routing(("anthropic", "openai"))
    members = {"anthropic": _member("anthropic"), "openai": _member("openai")}

    def probe(name: str, _t: int) -> bool:
        if name == "anthropic":
            raise RuntimeError("CLI wedged")
        return True

    pick = select_solo_member(
        routing, members, auth_cache=cache,
        probe=probe, now=100.0, env={},
    )
    assert pick == "openai"


def test_timeout_value_passed_to_probe() -> None:
    cache = AuthCache()
    routing = _routing(("anthropic",), timeout=7)
    members = {"anthropic": _member("anthropic")}
    seen: list[int] = []

    select_solo_member(
        routing, members, auth_cache=cache,
        probe=lambda _n, t: seen.append(t) or True,
        now=100.0, env={},
    )
    assert seen == [7]


# ── env-var override ────────────────────────────────────────────────────────


def test_env_override_short_circuits_to_none() -> None:
    cache = AuthCache()
    routing = _routing(("anthropic",))
    members = {"anthropic": _member("anthropic")}

    pick = select_solo_member(
        routing, members, auth_cache=cache,
        probe=lambda n, _t: True, now=100.0,
        env={FORCE_FULL_ENV: "1"},
    )
    assert pick is None


def test_env_override_only_accepts_exact_one() -> None:
    assert force_full_council(env={FORCE_FULL_ENV: "1"}) is True
    assert force_full_council(env={FORCE_FULL_ENV: "true"}) is False
    assert force_full_council(env={FORCE_FULL_ENV: "yes"}) is False
    assert force_full_council(env={}) is False


def test_empty_chain_returns_none() -> None:
    cache = AuthCache()
    routing = _routing(())
    members = {"anthropic": _member("anthropic")}

    pick = select_solo_member(
        routing, members, auth_cache=cache,
        probe=lambda n, _t: True, now=100.0, env={},
    )
    assert pick is None
