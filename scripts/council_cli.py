#!/usr/bin/env python3
"""Council CLI — `./agent-config council:{estimate,run,render}`.

Wraps `scripts.ai_council.orchestrator` for non-interactive callers.
Subcommands:

  estimate  Bundle + estimate per-member cost (no API call, no spend).
  run       Same + estimate, then call the council. Requires --confirm.
  render    Re-render a saved responses JSON to the markdown report.

`./agent-config` is non-interactive by contract — the cost gate is an
explicit `--confirm` flag, never an interactive y/n.
"""
from __future__ import annotations

import argparse
import json
import sys
from dataclasses import asdict
from pathlib import Path
from typing import Any

import yaml

REPO_ROOT = Path(__file__).resolve().parents[1]
SETTINGS_FILE = REPO_ROOT / ".agent-settings.yml"
AI_COUNCIL_FILE = REPO_ROOT / "agents" / ".ai-council.yml"

# Canonical output dirs per ai-council § "Output path convention".
# Enforced at write-time by `_validate_council_output_path` so shell-side
# `>` redirects and forgetful agents can't strand artefacts at agents/ root.
COUNCIL_CANONICAL_DIRS: dict[str, str] = {
    "responses": "agents/council-responses",
    "sessions":  "agents/council-sessions",
    "questions": "agents/council-questions",
}


def _validate_council_output_path(
    path_str: str, *, kind: str, subcommand: str,
) -> Path:
    """Reject non-canonical --output paths at write-time.

    `kind` selects the expected canonical dir (`responses`, `sessions`,
    `questions`). Raises `argparse.ArgumentTypeError` on violation so
    `main()` surfaces a clean ❌ message and returns 2.
    """
    expected_rel = COUNCIL_CANONICAL_DIRS[kind]
    expected_abs = (REPO_ROOT / expected_rel).resolve()
    p = Path(path_str)
    target = p if p.is_absolute() else (REPO_ROOT / p)
    target_resolved = target.resolve()
    try:
        target_resolved.relative_to(expected_abs)
    except ValueError as exc:
        raise argparse.ArgumentTypeError(
            f"council:{subcommand} --output must live under "
            f"{expected_rel}/ (per ai-council § Output path convention); "
            f"got {path_str!r}."
        ) from exc
    return p

sys.path.insert(0, str(REPO_ROOT))

from scripts.ai_council.bundler import (  # noqa: E402
    BundleTooLarge, bundle_prompt, bundle_roadmap,
)
from scripts.ai_council.clients import (  # noqa: E402
    DEFAULT_MAX_TOKENS, UNLIMITED_TOKENS_FALLBACK,
    AnthropicClient, AnthropicCliClient, CliClient, CliClientError,
    CouncilResponse, ExternalAIClient, GeminiClient, GeminiCliClient,
    ManualClient, OpenAIClient, OpenAICliClient, PerplexityClient,
    PerplexityCliClient, XAIClient, XAICliClient,
    load_anthropic_key, load_cli_call_counts, load_openai_key,
    quota_summary_line, reset_cli_call_counts,
)
from scripts.ai_council.advisors import (  # noqa: E402
    AdvisorPlan, build_persona_labels, plan_advisor_swap,
)
from scripts.ai_council.cli_hints import format_install_hints  # noqa: E402
from scripts.ai_council.config import (  # noqa: E402
    AdvisorConfig, CouncilConfig, CouncilConfigError,
    load_council_config, resolve_api_key,
)
from scripts.ai_council.solo_dispatch import (  # noqa: E402
    AuthCache, select_solo_member,
)
from scripts.ai_council.modes import (  # noqa: E402
    InvalidModeError, resolve_mode,
)
from scripts.ai_council.events_log import append_event  # noqa: E402
from scripts.ai_council.necessity import (  # noqa: E402
    ClassificationResult, SizeFitVerdict, classify_necessity,
    classify_size_fit, downgrade_message, educate_message,
)
from scripts.ai_council.orchestrator import (  # noqa: E402
    ConsensusResult,
    CostBudget, CouncilQuestion, DebateCapExceeded, DebateCheckpoint,
    DebateCostEstimate,
    PeerReviewResult, consult, estimate, estimate_debate_cost, render,
    run_consensus_scoring, run_debate, run_peer_review,
)
from scripts.ai_council.pricing import (  # noqa: E402
    PriceTable, estimate_cost, load_prices,
)
from scripts.ai_council.project_context import detect_project_context  # noqa: E402
from scripts.ai_council.replay import (  # noqa: E402
    DecisionReplayInputs, render_decision_replay,
)

SCHEMA_VERSION = 1

#: Provider names accepted under `mode=api`. Mirrors the routing table
#: in ``_construct_api_member``; both must stay in sync.
_API_PROVIDERS = frozenset({"anthropic", "openai", "gemini", "xai", "perplexity"})

#: Provider names with a wired ``mode=cli`` subclass. Mirrors the
#: routing table in ``_construct_cli_member``; both must stay in sync.
#: Phase 2 ships ``anthropic``; Phase 3 adds ``openai`` + ``gemini``;
#: Phase 4 adds ``xai`` + ``perplexity`` (community CLIs, no
#: subscription savings — they still consume the API key and remain
#: ``billable=True``).
_CLI_PROVIDERS = frozenset({"anthropic", "openai", "gemini", "xai", "perplexity"})


class CouncilDisabledError(RuntimeError):
    """Raised when ai_council.enabled is false or no member is enabled."""


def load_settings(
    path: Path = SETTINGS_FILE,
    *,
    ai_council_path: Path = AI_COUNCIL_FILE,
) -> dict[str, Any]:
    """Load merged settings via the centralized loader.

    road-to-portable-dev-preferences P3 migration: tolerance contract
    (missing file / malformed YAML / no PyYAML) is handled uniformly by
    ``load_agent_settings``. ``ai_council.*`` keys are not whitelisted,
    so the project file remains authoritative for council config.

    Step-2 council-redesign overlay: when ``agents/.ai-council.yml``
    exists it is the single source of truth — the validated config is
    synthesized back into ``settings['ai_council']`` and wins over any
    legacy block in ``.agent-settings.yml``. The pre-2 path stays alive
    so the migration breadcrumb in ``.agent-settings.yml`` can ship
    independently.
    """
    from scripts._lib.agent_settings import load_agent_settings
    settings = load_agent_settings(project_path=path)
    if ai_council_path.exists():
        cfg = load_council_config(ai_council_path)
        settings["ai_council"] = _synthesize_ai_council_block(cfg)
    return settings


def _synthesize_ai_council_block(cfg: CouncilConfig) -> dict[str, Any]:
    """Project a validated ``CouncilConfig`` onto the legacy dict shape.

    ``build_members`` and the ``_resolve_*`` helpers read the legacy
    ``ai_council.*`` keys — keeping the projection identical means no
    downstream caller changes. ``api_key_ref`` is carried through; raw
    keys are never resolved here (resolution is lazy, per enabled
    member, inside ``_construct_api_member``).
    """
    members: dict[str, dict[str, Any]] = {}
    for name, m in cfg.members.items():
        entry: dict[str, Any] = {"enabled": m.enabled, "model": m.model}
        if m.api_key_ref is not None:
            entry["api_key_ref"] = m.api_key_ref
        if m.mode is not None:
            entry["mode"] = m.mode
        if m.binary is not None:
            entry["binary"] = m.binary
        if m.model_ladder:
            entry["model_ladder"] = list(m.model_ladder)
        members[name] = entry
    advisors: dict[str, dict[str, Any]] = {}
    for name, a in cfg.advisors.items():
        entry = {
            "enabled": a.enabled,
            "member": a.member,
            "persona": a.persona,
        }
        if a.model is not None:
            entry["model"] = a.model
        advisors[name] = entry
    return {
        "enabled": cfg.enabled,
        "mode": cfg.defaults.mode,
        "min_rounds": cfg.defaults.min_rounds,
        "deep_min_rounds": cfg.defaults.deep_min_rounds,
        "max_output_tokens": cfg.defaults.max_output_tokens,
        "session_retention_days": cfg.defaults.session_retention_days,
        "debate_max_rounds": cfg.defaults.debate_max_rounds,
        "cost_budget": {
            "max_input_tokens": cfg.cost_budget.max_input_tokens,
            "max_output_tokens": cfg.cost_budget.max_output_tokens,
            "max_calls": cfg.cost_budget.max_calls,
            "max_total_usd": cfg.cost_budget.max_total_usd,
        },
        "consensus_scoring": {
            "enabled": cfg.consensus_scoring.enabled,
            "strong_threshold": cfg.consensus_scoring.strong_threshold,
            "minority_threshold": cfg.consensus_scoring.minority_threshold,
            "lenses": list(cfg.consensus_scoring.lenses),
        },
        "cli_call_budget": {
            "max_calls_per_day": dict(cfg.cli_call_budget.max_calls_per_day),
            "warn_at": cfg.cli_call_budget.warn_at,
        },
        "necessity_classifier": {
            "enabled": cfg.necessity_classifier.enabled,
            "mode": cfg.necessity_classifier.mode,
            "user_explicit_mode": cfg.necessity_classifier.user_explicit_mode,
        },
        "model_downgrade": {
            "enabled": cfg.model_downgrade.enabled,
            "auto_apply": cfg.model_downgrade.auto_apply,
        },
        "debate": {
            "max_cost_usd": cfg.debate.max_cost_usd,
            "cost_disclosure": {
                "mode": cfg.debate.cost_disclosure.mode,
                "threshold_usd": cfg.debate.cost_disclosure.threshold_usd,
                "show_per_member": cfg.debate.cost_disclosure.show_per_member,
            },
        },
        "lens_overrides": {
            "necessity_classifier_mode": dict(
                cfg.lens_overrides.necessity_classifier_mode,
            ),
            "necessity_classifier_user_explicit_mode": dict(
                cfg.lens_overrides.necessity_classifier_user_explicit_mode,
            ),
            "model_downgrade": {
                lens: {"enabled": md.enabled, "auto_apply": md.auto_apply}
                for lens, md in cfg.lens_overrides.model_downgrade.items()
            },
            "cost_disclosure": {
                lens: {
                    "mode": cd.mode,
                    "threshold_usd": cd.threshold_usd,
                    "show_per_member": cd.show_per_member,
                }
                for lens, cd in cfg.lens_overrides.cost_disclosure.items()
            },
        },
        "members": members,
        "advisors": advisors,
    }


