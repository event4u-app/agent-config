"""Council configuration loader — single source of truth.

Reads ``agents/.ai-council.yml`` per the contract in
``docs/contracts/ai-council-config.md``. Replaces the fragmented
``.agent-settings.yml`` ``ai_council`` block (Phase 0 migration).

Validation contract (7 rules, all enforced at load time):

1. ``enabled`` is a bool.
2. ``defaults.mode`` ∈ {``api``, ``manual``}; per-member mode same set.
3. ``members.<name>`` keys are restricted to the known provider set.
4. ``cost_budget.*`` numeric fields are >= 0.
5. Enabled members carry a non-empty ``model`` and ``api_key_ref``.
6. ``api_key_ref`` starts with ``file:`` or ``env:`` — raw keys are
   refused even if syntactically plausible.
7. Resolved ``file:`` key paths must have mode 0o600 (delegated to
   :func:`resolve_api_key`; runs at use-time, not parse-time).
"""

from __future__ import annotations

import os
import stat
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import yaml

from scripts._lib import user_global_paths

_VALID_PROVIDERS = frozenset({"anthropic", "openai", "gemini", "xai", "perplexity"})
_VALID_MODES = frozenset({"api", "manual"})

#: Prefixes that signal "this is a raw API key" so we refuse it loudly
#: even when the user accidentally inlined it in ``api_key_ref``.
_RAW_KEY_PREFIXES = ("sk-", "sk-ant-", "ya29.", "AIza", "xai-", "pplx-", "gsk_")


class CouncilConfigError(RuntimeError):
    """Raised when ``agents/.ai-council.yml`` violates the schema."""


@dataclass(frozen=True)
class DefaultsConfig:
    mode: str = "api"
    min_rounds: int = 2
    deep_min_rounds: int = 3
    max_output_tokens: int = 0
    session_retention_days: int = 7
    debate_max_rounds: int = 4


@dataclass(frozen=True)
class CostBudgetConfig:
    max_input_tokens: int = 500_000
    max_output_tokens: int = 200_000
    max_calls: int = 50
    max_total_usd: float = 20.0


@dataclass(frozen=True)
class MemberConfig:
    name: str
    enabled: bool
    model: str
    api_key_ref: str | None
    mode: str | None = None


@dataclass(frozen=True)
class AdvisorConfig:
    name: str
    enabled: bool
    target: str
    persona: str
    model: str | None = None


@dataclass(frozen=True)
class CouncilConfig:
    enabled: bool
    defaults: DefaultsConfig
    cost_budget: CostBudgetConfig
    members: dict[str, MemberConfig]
    advisors: dict[str, AdvisorConfig] = field(default_factory=dict)
    source_path: Path | None = None


def load_council_config(path: Path) -> CouncilConfig:
    """Load and validate the council YAML at ``path``."""
    if not path.exists():
        raise CouncilConfigError(
            f"Council config not found at {path}. "
            f"Create it per docs/contracts/ai-council-config.md."
        )
    try:
        raw = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
    except yaml.YAMLError as exc:
        raise CouncilConfigError(f"{path}: invalid YAML — {exc}") from exc
    if not isinstance(raw, dict):
        raise CouncilConfigError(f"{path}: top-level must be a mapping.")
    return _build_config(raw, source_path=path)


def _build_config(raw: dict[str, Any], *, source_path: Path) -> CouncilConfig:
    enabled = raw.get("enabled", False)
    if not isinstance(enabled, bool):
        raise CouncilConfigError("`enabled` must be a bool.")

    defaults = _build_defaults(raw.get("defaults") or {})
    cost_budget = _build_cost_budget(raw.get("cost_budget") or {})

    members_raw = raw.get("members") or {}
    if not isinstance(members_raw, dict):
        raise CouncilConfigError("`members` must be a mapping.")
    members: dict[str, MemberConfig] = {}
    for name, cfg in members_raw.items():
        members[name] = _build_member(name, cfg or {})

    advisors_raw = raw.get("advisors") or {}
    if not isinstance(advisors_raw, dict):
        raise CouncilConfigError("`advisors` must be a mapping.")
    advisors: dict[str, AdvisorConfig] = {}
    for adv_name, adv_cfg in advisors_raw.items():
        advisors[adv_name] = _build_advisor(adv_name, adv_cfg or {})

    return CouncilConfig(
        enabled=enabled,
        defaults=defaults,
        cost_budget=cost_budget,
        members=members,
        advisors=advisors,
        source_path=source_path,
    )


def _build_defaults(d: dict[str, Any]) -> DefaultsConfig:
    if not isinstance(d, dict):
        raise CouncilConfigError("`defaults` must be a mapping.")
    mode = d.get("mode", "api")
    if mode not in _VALID_MODES:
        raise CouncilConfigError(
            f"defaults.mode={mode!r} not in {sorted(_VALID_MODES)}."
        )
    return DefaultsConfig(
        mode=mode,
        min_rounds=int(d.get("min_rounds", 2)),
        deep_min_rounds=int(d.get("deep_min_rounds", 3)),
        max_output_tokens=int(d.get("max_output_tokens", 0)),
        session_retention_days=int(d.get("session_retention_days", 7)),
        debate_max_rounds=int(d.get("debate_max_rounds", 4)),
    )


