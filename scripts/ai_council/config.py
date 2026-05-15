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
    model_ladder: tuple[str, ...] = ()
    participate_low_impact: bool = False


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


_VALID_NECESSITY_MODES = frozenset({"off", "educate", "block", "warn-only"})
_VALID_DISCLOSURE_MODES = frozenset({"always", "above_threshold", "off"})


@dataclass(frozen=True)
class NecessityClassifierConfig:
    """Council-necessity classifier toggle (Phase 6).

    ``mode`` controls the **agent** invocation path; ``user_explicit_mode``
    controls the **user-explicit** invocation path (step-8 D2 tier split).

    Valid modes ∈ ``{"off", "educate", "block", "warn-only"}``:

    - ``off`` — legacy behaviour: classifier never runs, every request
      proceeds to deliberation.
    - ``educate`` — agent-initiated `unnecessary` skips silently;
      user-explicit `unnecessary` emits the educate paragraph and
      requires ``--proceed-anyway`` (CLI) or a numbered-options
      confirmation (agent surface) before firing members.
    - ``block`` — power-user opt-in: `unnecessary` skips silently
      regardless of override flag.
    - ``warn-only`` — classifier verdict annotated in stdout but
      **never** skips. Default for ``user_explicit_mode`` (step-8 D2).

    Default ``mode`` (agent path) = ``educate``;
    default ``user_explicit_mode`` = ``warn-only``. Reconciles
    "Council always active when called" with "skip trivial agent-side
    requests".

    Per-lens overrides live in :class:`CouncilConfig.lens_overrides`;
    this dataclass carries only the global default.
    """

    enabled: bool = True
    mode: str = "educate"
    user_explicit_mode: str = "warn-only"


@dataclass(frozen=True)
class ModelDowngradeConfig:
    """Model-size downgrade-suggestion toggle (Phase 7).

    When ``enabled`` is true, the dispatcher runs the size-fit
    classifier (:func:`scripts.ai_council.necessity.classify_size_fit`)
    before deliberation. ``fit=False`` triggers a single
    numbered-options prompt offering the suggested cheaper model.

    ``auto_apply`` toggles agent-initiated invocations to silently
    accept the suggested model (logged in ``session.md`` as a
    ``downgraded`` event). User-explicit invocations always see the
    prompt regardless. Default global ON per the roadmap spec; per-lens
    override lives in :class:`LensOverridesConfig`.
    """

    enabled: bool = True
    auto_apply: bool = False


@dataclass(frozen=True)
class CostDisclosureConfig:
    """Pre-flight cost-disclosure toggle (Phase 8).

    ``mode`` ∈ ``{"always", "above_threshold", "off"}``:

    - ``always`` — always emit the disclosure block before deliberation.
    - ``above_threshold`` — emit only when the expected USD spend exceeds
      ``threshold_usd``. Useful for cheap lenses (analysis / default)
      where the prompt would be friction.
    - ``off`` — power-user opt-out, never emit. The hard refusal cap
      still fires regardless (cost ceilings are not optional).

    ``show_per_member`` toggles whether the per-member breakdown is
    surfaced or just the rolled-up totals.
    """

    mode: str = "always"
    threshold_usd: float = 1.00
    show_per_member: bool = True


@dataclass(frozen=True)
class DebateConfig:
    """Debate cost-visibility + hard refusal cap (Phase 8).

    ``max_cost_usd`` is the unconditional refusal cap — when the
    pre-flight ``high_usd`` estimate exceeds this value, the dispatcher
    refuses to start the debate (no prompt, exit non-zero). Mirrored
    mid-run: running spend > cap aborts cleanly after the current round.

    ``cost_disclosure`` controls the pre-flight disclosure block. Both
    are independent — disclosure off + cap on still refuses over-budget
    debates; cap=0 disables the refusal but disclosure still fires.
    """

    max_cost_usd: float = 5.00
    cost_disclosure: CostDisclosureConfig = field(
        default_factory=CostDisclosureConfig,
    )