def build_members(
    settings: dict[str, Any],
    *,
    invocation_mode: str | None = None,
    model_overrides: dict[str, str] | None = None,
    siblings_overrides: dict[str, list[str]] | None = None,
    skipped: list[dict[str, Any]] | None = None,
) -> list[ExternalAIClient]:
    """Construct enabled council members from settings.

    Honours `ai_council.enabled` (master switch) and per-member
    `enabled` flags. Raises `CouncilDisabledError` when the council is
    off or no member is wired up.

    `model_overrides` is a per-invocation `{member_name: model_id}`
    map that wins over the per-member `model` in settings. Members not
    listed fall back to the settings value, then the per-client default.

    `siblings_overrides` is a per-invocation `{member_name: [model, ...]}`
    map that fans the named provider out to multiple sibling models in
    one run (e.g. claude-sonnet-4-5 + claude-opus-4-1). Each model
    becomes its own billable member with independent cost tracking.
    Mutually exclusive with `model_overrides` for the same provider;
    requires `mode=api`; provider must be enabled in settings.

    `skipped` is an optional caller-owned list. When provided, each
    cli-mode member that fails to construct (binary missing) is appended
    as `{"member": <name>, "reason": "binary_missing", "detail": <msg>}`
    instead of crashing the loop. The skip is also surfaced on stderr
    as `[council] SKIP <name>: <detail>` so the run log carries it
    even when the caller passes ``None``. Phase 5 Step 2 contract:
    a missing CLI binary degrades that member only — never silently
    drops, never crashes the whole council unless every configured
    member ends up skipped.
    """
    ai = (settings.get("ai_council") or {}) if isinstance(settings, dict) else {}
    if not ai.get("enabled"):
        raise CouncilDisabledError(
            "ai_council.enabled is false in .agent-settings.yml — "
            "flip it on before invoking council:* commands."
        )
    members_cfg = ai.get("members") or {}
    global_mode = ai.get("mode")
    cli_budget_cfg = (ai.get("cli_call_budget") or {}) if isinstance(ai, dict) else {}
    cli_caps = (cli_budget_cfg.get("max_calls_per_day") or {}) if isinstance(cli_budget_cfg, dict) else {}
    cli_warn_at = float(cli_budget_cfg.get("warn_at", 0.8)) if isinstance(cli_budget_cfg, dict) else 0.8
    overrides = model_overrides or {}
    siblings = siblings_overrides or {}
    unknown = set(overrides) - set(members_cfg)
    if unknown:
        raise CouncilDisabledError(
            f"--model targets unknown member(s) {sorted(unknown)!r}; "
            f"known members: {sorted(members_cfg)!r}."
        )
    unknown_sib = set(siblings) - set(members_cfg)
    if unknown_sib:
        raise CouncilDisabledError(
            f"--siblings targets unknown member(s) {sorted(unknown_sib)!r}; "
            f"known members: {sorted(members_cfg)!r}."
        )
    conflict = set(overrides) & set(siblings)
    if conflict:
        raise CouncilDisabledError(
            f"--model and --siblings target the same member(s) {sorted(conflict)!r}; "
            f"pick one per provider per invocation."
        )
    members: list[ExternalAIClient] = []
    for name, cfg in members_cfg.items():
        cfg = cfg or {}
        if not cfg.get("enabled"):
            if name in siblings:
                raise CouncilDisabledError(
                    f"--siblings targets member {name!r} but it is not "
                    f"enabled in .agent-settings.yml (ai_council.members.{name}.enabled)."
                )
            continue
        mode = resolve_mode(
            name,
            invocation_mode=invocation_mode,
            member_settings=cfg,
            global_mode=global_mode,
        )
        if name in siblings:
            if mode != "api":
                raise CouncilDisabledError(
                    f"--siblings requires mode=api for member {name!r} (got {mode!r})."
                )
            api_key_ref = cfg.get("api_key_ref")
            for sib_model in siblings[name]:
                members.append(
                    _construct_api_member(name, sib_model, api_key_ref=api_key_ref),
                )
            continue
        model = overrides.get(name) or cfg.get("model")
        if mode == "api" and name in _API_PROVIDERS:
            members.append(
                _construct_api_member(name, model, api_key_ref=cfg.get("api_key_ref")),
            )
        elif mode == "cli" and name in _CLI_PROVIDERS:
            try:
                members.append(
                    _construct_cli_member(
                        name,
                        model,
                        binary=cfg.get("binary"),
                        max_calls_per_day=cli_caps.get(name),
                        warn_at=cli_warn_at,
                    ),
                )
            except CliClientError as exc:
                _, _, display = _CLI_FACTORY[name]
                detail = (
                    f"{exc} Install the {display} CLI or flip "
                    f"ai_council.members.{name}.mode back to 'api'."
                )
                entry = {
                    "member": name,
                    "reason": "binary_missing",
                    "detail": detail,
                }
                if skipped is not None:
                    skipped.append(entry)
                print(f"[council] SKIP {name}: {detail}", file=sys.stderr)
                continue
        elif mode == "cli":
            raise CouncilDisabledError(
                f"member {name!r} resolves to mode=cli but no CLI client is "
                f"wired (known: {sorted(_CLI_PROVIDERS)!r})."
            )
        elif mode == "manual":
            members.append(ManualClient(name=name, model=model or "manual"))
        elif mode == "playwright":
            raise CouncilDisabledError(
                f"member {name!r} resolves to mode=playwright (Phase 2c, not wired)."
            )
        else:
            raise CouncilDisabledError(
                f"member {name!r} has no transport — mode={mode}, "
                f"name not in {sorted(_API_PROVIDERS)!r}."
            )
    if not members:
        if skipped:
            names = ", ".join(s["member"] for s in skipped)
            raise CouncilDisabledError(
                f"no council member could be constructed — every enabled "
                f"member was skipped ({names}). See [council] SKIP entries "
                f"on stderr for the per-member reason."
            )
        raise CouncilDisabledError(
            "no council member has `enabled: true` — enable at least one in "
            ".agent-settings.yml under ai_council.members.*."
        )
    return members


def _build_advisor_plans(
    ai_cfg: dict[str, Any],
    repo_root: Path,
) -> dict[str, AdvisorPlan]:
    """Reconstruct AdvisorConfig from the projected dict, then plan swaps.

    The legacy ``ai_council.advisors`` dict shape is the projection
    written by ``_synthesize_ai_council_block``. Disabled advisors are
    silently skipped by ``plan_advisor_swap``; one-per-provider is
    enforced there. Returns empty when no advisor block is present.
    """
    raw = ai_cfg.get("advisors") if isinstance(ai_cfg, dict) else None
    if not raw:
        return {}
    advisors: dict[str, AdvisorConfig] = {}
    for name, entry in raw.items():
        if not isinstance(entry, dict):
            continue
        advisors[name] = AdvisorConfig(
            name=name,
            enabled=bool(entry.get("enabled", False)),
            member=str(entry.get("member", "")),
            persona=str(entry.get("persona", "")),
            model=entry.get("model"),
        )
    return plan_advisor_swap(advisors, repo_root)


def _advisor_model_overrides(
    plans: dict[str, AdvisorPlan],
    explicit: dict[str, str] | None,
) -> dict[str, str]:
    """Merge advisor model_overrides under explicit ``--model`` flags.

    Explicit CLI ``--model`` overrides win over advisor-bound model
    overrides — the user's flag is always authoritative.
    """
    merged: dict[str, str] = {}
    for member, plan in plans.items():
        if plan.model_override:
            merged[member] = plan.model_override
    if explicit:
        merged.update(explicit)
    return merged


def _format_advisor_summary(
    plans: dict[str, AdvisorPlan],
    members: list[ExternalAIClient],
) -> str:
    """Render the ``advisor: <persona> on <member> via <model>`` lines."""
    if not plans:
        return ""
    member_models = {m.name: m.model for m in members}
    rows: list[str] = []
    for member, plan in plans.items():
        model = member_models.get(member, plan.model_override or "?")
        rows.append(
            f"  advisor: {plan.display_name} on {member} via {model}"
        )
    return "\n".join(rows)


def _construct_api_member(
    name: str,
    model: str | None,
    *,
    api_key_ref: str | None = None,
) -> ExternalAIClient:
    """Build an api-mode client for a known provider name.

    ``api_key_ref`` carries the validated ``file:<path>`` / ``env:<VAR>``
    reference from ``agents/.ai-council.yml`` and is resolved lazily here
    so the council does not require keys for disabled providers. When
    ``api_key_ref`` is ``None`` (no new config yet, or legacy code path),
    fall back to the per-provider loaders so the pre-step-2
    ``.agent-settings.yml`` flow keeps working during migration. Tests
    monkeypatch the legacy loaders — that path stays intact.
    """
    if name == "anthropic":
        api_key = (
            resolve_api_key(api_key_ref, scope="ai_council.members.anthropic")
            if api_key_ref else load_anthropic_key()
        )
        return AnthropicClient(model=model or "claude-sonnet-4-5", api_key=api_key)
    if name == "openai":
        api_key = (
            resolve_api_key(api_key_ref, scope="ai_council.members.openai")
            if api_key_ref else load_openai_key()
        )
        return OpenAIClient(model=model or "gpt-4o", api_key=api_key)
    if name == "gemini":
        if not api_key_ref:
            raise CouncilDisabledError(
                "member 'gemini' requires api_key_ref in agents/.ai-council.yml "
                "(e.g. `env:GEMINI_API_KEY`) — no legacy fallback."
            )
        api_key = resolve_api_key(api_key_ref, scope="ai_council.members.gemini")
        return GeminiClient(model=model or "gemini-2.5-pro", api_key=api_key)
    if name == "xai":
        if not api_key_ref:
            raise CouncilDisabledError(
                "member 'xai' requires api_key_ref in agents/.ai-council.yml "
                "(e.g. `env:XAI_API_KEY`) — no legacy fallback."
            )
        api_key = resolve_api_key(api_key_ref, scope="ai_council.members.xai")
        return XAIClient(model=model or "grok-4", api_key=api_key)
    if name == "perplexity":
        if not api_key_ref:
            raise CouncilDisabledError(
                "member 'perplexity' requires api_key_ref in agents/.ai-council.yml "
                "(e.g. `env:PERPLEXITY_API_KEY`) — no legacy fallback."
            )
        api_key = resolve_api_key(api_key_ref, scope="ai_council.members.perplexity")
        return PerplexityClient(model=model or "sonar-pro", api_key=api_key)
    raise CouncilDisabledError(
        f"member {name!r} has no api transport "
        f"(known: {sorted(_API_PROVIDERS)!r})."
    )


#: Provider → (class-attribute-name, default_model, human_display) for
#: cli-mode routing. The class ref is looked up via ``getattr`` on this
#: module at call time so ``monkeypatch.setattr(council_cli, "AnthropicCliClient", X)``
#: keeps working from tests. The display string is used by
#: ``build_members`` to render the "Install the <X> CLI" hint in
#: skip-with-reason logs without re-importing every subclass at the
#: call site.
_CLI_FACTORY: dict[str, tuple[str, str, str]] = {
    "anthropic": ("AnthropicCliClient", "claude-sonnet-4-5", "Claude"),
    "openai": ("OpenAICliClient", "gpt-5", "Codex"),
    "gemini": ("GeminiCliClient", "gemini-2.5-pro", "Gemini"),
    "xai": ("XAICliClient", "grok-4", "Grok (community)"),
    "perplexity": ("PerplexityCliClient", "sonar-pro", "Perplexity (community)"),
}


def _construct_cli_member(
    name: str,
    model: str | None,
    *,
    binary: str | None = None,
    max_calls_per_day: int | None = None,
    warn_at: float = 0.8,
) -> ExternalAIClient:
    """Build a cli-mode client for a known provider name.

    ``binary`` overrides the provider default (e.g. ``/opt/claude``);
    ``None`` falls through to ``shutil.which(default_binary)``. The
    daily quota is plumbed through to the subclass; ``None`` disables
    the local counter (only stderr-based quota detection remains).
    ``warn_at`` (step-8 P1) is the fractional threshold flipping the
    pre-run quota summary to its ``⚠️`` shape; default 0.8 mirrors
    ``CliCallBudgetConfig``.
    Lets the subclass' ``CliClientError`` propagate so ``build_members``
    can convert it into a structured per-member skip entry without
    crashing the whole council (the original "fail loudly for the
    entire council" contract is preserved when no other member
    survives — the empty-members guard at the end of ``build_members``
    fires with the skip log attached).
    """
    if name in _CLI_FACTORY:
        attr, default_model, _display = _CLI_FACTORY[name]
        cls = globals()[attr]
        return cls(
            model=model or default_model,
            binary=binary,
            max_calls_per_day=max_calls_per_day,
            warn_at=warn_at,
        )
    raise CouncilDisabledError(
        f"member {name!r} has no cli transport "
        f"(known: {sorted(_CLI_PROVIDERS)!r})."
    )


def build_question(
    *,
    input_path: Path,
    input_mode: str,
    max_tokens: int,
    prompt_mode_override: str | None = None,
) -> tuple[CouncilQuestion, str]:
    """Bundle the input file. Returns (question, artefact_label).

    `prompt_mode_override` swaps the per-mode neutrality addendum looked
    up by `system_prompt_for(question.mode, ...)`. The bundle shape is
    unchanged — the bundler still uses `input_mode` to format the
    artefact. Routed by the `/council pr|design|optimize|analysis`
    wrappers via the `--prompt-mode` CLI flag.
    """
    if input_mode == "prompt":
        text = input_path.read_text(encoding="utf-8")
        ctx = bundle_prompt(text)
        artefact = str(input_path)
    elif input_mode == "roadmap":
        ctx = bundle_roadmap(input_path)
        artefact = str(input_path)
    else:
        raise ValueError(
            f"unsupported input mode: {input_mode!r} (use prompt | roadmap)"
        )
    mode = prompt_mode_override or ctx.mode
    return CouncilQuestion(mode=mode, user_prompt=ctx.text,
                           max_tokens=max_tokens), artefact


