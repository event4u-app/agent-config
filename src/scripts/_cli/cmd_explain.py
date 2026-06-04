"""``agent-config explain`` — print the decision chain behind an outcome.

Step-15 Phase 1 item 3. Answers the silent "why did the agent do that?"
question by showing which inputs the loader / router consulted, in what
order, and which one won. Read-only; never edits state, never dispatches
network calls. Four subjects in the surface:

* ``config``           — full resolution chain for the active profile +
                         preset. Uses :mod:`scripts.config.profiles` and
                         :mod:`scripts.config.presets`; surfaces source
                         (pack / profile / user / env / runtime / default)
                         and per-knob overrides.
* ``rule <name>``      — kernel vs tier-1 vs tier-2 placement plus the
                         declared trigger list from ``router.json``.
* ``route <text>``     — given prompt text, returns every tier-1 rule
                         whose trigger list matches plus kernel rules
                         (always active).
* ``last``             — execution trace for the most recent ``/work``
                         run. Aggregates the persisted ``.work-state.json``,
                         council session, and memory hits into the
                         ``ExplainTrace`` v1 contract (see
                         ``docs/contracts/explain-trace.schema.json``).

Exit codes: ``0`` clean, ``1`` not found / no match, ``2`` invocation
error (bad project root, malformed ``router.json``).
"""
from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path
from typing import Any

from scripts._lib.agent_settings import (
    DEFAULT_PROJECT_FILE,
    ProjectRootError,
    load_agent_settings,
    resolve_project_root,
)
from scripts.config import presets, profiles

ROUTER_FILENAME = "router.json"
ROUTER_RELATIVE = Path("dist") / ROUTER_FILENAME


def _resolve_root(arg: str | None) -> tuple[Path, str]:
    try:
        return resolve_project_root(arg, cwd=Path.cwd())
    except ProjectRootError as exc:
        print(f"❌  explain: {exc}", file=sys.stderr)
        raise SystemExit(2) from exc


def _load_user_settings(project_root: Path) -> dict[str, Any]:
    path = project_root / DEFAULT_PROJECT_FILE
    if not path.exists():
        return {}
    return load_agent_settings(project_path=path) or {}


def _load_router(project_root: Path) -> dict[str, Any]:
    path = project_root / ROUTER_RELATIVE
    if not path.exists():
        return {}
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        print(f"❌  explain: cannot read {path}: {exc}", file=sys.stderr)
        raise SystemExit(2) from exc


def _explain_config(project_root: Path, *, as_json: bool) -> int:
    settings = _load_user_settings(project_root)
    resolved_profile = profiles.resolve_profile(
        project_root=project_root,
        user_settings=settings,
    )
    resolved_preset = presets.resolve_preset(
        project_root=project_root,
        user_settings=settings,
        profile_preset_id=resolved_profile.preset_id,
    )
    payload = {
        "project_root": str(project_root),
        "profile": {
            "id": resolved_profile.id,
            "source": resolved_profile.source,
            "preset_id": resolved_profile.preset_id,
            "warning": resolved_profile.warning,
        },
        "preset": {
            "id": resolved_preset.id,
            "source": resolved_preset.source,
            "overrides": list(resolved_preset.overrides),
            "knobs": resolved_preset.knobs,
        },
        "env": {
            profiles.PROFILE_ID_ENV: os.environ.get(profiles.PROFILE_ID_ENV),
            presets.PRESET_ID_ENV: os.environ.get(presets.PRESET_ID_ENV),
        },
    }
    if as_json:
        json.dump(payload, sys.stdout, indent=2, sort_keys=True)
        sys.stdout.write("\n")
        return 0
    print(f"  📍  project_root: {project_root}")
    print()
    print(f"  profile.id:   {resolved_profile.id}  (source: {resolved_profile.source})")
    if resolved_profile.warning:
        print(f"  ⚠️   {resolved_profile.warning}")
    print(f"  preset.id:    {resolved_preset.id}  (source: {resolved_preset.source})")
    if resolved_preset.overrides:
        print(f"  overrides:    {', '.join(resolved_preset.overrides)}")
    cost = resolved_preset.knobs.get("cost", {})
    if cost:
        print(
            f"  cost caps:    daily ${cost.get('daily_max_usd')} · "
            f"weekly ${cost.get('weekly_max_usd')} · "
            f"monthly ${cost.get('monthly_max_usd')}",
        )
    autonomy = resolved_preset.knobs.get("autonomy", {})
    if autonomy:
        print(f"  autonomy:     default={autonomy.get('default')}")
    return 0


