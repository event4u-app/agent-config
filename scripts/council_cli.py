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

sys.path.insert(0, str(REPO_ROOT))

from scripts.ai_council.bundler import (  # noqa: E402
    BundleTooLarge, bundle_prompt, bundle_roadmap,
)
from scripts.ai_council.clients import (  # noqa: E402
    DEFAULT_MAX_TOKENS, UNLIMITED_TOKENS_FALLBACK,
    AnthropicClient, CouncilResponse, ExternalAIClient, GeminiClient,
    ManualClient, OpenAIClient, PerplexityClient, XAIClient,
    load_anthropic_key, load_openai_key,
)
from scripts.ai_council.config import (  # noqa: E402
    CouncilConfig, CouncilConfigError, load_council_config, resolve_api_key,
)
from scripts.ai_council.modes import (  # noqa: E402
    InvalidModeError, resolve_mode,
)
from scripts.ai_council.orchestrator import (  # noqa: E402
    ConsensusResult,
    CostBudget, CouncilQuestion, consult, estimate, render,
    run_consensus_scoring,
)
from scripts.ai_council.pricing import (  # noqa: E402
    PriceTable, estimate_cost, load_prices,
)
from scripts.ai_council.project_context import detect_project_context  # noqa: E402

SCHEMA_VERSION = 1

#: Provider names accepted under `mode=api`. Mirrors the routing table
#: in ``_construct_api_member``; both must stay in sync.
_API_PROVIDERS = frozenset({"anthropic", "openai", "gemini", "xai", "perplexity"})


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
        members[name] = entry
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
        "members": members,
    }