def format_estimate_table(
    members: list[ExternalAIClient],
    estimates: list[Any],
    *,
    consensus_delta_usd: float = 0.0,
    consensus_extra_calls: int = 0,
    peer_review_delta_usd: float = 0.0,
    peer_review_extra_calls: int = 0,
) -> str:
    rows = [
        f"  {m.name}/{m.model}: "
        f"~{e.input_tokens} in + {e.output_tokens} out  =  ${e.total_usd:.4f}"
        for m, e in zip(members, estimates)
    ]
    total = sum(e.total_usd for e in estimates)
    if consensus_extra_calls > 0:
        rows.append(
            f"  +consensus scoring: +{consensus_extra_calls} calls "
            f"(~+${consensus_delta_usd:.4f})"
        )
        total += consensus_delta_usd
    if peer_review_extra_calls > 0:
        rows.append(
            f"  +peer-review: +{peer_review_extra_calls} calls "
            f"(~+${peer_review_delta_usd:.4f})"
        )
        total += peer_review_delta_usd
    rows.append(f"  TOTAL:  ${total:.4f}")
    return "\n".join(rows)


def _consensus_cost_delta(
    ai_cfg: dict[str, Any],
    prompt_mode: str,
    estimates: list[Any],
    n_billable: int,
) -> tuple[int, float]:
    """Return ``(extra_calls, extra_usd)`` for the consensus round.

    Active when ``ai_council.consensus_scoring.enabled`` is true AND the
    invocation's lens is in ``consensus_scoring.lenses``. Each member
    contributes two extra calls (extraction + scoring); the worst-case
    cost uses the base per-member estimate as a ceiling.
    """
    cs = ai_cfg.get("consensus_scoring") or {}
    if not cs.get("enabled"):
        return 0, 0.0
    lenses = cs.get("lenses") or ["analysis"]
    if prompt_mode not in lenses:
        return 0, 0.0
    extra_calls = 2 * n_billable
    extra_usd = 2.0 * sum(e.total_usd for e in estimates)
    return extra_calls, extra_usd


def _maybe_run_consensus(
    ai_cfg: dict[str, Any],
    question: CouncilQuestion,
    members: list[ExternalAIClient],
    responses: list[CouncilResponse],
    budget: CostBudget,
    table: PriceTable,
    project: Any,
    args: argparse.Namespace,
) -> ConsensusResult | None:
    """Run the consensus scoring round when enabled for this lens."""
    cs = ai_cfg.get("consensus_scoring") or {}
    if not cs.get("enabled"):
        return None
    lenses = cs.get("lenses") or ["analysis"]
    if question.mode not in lenses:
        return None
    return run_consensus_scoring(
        members, responses,
        budget=budget, table=table, project=project,
        original_ask=args.original_ask,
        max_tokens=question.max_tokens,
        strong_threshold=float(cs.get("strong_threshold", 0.7)),
        minority_threshold=float(cs.get("minority_threshold", 0.4)),
    )


def _serialise_consensus(consensus: ConsensusResult) -> dict[str, Any]:
    """Project ConsensusResult onto a JSON-safe dict for session payloads."""
    return {
        "findings": [
            {"id": f.id, "source": f.source, "text": f.text}
            for f in consensus.findings
        ],
        "scores": [
            {
                "finding_id": s.finding_id, "scorer": s.scorer,
                "score": s.score, "agree": s.agree, "reason": s.reason,
            }
            for s in consensus.scores
        ],
        "metadata": {
            fid: {
                "mean_score": m.mean_score,
                "agreement_rate": m.agreement_rate,
                "consensus_strength": m.consensus_strength,
                "dissent_count": m.dissent_count,
                "scorers": list(m.scorers),
                "concur_count": m.concur_count,
                "dissent_reasons": [list(pair) for pair in m.dissent_reasons],
                "evidence_quality": m.evidence_quality,
            }
            for fid, m in consensus.metadata.items()
        },
        "extraction_responses": _serialise_responses(consensus.extraction_responses),
        "scoring_responses": _serialise_responses(consensus.scoring_responses),
    }


def _decision_replay_settings(
    ai_cfg: dict[str, Any], lens: str,
) -> tuple[bool, bool]:
    """Resolve (enabled, include_member_arguments) for ``lens``.

    Per-lens override under ``lenses.<lens>.decision_replay`` beats the
    global ``decision_replay`` block. Defaults: enabled=True,
    include_member_arguments=True (Phase 9 ships ON by default — the
    artefact is the audit trail GPT review of PR #148 called out as
    missing).
    """
    global_block = ai_cfg.get("decision_replay") or {}
    enabled = global_block.get("enabled", True)
    include_args = global_block.get("include_member_arguments", True)
    lenses = ai_cfg.get("lenses") or {}
    lens_block = (lenses.get(lens) or {}).get("decision_replay")
    if isinstance(lens_block, dict):
        if "enabled" in lens_block:
            enabled = lens_block["enabled"]
        if "include_member_arguments" in lens_block:
            include_args = lens_block["include_member_arguments"]
    return bool(enabled), bool(include_args)


def _maybe_write_decision_replay(
    *,
    ai_cfg: dict[str, Any],
    lens: str,
    out_path: Path,
    consensus: ConsensusResult | None,
    deliberation: list[CouncilResponse],
    original_ask: str,
) -> Path | None:
    """Write ``decision-replay.md`` alongside ``out_path`` when enabled.

    No-op when ``decision_replay.enabled`` resolves to ``False`` for the
    lens or when ``consensus`` is ``None`` (nothing to replay). Returns
    the artefact path on success, ``None`` otherwise.
    """
    enabled, include_args = _decision_replay_settings(ai_cfg, lens)
    if not enabled or consensus is None:
        return None
    replay = render_decision_replay(
        DecisionReplayInputs(
            findings=list(consensus.findings),
            scores=list(consensus.scores),
            metadata=dict(consensus.metadata),
            deliberation=deliberation,
            original_ask=original_ask,
            include_member_arguments=include_args,
        ),
    )
    target = out_path.parent / "decision-replay.md"
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(replay, encoding="utf-8")
    return target


# ── peer-review (Phase 5 / F1, Karpathy anonymous review) ──────────


def _peer_review_active(ai_cfg: dict[str, Any], args: argparse.Namespace) -> bool:
    """Return True when peer-review should fire for this invocation.

    Resolution chain (highest priority first):
      1. ``--peer-review`` CLI flag — explicit opt-in.
      2. ``ai_council.peer_review.enabled: true`` in
         ``agents/.ai-council.yml`` — opt-in via config.
    Both default to false; peer-review is opt-in by R2 verdict.
    """
    if getattr(args, "peer_review", False):
        return True
    pr_cfg = ai_cfg.get("peer_review") or {}
    return bool(pr_cfg.get("enabled"))


def _peer_review_cost_delta(
    ai_cfg: dict[str, Any],
    args: argparse.Namespace,
    estimates: list[Any],
    n_billable: int,
) -> tuple[int, float]:
    """Return ``(extra_calls, extra_usd)`` for the peer-review round.

    One extra call per billable member (each reviews the others). The
    worst-case cost uses the base per-member estimate as a ceiling —
    same heuristic as ``_consensus_cost_delta``.
    """
    if not _peer_review_active(ai_cfg, args):
        return 0, 0.0
    if n_billable < 2:
        # Need ≥ 2 distinct deliberation outputs for peer-review to
        # have anything to review. The orchestrator no-ops below 2.
        return 0, 0.0
    extra_calls = n_billable
    extra_usd = sum(e.total_usd for e in estimates)
    return extra_calls, extra_usd


def _maybe_run_peer_review(
    ai_cfg: dict[str, Any],
    args: argparse.Namespace,
    question: CouncilQuestion,
    members: list[ExternalAIClient],
    responses: list[CouncilResponse],
    budget: CostBudget,
    table: PriceTable,
    project: Any,
    *,
    persona_labels: dict[str, str] | None = None,
) -> PeerReviewResult | None:
    """Run the peer-review pass when opted in.

    No-ops if fewer than 2 successful deliberation responses exist —
    the orchestrator surfaces the empty result in that case.

    ``persona_labels`` (Phase 6) flows through to ``anonymize_responses``
    so advisor-mode runs render as ``Response A (Contrarian)`` instead
    of bare ``Response A``. Plain-member runs pass ``None``.
    """
    if not _peer_review_active(ai_cfg, args):
        return None
    result = run_peer_review(
        members, responses,
        budget=budget, table=table, project=project,
        original_ask=args.original_ask,
        max_tokens=question.max_tokens,
        persona_labels=persona_labels,
    )
    if not result.responses:
        return None
    return result


def _serialise_peer_review(peer_review: PeerReviewResult) -> dict[str, Any]:
    """Project PeerReviewResult onto a JSON-safe dict for session payloads."""
    return {
        "responses": _serialise_responses(peer_review.responses),
        "label_to_source": dict(peer_review.label_to_source),
        "persona_labels": dict(peer_review.persona_labels),
    }


def _deserialise_peer_review(
    data: dict[str, Any] | None,
) -> PeerReviewResult | None:
    """Reconstruct a PeerReviewResult from a session payload section.

    Returns ``None`` for payloads predating Phase 5 or runs where the
    flag was not passed.
    """
    if not data:
        return None
    return PeerReviewResult(
        responses=_deserialise_responses(data.get("responses") or []),
        label_to_source=dict(data.get("label_to_source") or {}),
        persona_labels=dict(data.get("persona_labels") or {}),
    )


# ── subcommands ─────────────────────────────────────────────────────


def _resolve_rounds(args: argparse.Namespace, ai_cfg: dict[str, Any]) -> int:
    """Resolve effective debate round count from CLI args + settings.

    Resolution chain (highest priority first):
      1. ``--rounds N`` — explicit user override, any value.
      2. ``--depth deep`` — uses ``ai_council.deep_min_rounds``,
         floored at ``min_rounds`` so the deep tier is monotonic.
      3. ``ai_council.min_rounds`` — default 2.

    Sub-commands (rule/skill/command) declare ``council_depth: deep``
    in their frontmatter; the host agent reads that and translates it
    to ``--depth deep`` on the CLI invocation. The CLI itself stays
    unaware of frontmatter — the contract is the flag.
    """
    if getattr(args, "rounds", None) is not None:
        return int(args.rounds)
    min_rounds = int(ai_cfg.get("min_rounds", 2))
    if getattr(args, "depth", "standard") == "deep":
        deep = int(ai_cfg.get("deep_min_rounds", min_rounds))
        return max(deep, min_rounds)
    return min_rounds


def _resolve_max_tokens(args: argparse.Namespace, ai_cfg: dict[str, Any]) -> int:
    """Resolve the per-call output budget passed to each member.

    Resolution chain (highest priority first):
      1. ``--max-tokens N`` — explicit invocation override.
      2. ``ai_council.max_output_tokens`` — settings value (project file
         is authoritative; this key is not user-global-mergeable).
      3. ``DEFAULT_MAX_TOKENS`` — package fallback (2048).

    A value of ``0`` at any layer means "unlimited"; it is widened to
    ``UNLIMITED_TOKENS_FALLBACK`` before reaching the SDK because
    Anthropic rejects ``max_tokens=0``. Estimation uses the same expanded
    value so the cost preview reflects the worst-case ceiling.
    """
    cli = getattr(args, "max_tokens", None)
    if cli is not None:
        value = int(cli)
    elif "max_output_tokens" in ai_cfg:
        value = int(ai_cfg.get("max_output_tokens") or 0)
    else:
        value = DEFAULT_MAX_TOKENS
    if value <= 0:
        return UNLIMITED_TOKENS_FALLBACK
    return value