@dataclass(frozen=True)
class DecisionReplayConfig:
    """Decision-replay artefact toggle (Phase 9).

    ``enabled`` controls whether ``decision-replay.md`` is written
    alongside the session JSON. ``include_member_arguments`` toggles
    the redacted view: when ``False`` the artefact emits consensus +
    dissent COUNT only — no per-member arguments — for sharing without
    leaking which model framed which point.
    """

    enabled: bool = True
    include_member_arguments: bool = True


@dataclass(frozen=True)
class DecisionResolutionEntry:
    """Routing entry for one impact class (Phase 10).

    Attributes:
        mode: One of ``agent`` / ``council`` / ``user``. ``high_impact``
            and ``user_required`` are LOCKED to ``user`` at parse-time
            — overrides are rejected with a CouncilConfigError.
        confidence_threshold: When the classifier's confidence is BELOW
            this value, the entry's ``mode`` is upgraded by one rung
            (agent → council, council → user). ``user`` mode ignores
            the threshold. Default ``0.6``.
    """

    mode: str = "user"
    confidence_threshold: float = 0.6


@dataclass(frozen=True)
class LowImpactFastPathConfig:
    """Hard caps for the lightweight-QA fast-path (Phase 11).

    Lives under ``decision_resolution.fast_path`` in the YAML. Used by
    :mod:`scripts.ai_council.low_impact` to assemble the fast-path
    ``CostBudget`` when a ``low_impact`` question routes to ``council``.

    Attributes:
        max_members: Upper bound on opted-in members invoked per
            resolution. Default ``2``. ``1`` skips quick-consensus
            and returns the single responder's answer; ``2`` runs the
            agreement / disagreement check.
        max_rounds: Locked to ``1`` — the fast-path strips debate.
            Surfaced for documentation; the loader rejects any other
            value with a hard schema error.
        max_tokens: Combined input+output token budget per resolution.
            Default ``2500``. Passed through to ``CostBudget``.
        max_cost_usd: USD cap per resolution. Default ``0.05``.
    """

    max_members: int = 2
    max_rounds: int = 1
    max_tokens: int = 2500
    max_cost_usd: float = 0.05


@dataclass(frozen=True)
class DecisionResolutionConfig:
    """Impact-class → routing map (Phase 10).

    Keyed by impact class (``trivial`` / ``low_impact`` / ``medium_impact``
    / ``high_impact`` / ``user_required``). The Iron Law rule for
    ``high_impact`` and ``user_required`` is enforced by
    :func:`_build_decision_resolution` — those classes MUST route to
    ``user`` and any other value is a hard schema error.

    ``fast_path`` carries the Phase 11 hard caps for the lightweight-QA
    resolver. Only consulted when a ``low_impact`` question routes to
    ``council``.
    """

    enabled: bool = True
    classes: dict[str, DecisionResolutionEntry] = field(default_factory=dict)
    fast_path: LowImpactFastPathConfig = field(
        default_factory=LowImpactFastPathConfig,
    )