def _build_cost_budget(d: dict[str, Any]) -> CostBudgetConfig:
    if not isinstance(d, dict):
        raise CouncilConfigError("`cost_budget` must be a mapping.")
    cb = CostBudgetConfig(
        max_input_tokens=int(d.get("max_input_tokens", 500_000)),
        max_output_tokens=int(d.get("max_output_tokens", 200_000)),
        max_calls=int(d.get("max_calls", 50)),
        max_total_usd=float(d.get("max_total_usd", 20.0)),
    )
    for fname in ("max_input_tokens", "max_output_tokens", "max_calls", "max_total_usd"):
        val = getattr(cb, fname)
        if val < 0:
            raise CouncilConfigError(
                f"cost_budget.{fname} must be >= 0 (got {val!r})."
            )
    return cb


def _build_member(name: str, cfg: dict[str, Any]) -> MemberConfig:
    if name not in _VALID_PROVIDERS:
        raise CouncilConfigError(
            f"members.{name}: unknown provider; valid: {sorted(_VALID_PROVIDERS)}."
        )
    member_enabled = bool(cfg.get("enabled", False))
    model = cfg.get("model") or ""
    api_key_ref = cfg.get("api_key_ref")
    if member_enabled:
        if not model:
            raise CouncilConfigError(
                f"members.{name}: enabled members require a non-empty `model`."
            )
        if not api_key_ref:
            raise CouncilConfigError(
                f"members.{name}: enabled members require an `api_key_ref`."
            )
    if api_key_ref is not None:
        _validate_api_key_ref(f"members.{name}", api_key_ref)
    member_mode = cfg.get("mode")
    if member_mode is not None and member_mode not in _VALID_MODES:
        raise CouncilConfigError(
            f"members.{name}.mode={member_mode!r} not in {sorted(_VALID_MODES)}."
        )
    return MemberConfig(
        name=name,
        enabled=member_enabled,
        model=model,
        api_key_ref=api_key_ref,
        mode=member_mode,
    )


def _build_advisor(name: str, cfg: dict[str, Any]) -> AdvisorConfig:
    target = cfg.get("target")
    if target not in _VALID_PROVIDERS:
        raise CouncilConfigError(
            f"advisors.{name}.target={target!r} not a valid provider."
        )
    persona = cfg.get("persona") or ""
    if not persona:
        raise CouncilConfigError(
            f"advisors.{name}: `persona` (path to persona file) required."
        )
    return AdvisorConfig(
        name=name,
        enabled=bool(cfg.get("enabled", False)),
        target=target,
        persona=persona,
        model=cfg.get("model"),
    )


def _validate_api_key_ref(scope: str, ref: Any) -> None:
    if not isinstance(ref, str) or not ref:
        raise CouncilConfigError(f"{scope}.api_key_ref must be a non-empty string.")
    if any(ref.startswith(prefix) for prefix in _RAW_KEY_PREFIXES):
        raise CouncilConfigError(
            f"{scope}.api_key_ref looks like a raw API key. "
            f"Use `file:<path>` (0600) or `env:<VAR>` — never inline secrets."
        )
    if ref.startswith("file:"):
        if not ref[len("file:"):].strip():
            raise CouncilConfigError(f"{scope}.api_key_ref `file:` ref missing path.")
        return
    if ref.startswith("env:"):
        if not ref[len("env:"):].strip():
            raise CouncilConfigError(f"{scope}.api_key_ref `env:` ref missing variable name.")
        return
    raise CouncilConfigError(
        f"{scope}.api_key_ref must start with `file:` or `env:` (got {ref!r})."
    )


def resolve_api_key(ref: str, *, scope: str = "api_key_ref") -> str:
    """Resolve ``file:<path>`` or ``env:<VAR>`` to the raw key string.

    ``file:`` — relative paths resolve under the user-global namespace
    (``~/.event4u/agent-config/`` today, with the pre-2.4
    ``~/.config/agent-config/`` tree read as a fallback). Mode must be
    0o600. ``env:`` — reads from ``os.environ``; empty/missing is a
    hard error. Never echoes the value.
    """
    _validate_api_key_ref(scope, ref)
    if ref.startswith("env:"):
        var = ref[len("env:"):].strip()
        if not var:
            raise CouncilConfigError(f"{scope}: `env:` ref missing variable name.")
        value = os.environ.get(var, "").strip()
        if not value:
            raise CouncilConfigError(f"{scope}: env var {var!r} is unset or empty.")
        return value
    spec = ref[len("file:"):].strip()
    if not spec:
        raise CouncilConfigError(f"{scope}: `file:` ref missing path.")
    path = Path(spec).expanduser()
    if not path.is_absolute():
        found = user_global_paths.resolve_with_fallback(spec)
        if found is None:
            target = user_global_paths.write_target(spec)
            raise CouncilConfigError(
                f"{scope}: key file not found at {target} (or legacy fallback)."
            )
        path = found
    if not path.exists():
        raise CouncilConfigError(f"{scope}: key file does not exist at {path}.")
    mode = stat.S_IMODE(path.stat().st_mode)
    if mode != 0o600:
        raise CouncilConfigError(
            f"{scope}: unsafe permissions on {path}: got {oct(mode)}, expected 0o600. "
            f"Fix:  chmod 600 {path}"
        )
    value = path.read_text(encoding="utf-8").strip()
    if not value:
        raise CouncilConfigError(f"{scope}: key file at {path} is empty.")
    return value