def cmd_estimate(
    args: argparse.Namespace,
    *,
    settings: dict[str, Any] | None = None,
    members: list[ExternalAIClient] | None = None,
    table: PriceTable | None = None,
) -> int:
    """Print per-member cost preview. No API calls."""
    if settings is None:
        settings = load_settings()
    ai_cfg = (settings.get("ai_council") or {}) if isinstance(settings, dict) else {}
    advisor_plans = _build_advisor_plans(ai_cfg, REPO_ROOT)
    explicit_overrides = _parse_model_overrides(getattr(args, "model", None))
    skipped: list[dict[str, Any]] = []
    if members is None:
        members = build_members(
            settings,
            invocation_mode=args.mode_override,
            model_overrides=_advisor_model_overrides(
                advisor_plans, explicit_overrides,
            ),
            siblings_overrides=_parse_siblings_overrides(getattr(args, "siblings", None)),
            skipped=skipped,
        )
    if table is None:
        table = load_prices()
    question, _ = build_question(
        input_path=Path(args.question), input_mode=args.input_mode,
        max_tokens=_resolve_max_tokens(args, ai_cfg),
        prompt_mode_override=getattr(args, "prompt_mode", None),
    )
    project = detect_project_context(REPO_ROOT)
    billable = [m for m in members if getattr(m, "billable", True)]
    estimates = estimate(question, billable, table,
                         project=project, original_ask=args.original_ask,
                         advisor_plans=advisor_plans)
    if getattr(args, "debate", False):
        return _emit_debate_estimate(
            args, ai_cfg, members, billable, estimates, advisor_plans,
            skipped=skipped,
        )
    extra_calls, extra_usd = _consensus_cost_delta(
        ai_cfg, question.mode, estimates, len(billable),
    )
    pr_extra_calls, pr_extra_usd = _peer_review_cost_delta(
        ai_cfg, args, estimates, len(billable),
    )
    sys.stdout.write(
        f"council:estimate · mode={question.mode} · members={len(members)} "
        f"(billable={len(billable)})\n"
    )
    advisor_summary = _format_advisor_summary(advisor_plans, billable)
    if advisor_summary:
        sys.stdout.write(advisor_summary + "\n")
    if skipped:
        sys.stdout.write(format_install_hints(skipped) + "\n")
    sys.stdout.write(
        format_estimate_table(
            billable, estimates,
            consensus_delta_usd=extra_usd,
            consensus_extra_calls=extra_calls,
            peer_review_delta_usd=pr_extra_usd,
            peer_review_extra_calls=pr_extra_calls,
        ) + "\n"
    )
    return 0


def _emit_debate_estimate(
    args: argparse.Namespace,
    ai_cfg: dict[str, Any],
    members: list[ExternalAIClient],
    billable: list[ExternalAIClient],
    estimates: list[Any],
    advisor_plans: Any,
    *,
    skipped: list[dict[str, Any]] | None = None,
) -> int:
    """Render the round-by-round debate cost projection.

    Upper bound only — progressive disclosure may stop the debate early.
    Cost shape mirrors ``cmd_debate``: one call per billable member per
    round, default ``ai_council.min_rounds`` (typically 2), capped at
    ``ai_council.debate_max_rounds`` (typically 4).
    """
    min_rounds = int(ai_cfg.get("min_rounds", 2))
    max_rounds_cap = int(ai_cfg.get("debate_max_rounds", 4))
    requested = (
        int(args.rounds) if getattr(args, "rounds", None) is not None
        else min_rounds
    )
    if requested < 1:
        raise argparse.ArgumentTypeError(
            f"--rounds must be >= 1 (got {requested})"
        )
    if requested > max_rounds_cap:
        raise argparse.ArgumentTypeError(
            f"--rounds={requested} exceeds debate_max_rounds={max_rounds_cap}; "
            f"raise the cap in agents/.ai-council.yml or lower --rounds."
        )
    rounds = requested
    per_round_usd = sum(e.total_usd for e in estimates)
    projected_total = per_round_usd * rounds
    sys.stdout.write(
        f"council:estimate · mode=debate · members={len(members)} "
        f"(billable={len(billable)}) · rounds={rounds} "
        f"(cap={max_rounds_cap})\n"
    )
    advisor_summary = _format_advisor_summary(advisor_plans, billable)
    if advisor_summary:
        sys.stdout.write(advisor_summary + "\n")
    if skipped:
        sys.stdout.write(format_install_hints(skipped) + "\n")
    for round_idx in range(1, rounds + 1):
        sys.stdout.write(f"\nRound {round_idx} of {rounds}:\n")
        sys.stdout.write(format_estimate_table(billable, estimates) + "\n")
        if round_idx < rounds:
            sys.stdout.write("  " + "─" * 40 + "\n")
    sys.stdout.write(
        f"\n  PROJECTED TOTAL ({rounds} rounds):  ${projected_total:.4f}\n"
    )
    sys.stdout.write(
        "  Note: progressive disclosure may stop the debate early; "
        "this is an upper bound.\n"
    )
    return 0


def _serialise_responses(responses: list[CouncilResponse]) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    for r in responses:
        d = asdict(r)
        # `metadata` may contain non-JSON types; coerce.
        d["metadata"] = {k: str(v) for k, v in (d.get("metadata") or {}).items()}
        out.append(d)
    return out


def _deserialise_responses(items: list[dict[str, Any]]) -> list[CouncilResponse]:
    out: list[CouncilResponse] = []
    for d in items:
        out.append(CouncilResponse(
            provider=d.get("provider", ""),
            model=d.get("model", ""),
            text=d.get("text", ""),
            input_tokens=int(d.get("input_tokens", 0) or 0),
            output_tokens=int(d.get("output_tokens", 0) or 0),
            latency_ms=int(d.get("latency_ms", 0) or 0),
            error=d.get("error"),
            metadata=dict(d.get("metadata") or {}),
        ))
    return out


def _deserialise_consensus(data: dict[str, Any] | None) -> ConsensusResult | None:
    """Reconstruct a ConsensusResult from a serialised payload section.

    Used by ``cmd_render`` to re-render saved sessions that captured a
    consensus round. Returns ``None`` when the payload predates Phase 4
    or the round was skipped for the lens.
    """
    if not data:
        return None
    from scripts.ai_council.consensus import (
        ConsensusMetadata, Finding, FindingScore,
        aggregate_scores, bucket_by_threshold,
    )
    findings = [
        Finding(id=f["id"], source=f["source"], text=f["text"])
        for f in (data.get("findings") or [])
    ]
    scores = [
        FindingScore(
            finding_id=s["finding_id"], scorer=s["scorer"],
            score=int(s["score"]), agree=bool(s["agree"]),
            reason=s.get("reason", ""),
        )
        for s in (data.get("scores") or [])
    ]
    metadata = aggregate_scores(findings, scores)
    bucket = bucket_by_threshold(findings, metadata)
    return ConsensusResult(
        bucket=bucket, findings=findings, scores=scores, metadata=metadata,
        extraction_responses=_deserialise_responses(
            data.get("extraction_responses") or [],
        ),
        scoring_responses=_deserialise_responses(
            data.get("scoring_responses") or [],
        ),
    )


def _resolve_necessity_mode(
    ai_cfg: dict[str, Any],
    lens: str,
    invocation: str = "agent",
) -> tuple[bool, str]:
    """Return ``(enabled, effective_mode)`` for the necessity classifier.

    Two-tier resolution (step-8 D2):

    - ``invocation="agent"`` → reads ``necessity_classifier.mode`` with
      per-lens override at ``lenses.<lens>.necessity_classifier.mode``
      (default ``educate``).
    - ``invocation="user_explicit"`` → reads
      ``necessity_classifier.user_explicit_mode`` with per-lens override
      at ``lenses.<lens>.necessity_classifier.user_explicit_mode``
      (default ``warn-only``).

    Reads the synthesized dict shape produced by
    :func:`_synthesize_ai_council_block`, so both typed-config and
    legacy-settings paths are honoured.
    """
    nc_block = ai_cfg.get("necessity_classifier") or {}
    enabled = bool(nc_block.get("enabled", True))
    lens_overrides = ai_cfg.get("lens_overrides") or {}
    if invocation == "user_explicit":
        global_mode = str(nc_block.get("user_explicit_mode", "warn-only"))
        overrides = (
            lens_overrides.get("necessity_classifier_user_explicit_mode") or {}
        )
    else:
        global_mode = str(nc_block.get("mode", "educate"))
        overrides = lens_overrides.get("necessity_classifier_mode") or {}
    return enabled, str(overrides.get(lens, global_mode))


def _provider_caps_snapshot(ai_cfg: dict[str, Any]) -> dict[str, dict[str, str]]:
    """Return ``{provider: {mode, model}}`` for enabled members.

    Step-8 D3 events-log snapshot. Captures only public capability
    metadata (no API keys, no prompt content) so the log line stays
    within the privacy floor. Disabled members are excluded.
    """
    members = ai_cfg.get("members") or {}
    snapshot: dict[str, dict[str, str]] = {}
    if not isinstance(members, dict):
        return snapshot
    for name, cfg in members.items():
        if not isinstance(cfg, dict) or not cfg.get("enabled", True):
            continue
        snapshot[str(name)] = {
            "mode": str(cfg.get("mode", "")),
            "model": str(cfg.get("model", "")),
        }
    return snapshot


def _necessity_gate(
    *, prompt: str, lens: str, invocation: str, proceed_anyway: bool,
    ai_cfg: dict[str, Any], stdout=None, original_ask: str = "",
) -> tuple[bool, int, ClassificationResult | None]:
    """Apply the Phase-6 necessity classifier before any member fires.

    Returns ``(proceed, exit_code, result)``. ``proceed=True`` means the
    dispatcher continues; ``proceed=False`` means the caller should
    return ``exit_code`` immediately. ``result`` carries the verdict for
    session.md provenance on the proceed path (None when classifier is
    disabled / off).

    Step-8 D3: every non-disabled branch emits one
    :func:`append_event` line. ``original_ask`` is forwarded to the
    events log so the sha256[:12] hash anchors the line to the
    user-side question without leaking content. When the caller does
    not have an ``original_ask`` value, the prompt itself is hashed
    (legacy CLIs route through this path).
    """
    out = stdout if stdout is not None else sys.stdout
    enabled, mode = _resolve_necessity_mode(ai_cfg, lens, invocation=invocation)
    if not enabled or mode == "off":
        return True, 0, None
    result = classify_necessity(prompt, lens=lens, invocation=invocation)
    caps = _provider_caps_snapshot(ai_cfg)
    hashed = original_ask or prompt

    def _emit(action: str) -> None:
        append_event({
            "lens": lens, "invocation": invocation,
            "action": action, "verdict": result.verdict,
            "category": result.category,
            "mode": mode, "provider_caps": caps,
            "original_ask": hashed,
        })

    if result.verdict != "unnecessary":
        if result.verdict == "borderline":
            out.write(
                f"council:necessity · borderline ({result.category}) · "
                f"{result.rationale}\n"
            )
        _emit("proceed")
        return True, 0, result
    # verdict == "unnecessary"
    if mode == "warn-only":
        # Annotated but never skips (step-8 D2). Applies to both
        # invocation tiers when the mode resolves to warn-only.
        out.write(
            f"council:necessity · warn-only ({result.category}) · "
            f"{result.rationale}\n"
        )
        _emit("proceed")
        return True, 0, result
    if mode == "block":
        out.write(
            f"council:necessity · skipped ({result.category}) · "
            f"{result.rationale}\n"
            f"council:necessity · mode=block — `--proceed-anyway` has "
            f"no effect on the block path.\n"
        )
        _emit("skip_necessity")
        return False, 0, result
    # mode == "educate"
    if invocation == "agent":
        out.write(
            f"council:necessity · skipped (agent, {result.category}) · "
            f"{result.rationale}\n"
        )
        _emit("skip_necessity")
        return False, 0, result
    # invocation == "user_explicit"
    if proceed_anyway:
        out.write(
            f"council:necessity · override (user_explicit + "
            f"--proceed-anyway, {result.category}) · "
            f"{result.rationale}\n"
        )
        _emit("proceed")
        return True, 0, result
    out.write(educate_message(result, lens) + "\n")
    _emit("skip_necessity")
    return False, 2, result


