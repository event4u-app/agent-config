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

sys.path.insert(0, str(REPO_ROOT))

from scripts.ai_council.bundler import (  # noqa: E402
    BundleTooLarge, bundle_prompt, bundle_roadmap,
)
from scripts.ai_council.clients import (  # noqa: E402
    AnthropicClient, CouncilResponse, ExternalAIClient, ManualClient,
    OpenAIClient, load_anthropic_key, load_openai_key,
)
from scripts.ai_council.modes import (  # noqa: E402
    InvalidModeError, resolve_mode,
)
from scripts.ai_council.orchestrator import (  # noqa: E402
    CostBudget, CouncilQuestion, consult, estimate, render,
)
from scripts.ai_council.pricing import (  # noqa: E402
    PriceTable, estimate_cost, load_prices,
)
from scripts.ai_council.project_context import detect_project_context  # noqa: E402

SCHEMA_VERSION = 1


class CouncilDisabledError(RuntimeError):
    """Raised when ai_council.enabled is false or no member is enabled."""


def load_settings(path: Path = SETTINGS_FILE) -> dict[str, Any]:
    if not path.exists():
        return {}
    return yaml.safe_load(path.read_text(encoding="utf-8")) or {}


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
            for sib_model in siblings[name]:
                members.append(_construct_api_member(name, sib_model))
            continue
        model = overrides.get(name) or cfg.get("model")
        if mode == "api" and name in {"anthropic", "openai"}:
            members.append(_construct_api_member(name, model))
        elif mode == "manual":
            members.append(ManualClient(name=name, model=model or "manual"))
        elif mode == "playwright":
            raise CouncilDisabledError(
                f"member {name!r} resolves to mode=playwright (Phase 2c, not wired)."
            )
        else:
            raise CouncilDisabledError(
                f"member {name!r} has no transport — mode={mode}, name not in {{anthropic,openai}}."
            )
    if not members:
        raise CouncilDisabledError(
            "no council member has `enabled: true` — enable at least one in "
            ".agent-settings.yml under ai_council.members.*."
        )
    return members


def _construct_api_member(name: str, model: str | None) -> ExternalAIClient:
    """Build an api-mode client for a known provider name."""
    if name == "anthropic":
        return AnthropicClient(model=model or "claude-sonnet-4-5",
                               api_key=load_anthropic_key())
    if name == "openai":
        return OpenAIClient(model=model or "gpt-4o",
                            api_key=load_openai_key())
    raise CouncilDisabledError(
        f"member {name!r} has no api transport (known: anthropic, openai)."
    )


def build_question(
    *,
    input_path: Path,
    input_mode: str,
    max_tokens: int,
) -> tuple[CouncilQuestion, str]:
    """Bundle the input file. Returns (question, artefact_label)."""
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
    return CouncilQuestion(mode=ctx.mode, user_prompt=ctx.text,
                           max_tokens=max_tokens), artefact


def format_estimate_table(
    members: list[ExternalAIClient],
    estimates: list[Any],
) -> str:
    rows = [
        f"  {m.name}/{m.model}: "
        f"~{e.input_tokens} in + {e.output_tokens} out  =  ${e.total_usd:.4f}"
        for m, e in zip(members, estimates)
    ]
    total = sum(e.total_usd for e in estimates)
    rows.append(f"  TOTAL:  ${total:.4f}")
    return "\n".join(rows)


# ── subcommands ─────────────────────────────────────────────────────


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
    question, _ = build_question(
        input_path=Path(args.question), input_mode=args.input_mode,
        max_tokens=args.max_tokens,
    )
    project = detect_project_context(REPO_ROOT)
    billable = [m for m in members if getattr(m, "billable", True)]
    estimates = estimate(question, billable, table,
                         project=project, original_ask=args.original_ask)
    sys.stdout.write(
        f"council:estimate · mode={question.mode} · members={len(members)} "
        f"(billable={len(billable)})\n"
    )
    sys.stdout.write(format_estimate_table(billable, estimates) + "\n")
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
    question, artefact = build_question(
        input_path=Path(args.question), input_mode=args.input_mode,
        max_tokens=args.max_tokens,
    )
    project = detect_project_context(REPO_ROOT)
    billable = [m for m in members if getattr(m, "billable", True)]
    estimates = estimate(question, billable, table,
                         project=project, original_ask=args.original_ask)
    sys.stdout.write(
        f"council:run · mode={question.mode} · members={len(members)} "
        f"(billable={len(billable)})\n"
    )
    sys.stdout.write(format_estimate_table(billable, estimates) + "\n")

    if not args.confirm:
        sys.stdout.write(
            "\nNo --confirm flag — estimate only. Re-run with --confirm to "
            "invoke the council and write the response.\n"
        )
        return 0

    ai_cfg = settings.get("ai_council") or {}
    cost_cfg = ai_cfg.get("cost_budget") or {}
    budget = CostBudget(
        max_input_tokens=int(cost_cfg.get("max_input_tokens", 50_000)),
        max_output_tokens=int(cost_cfg.get("max_output_tokens", 20_000)),
        max_calls=int(cost_cfg.get("max_calls", 10)),
        max_total_usd=float(cost_cfg.get("max_total_usd", 0.0) or 0.0),
    )
    rounds = args.rounds if args.rounds is not None else int(ai_cfg.get("min_rounds", 2))
    responses = consult(
        members, question, budget,
        table=table, project=project,
        original_ask=args.original_ask, rounds=rounds,
    )
    estimated_total = sum(e.total_usd for e in estimates)
    actual_total = 0.0
    for r in responses:
        if r.error:
            continue
        ce = estimate_cost(r.provider, r.model, r.input_tokens, r.output_tokens, table)
        actual_total += ce.total_usd
    payload = {
        "schema_version": SCHEMA_VERSION,
        "mode": question.mode,
        "artefact": artefact,
        "original_ask": args.original_ask,
        "members": [f"{m.name}/{m.model}" for m in members],
        "rounds": rounds,
        "cost_usd_estimated": round(estimated_total, 6),
        "cost_usd_actual": round(actual_total, 6),
        "responses": _serialise_responses(responses),
    }
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
    """Re-render a saved responses JSON to the markdown report."""
    payload = json.loads(Path(args.responses).read_text(encoding="utf-8"))
    items = payload.get("responses") or []
    sys.stdout.write(render(_deserialise_responses(items)) + "\n")
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
    p.add_argument("--max-tokens", type=int, default=1024,
                   help="Per-member output budget (default: 1024).")
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
                       help="Number of debate rounds (1-3). Defaults to "
                            "ai_council.min_rounds in .agent-settings.yml "
                            "(or 2 if unset).")

    p_ren = sub.add_parser("render", help="Re-render a saved responses JSON.")
    p_ren.add_argument("responses",
                       help="Path to the JSON written by `council run`.")

    return parser


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
