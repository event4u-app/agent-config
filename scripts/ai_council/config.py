"""Council configuration loader — single source of truth.

Reads ``agents/.ai-council.yml`` per the contract in
``docs/contracts/ai-council-config.md``. Replaces the fragmented
``.agent-settings.yml`` ``ai_council`` block (Phase 0 migration).

Validation contract (8 rules, all enforced at load time):

1. ``enabled`` is a bool.
2. ``defaults.mode`` ∈ {``api``, ``manual``, ``cli``}; per-member mode
   same set. Semantics: ``api`` = SDK call against a stored key
   (billable); ``manual`` = copy & paste — human transports prompt +
   reply between the agent and an external chat surface (free);
   ``cli`` = shell out to a locally-installed CLI under subscription
   auth (free for first-party CLIs, billable for community wrappers).
3. ``members.<name>`` keys are restricted to the known provider set.
4. ``cost_budget.*`` numeric fields are >= 0.
5. Enabled members carry a non-empty ``model`` and ``api_key_ref``
   when their effective mode is ``api``. CLI-mode members do NOT
   require ``api_key_ref`` (subscription auth is provided by the CLI
   binary itself).
6. ``api_key_ref`` starts with ``file:`` or ``env:`` — raw keys are
   refused even if syntactically plausible.
7. Resolved ``file:`` key paths must have mode 0o600 (delegated to
   :func:`resolve_api_key`; runs at use-time, not parse-time).
8. ``binary:`` is only valid when the member's effective mode is
   ``cli``; ``cli_call_budget.max_calls_per_day.<provider>`` keys
   must be valid providers.
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
_VALID_MODES = frozenset({"api", "manual", "cli"})

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
    binary: str | None = None


@dataclass(frozen=True)
class AdvisorConfig:
    """Replace-mode advisor binding (Phase 6).

    `member` names the provider whose plain call is replaced by this
    advisor-persona call. `persona` is the path to the advisor persona
    file (resolved relative to the package root). `model` is an
    optional override of the bound member's plain model.
    """

    name: str
    enabled: bool
    member: str
    persona: str
    model: str | None = None


@dataclass(frozen=True)
class ConsensusScoringConfig:
    """Consensus-scoring round settings (Phase 4 / F3).

    Only the `analysis` lens activates the scoring round today. Other
    lenses see this as inert config. Thresholds are inclusive on the
    `strong` side (> strong → strong bucket) and exclusive on the
    `minority` side (≤ minority → minority bucket); the middle bucket
    is `(minority, strong]`. Defaults mirror the roadmap (0.7 / 0.4).
    """

    enabled: bool = False
    strong_threshold: float = 0.7
    minority_threshold: float = 0.4
    lenses: tuple[str, ...] = ("analysis",)


@dataclass(frozen=True)
class CliCallBudgetConfig:
    """Per-day call-count guard for ``mode: cli`` members (Phase 0).

    The standard ``cost_budget`` gate skips CLI calls because they are
    ``billable=False`` — but provider subscriptions still carry their
    own quotas (Claude Pro 5h windows, ChatGPT Plus message caps,
    Gemini free-tier per-day limits). Users opt into a per-provider
    cap; default unset = unlimited from this loader's perspective.

    Counter state persists under
    ``~/.event4u/agent-config/cli-calls.json`` with daily UTC reset
    (wired in Phase 1).
    """

    max_calls_per_day: dict[str, int] = field(default_factory=dict)


@dataclass(frozen=True)
class CouncilConfig:
    enabled: bool
    defaults: DefaultsConfig
    cost_budget: CostBudgetConfig
    members: dict[str, MemberConfig]
    advisors: dict[str, AdvisorConfig] = field(default_factory=dict)
    consensus_scoring: ConsensusScoringConfig = field(
        default_factory=ConsensusScoringConfig,
    )
    cli_call_budget: CliCallBudgetConfig = field(
        default_factory=CliCallBudgetConfig,
    )
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
        members[name] = _build_member(name, cfg or {}, default_mode=defaults.mode)

    advisors_raw = raw.get("advisors") or {}
    if not isinstance(advisors_raw, dict):
        raise CouncilConfigError("`advisors` must be a mapping.")
    advisors: dict[str, AdvisorConfig] = {}
    for adv_name, adv_cfg in advisors_raw.items():
        advisors[adv_name] = _build_advisor(adv_name, adv_cfg or {})

    # Cross-validate enabled advisors against the members block. An
    # advisor referencing a missing or disabled member is a hard error
    # — never a silent skip — so a typo never costs the user money on
    # an unintended call plan.
    for adv in advisors.values():
        if not adv.enabled:
            continue
        bound = members.get(adv.member)
        if bound is None:
            raise CouncilConfigError(
                f"advisors.{adv.name}.member={adv.member!r}: no such "
                f"member in the `members` block."
            )
        if not bound.enabled:
            raise CouncilConfigError(
                f"advisors.{adv.name}.member={adv.member!r}: member "
                f"exists but is disabled. Enable the member or disable "
                f"the advisor."
            )

    consensus = _build_consensus_scoring(raw.get("consensus_scoring") or {})
    cli_call_budget = _build_cli_call_budget(raw.get("cli_call_budget") or {})

    return CouncilConfig(
        enabled=enabled,
        defaults=defaults,
        cost_budget=cost_budget,
        members=members,
        advisors=advisors,
        consensus_scoring=consensus,
        cli_call_budget=cli_call_budget,
        source_path=source_path,
    )


def _build_consensus_scoring(d: dict[str, Any]) -> ConsensusScoringConfig:
    if not isinstance(d, dict):
        raise CouncilConfigError("`consensus_scoring` must be a mapping.")
    strong = float(d.get("strong_threshold", 0.7))
    minority = float(d.get("minority_threshold", 0.4))
    if not 0.0 <= minority <= strong <= 1.0:
        raise CouncilConfigError(
            f"consensus_scoring thresholds broken: require "
            f"0 <= minority ({minority}) <= strong ({strong}) <= 1."
        )
    lenses_raw = d.get("lenses", ["analysis"])
    if not isinstance(lenses_raw, list) or not all(isinstance(x, str) for x in lenses_raw):
        raise CouncilConfigError("`consensus_scoring.lenses` must be a list of strings.")
    return ConsensusScoringConfig(
        enabled=bool(d.get("enabled", False)),
        strong_threshold=strong,
        minority_threshold=minority,
        lenses=tuple(lenses_raw),
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


def _build_member(
    name: str,
    cfg: dict[str, Any],
    *,
    default_mode: str = "api",
) -> MemberConfig:
    if name not in _VALID_PROVIDERS:
        raise CouncilConfigError(
            f"members.{name}: unknown provider; valid: {sorted(_VALID_PROVIDERS)}."
        )
    member_enabled = bool(cfg.get("enabled", False))
    model = cfg.get("model") or ""
    api_key_ref = cfg.get("api_key_ref")
    member_mode = cfg.get("mode")
    if member_mode is not None and member_mode not in _VALID_MODES:
        raise CouncilConfigError(
            f"members.{name}.mode={member_mode!r} not in {sorted(_VALID_MODES)}."
        )
    effective_mode = member_mode or default_mode
    binary = cfg.get("binary")
    if binary is not None:
        if not isinstance(binary, str) or not binary.strip():
            raise CouncilConfigError(
                f"members.{name}.binary must be a non-empty string when set."
            )
        if effective_mode != "cli":
            raise CouncilConfigError(
                f"members.{name}.binary is only valid when the member's "
                f"effective mode is 'cli' (got {effective_mode!r}). Set "
                f"`mode: cli` on the member or `defaults.mode: cli` to use "
                f"this field."
            )
    if member_enabled:
        if not model:
            raise CouncilConfigError(
                f"members.{name}: enabled members require a non-empty `model`."
            )
        # CLI-mode members authenticate via the subscription bound to
        # the local CLI binary; api_key_ref is not required for them.
        # Manual mode is human-transported and also key-free. Only
        # api-mode members must supply an api_key_ref.
        if effective_mode == "api" and not api_key_ref:
            raise CouncilConfigError(
                f"members.{name}: enabled api-mode members require an `api_key_ref`."
            )
    if api_key_ref is not None:
        _validate_api_key_ref(f"members.{name}", api_key_ref)
    return MemberConfig(
        name=name,
        enabled=member_enabled,
        model=model,
        api_key_ref=api_key_ref,
        mode=member_mode,
        binary=binary,
    )


def _build_cli_call_budget(d: dict[str, Any]) -> CliCallBudgetConfig:
    if not isinstance(d, dict):
        raise CouncilConfigError("`cli_call_budget` must be a mapping.")
    raw_caps = d.get("max_calls_per_day") or {}
    if not isinstance(raw_caps, dict):
        raise CouncilConfigError(
            "`cli_call_budget.max_calls_per_day` must be a mapping."
        )
    caps: dict[str, int] = {}
    for provider, value in raw_caps.items():
        if provider not in _VALID_PROVIDERS:
            raise CouncilConfigError(
                f"cli_call_budget.max_calls_per_day.{provider}: unknown "
                f"provider; valid: {sorted(_VALID_PROVIDERS)}."
            )
        if not isinstance(value, int) or isinstance(value, bool) or value < 0:
            raise CouncilConfigError(
                f"cli_call_budget.max_calls_per_day.{provider} must be a "
                f"non-negative integer (got {value!r})."
            )
        caps[provider] = value
    return CliCallBudgetConfig(max_calls_per_day=caps)


def _build_advisor(name: str, cfg: dict[str, Any]) -> AdvisorConfig:
    if not isinstance(cfg, dict):
        raise CouncilConfigError(f"advisors.{name}: must be a mapping.")
    member = cfg.get("member")
    if member not in _VALID_PROVIDERS:
        raise CouncilConfigError(
            f"advisors.{name}.member={member!r} not a valid provider; "
            f"valid: {sorted(_VALID_PROVIDERS)}."
        )
    # `persona` may be set explicitly; otherwise default to the
    # convention path so the YAML stays terse.
    persona = cfg.get("persona") or f"personas/advisors/{name}.md"
    model = cfg.get("model")
    if model is not None and not isinstance(model, str):
        raise CouncilConfigError(
            f"advisors.{name}.model must be a string when set."
        )
    return AdvisorConfig(
        name=name,
        enabled=bool(cfg.get("enabled", False)),
        member=member,
        persona=persona,
        model=model,
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