@dataclass(frozen=True)
class LensOverridesConfig:
    """Per-lens overrides keyed by lens name (Phase 6+).

    Carries necessity-classifier mode overrides (Phase 6),
    model-downgrade overrides (Phase 7), cost-disclosure overrides
    (Phase 8), and decision-replay overrides (Phase 9).
    """

    necessity_classifier_mode: dict[str, str] = field(default_factory=dict)
    necessity_classifier_user_explicit_mode: dict[str, str] = field(
        default_factory=dict,
    )
    model_downgrade: dict[str, ModelDowngradeConfig] = field(default_factory=dict)
    cost_disclosure: dict[str, CostDisclosureConfig] = field(default_factory=dict)
    decision_replay: dict[str, DecisionReplayConfig] = field(default_factory=dict)


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

    ``warn_at`` is the fractional threshold (0.0–1.0) at which the
    pre-run quota summary in :func:`council_cli.cmd_run` flips its
    prefix to ``⚠️`` and surfaces a ``council:quota · WARN`` line
    (step-8 P1). Default ``0.8`` is the standard ops-monitoring 80 %
    threshold (step-8 D4). Providers without a configured cap are
    omitted from the summary regardless.
    """

    max_calls_per_day: dict[str, int] = field(default_factory=dict)
    warn_at: float = 0.8


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
    necessity_classifier: NecessityClassifierConfig = field(
        default_factory=NecessityClassifierConfig,
    )
    model_downgrade: ModelDowngradeConfig = field(
        default_factory=ModelDowngradeConfig,
    )
    debate: DebateConfig = field(default_factory=DebateConfig)
    decision_replay: DecisionReplayConfig = field(
        default_factory=DecisionReplayConfig,
    )
    decision_resolution: DecisionResolutionConfig = field(
        default_factory=DecisionResolutionConfig,
    )
    lens_overrides: LensOverridesConfig = field(
        default_factory=LensOverridesConfig,
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
    necessity_classifier = _build_necessity_classifier(
        raw.get("necessity_classifier") or {},
    )
    model_downgrade = _build_model_downgrade(raw.get("model_downgrade") or {})
    debate = _build_debate(raw.get("debate") or {})
    decision_replay = _build_decision_replay(
        raw.get("decision_replay") or {}, path="decision_replay",
    )
    decision_resolution = _build_decision_resolution(
        raw.get("decision_resolution") or {},
    )
    lens_overrides = _build_lens_overrides(raw.get("lenses") or {})

    return CouncilConfig(
        enabled=enabled,
        defaults=defaults,
        cost_budget=cost_budget,
        members=members,
        advisors=advisors,
        consensus_scoring=consensus,
        cli_call_budget=cli_call_budget,
        necessity_classifier=necessity_classifier,
        model_downgrade=model_downgrade,
        debate=debate,
        decision_replay=decision_replay,
        decision_resolution=decision_resolution,
        lens_overrides=lens_overrides,
        source_path=source_path,
    )


def _build_necessity_classifier(d: dict[str, Any]) -> NecessityClassifierConfig:
    if not isinstance(d, dict):
        raise CouncilConfigError("`necessity_classifier` must be a mapping.")
    enabled = d.get("enabled", True)
    if not isinstance(enabled, bool):
        raise CouncilConfigError("`necessity_classifier.enabled` must be a bool.")
    mode = d.get("mode", "educate")
    if mode not in _VALID_NECESSITY_MODES:
        raise CouncilConfigError(
            f"necessity_classifier.mode={mode!r} not in "
            f"{sorted(_VALID_NECESSITY_MODES)}."
        )
    user_explicit_mode = d.get("user_explicit_mode", "warn-only")
    if user_explicit_mode not in _VALID_NECESSITY_MODES:
        raise CouncilConfigError(
            f"necessity_classifier.user_explicit_mode="
            f"{user_explicit_mode!r} not in "
            f"{sorted(_VALID_NECESSITY_MODES)}."
        )
    return NecessityClassifierConfig(
        enabled=bool(enabled),
        mode=mode,
        user_explicit_mode=user_explicit_mode,
    )


def _build_model_downgrade(d: dict[str, Any]) -> ModelDowngradeConfig:
    if not isinstance(d, dict):
        raise CouncilConfigError("`model_downgrade` must be a mapping.")
    enabled = d.get("enabled", True)
    if not isinstance(enabled, bool):
        raise CouncilConfigError("`model_downgrade.enabled` must be a bool.")
    auto_apply = d.get("auto_apply", False)
    if not isinstance(auto_apply, bool):
        raise CouncilConfigError("`model_downgrade.auto_apply` must be a bool.")
    return ModelDowngradeConfig(enabled=bool(enabled), auto_apply=bool(auto_apply))


def _build_cost_disclosure(
    d: dict[str, Any], *, path: str,
) -> CostDisclosureConfig:
    if not isinstance(d, dict):
        raise CouncilConfigError(f"`{path}` must be a mapping.")
    mode = d.get("mode", "always")
    if mode not in _VALID_DISCLOSURE_MODES:
        raise CouncilConfigError(
            f"{path}.mode={mode!r} not in {sorted(_VALID_DISCLOSURE_MODES)}."
        )
    threshold = float(d.get("threshold_usd", 1.00))
    if threshold < 0:
        raise CouncilConfigError(
            f"{path}.threshold_usd must be >= 0 (got {threshold!r})."
        )
    show_per_member = d.get("show_per_member", True)
    if not isinstance(show_per_member, bool):
        raise CouncilConfigError(
            f"`{path}.show_per_member` must be a bool."
        )
    return CostDisclosureConfig(
        mode=mode,
        threshold_usd=threshold,
        show_per_member=bool(show_per_member),
    )


def _build_debate(d: dict[str, Any]) -> DebateConfig:
    if not isinstance(d, dict):
        raise CouncilConfigError("`debate` must be a mapping.")
    cap = float(d.get("max_cost_usd", 5.00))
    if cap < 0:
        raise CouncilConfigError(
            f"debate.max_cost_usd must be >= 0 (got {cap!r}; "
            f"use 0 to disable the cap)."
        )
    disclosure_raw = d.get("cost_disclosure") or {}
    disclosure = _build_cost_disclosure(
        disclosure_raw, path="debate.cost_disclosure",
    )
    return DebateConfig(max_cost_usd=cap, cost_disclosure=disclosure)


def _build_decision_replay(
    d: dict[str, Any], *, path: str,
) -> DecisionReplayConfig:
    if not isinstance(d, dict):
        raise CouncilConfigError(f"`{path}` must be a mapping.")
    enabled = d.get("enabled", True)
    if not isinstance(enabled, bool):
        raise CouncilConfigError(f"`{path}.enabled` must be a bool.")
    include_args = d.get("include_member_arguments", True)
    if not isinstance(include_args, bool):
        raise CouncilConfigError(
            f"`{path}.include_member_arguments` must be a bool."
        )
    return DecisionReplayConfig(
        enabled=bool(enabled),
        include_member_arguments=bool(include_args),
    )


_VALID_RESOLUTION_MODES = frozenset({"agent", "council", "user"})
_IMPACT_CLASSES = (
    "trivial", "low_impact", "medium_impact", "high_impact", "user_required",
)
_LOCKED_IMPACT_CLASSES = frozenset({"high_impact", "user_required"})

_DEFAULT_RESOLUTION_MODES: dict[str, str] = {
    "trivial": "agent",
    "low_impact": "agent",
    "medium_impact": "council",
    "high_impact": "user",
    "user_required": "user",
}


def _build_decision_resolution(
    d: dict[str, Any],
) -> DecisionResolutionConfig:
    """Build the impact-class → routing map (Phase 10).

    Enforces the Iron Law: ``high_impact`` and ``user_required`` MUST
    route to ``user``. Any other value is a hard schema error — no
    silent fall-back, no override path.
    """
    if not isinstance(d, dict):
        raise CouncilConfigError("`decision_resolution` must be a mapping.")
    enabled = d.get("enabled", True)
    if not isinstance(enabled, bool):
        raise CouncilConfigError(
            "`decision_resolution.enabled` must be a bool."
        )
    classes_raw = d.get("classes") or {}
    if not isinstance(classes_raw, dict):
        raise CouncilConfigError(
            "`decision_resolution.classes` must be a mapping."
        )
    classes: dict[str, DecisionResolutionEntry] = {}
    for cls in _IMPACT_CLASSES:
        entry_raw = classes_raw.get(cls) or {}
        if not isinstance(entry_raw, dict):
            raise CouncilConfigError(
                f"`decision_resolution.classes.{cls}` must be a mapping."
            )
        mode = entry_raw.get("mode", _DEFAULT_RESOLUTION_MODES[cls])
        if mode not in _VALID_RESOLUTION_MODES:
            raise CouncilConfigError(
                f"decision_resolution.classes.{cls}.mode={mode!r} not in "
                f"{sorted(_VALID_RESOLUTION_MODES)}."
            )
        # Iron Law: high_impact + user_required are locked to user.
        if cls in _LOCKED_IMPACT_CLASSES and mode != "user":
            raise CouncilConfigError(
                f"decision_resolution.classes.{cls}.mode={mode!r}: "
                f"class `{cls}` is LOCKED to `user` (Iron Law) — "
                f"high-impact and user-required decisions never bypass "
                f"the user."
            )
        threshold = float(entry_raw.get("confidence_threshold", 0.6))
        if not 0.0 <= threshold <= 1.0:
            raise CouncilConfigError(
                f"decision_resolution.classes.{cls}.confidence_threshold "
                f"must be in [0.0, 1.0] (got {threshold!r})."
            )
        classes[cls] = DecisionResolutionEntry(
            mode=mode,
            confidence_threshold=threshold,
        )
    fast_path_raw = d.get("fast_path") or {}
    if not isinstance(fast_path_raw, dict):
        raise CouncilConfigError(
            "`decision_resolution.fast_path` must be a mapping."
        )
    fast_path = _build_fast_path(fast_path_raw)
    return DecisionResolutionConfig(
        enabled=bool(enabled),
        classes=classes,
        fast_path=fast_path,
    )


def _build_fast_path(d: dict[str, Any]) -> LowImpactFastPathConfig:
    """Parse `decision_resolution.fast_path` into a frozen config.

    Hard caps for the lightweight-QA resolver (Phase 11). ``max_rounds``
    is locked to ``1`` — any other value is a hard schema error. The
    other fields are positive numbers within sane bounds; out-of-range
    values are rejected to prevent silent token / cost blow-ups.
    """
    max_members = d.get("max_members", 2)
    if not isinstance(max_members, int) or isinstance(max_members, bool):
        raise CouncilConfigError(
            "decision_resolution.fast_path.max_members must be an int "
            f"(got {type(max_members).__name__})."
        )
    if max_members < 1 or max_members > 2:
        raise CouncilConfigError(
            "decision_resolution.fast_path.max_members must be 1 or 2 "
            f"(got {max_members}). Fast-path is by design a 1-2 member "
            "lookup — wider fan-out belongs in the standard council path."
        )
    max_rounds = d.get("max_rounds", 1)
    if max_rounds != 1:
        raise CouncilConfigError(
            "decision_resolution.fast_path.max_rounds is LOCKED to 1 "
            f"(got {max_rounds!r}). Multi-round fast-paths defeat the "
            "purpose — escalate to standard council instead."
        )
    max_tokens = d.get("max_tokens", 2500)
    if (
        not isinstance(max_tokens, int)
        or isinstance(max_tokens, bool)
        or max_tokens <= 0
    ):
        raise CouncilConfigError(
            "decision_resolution.fast_path.max_tokens must be a positive "
            f"int (got {max_tokens!r})."
        )
    max_cost_raw = d.get("max_cost_usd", 0.05)
    if isinstance(max_cost_raw, bool) or not isinstance(
        max_cost_raw, (int, float)
    ):
        raise CouncilConfigError(
            "decision_resolution.fast_path.max_cost_usd must be a "
            f"number (got {type(max_cost_raw).__name__})."
        )
    max_cost = float(max_cost_raw)
    if max_cost <= 0.0:
        raise CouncilConfigError(
            "decision_resolution.fast_path.max_cost_usd must be > 0 "
            f"(got {max_cost!r})."
        )
    return LowImpactFastPathConfig(
        max_members=max_members,
        max_rounds=1,
        max_tokens=max_tokens,
        max_cost_usd=max_cost,
    )



def _build_lens_overrides(d: dict[str, Any]) -> LensOverridesConfig:
    if not isinstance(d, dict):
        raise CouncilConfigError("`lenses` must be a mapping.")
    nc_overrides: dict[str, str] = {}
    nc_user_overrides: dict[str, str] = {}
    md_overrides: dict[str, ModelDowngradeConfig] = {}
    cd_overrides: dict[str, CostDisclosureConfig] = {}
    dr_overrides: dict[str, DecisionReplayConfig] = {}
    for lens_name, lens_cfg in d.items():
        if not isinstance(lens_cfg, dict):
            raise CouncilConfigError(
                f"`lenses.{lens_name}` must be a mapping."
            )
        nc_block = lens_cfg.get("necessity_classifier")
        if nc_block is not None:
            if not isinstance(nc_block, dict):
                raise CouncilConfigError(
                    f"`lenses.{lens_name}.necessity_classifier` must be a mapping."
                )
            mode = nc_block.get("mode")
            if mode is not None:
                if mode not in _VALID_NECESSITY_MODES:
                    raise CouncilConfigError(
                        f"lenses.{lens_name}.necessity_classifier.mode={mode!r} "
                        f"not in {sorted(_VALID_NECESSITY_MODES)}."
                    )
                nc_overrides[lens_name] = mode
            user_mode = nc_block.get("user_explicit_mode")
            if user_mode is not None:
                if user_mode not in _VALID_NECESSITY_MODES:
                    raise CouncilConfigError(
                        f"lenses.{lens_name}.necessity_classifier."
                        f"user_explicit_mode={user_mode!r} "
                        f"not in {sorted(_VALID_NECESSITY_MODES)}."
                    )
                nc_user_overrides[lens_name] = user_mode
        md_block = lens_cfg.get("model_downgrade")
        if md_block is not None:
            if not isinstance(md_block, dict):
                raise CouncilConfigError(
                    f"`lenses.{lens_name}.model_downgrade` must be a mapping."
                )
            md_enabled = md_block.get("enabled", True)
            if not isinstance(md_enabled, bool):
                raise CouncilConfigError(
                    f"`lenses.{lens_name}.model_downgrade.enabled` must be a bool."
                )
            md_auto = md_block.get("auto_apply", False)
            if not isinstance(md_auto, bool):
                raise CouncilConfigError(
                    f"`lenses.{lens_name}.model_downgrade.auto_apply` must be a bool."
                )
            md_overrides[lens_name] = ModelDowngradeConfig(
                enabled=bool(md_enabled),
                auto_apply=bool(md_auto),
            )
        cd_block = lens_cfg.get("cost_disclosure")
        if cd_block is not None:
            cd_overrides[lens_name] = _build_cost_disclosure(
                cd_block, path=f"lenses.{lens_name}.cost_disclosure",
            )
        dr_block = lens_cfg.get("decision_replay")
        if dr_block is not None:
            dr_overrides[lens_name] = _build_decision_replay(
                dr_block, path=f"lenses.{lens_name}.decision_replay",
            )
    return LensOverridesConfig(
        necessity_classifier_mode=nc_overrides,
        necessity_classifier_user_explicit_mode=nc_user_overrides,
        model_downgrade=md_overrides,
        cost_disclosure=cd_overrides,
        decision_replay=dr_overrides,
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
    ladder_raw = cfg.get("model_ladder") or ()
    if not isinstance(ladder_raw, (list, tuple)):
        raise CouncilConfigError(
            f"members.{name}.model_ladder must be a list (got "
            f"{type(ladder_raw).__name__})."
        )
    ladder: tuple[str, ...] = ()
    if ladder_raw:
        entries: list[str] = []
        for entry in ladder_raw:
            if not isinstance(entry, str) or not entry.strip():
                raise CouncilConfigError(
                    f"members.{name}.model_ladder entries must be non-empty "
                    f"strings (got {entry!r})."
                )
            entries.append(entry)
        if member_enabled and model and model not in entries:
            raise CouncilConfigError(
                f"members.{name}.model_ladder must include the active "
                f"`model` ({model!r}); got {entries!r}."
            )
        ladder = tuple(entries)
    participate_raw = cfg.get("participate_low_impact", False)
    if not isinstance(participate_raw, bool):
        raise CouncilConfigError(
            f"members.{name}.participate_low_impact must be a bool "
            f"(got {type(participate_raw).__name__})."
        )
    return MemberConfig(
        name=name,
        enabled=member_enabled,
        model=model,
        api_key_ref=api_key_ref,
        mode=member_mode,
        binary=binary,
        model_ladder=ladder,
        participate_low_impact=participate_raw,
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
    warn_at_raw = d.get("warn_at", 0.8)
    if isinstance(warn_at_raw, bool) or not isinstance(warn_at_raw, (int, float)):
        raise CouncilConfigError(
            f"cli_call_budget.warn_at must be a number in [0.0, 1.0] "
            f"(got {warn_at_raw!r})."
        )
    warn_at = float(warn_at_raw)
    if not 0.0 <= warn_at <= 1.0:
        raise CouncilConfigError(
            f"cli_call_budget.warn_at must be in [0.0, 1.0] (got {warn_at})."
        )
    return CliCallBudgetConfig(max_calls_per_day=caps, warn_at=warn_at)


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