def _resolve_model_downgrade(
    ai_cfg: dict[str, Any], lens: str,
) -> tuple[bool, bool]:
    """Return ``(enabled, auto_apply)`` for the size-fit downgrade gate.

    Per-lens override at ``lenses.<lens>.model_downgrade`` wins over the
    global ``model_downgrade`` block. Reads the synthesized dict shape
    from :func:`_synthesize_ai_council_block` so both typed-config and
    legacy paths are honoured.
    """
    md_block = ai_cfg.get("model_downgrade") or {}
    enabled = bool(md_block.get("enabled", True))
    auto_apply = bool(md_block.get("auto_apply", False))
    overrides = (
        (ai_cfg.get("lens_overrides") or {}).get("model_downgrade") or {}
    )
    lens_override = overrides.get(lens) if isinstance(overrides, dict) else None
    if isinstance(lens_override, dict):
        enabled = bool(lens_override.get("enabled", enabled))
        auto_apply = bool(lens_override.get("auto_apply", auto_apply))
    return enabled, auto_apply


def _size_fit_gate(
    *, prompt: str, lens: str, members: list[ExternalAIClient],
    ai_cfg: dict[str, Any], stdout=None,
) -> list[tuple[str, SizeFitVerdict, bool]]:
    """Apply the Phase-7 size-fit classifier across enabled members.

    Iterates every member with a configured ``model_ladder`` and runs
    :func:`classify_size_fit`. When ``auto_apply`` is true and a
    downgrade is suggested, the member's ``model`` attribute is rewritten
    in place; otherwise the suggestion is surfaced as a stdout notice
    and the original model stands. Members without a ladder are skipped
    silently.

    Returns a list of ``(member_name, verdict, applied)`` tuples for
    session.md provenance. Never blocks the dispatch — Phase 7 is a
    suggestion gate, not a refusal gate.
    """
    out = stdout if stdout is not None else sys.stdout
    enabled, auto_apply = _resolve_model_downgrade(ai_cfg, lens)
    decisions: list[tuple[str, SizeFitVerdict, bool]] = []
    if not enabled:
        return decisions
    members_cfg = ai_cfg.get("members") or {}
    for member in members:
        member_cfg = members_cfg.get(member.name) or {}
        ladder = member_cfg.get("model_ladder") or ()
        if not ladder:
            continue
        verdict = classify_size_fit(
            prompt, current_model=member.model, ladder=ladder, lens=lens,
        )
        applied = False
        if not verdict.fit and verdict.suggested_model:
            if auto_apply:
                out.write(
                    f"council:size-fit · {member.name} · auto-downgrade "
                    f"`{member.model}` → `{verdict.suggested_model}` · "
                    f"{verdict.reason}\n"
                )
                member.model = verdict.suggested_model
                applied = True
            else:
                out.write(
                    f"council:size-fit · {member.name} · "
                    f"{downgrade_message(verdict, member.model)}\n"
                )
        decisions.append((member.name, verdict, applied))
    return decisions


def _resolve_cost_disclosure(
    ai_cfg: dict[str, Any], lens: str,
) -> tuple[str, float, bool]:
    """Return ``(mode, threshold_usd, show_per_member)`` for the lens.

    Per-lens override at ``lenses.<lens>.cost_disclosure`` wins over the
    global ``debate.cost_disclosure`` block. The ``debate`` lens gets
    the debate-scoped defaults; other lenses default to ``off`` unless
    explicitly overridden (Phase 8 step 5 \u2014 cheap lenses are opt-in).
    """
    debate_block = ai_cfg.get("debate") or {}
    debate_disc = debate_block.get("cost_disclosure") or {}
    if lens == "debate":
        mode = str(debate_disc.get("mode", "always"))
        threshold = float(debate_disc.get("threshold_usd", 1.00))
        show_per_member = bool(debate_disc.get("show_per_member", True))
    else:
        mode = "off"
        threshold = 1.00
        show_per_member = True
    overrides = (
        (ai_cfg.get("lens_overrides") or {}).get("cost_disclosure") or {}
    )
    lens_override = overrides.get(lens) if isinstance(overrides, dict) else None
    if isinstance(lens_override, dict):
        mode = str(lens_override.get("mode", mode))
        threshold = float(lens_override.get("threshold_usd", threshold))
        show_per_member = bool(lens_override.get("show_per_member", show_per_member))
    return mode, threshold, show_per_member


def _format_cost_disclosure(
    est: DebateCostEstimate, *, lens: str, show_per_member: bool,
) -> str:
    """Render the pre-flight disclosure block for stdout.

    Mirrors the roadmap spec: total range across N members \u00d7 R rounds,
    optional per-member breakdown, and a subscription-member call-out
    for CLI / manual transports that don't sum into USD totals.
    """
    lines = [
        f"council:{lens} \u00b7 cost-disclosure \u00b7 estimated "
        f"${est.low_usd:.4f} \u2013 ${est.high_usd:.4f} "
        f"(expected ${est.expected_usd:.4f}) across "
        f"{len(est.per_member)} billable members \u00d7 {est.rounds} rounds",
    ]
    if show_per_member and est.per_member:
        lines.append("  per member:")
        for pm in est.per_member:
            lines.append(
                f"    \u00b7 {pm['name']:<14} {pm['model']:<22} "
                f"${pm['low_usd']:.4f} \u2013 ${pm['high_usd']:.4f}",
            )
    if est.subscription_members:
        lines.append("  subscription (no USD spend):")
        for sm in est.subscription_members:
            label = sm.get("subscription_label") or sm.get("transport", "")
            lines.append(
                f"    \u00b7 {sm['name']:<14} {sm['model']:<22} ({label})",
            )
    return "\n".join(lines) + "\n"


def _debate_refusal_cap(
    ai_cfg: dict[str, Any],
) -> float:
    """Resolve the hard refusal cap (``debate.max_cost_usd``).

    Returns 0.0 when disabled. The cap is unconditional \u2014 no
    ``--proceed-anyway`` override (the user must lower rounds, drop
    members, or raise the cap explicitly).
    """
    debate_block = ai_cfg.get("debate") or {}
    return float(debate_block.get("max_cost_usd", 5.00) or 0.0)


def _emit_shadow_slo_banner() -> None:
    """Pre-flight SLO banner for solo-dispatch invocations (step-9 P10).

    Reads ``agents/council-shadow-log.jsonl`` and prints the 7-day rolling
    disagreement rate. ``OK``, ``WARN``, ``BREACH`` are all surfaced so the
    user can see when single-member quality is drifting. Never auto-flips
    back to full council \u2014 visibility-first, action-second (D10).
    """
    try:
        from scripts.ai_council import shadow_dispatch as _sd
        rate, n = _sd.compute_disagreement_rate(_sd.SHADOW_LOG_PATH)
        if n == 0:
            return
        sys.stdout.write(_sd.slo_banner(rate, n) + "\n")
    except Exception:  # noqa: BLE001 \u2014 banner must never break dispatch.
        return


def _apply_solo_dispatch(
    members: list[ExternalAIClient],
) -> tuple[list[ExternalAIClient], str | None]:
    """Filter ``members`` to a single solo-dispatch pick (step-9 P9).

    Loads the routing chain from ``agents/.ai-council.yml`` and asks
    :func:`select_solo_member` for the first chain entry whose member
    is runtime-present. The probe is conservative: a member counts as
    auth-valid iff ``build_members`` returned a runtime client for it
    \u2014 build_members has already filtered out missing binaries / bad
    keys via the ``skipped`` list. Deep CLI auth probes (e.g.
    ``claude auth status``) are reserved for the shadow-mode path.

    Returns ``(filtered_members, marker)``. ``marker`` is a one-line
    info banner the caller prints to stdout (``None`` when no banner
    is needed, e.g. config missing). Returns the unfiltered list when
    no solo member can be picked \u2014 caller never fails the decision.
    """
    try:
        cfg = load_council_config(AI_COUNCIL_FILE)
    except (CouncilConfigError, FileNotFoundError):
        return members, None
    if not cfg.routing.solo_member_fallback_chain:
        return (
            members,
            "council:solo \u00b7 WARN \u00b7 --single requested but "
            "routing.solo_member_fallback_chain is empty \u2014 "
            "escalating to full council.",
        )
    runtime_names = {getattr(m, "name", "") for m in members}
    pick = select_solo_member(
        cfg.routing,
        cfg.members,
        auth_cache=AuthCache(),
        probe=lambda name, _t: name in runtime_names,
    )
    if pick is None:
        return (
            members,
            "council:solo \u00b7 WARN \u00b7 solo dispatch unavailable "
            "(no chain member runtime-present) \u2014 escalating to "
            "full council.",
        )
    filtered = [m for m in members if getattr(m, "name", "") == pick]
    if not filtered:
        # Defensive: ``pick`` came from runtime_names so this should
        # be unreachable. If we ever get here, escalate rather than
        # ship an empty council.
        return (
            members,
            "council:solo \u00b7 WARN \u00b7 selected member vanished "
            "between probe and filter \u2014 escalating to full council.",
        )
    return (
        filtered,
        f"council:solo \u00b7 dispatching to {pick} only "
        f"(routing.solo_member_fallback_chain).",
    )