def _find_rule(router: dict[str, Any], name: str) -> tuple[str, dict[str, Any]] | None:
    if name in router.get("kernel", []):
        return "kernel", {"id": name, "triggers": [{"always": True}]}
    for tier in ("tier_1", "tier_2"):
        for entry in router.get(tier, []):
            if entry.get("id") == name:
                return tier, entry
    return None


def _explain_rule(project_root: Path, name: str, *, as_json: bool) -> int:
    router = _load_router(project_root)
    found = _find_rule(router, name)
    if found is None:
        print(f"❌  explain: rule {name!r} not found in router", file=sys.stderr)
        return 1
    tier, entry = found
    payload = {"rule": name, "tier": tier, "entry": entry}
    if as_json:
        json.dump(payload, sys.stdout, indent=2, sort_keys=True)
        sys.stdout.write("\n")
        return 0
    print(f"  rule:    {name}")
    print(f"  tier:    {tier}")
    triggers = entry.get("triggers") or []
    print(f"  triggers ({len(triggers)}):")
    for trig in triggers:
        print(f"    · {trig}")
    routes = entry.get("routes_to") or []
    if routes:
        print(f"  routes_to: {', '.join(routes)}")
    return 0


def _matches_trigger(trigger: dict[str, Any], text: str, lowered: str) -> str | None:
    """Return a human-readable match reason, or ``None`` for no match."""
    if "keyword" in trigger:
        kw = str(trigger["keyword"]).lower()
        if kw and kw in lowered:
            return f"keyword: {kw}"
    if "phrase" in trigger:
        ph = str(trigger["phrase"]).lower()
        if ph and ph in lowered:
            return f"phrase: {ph}"
    if "path_prefix" in trigger:
        prefix = str(trigger["path_prefix"])
        if prefix and prefix in text:
            return f"path_prefix: {prefix}"
    return None


def _explain_route(project_root: Path, text: str, *, as_json: bool) -> int:
    router = _load_router(project_root)
    lowered = text.lower()
    matches: list[dict[str, Any]] = []
    for entry in router.get("tier_1", []):
        for trig in entry.get("triggers", []) or []:
            reason = _matches_trigger(trig, text, lowered)
            if reason is not None:
                matches.append({
                    "id": entry["id"], "tier": "tier_1", "reason": reason,
                })
                break
    payload = {
        "input": text,
        "kernel_always": list(router.get("kernel", [])),
        "tier_1_matches": matches,
    }
    if as_json:
        json.dump(payload, sys.stdout, indent=2, sort_keys=True)
        sys.stdout.write("\n")
        return 0
    print(f"  input: {text!r}")
    print()
    print(f"  kernel (always active, {len(payload['kernel_always'])}):")
    for kid in payload["kernel_always"]:
        print(f"    · {kid}")
    print()
    print(f"  tier-1 matches ({len(matches)}):")
    if not matches:
        print("    · (no trigger matched — only kernel rules active)")
        return 1
    for match in matches:
        print(f"    · {match['id']}  ({match['reason']})")
    return 0


def _explain_last(
    project_root: Path,
    state_file: Path | None,
    *,
    as_json: bool,
    quiet: bool,
) -> int:
    """Render the execution trace for the most recent ``/work`` run."""
    from scripts._cli.explain_last import build_trace
    from scripts._cli.explain_last.render import render as render_md
    from scripts._cli.explain_last.state_loader import StateLoadError

    settings = _load_user_settings(project_root)
    explain_cfg = settings.get("explain") if isinstance(settings.get("explain"), dict) else {}
    if explain_cfg.get("enable_last") is False:
        print("explain last disabled by settings (explain.enable_last)")
        return 0
    target_state = state_file or project_root / ".work-state.json"
    try:
        trace = build_trace(project_root, target_state)
    except StateLoadError as exc:
        # BLOCKING council fix — never print absolute paths in errors;
        # username leakage via /Users/<name>/... hits Slack / CI logs.
        try:
            rel = target_state.relative_to(project_root)
        except ValueError:
            rel = Path(target_state.name)
        msg = str(exc).replace(str(target_state), str(rel))
        print(f"❌  explain last: {msg}", file=sys.stderr)
        return exc.exit_code
    if as_json:
        json.dump(trace, sys.stdout, indent=2, sort_keys=True)
        sys.stdout.write("\n")
        return 0
    sys.stdout.write(render_md(trace, with_footer=not quiet))
    return 0