def build_members(
    settings: dict[str, Any],
    *,
    invocation_mode: str | None = None,
    model_overrides: dict[str, str] | None = None,
    siblings_overrides: dict[str, list[str]] | None = None,
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
    """
    ai = (settings.get("ai_council") or {}) if isinstance(settings, dict) else {}
    if not ai.get("enabled"):
        raise CouncilDisabledError(
            "ai_council.enabled is false in .agent-settings.yml — "
            "flip it on before invoking council:* commands."
        )
    members_cfg = ai.get("members") or {}
    global_mode = ai.get("mode")
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
        raise CouncilDisabledError(
            "no council member has `enabled: true` — enable at least one in "
            ".agent-settings.yml under ai_council.members.*."
        )
    return members


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
            }
            for fid, m in consensus.metadata.items()
        },
        "extraction_responses": _serialise_responses(consensus.extraction_responses),
        "scoring_responses": _serialise_responses(consensus.scoring_responses),
    }


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
    if members is None:
        members = build_members(
            settings,
            invocation_mode=args.mode_override,
            model_overrides=_parse_model_overrides(getattr(args, "model", None)),
            siblings_overrides=_parse_siblings_overrides(getattr(args, "siblings", None)),
        )
    if table is None:
        table = load_prices()
    ai_cfg = (settings.get("ai_council") or {}) if isinstance(settings, dict) else {}
    question, _ = build_question(
        input_path=Path(args.question), input_mode=args.input_mode,
        max_tokens=_resolve_max_tokens(args, ai_cfg),
        prompt_mode_override=getattr(args, "prompt_mode", None),
    )
    project = detect_project_context(REPO_ROOT)
    billable = [m for m in members if getattr(m, "billable", True)]
    estimates = estimate(question, billable, table,
                         project=project, original_ask=args.original_ask)
    extra_calls, extra_usd = _consensus_cost_delta(
        ai_cfg, question.mode, estimates, len(billable),
    )
    sys.stdout.write(
        f"council:estimate · mode={question.mode} · members={len(members)} "
        f"(billable={len(billable)})\n"
    )
    sys.stdout.write(
        format_estimate_table(
            billable, estimates,
            consensus_delta_usd=extra_usd,
            consensus_extra_calls=extra_calls,
        ) + "\n"
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
    if members is None:
        members = build_members(
            settings,
            invocation_mode=args.mode_override,
            model_overrides=_parse_model_overrides(getattr(args, "model", None)),
            siblings_overrides=_parse_siblings_overrides(getattr(args, "siblings", None)),
        )
    if table is None:
        table = load_prices()
    ai_cfg = (settings.get("ai_council") or {}) if isinstance(settings, dict) else {}
    question, artefact = build_question(
        input_path=Path(args.question), input_mode=args.input_mode,
        max_tokens=_resolve_max_tokens(args, ai_cfg),
        prompt_mode_override=getattr(args, "prompt_mode", None),
    )
    project = detect_project_context(REPO_ROOT)
    billable = [m for m in members if getattr(m, "billable", True)]
    estimates = estimate(question, billable, table,
                         project=project, original_ask=args.original_ask)
    extra_calls, extra_usd = _consensus_cost_delta(
        ai_cfg, question.mode, estimates, len(billable),
    )
    sys.stdout.write(
        f"council:run · mode={question.mode} · members={len(members)} "
        f"(billable={len(billable)})\n"
    )
    sys.stdout.write(
        format_estimate_table(
            billable, estimates,
            consensus_delta_usd=extra_usd,
            consensus_extra_calls=extra_calls,
        ) + "\n"
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
    )
    consensus = _maybe_run_consensus(
        ai_cfg, question, members, responses, budget, table, project, args,
    )
    estimated_total = sum(e.total_usd for e in estimates)
    actual_total = 0.0
    all_responses: list[CouncilResponse] = list(responses)
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
        "artefact": artefact,
        "original_ask": args.original_ask,
        "members": [f"{m.name}/{m.model}" for m in members],
        "rounds": rounds,
        "cost_usd_estimated": round(estimated_total, 6),
        "cost_usd_actual": round(actual_total, 6),
        "responses": _serialise_responses(responses),
    }
    if consensus is not None:
        payload["consensus"] = _serialise_consensus(consensus)
    out_path = Path(args.output)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    sys.stdout.write(
        f"\ncouncil:run · wrote {out_path} "
        f"(estimated ${estimated_total:.4f} / actual ${actual_total:.4f})\n"
    )
    errors = [r for r in responses if r.error]
    return 1 if errors and len(errors) == len(responses) else 0


def cmd_render(args: argparse.Namespace) -> int:
    """Re-render a saved responses JSON to the markdown report.

    Lens resolution order: explicit ``--prompt-mode`` > ``prompt_mode``
    in the payload > ``mode`` in the payload > ``None`` (default decision
    template). R4 Q4 escape hatch ``--prose-synthesis`` overrides the
    table.
    """
    payload = json.loads(Path(args.responses).read_text(encoding="utf-8"))
    items = payload.get("responses") or []
    explicit = getattr(args, "prompt_mode", None)
    mode = explicit or payload.get("prompt_mode") or payload.get("mode")
    prose = getattr(args, "prose_synthesis", None)
    if prose is None:
        prose = payload.get("prose_synthesis")
    consensus = _deserialise_consensus(payload.get("consensus"))
    sys.stdout.write(
        render(
            _deserialise_responses(items),
            mode=mode,
            prose_synthesis=prose,
            consensus=consensus,
        )
        + "\n"
    )
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


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="agent-config council",
        description="Non-interactive council orchestration.",
    )
    sub = parser.add_subparsers(dest="cmd", required=True)

    p_est = sub.add_parser("estimate", help="Pre-call cost preview (no spend).")
    _add_common_input_args(p_est)

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
    _add_prose_synthesis_arg(p_run)

    p_ren = sub.add_parser("render", help="Re-render a saved responses JSON.")
    p_ren.add_argument("responses",
                       help="Path to the JSON written by `council run`.")
    p_ren.add_argument("--prompt-mode",
                       choices=["default", "pr", "design", "optimize", "analysis",
                                "prompt", "roadmap", "diff", "files"],
                       default=None, dest="prompt_mode",
                       help="Override the synthesis-template lens. Defaults "
                            "to the `mode` recorded in the responses JSON.")
    _add_prose_synthesis_arg(p_ren)

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
        if args.cmd == "render":
            return cmd_render(args)
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