def cmd_run(
    args: argparse.Namespace,
    *,
    settings: dict[str, Any] | None = None,
    members: list[ExternalAIClient] | None = None,
    table: PriceTable | None = None,
) -> int:
    """Estimate, then run the council. Requires --confirm to spend."""
    if settings is None:
        settings = load_settings()
    ai_cfg = (settings.get("ai_council") or {}) if isinstance(settings, dict) else {}
    advisor_plans = _build_advisor_plans(ai_cfg, REPO_ROOT)
    explicit_overrides = _parse_model_overrides(getattr(args, "model", None))
    skipped: list[dict[str, Any]] = []
    if members is None:
        members = build_members(
            settings,
            invocation_mode=args.mode_override,
            model_overrides=_advisor_model_overrides(
                advisor_plans, explicit_overrides,
            ),
            siblings_overrides=_parse_siblings_overrides(getattr(args, "siblings", None)),
            skipped=skipped,
        )
    if getattr(args, "single", False):
        members, solo_banner = _apply_solo_dispatch(members)
        if solo_banner:
            sys.stdout.write(solo_banner + "\n")
        _emit_shadow_slo_banner()
    if table is None:
        table = load_prices()
    question, artefact = build_question(
        input_path=Path(args.question), input_mode=args.input_mode,
        max_tokens=_resolve_max_tokens(args, ai_cfg),
        prompt_mode_override=getattr(args, "prompt_mode", None),
    )
    proceed, gate_exit, _necessity_result = _necessity_gate(
        prompt=question.user_prompt,
        lens=question.mode,
        invocation=getattr(args, "invocation", "agent"),
        proceed_anyway=getattr(args, "proceed_anyway", False),
        ai_cfg=ai_cfg,
        original_ask=getattr(args, "original_ask", "") or "",
    )
    if not proceed:
        return gate_exit
    _size_fit_gate(
        prompt=question.user_prompt,
        lens=question.mode,
        members=members,
        ai_cfg=ai_cfg,
    )
    project = detect_project_context(REPO_ROOT)
    billable = [m for m in members if getattr(m, "billable", True)]
    estimates = estimate(question, billable, table,
                         project=project, original_ask=args.original_ask,
                         advisor_plans=advisor_plans)
    extra_calls, extra_usd = _consensus_cost_delta(
        ai_cfg, question.mode, estimates, len(billable),
    )
    pr_extra_calls, pr_extra_usd = _peer_review_cost_delta(
        ai_cfg, args, estimates, len(billable),
    )
    sys.stdout.write(
        f"council:run · mode={question.mode} · members={len(members)} "
        f"(billable={len(billable)})\n"
    )
    advisor_summary = _format_advisor_summary(advisor_plans, billable)
    if advisor_summary:
        sys.stdout.write(advisor_summary + "\n")
    if skipped:
        sys.stdout.write(format_install_hints(skipped) + "\n")
    sys.stdout.write(
        format_estimate_table(
            billable, estimates,
            consensus_delta_usd=extra_usd,
            consensus_extra_calls=extra_calls,
            peer_review_delta_usd=pr_extra_usd,
            peer_review_extra_calls=pr_extra_calls,
        ) + "\n"
    )

    # Step-8 P1 — pre-run quota summary. After estimate / before
    # dispatch so the user sees the budget shape before --confirm.
    # Uncapped providers are omitted by ``quota_summary_line``; when
    # no CLI member has a configured cap the summary is empty and we
    # write nothing.
    cli_members = [m for m in members if isinstance(m, CliClient)]
    summary, warn_providers = quota_summary_line(cli_members)
    if summary:
        sys.stdout.write(summary + "\n")
        for prov in warn_providers:
            sys.stdout.write(f"council:quota · WARN · {prov} near limit\n")

    # Phase 8 step 5 — opt-in cost disclosure for non-debate lenses.
    # Default mode is "off" for analysis / default (cheap enough that
    # the disclosure is friction); users opt in by setting
    # `lenses.<name>.cost_disclosure.mode` in agents/.ai-council.yml.
    disc_mode, disc_threshold, disc_show = _resolve_cost_disclosure(
        ai_cfg, question.mode,
    )
    if disc_mode != "off":
        run_estimate = estimate_debate_cost(
            question, members, table,
            rounds=1, project=project,
            original_ask=args.original_ask,
            advisor_plans=advisor_plans,
        )
        if disc_mode == "always" or (
            disc_mode == "above_threshold"
            and run_estimate.expected_usd > disc_threshold
        ):
            sys.stdout.write(
                _format_cost_disclosure(
                    run_estimate, lens=question.mode,
                    show_per_member=disc_show,
                )
            )

    if not args.confirm:
        sys.stdout.write(
            "\nNo --confirm flag — estimate only. Re-run with --confirm to "
            "invoke the council and write the response.\n"
        )
        return 0

    cost_cfg = ai_cfg.get("cost_budget") or {}
    budget = CostBudget(
        max_input_tokens=int(cost_cfg.get("max_input_tokens", 50_000)),
        max_output_tokens=int(cost_cfg.get("max_output_tokens", 20_000)),
        max_calls=int(cost_cfg.get("max_calls", 10)),
        max_total_usd=float(cost_cfg.get("max_total_usd", 0.0) or 0.0),
    )
    rounds = _resolve_rounds(args, ai_cfg)
    responses = consult(
        members, question, budget,
        table=table, project=project,
        original_ask=args.original_ask, rounds=rounds,
        advisor_plans=advisor_plans,
    )
    # Pipeline order (R4 verdict): deliberation → peer-review → consensus
    # → synthesis. Peer-review anonymises only deliberation outputs;
    # consensus-scoring runs on the de-anonymised findings.
    persona_labels = build_persona_labels(advisor_plans, billable)
    peer_review = _maybe_run_peer_review(
        ai_cfg, args, question, members, responses, budget, table, project,
        persona_labels=persona_labels,
    )
    consensus = _maybe_run_consensus(
        ai_cfg, question, members, responses, budget, table, project, args,
    )
    estimated_total = sum(e.total_usd for e in estimates)
    actual_total = 0.0
    all_responses: list[CouncilResponse] = list(responses)
    if peer_review is not None:
        all_responses.extend(peer_review.responses)
    if consensus is not None:
        all_responses.extend(consensus.extraction_responses)
        all_responses.extend(consensus.scoring_responses)
    for r in all_responses:
        if r.error:
            continue
        ce = estimate_cost(r.provider, r.model, r.input_tokens, r.output_tokens, table)
        actual_total += ce.total_usd
    payload = {
        "schema_version": SCHEMA_VERSION,
        "mode": question.mode,
        "prompt_mode": getattr(args, "prompt_mode", None),
        "prose_synthesis": getattr(args, "prose_synthesis", None),
        "peer_review_enabled": _peer_review_active(ai_cfg, args),
        "artefact": artefact,
        "original_ask": args.original_ask,
        "members": [f"{m.name}/{m.model}" for m in members],
        "rounds": rounds,
        "cost_usd_estimated": round(estimated_total, 6),
        "cost_usd_actual": round(actual_total, 6),
        "responses": _serialise_responses(responses),
    }
    if peer_review is not None:
        payload["peer_review"] = _serialise_peer_review(peer_review)
    if consensus is not None:
        payload["consensus"] = _serialise_consensus(consensus)
    out_path = _validate_council_output_path(
        args.output, kind="responses", subcommand="run",
    )
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    sys.stdout.write(
        f"\ncouncil:run · wrote {out_path} "
        f"(estimated ${estimated_total:.4f} / actual ${actual_total:.4f})\n"
    )
    replay_path = _maybe_write_decision_replay(
        ai_cfg=ai_cfg, lens=question.mode, out_path=out_path,
        consensus=consensus, deliberation=responses,
        original_ask=args.original_ask,
    )
    if replay_path is not None:
        sys.stdout.write(f"council:run · wrote {replay_path}\n")
    errors = [r for r in responses if r.error]
    return 1 if errors and len(errors) == len(responses) else 0


def _debate_round_filename(round_number: int) -> str:
    return f"debate-round-{round_number}.json"


def _write_debate_round(
    out_dir: Path,
    round_number: int,
    responses: list[CouncilResponse],
    *,
    question: CouncilQuestion,
    members: list[ExternalAIClient],
    artefact: str,
    original_ask: str,
    total_planned_rounds: int,
    table: PriceTable,
    prompt_mode: str | None,
    prose_synthesis: bool | None,
) -> Path:
    """Persist a single debate round as a self-contained JSON.

    Each round file mirrors the ``cmd_run`` payload shape — re-rendering
    via ``council render <debate-round-N.json>`` works without special
    handling. Round-specific keys (``debate_round``, ``debate_total_rounds``)
    are additive so the renderer can ignore them safely.
    """
    out_dir.mkdir(parents=True, exist_ok=True)
    actual_total = 0.0
    for r in responses:
        if r.error:
            continue
        ce = estimate_cost(r.provider, r.model, r.input_tokens, r.output_tokens, table)
        actual_total += ce.total_usd
    payload = {
        "schema_version": SCHEMA_VERSION,
        "mode": question.mode,
        "prompt_mode": prompt_mode,
        "prose_synthesis": prose_synthesis,
        "artefact": artefact,
        "original_ask": original_ask,
        "members": [f"{m.name}/{m.model}" for m in members],
        "debate_round": round_number,
        "debate_total_rounds": total_planned_rounds,
        "rounds": 1,
        "cost_usd_actual": round(actual_total, 6),
        "responses": _serialise_responses(responses),
    }
    out_path = out_dir / _debate_round_filename(round_number)
    out_path.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    return out_path


def _load_debate_seed(
    path: Path,
    expected_members: list[ExternalAIClient],
) -> list[CouncilResponse]:
    """Load `--continue-as-debate` seed: round-1 responses from a prior session.

    The seed file must be the JSON written by ``cmd_run`` (or a prior
    debate round). Members + models must match the current invocation —
    a mismatch is a hard error per the Phase 7 contract, not a silent
    fallback. The host agent surfaces the mismatch and asks the user
    to either re-run with matching members or drop ``--continue-as-debate``.
    """
    if not path.exists():
        raise FileNotFoundError(
            f"--continue-as-debate path not found: {path}"
        )
    payload = json.loads(path.read_text(encoding="utf-8"))
    source_members = list(payload.get("members") or [])
    expected_labels = [f"{m.name}/{m.model}" for m in expected_members]
    if source_members != expected_labels:
        raise CouncilDisabledError(
            f"--continue-as-debate member mismatch: source session has "
            f"{source_members!r}, current invocation has {expected_labels!r}. "
            f"Re-run with matching members or drop --continue-as-debate."
        )
    return _deserialise_responses(payload.get("responses") or [])


def _make_debate_continue_prompt(
    *, auto_continue: bool,
    stream: Any = None,
) -> Any:
    """Build the on_continue callback for `run_debate()`.

    ``--auto-continue`` returns ``None`` so the orchestrator skips the
    gate entirely (still subject to the hard-cap check). Interactive
    mode prints the checkpoint line and reads y/N from stdin.
    """
    if auto_continue:
        return None
    out = stream or sys.stdout

    def _prompt(checkpoint: DebateCheckpoint) -> bool:
        out.write(
            f"\ndebate:checkpoint round={checkpoint.completed_round}/"
            f"{checkpoint.total_planned_rounds} "
            f"cost_so_far=${checkpoint.cost_so_far_usd:.4f} "
            f"next_round_estimate=${checkpoint.next_round_estimate_usd:.4f} "
            f"— continue? [y/N]: "
        )
        out.flush()
        try:
            answer = sys.stdin.readline().strip().lower()
        except (EOFError, KeyboardInterrupt):
            return False
        return answer in {"y", "yes"}

    return _prompt


