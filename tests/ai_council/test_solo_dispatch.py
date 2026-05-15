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
    dispatch_with_escalation,
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



# ── dispatch_with_escalation (step-9 P13) ───────────────────────────────────


_HIGH_CONF = (
    "The fix updates the validator and the regression test asserts the new "
    "message. PHPStan and ECS are clean.\nConfidence: 0.92"
)
_LOW_CONF_HEDGES = (
    "Maybe this is right. I think it's probably ok but I'm not sure. "
    "Perhaps the validator works."
)


def _wrap_kwargs(
    chain: tuple[str, ...],
    *,
    solo_response: str,
    full_response: str = "FULL_VERDICT",
    floor: float = 0.7,
    probe_ok: bool = True,
):
    cache = AuthCache()
    members = {name: _member(name) for name in chain}
    return dict(
        routing=_routing(chain),
        members=members,
        auth_cache=cache,
        probe=lambda _n, _t: probe_ok,
        run_solo=lambda _n: solo_response,
        run_full=lambda: full_response,
        confidence_floor=floor,
        now=100.0,
        env={},
    )


def test_dispatch_high_confidence_returns_solo() -> None:
    result = dispatch_with_escalation(
        **_wrap_kwargs(("anthropic",), solo_response=_HIGH_CONF)
    )
    assert not result.escalated
    assert result.escalation_reason == "ok"
    assert result.verdict == _HIGH_CONF
    assert result.solo_member == "anthropic"


def test_dispatch_low_confidence_escalates_to_full() -> None:
    result = dispatch_with_escalation(
        **_wrap_kwargs(("anthropic",), solo_response=_LOW_CONF_HEDGES)
    )
    assert result.escalated
    assert result.escalation_reason == "low_confidence"
    assert result.verdict == "FULL_VERDICT"
    assert result.solo_response == _LOW_CONF_HEDGES


def test_dispatch_refusal_escalates() -> None:
    result = dispatch_with_escalation(
        **_wrap_kwargs(("anthropic",), solo_response="I cannot decide.")
    )
    assert result.escalated
    assert result.escalation_reason == "refusal"
    assert result.verdict == "FULL_VERDICT"


def test_dispatch_no_solo_member_escalates() -> None:
    result = dispatch_with_escalation(
        **_wrap_kwargs(
            ("anthropic",), solo_response="ignored", probe_ok=False,
        )
    )
    assert result.escalated
    assert result.escalation_reason == "no_solo_member"
    assert result.solo_member is None
    assert result.solo_response is None
    assert result.verdict == "FULL_VERDICT"


def test_dispatch_split_escalates() -> None:
    split_text = (
        "This response is long enough to clear the short-response cutoff.\n"
        "Option A: revert. Option B: patch forward."
    )
    result = dispatch_with_escalation(
        **_wrap_kwargs(("anthropic",), solo_response=split_text)
    )
    assert result.escalated
    assert result.escalation_reason == "split"
