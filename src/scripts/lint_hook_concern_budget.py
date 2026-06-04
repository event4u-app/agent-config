#!/usr/bin/env python3
"""Lint the hook concern budget against `scripts/hook_manifest.yaml`.

P3.3 of `agents/roadmaps/road-to-proof-not-features.md`. Static gate
that mirrors the always-rule budget pattern:

- **max concerns per (platform, event)** — warns when any cell exceeds
  the configured threshold. Default threshold is a placeholder sourced
  from `current-max × 1.5, rounded up` until Phase 1 captures real
  decision-trace evidence (`max(observed-in-Phase-1) × 1.5`).
- **fail-closed only for declared Tier-1 concerns** — errors when a
  concern carries `fail_closed: true` without being listed in
  `hooks.concern_budget.tier1_concerns`.

Out of scope for the static gate: **max execution time per concern**.
That signal lives in runtime decision-trace logs (Phase 2) and is
checked by a separate runtime probe once Phase 1 sessions produce
data — tracked as a P3.3 follow-up, not blocking this gate.

Defaults (override in `.agent-settings.yml`):

    hooks:
      concern_budget:
        max_per_event: 8
        tier1_concerns: []
        hard_fail: false

Exit codes (warn-only mode, the default):

    0 — clean, OR violations exist but `hard_fail` is false
    1 — schema load failed (file absent / malformed)
    2 — `hard_fail: true` and at least one violation

Hard-fail mode is gated on Phase 1 evidence (≥10 captured sessions per
the roadmap exit criterion).

Invocation:

    python3 scripts/lint_hook_concern_budget.py [--manifest PATH]
                                                [--settings PATH]
                                                [--strict]

`--strict` upgrades warn-only to hard-fail regardless of settings — for
CI lanes that want to surface the gate on every PR.
"""
from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path
try:  # invocation-agnostic import (repo-root-on-path vs scripts-on-path)
    from scripts._lib.agent_settings import project_settings_path
except ModuleNotFoundError:  # pragma: no cover
    from _lib.agent_settings import project_settings_path

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
DEFAULT_MANIFEST = REPO_ROOT / "src" / "scripts" / "hook_manifest.yaml"
DEFAULT_SETTINGS = project_settings_path(REPO_ROOT)

DEFAULT_MAX_PER_EVENT = 8
DEFAULT_TIER1: list[str] = []
DEFAULT_HARD_FAIL = False


def _load_manifest(path: Path) -> dict:
    sys.path.insert(0, str(REPO_ROOT / "src" / "scripts"))
    from hooks.dispatch_hook import _load_yaml  # noqa: E402
    return _load_yaml(path)


def _read_settings_block(settings_path: Path) -> dict:
    """Minimal YAML walk for `hooks.concern_budget.*`. Mirrors the
    pattern used by `scripts/minimal_safe_diff_hook.py` — no PyYAML
    dependency, tolerant of missing keys / blocks."""
    out: dict = {}
    if not settings_path.is_file():
        return out
    in_hooks = False
    in_budget = False
    in_tier1 = False
    try:
        text = settings_path.read_text(encoding="utf-8")
    except OSError:
        return out
    for raw in text.splitlines():
        line = raw.rstrip()
        if re.match(r"^hooks\s*:\s*(?:#.*)?$", line):
            in_hooks, in_budget, in_tier1 = True, False, False
            continue
        if in_hooks and re.match(r"^\S", line):
            in_hooks = in_budget = in_tier1 = False
        if in_hooks and re.match(r"^\s{2}concern_budget\s*:\s*(?:#.*)?$", line):
            in_budget, in_tier1 = True, False
            continue
        if in_budget and re.match(r"^\s{2}\S", line):
            in_budget = in_tier1 = False
        if in_budget:
            m = re.match(r"^\s{4}max_per_event\s*:\s*(\d+)", line)
            if m:
                out["max_per_event"] = int(m.group(1))
                in_tier1 = False
                continue
            m = re.match(r"^\s{4}hard_fail\s*:\s*(true|false)", line)
            if m:
                out["hard_fail"] = m.group(1) == "true"
                in_tier1 = False
                continue
            if re.match(r"^\s{4}tier1_concerns\s*:\s*\[\s*\]", line):
                out["tier1_concerns"] = []
                in_tier1 = False
                continue
            if re.match(r"^\s{4}tier1_concerns\s*:\s*(?:#.*)?$", line):
                out.setdefault("tier1_concerns", [])
                in_tier1 = True
                continue
            if in_tier1:
                m = re.match(r"^\s{6}-\s*([A-Za-z0-9_\-]+)", line)
                if m:
                    out.setdefault("tier1_concerns", []).append(m.group(1))
    return out


def _check_concern_counts(manifest: dict, max_per_event: int,
                          warnings: list[str]) -> None:
    platforms = manifest.get("platforms") or {}
    if not isinstance(platforms, dict):
        return
    for plat, block in platforms.items():
        if not isinstance(block, dict) or block.get("fallback_only"):
            continue
        for event, names in block.items():
            if not isinstance(names, list):
                continue
            count = len(names)
            if count > max_per_event:
                warnings.append(
                    f"platforms.{plat}.{event}: {count} concerns "
                    f"(threshold {max_per_event}). Trim or raise "
                    "hooks.concern_budget.max_per_event in .agent-settings.yml."
                )


def _check_fail_closed_tier(manifest: dict, tier1: list[str],
                            errors: list[str]) -> None:
    concerns = manifest.get("concerns") or {}
    if not isinstance(concerns, dict):
        return
    allowed = set(tier1)
    for name, spec in concerns.items():
        if not isinstance(spec, dict):
            continue
        if spec.get("fail_closed") is True and name not in allowed:
            errors.append(
                f"concerns.{name}: fail_closed=true but not declared in "
                "hooks.concern_budget.tier1_concerns. Promotion to Tier-1 "
                "is explicit opt-in (Phase 1 evidence required)."
            )


def lint(manifest_path: Path, settings_path: Path, *,
         strict: bool = False) -> int:
    if not manifest_path.is_file():
        sys.stderr.write(f"lint_hook_concern_budget: file not found: "
                         f"{manifest_path}\n")
        return 1
    try:
        manifest = _load_manifest(manifest_path)
    except Exception as exc:  # pragma: no cover
        sys.stderr.write(f"lint_hook_concern_budget: load error: {exc}\n")
        return 1
    if not isinstance(manifest, dict):
        sys.stderr.write("lint_hook_concern_budget: manifest is not a mapping\n")
        return 1

    settings = _read_settings_block(settings_path)
    max_per_event = settings.get("max_per_event", DEFAULT_MAX_PER_EVENT)
    tier1 = settings.get("tier1_concerns", DEFAULT_TIER1)
    hard_fail = settings.get("hard_fail", DEFAULT_HARD_FAIL) or strict

    warnings: list[str] = []
    errors: list[str] = []
    _check_concern_counts(manifest, max_per_event, warnings)
    _check_fail_closed_tier(manifest, tier1, errors)

    for w in warnings:
        sys.stderr.write(f"warn: {w}\n")
    for e in errors:
        sys.stderr.write(f"error: {e}\n")

    if hard_fail and (warnings or errors):
        return 2
    return 0


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--manifest", type=Path, default=DEFAULT_MANIFEST)
    parser.add_argument("--settings", type=Path, default=DEFAULT_SETTINGS)
    parser.add_argument("--strict", action="store_true",
                        help="upgrade warn-only to hard-fail")
    args = parser.parse_args(argv)
    return lint(args.manifest, args.settings, strict=args.strict)


if __name__ == "__main__":
    raise SystemExit(main())