def cmd_debate(
    args: argparse.Namespace,
    *,
    settings: dict[str, Any] | None = None,
    members: list[ExternalAIClient] | None = None,
    table: PriceTable | None = None,
) -> int:
    """Run a multi-round debate with progressive cost disclosure.

    Phase 7 contract: each member produces an initial position in
    Round 1, then rebuts the strongest opposing position in subsequent
    rounds. The orchestrator pauses after each round and asks the user
    to continue (``--auto-continue`` bypasses the prompt). Round files
    are persisted incrementally so an interrupted debate leaves a
    recoverable trail.
    """
    if settings is None:
        settings = load_settings()
    ai_cfg = (settings.get("ai_council") or {}) if isinstance(settings, dict) else {}
    advisor_plans = _build_advisor_plans(ai_cfg, REPO_ROOT)
    explicit_overrides = _parse_model_overrides(getattr(args, "model", None))
    skipped: list[dict[str, Any]] = []
    if members is None:
        members = build_members(
            settings,
            invocation_mode=args.mode_override,
            model_overrides=_advisor_model_overrides(
                advisor_plans, explicit_overrides,
            ),
            siblings_overrides=_parse_siblings_overrides(
                getattr(args, "siblings", None),
            ),
            skipped=skipped,
        )
    if table is None:
        table = load_prices()
    question, artefact = build_question(
        input_path=Path(args.question), input_mode=args.input_mode,
        max_tokens=_resolve_max_tokens(args, ai_cfg),
        prompt_mode_override="debate",
    )
    proceed, gate_exit, _necessity_result = _necessity_gate(
        prompt=question.user_prompt,
        lens="debate",
        invocation=getattr(args, "invocation", "agent"),
        proceed_anyway=getattr(args, "proceed_anyway", False),
        ai_cfg=ai_cfg,
        original_ask=getattr(args, "original_ask", "") or "",
    )
    if not proceed:
        return gate_exit
    _size_fit_gate(
        prompt=question.user_prompt,
        lens="debate",
        members=members,
        ai_cfg=ai_cfg,
    )
    project = detect_project_context(REPO_ROOT)
    billable = [m for m in members if getattr(m, "billable", True)]

    # Resolve round count: explicit --rounds wins; otherwise default 2.
    # Hard ceiling: ai_council.debate_max_rounds (Phase 0 reserved key).
    max_rounds_cap = int(ai_cfg.get("debate_max_rounds", 4))
    requested = (
        int(args.rounds) if getattr(args, "rounds", None) is not None else 2
    )
    if requested < 1:
        raise argparse.ArgumentTypeError(
            f"--rounds must be >= 1 (got {requested})"
        )
    if requested > max_rounds_cap:
        raise argparse.ArgumentTypeError(
            f"--rounds={requested} exceeds debate_max_rounds={max_rounds_cap}; "
            f"raise the cap in agents/.ai-council.yml or lower --rounds."
        )
    rounds = requested

    estimates = estimate(
        question, billable, table,
        project=project, original_ask=args.original_ask,
        advisor_plans=advisor_plans,
    )
    per_round_usd = sum(e.total_usd for e in estimates)
    projected_total = per_round_usd * rounds
    sys.stdout.write(
        f"council:debate · members={len(members)} (billable={len(billable)}) "
        f"· rounds={rounds} (cap={max_rounds_cap})\n"
    )
    advisor_summary = _format_advisor_summary(advisor_plans, billable)
    if advisor_summary:
        sys.stdout.write(advisor_summary + "\n")
    if skipped:
        sys.stdout.write(format_install_hints(skipped) + "\n")
    sys.stdout.write(
        format_estimate_table(billable, estimates) + "\n"
    )
    sys.stdout.write(
        f"  × {rounds} rounds (worst case, before progressive disclosure)\n"
        f"  PROJECTED TOTAL:  ${projected_total:.4f}\n"
    )

    # Phase 8 — pre-flight cost disclosure + hard refusal cap.
    debate_estimate = estimate_debate_cost(
        question, members, table,
        rounds=rounds, project=project,
        original_ask=args.original_ask,
        advisor_plans=advisor_plans,
    )
    disc_mode, disc_threshold, disc_show = _resolve_cost_disclosure(
        ai_cfg, "debate",
    )
    should_disclose = (
        disc_mode == "always"
        or (
            disc_mode == "above_threshold"
            and debate_estimate.expected_usd > disc_threshold
        )
    )
    if should_disclose:
        sys.stdout.write(
            _format_cost_disclosure(
                debate_estimate, lens="debate", show_per_member=disc_show,
            )
        )
    cap = _debate_refusal_cap(ai_cfg)
    if cap > 0 and debate_estimate.high_usd > cap:
        sys.stderr.write(
            f"❌  council:debate refused · high-end estimate "
            f"${debate_estimate.high_usd:.4f} exceeds "
            f"debate.max_cost_usd=${cap:.2f}. Lower --rounds, drop "
            f"members, or raise the cap in agents/.ai-council.yml.\n"
        )
        return 4

    if not args.confirm:
        sys.stdout.write(
            "\nNo --confirm flag — estimate only. Re-run with --confirm to "
            "start the debate.\n"
        )
        return 0

    cost_cfg = ai_cfg.get("cost_budget") or {}
    budget = CostBudget(
        max_input_tokens=int(cost_cfg.get("max_input_tokens", 50_000)),
        max_output_tokens=int(cost_cfg.get("max_output_tokens", 20_000)),
        max_calls=int(cost_cfg.get("max_calls", 10)),
        max_total_usd=float(cost_cfg.get("max_total_usd", 0.0) or 0.0),
    )

    out_dir = _validate_council_output_path(
        args.output, kind="responses", subcommand="debate",
    )
    seed: list[CouncilResponse] | None = None
    if getattr(args, "continue_as_debate", None):
        seed = _load_debate_seed(Path(args.continue_as_debate), billable)
        sys.stdout.write(
            f"council:debate · seeding round 1 from "
            f"{args.continue_as_debate} ({len(seed)} responses)\n"
        )

    written: list[Path] = []

    def _on_round_complete(round_number: int, results: list[CouncilResponse]) -> None:
        path = _write_debate_round(
            out_dir, round_number, results,
            question=question, members=members,
            artefact=artefact, original_ask=args.original_ask,
            total_planned_rounds=rounds, table=table,
            prompt_mode="debate",
            prose_synthesis=getattr(args, "prose_synthesis", None),
        )
        written.append(path)
        errors = [r for r in results if r.error]
        sys.stdout.write(
            f"council:debate · wrote {path} "
            f"({len(results) - len(errors)}/{len(results)} ok)\n"
        )

    on_continue = _make_debate_continue_prompt(
        auto_continue=bool(getattr(args, "auto_continue", False)),
    )

    try:
        all_rounds = run_debate(
            members, question,
            budget=budget, table=table, project=project,
            original_ask=args.original_ask,
            max_rounds=rounds,
            on_round_complete=_on_round_complete,
            on_continue=on_continue,
            advisor_plans=advisor_plans,
            seed_round_1=seed,
        )
    except DebateCapExceeded as exc:
        sys.stderr.write(
            f"❌  council:debate cap reached after round {exc.completed_round}: "
            f"{exc}\n"
            f"Partial debate persisted under {out_dir} "
            f"({len(written)} rounds).\n"
        )
        return 3

    actual_total = 0.0
    for rnd in all_rounds:
        for r in rnd:
            if r.error:
                continue
            ce = estimate_cost(
                r.provider, r.model, r.input_tokens, r.output_tokens, table,
            )
            actual_total += ce.total_usd
    sys.stdout.write(
        f"\ncouncil:debate · {len(all_rounds)} round(s) complete · "
        f"actual ${actual_total:.4f} (cap projection ${projected_total:.4f})\n"
    )
    errors_last = [r for r in all_rounds[-1] if r.error] if all_rounds else []
    return 1 if errors_last and len(errors_last) == len(all_rounds[-1]) else 0


def cmd_render(args: argparse.Namespace) -> int:
    """Re-render a saved responses JSON to the markdown report.

    Lens resolution order: explicit ``--prompt-mode`` > ``prompt_mode``
    in the payload > ``mode`` in the payload > ``None`` (default decision
    template). R4 Q4 escape hatch ``--prose-synthesis`` overrides the
    table. ``--output`` writes to ``agents/council-sessions/`` (enforced);
    omit it for stdout.
    """
    payload = json.loads(Path(args.responses).read_text(encoding="utf-8"))
    items = payload.get("responses") or []
    explicit = getattr(args, "prompt_mode", None)
    mode = explicit or payload.get("prompt_mode") or payload.get("mode")
    prose = getattr(args, "prose_synthesis", None)
    if prose is None:
        prose = payload.get("prose_synthesis")
    consensus = _deserialise_consensus(payload.get("consensus"))
    peer_review = _deserialise_peer_review(payload.get("peer_review"))
    body = render(
        _deserialise_responses(items),
        mode=mode,
        prose_synthesis=prose,
        consensus=consensus,
        peer_review=peer_review,
    )
    if getattr(args, "output", None):
        out_path = _validate_council_output_path(
            args.output, kind="sessions", subcommand="render",
        )
        out_path.parent.mkdir(parents=True, exist_ok=True)
        out_path.write_text(body + "\n", encoding="utf-8")
        sys.stdout.write(f"council:render · wrote {out_path}\n")
        return 0
    sys.stdout.write(body + "\n")
    return 0


def _cmd_replay_low_impact_stats(args: argparse.Namespace) -> int:
    """Summarise the session's ``low-impact-resolutions.md`` (Phase 11).

    The log file lives next to the ``responses`` JSON. Missing or empty
    log → prints an explicit "no entries" line and returns 0 (a session
    with no low-impact resolutions is not an error).
    """
    from scripts.ai_council.low_impact import (  # noqa: WPS433 — local import
        parse_low_impact_log,
        render_low_impact_stats,
    )

    responses_path = Path(args.responses)
    log_path = responses_path.parent / "low-impact-resolutions.md"
    if not log_path.exists():
        sys.stdout.write(
            "council:replay · no low-impact-resolutions.md alongside "
            f"{responses_path} — session had no fast-path entries.\n",
        )
        return 0
    body = log_path.read_text(encoding="utf-8")
    stats = parse_low_impact_log(body)
    out = render_low_impact_stats(stats)
    if getattr(args, "output", None):
        target = _validate_council_output_path(
            args.output, kind="sessions", subcommand="replay",
        )
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(out, encoding="utf-8")
        sys.stdout.write(f"council:replay · wrote {target}\n")
        return 0
    sys.stdout.write(out)
    return 0


def cmd_replay(args: argparse.Namespace) -> int:
    """Re-render the ``decision-replay.md`` audit trail (Phase 9).

    Reads a saved ``council:run`` JSON payload, rebuilds the consensus
    bundle, and emits the replay markdown to stdout (default) or to
    ``--output``. Pure re-projection — no model calls. Returns 2 when
    the payload lacks consensus data (Phase 9 prerequisite).

    When ``--low-impact-stats`` is set, the consensus replay is skipped
    and the session's ``low-impact-resolutions.md`` (Phase 11) is
    summarised instead — count, status breakdown, members used, cost.
    """
    if getattr(args, "low_impact_stats", False):
        return _cmd_replay_low_impact_stats(args)
    payload = json.loads(Path(args.responses).read_text(encoding="utf-8"))
    consensus = _deserialise_consensus(payload.get("consensus"))
    if consensus is None:
        sys.stderr.write(
            "❌  council:replay: payload has no `consensus` block — "
            "rerun with consensus_scoring enabled for this lens.\n"
        )
        return 2
    deliberation = _deserialise_responses(payload.get("responses") or [])
    include_args = (
        bool(args.include_member_arguments)
        if args.include_member_arguments is not None
        else True
    )
    body = render_decision_replay(
        DecisionReplayInputs(
            findings=list(consensus.findings),
            scores=list(consensus.scores),
            metadata=dict(consensus.metadata),
            deliberation=deliberation,
            original_ask=str(payload.get("original_ask", "")),
            include_member_arguments=include_args,
        ),
    )
    if getattr(args, "output", None):
        out_path = _validate_council_output_path(
            args.output, kind="sessions", subcommand="replay",
        )
        out_path.parent.mkdir(parents=True, exist_ok=True)
        out_path.write_text(body, encoding="utf-8")
        sys.stdout.write(f"council:replay · wrote {out_path}\n")
    else:
        sys.stdout.write(body)
    return 0


# ── argparse + main ─────────────────────────────────────────────────


def _parse_model_overrides(items: list[str] | None) -> dict[str, str]:
    """Parse repeated `--model name=model-id` flags into a dict.

    Empty/None list → empty dict (no override). Bad shape raises
    `argparse.ArgumentTypeError` so the CLI surfaces the error.
    """
    out: dict[str, str] = {}
    for raw in items or []:
        if "=" not in raw:
            raise argparse.ArgumentTypeError(
                f"--model expects '<member>=<model-id>', got {raw!r}."
            )
        name, model = raw.split("=", 1)
        name, model = name.strip(), model.strip()
        if not name or not model:
            raise argparse.ArgumentTypeError(
                f"--model member and model-id must both be non-empty: {raw!r}."
            )
        out[name] = model
    return out


def _parse_siblings_overrides(items: list[str] | None) -> dict[str, list[str]]:
    """Parse repeated `--siblings name=model1,model2[,...]` flags.

    Requires ≥ 2 distinct, non-empty models per provider — sibling
    mode without diversity has no purpose. Repeating the same provider
    flag is rejected as ambiguous.
    """
    out: dict[str, list[str]] = {}
    for raw in items or []:
        if "=" not in raw:
            raise argparse.ArgumentTypeError(
                f"--siblings expects '<member>=<model1>,<model2>[,...]', got {raw!r}."
            )
        name, models_csv = raw.split("=", 1)
        name = name.strip()
        models = [m.strip() for m in models_csv.split(",") if m.strip()]
        if not name or not models:
            raise argparse.ArgumentTypeError(
                f"--siblings member and model list must both be non-empty: {raw!r}."
            )
        if len(set(models)) < 2:
            raise argparse.ArgumentTypeError(
                f"--siblings requires ≥ 2 distinct models for {name!r}, got {models!r}."
            )
        if name in out:
            raise argparse.ArgumentTypeError(
                f"--siblings repeated for member {name!r}; combine into one flag."
            )
        out[name] = models
    return out


def _add_common_input_args(p: argparse.ArgumentParser) -> None:
    p.add_argument("question", type=str,
                   help="Path to the question file (text or roadmap).")
    p.add_argument("--input-mode", choices=["prompt", "roadmap"],
                   default="prompt",
                   help="How to bundle the file (default: prompt).")
    p.add_argument("--prompt-mode",
                   choices=["pr", "design", "optimize", "analysis"],
                   default=None, dest="prompt_mode",
                   help="Lens-override for the system-prompt addendum. "
                        "The bundle shape stays as --input-mode; only "
                        "the per-mode neutrality addendum is swapped "
                        "(see scripts/ai_council/prompts.py _MODE_TABLE). "
                        "Routed by the /council pr|design|optimize|"
                        "analysis wrappers.")
    p.add_argument("--max-tokens", type=int, default=None,
                   help="Per-member output budget. Default reads "
                        "ai_council.max_output_tokens from .agent-settings.yml "
                        "(2048 if unset). 0 = unlimited (widened to the safe "
                        "provider ceiling before the SDK call).")
    p.add_argument("--mode-override", choices=["api", "manual"], default=None,
                   help="Override every member's transport mode.")
    p.add_argument("--model", action="append", default=None, dest="model",
                   metavar="MEMBER=MODEL_ID",
                   help="Per-invocation model override, e.g. "
                        "--model anthropic=claude-sonnet-4-5. Repeatable. "
                        "Wins over `ai_council.members.<name>.model` in "
                        ".agent-settings.yml; the settings file is not "
                        "modified.")
    p.add_argument("--siblings", action="append", default=None, dest="siblings",
                   metavar="MEMBER=MODEL1,MODEL2[,...]",
                   help="Fan one provider out to ≥ 2 sibling models in a "
                        "single run, e.g. --siblings anthropic=claude-sonnet-4-5,"
                        "claude-opus-4-1. Each model becomes its own billable "
                        "member with independent cost tracking. Mutually "
                        "exclusive with --model for the same provider; "
                        "requires the provider to be enabled with mode=api. "
                        "Single-provider degraded-run strategy per ai-council "
                        "skill.")
    p.add_argument("--original-ask", default="",
                   help="The user's framing sentence (flows into handoff).")
    p.add_argument("--peer-review", dest="peer_review", action="store_true",
                   default=False,
                   help="Run an anonymous peer-review pass after the main "
                        "deliberation. Each member critiques the others' "
                        "(anonymised) responses for blind spots before "
                        "synthesis. Adds N extra API calls. Opt-in per the "
                        "R2 verdict; also accepts ai_council.peer_review."
                        "enabled: true in agents/.ai-council.yml.")