_LAST_HELP = """\
usage: agent-config explain last [--project PATH] [--state-file PATH]
                                 [--json] [--quiet]

Reconstruct the execution trace for the most recent /work,
/implement-ticket, /council, or /video run. Read-only; never
makes network calls. Output is the ExplainTrace v1 contract:
  docs/contracts/explain-trace.schema.json

why-slots answered (Markdown sections; JSON keys in parens):

  inputs       — profile / preset / rule_loading_tier with per-knob source
                 (pack | profile | preset | user | env | runtime |
                  default)
  route        — matched tier-1 rules · kernel rules · active persona
                 (route)
  memory       — memory-MCP entries that influenced this run, with
                 hit-score + step-id (memory)
  council      — council members consulted with per-member verdict
                 (council)
  assumptions  — assumptions recorded during refine + per-halt
                 (assumptions)
  pack         — discovery-manifest pack selection rationale (pack)
  halt         — reason · step · surface for the most recent halt
                 (halt; Phase 3)
  provider     — /video provider selection rationale; omitted for
                 non-video runs (provider; Phase 3)

options:
  --project PATH       project root (defaults to anchor walk from cwd)
  --state-file PATH    .work-state.json path (default <root>/.work-state.json)
  --json               emit ExplainTrace JSON instead of Markdown
  --quiet              suppress the trailing tip footer

exit codes:
  0  trace rendered, or disabled by settings (explain.enable_last)
  1  no recent run found (state file missing or unreadable)
  2  invocation error (bad project root, bad --state-file path)
"""


def main(argv: list[str] | None = None) -> int:
    argv_list = list(sys.argv[1:] if argv is None else argv)
    if argv_list[:1] == ["last"] and any(
        a in ("-h", "--help") for a in argv_list[1:]
    ):
        sys.stdout.write(_LAST_HELP)
        return 0
    parser = argparse.ArgumentParser(
        prog="agent-config explain",
        description=(
            "Print the decision chain behind a configuration or routing "
            "outcome. Read-only; no network calls."
        ),
    )
    parser.add_argument(
        "subject", choices=("config", "rule", "route", "last"),
        help="what to explain",
    )
    parser.add_argument(
        "target", nargs="?", default=None,
        help="rule name (for 'rule') or prompt text (for 'route')",
    )
    parser.add_argument(
        "--project", default=None,
        help="project root (defaults to anchor walk from cwd)",
    )
    parser.add_argument(
        "--state-file", default=None, dest="state_file",
        help="path to .work-state.json (subject=last; default <root>/.work-state.json)",
    )
    parser.add_argument(
        "--json", action="store_true", dest="as_json",
        help="emit JSON instead of human-readable text",
    )
    parser.add_argument(
        "--quiet", action="store_true",
        help="suppress the trailing tip footer (subject=last)",
    )
    opts = parser.parse_args(argv)
    project_root, _origin = _resolve_root(opts.project)
    if opts.subject == "config":
        return _explain_config(project_root, as_json=opts.as_json)
    if opts.subject == "last":
        state_path = Path(opts.state_file) if opts.state_file else None
        return _explain_last(
            project_root, state_path,
            as_json=opts.as_json, quiet=opts.quiet,
        )
    if opts.target is None:
        print(
            f"❌  explain: '{opts.subject}' requires a target argument",
            file=sys.stderr,
        )
        return 2
    if opts.subject == "rule":
        return _explain_rule(project_root, opts.target, as_json=opts.as_json)
    return _explain_route(project_root, opts.target, as_json=opts.as_json)


if __name__ == "__main__":  # pragma: no cover
    raise SystemExit(main())