def cmd_shadow_report(args: argparse.Namespace) -> int:
    """Print the 7-day rolling disagreement rate + SLO status (step-9 P10)."""
    from pathlib import Path as _Path

    from scripts.ai_council import shadow_dispatch as _sd

    log_path = _Path(args.log) if args.log else _sd.SHADOW_LOG_PATH
    rate, n = _sd.compute_disagreement_rate(
        log_path, window_days=int(args.window_days)
    )
    print(_sd.slo_banner(rate, n))
    return 0


def cmd_quota(
    args: argparse.Namespace,
    *,
    settings: dict[str, Any] | None = None,
) -> int:
    """Dump today's CLI-quota state (step-8 P1, D1).

    Reads ``~/.event4u/agent-config/cli-calls.json`` plus the configured
    caps from ``.agent-settings.yml`` and prints one line per provider
    that has a configured ``max_calls_per_day``. ``--reset <provider>``
    (gated behind ``--confirm``) clears the counter for that provider.
    """
    s = settings if settings is not None else load_settings()
    ai_cfg = (s.get("ai_council") or {}) if isinstance(s, dict) else {}
    cli_budget_cfg = (
        (ai_cfg.get("cli_call_budget") or {}) if isinstance(ai_cfg, dict) else {}
    )
    caps = (
        (cli_budget_cfg.get("max_calls_per_day") or {})
        if isinstance(cli_budget_cfg, dict)
        else {}
    )
    warn_at = (
        float(cli_budget_cfg.get("warn_at", 0.8))
        if isinstance(cli_budget_cfg, dict)
        else 0.8
    )

    if getattr(args, "reset", None):
        provider = args.reset
        if not getattr(args, "confirm", False):
            sys.stderr.write(
                f"❌  council:quota: --reset {provider} requires --confirm.\n"
            )
            return 2
        reset_cli_call_counts(provider=provider)
        sys.stdout.write(f"council:quota · reset · {provider}\n")
        return 0

    counts = load_cli_call_counts()
    if not caps:
        sys.stdout.write(
            "council:quota · no providers have a configured "
            "cli_call_budget.max_calls_per_day cap.\n"
        )
        return 0
    for provider in sorted(caps):
        limit = int(caps[provider])
        used = int(counts.get(provider, 0))
        ratio = used / limit if limit > 0 else 0.0
        status = "ok"
        if used >= limit:
            status = "exhausted"
        elif ratio >= warn_at:
            status = "warn"
        sys.stdout.write(
            f"council:quota · {provider} · {used}/{limit} · {status}\n"
        )
    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="agent-config council",
        description="Non-interactive council orchestration.",
    )
    sub = parser.add_subparsers(dest="cmd", required=True)

    p_est = sub.add_parser("estimate", help="Pre-call cost preview (no spend).")
    _add_common_input_args(p_est)
    p_est.add_argument("--debate", action="store_true", default=False,
                       help="Render the round-by-round projection for a "
                            "debate run (one call per member per round). "
                            "Progressive disclosure may stop the debate "
                            "early — this is an upper bound.")
    p_est.add_argument("--rounds", type=int, default=None,
                       help="Debate round count for --debate. Defaults to "
                            "ai_council.min_rounds (typically 2); capped "
                            "at ai_council.debate_max_rounds (typically 4).")

    p_run = sub.add_parser("run", help="Run the council; --confirm required to spend.")
    _add_common_input_args(p_run)
    p_run.add_argument("--output", required=True,
                       help="Path to write the responses JSON.")
    p_run.add_argument("--confirm", action="store_true",
                       help="Required to actually invoke the council.")
    p_run.add_argument("--rounds", type=int, default=None,
                       help="Number of debate rounds (1-3). Explicit override; "
                            "wins over --depth. Defaults to ai_council.min_rounds "
                            "in .agent-settings.yml (or 2 if unset).")
    p_run.add_argument("--depth", choices=["standard", "deep"], default="standard",
                       help="Reasoning-depth tier. 'deep' floors rounds at "
                            "ai_council.deep_min_rounds (max'd with min_rounds) "
                            "for architecture, refactoring, or bug-diagnosis "
                            "artefacts. Set by the host agent when the consuming "
                            "rule/skill/command declares council_depth: deep. "
                            "Overridden by explicit --rounds.")
    p_run.add_argument("--invocation", choices=["agent", "user_explicit"],
                       default="agent",
                       help="Source signal for the necessity classifier "
                            "(Phase 6). 'agent' = autonomous (default; silent "
                            "skip when unnecessary). 'user_explicit' = manual "
                            "user invocation (educate path when unnecessary, "
                            "requires --proceed-anyway to override).")
    p_run.add_argument("--proceed-anyway", action="store_true",
                       dest="proceed_anyway", default=False,
                       help="Override the necessity-classifier skip / educate "
                            "verdict for this invocation (Phase 6). Has no "
                            "effect when the classifier verdict is "
                            "`necessary` or `borderline`.")
    p_run.add_argument("--single", action="store_true", default=False,
                       help="Dispatch to a single member from "
                            "routing.solo_member_fallback_chain (step-9 P9). "
                            "Falls back to the full council when the chain is "
                            "empty or no chain member is runtime-present. "
                            "Overridden by env "
                            "AGENT_CONFIG_FORCE_FULL_COUNCIL=1.")
    _add_prose_synthesis_arg(p_run)

    p_deb = sub.add_parser(
        "debate",
        help="Multi-round debate with progressive cost disclosure (Phase 7).",
    )
    _add_common_input_args(p_deb)
    p_deb.add_argument("--output", required=True,
                       help="Directory to write debate-round-N.json files.")
    p_deb.add_argument("--confirm", action="store_true",
                       help="Required to actually start the debate.")
    p_deb.add_argument("--rounds", type=int, default=None,
                       help="Number of debate rounds (default 2). Capped by "
                            "ai_council.debate_max_rounds in agents/.ai-council.yml.")
    p_deb.add_argument("--auto-continue", action="store_true",
                       default=False, dest="auto_continue",
                       help="Skip the between-round y/N prompt. The hard cap "
                            "against cost_budget.max_total_usd still applies.")
    p_deb.add_argument("--continue-as-debate", default=None,
                       dest="continue_as_debate", metavar="PATH",
                       help="Seed round 1 from an existing council session "
                            "JSON. Members + models must match the current "
                            "invocation.")
    p_deb.add_argument("--invocation", choices=["agent", "user_explicit"],
                       default="agent",
                       help="Source signal for the necessity classifier "
                            "(Phase 6). 'agent' = autonomous (default; silent "
                            "skip when unnecessary). 'user_explicit' = manual "
                            "user invocation (educate path when unnecessary, "
                            "requires --proceed-anyway to override).")
    p_deb.add_argument("--proceed-anyway", action="store_true",
                       dest="proceed_anyway", default=False,
                       help="Override the necessity-classifier skip / educate "
                            "verdict for this invocation (Phase 6). Has no "
                            "effect when the classifier verdict is "
                            "`necessary` or `borderline`.")
    _add_prose_synthesis_arg(p_deb)

    p_ren = sub.add_parser("render", help="Re-render a saved responses JSON.")
    p_ren.add_argument("responses",
                       help="Path to the JSON written by `council run`.")
    p_ren.add_argument("--prompt-mode",
                       choices=["default", "pr", "design", "optimize", "analysis",
                                "prompt", "roadmap", "diff", "files"],
                       default=None, dest="prompt_mode",
                       help="Override the synthesis-template lens. Defaults "
                            "to the `mode` recorded in the responses JSON.")
    p_ren.add_argument("--output", default=None,
                       help="Write the rendered markdown to a file under "
                            "agents/council-sessions/ (enforced). Omit for "
                            "stdout. Prefer this over shell redirects so "
                            "the canonical-path check fires at write-time.")
    _add_prose_synthesis_arg(p_ren)

    p_rep = sub.add_parser(
        "replay",
        help="Re-render decision-replay.md from a saved responses JSON (Phase 9).",
    )
    p_rep.add_argument("responses",
                       help="Path to the JSON written by `council run`.")
    p_rep.add_argument("--output", default=None,
                       help="Optional file to write the replay markdown. "
                            "Defaults to stdout.")
    rep_group = p_rep.add_mutually_exclusive_group()
    rep_group.add_argument("--redact-member-arguments",
                           dest="include_member_arguments",
                           action="store_const", const=False, default=None,
                           help="Emit the redacted view (consensus + dissent "
                                "counts only, no per-member arguments).")
    rep_group.add_argument("--include-member-arguments",
                           dest="include_member_arguments",
                           action="store_const", const=True,
                           help="Include per-member arguments (default).")
    p_rep.add_argument("--low-impact-stats", action="store_true", default=False,
                       help="Skip the decision replay and print a summary of "
                            "low-impact fast-path resolutions for the session "
                            "(parses `low-impact-resolutions.md` alongside the "
                            "responses JSON).")

    p_quo = sub.add_parser(
        "quota",
        help="Dump today's CLI-quota state and configured caps (step-8 P1).",
    )
    p_quo.add_argument("--reset", default=None, metavar="PROVIDER",
                       help="Reset today's counter for one provider. "
                            "Requires --confirm.")
    p_quo.add_argument("--confirm", action="store_true", default=False,
                       help="Confirm a mutating --reset operation.")

    p_sha = sub.add_parser(
        "shadow-report",
        help="Read agents/council-shadow-log.jsonl and print the 7-day "
             "rolling disagreement rate + SLO status (step-9 P10).",
    )
    p_sha.add_argument("--log", default=None,
                       help="Path to the shadow log (default: "
                            "agents/council-shadow-log.jsonl).")
    p_sha.add_argument("--window-days", type=int, default=7,
                       help="Rolling window in days (default: 7).")

    return parser


def _add_prose_synthesis_arg(p: argparse.ArgumentParser) -> None:
    """R4 Q4 escape hatch — toggle structured vs prose synthesis."""
    group = p.add_mutually_exclusive_group()
    group.add_argument("--prose-synthesis", dest="prose_synthesis",
                       action="store_const", const=True, default=None,
                       help="Force open-ended prose synthesis (bare slot) "
                            "regardless of lens. R4 Q4 escape hatch.")
    group.add_argument("--no-prose-synthesis", dest="prose_synthesis",
                       action="store_const", const=False,
                       help="Force the structured default decision-lens "
                            "template even on a creative lens "
                            "(design / optimize). Symmetric escape hatch.")


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    try:
        if args.cmd == "estimate":
            return cmd_estimate(args)
        if args.cmd == "run":
            return cmd_run(args)
        if args.cmd == "debate":
            return cmd_debate(args)
        if args.cmd == "render":
            return cmd_render(args)
        if args.cmd == "replay":
            return cmd_replay(args)
        if args.cmd == "quota":
            return cmd_quota(args)
        if args.cmd == "shadow-report":
            return cmd_shadow_report(args)
    except CouncilDisabledError as exc:
        sys.stderr.write(f"❌  council:{args.cmd}: {exc}\n")
        return 2
    except (BundleTooLarge, InvalidModeError, FileNotFoundError,
            argparse.ArgumentTypeError) as exc:
        sys.stderr.write(f"❌  council:{args.cmd}: {exc}\n")
        return 2
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
