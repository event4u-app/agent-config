#!/usr/bin/env python3
"""Lint `scripts/hook_manifest.yaml`.

CI gate per roadmap step 7.10. Hard-fails on:

- missing or malformed top-level keys (`schema_version`, `concerns`,
  `platforms`)
- a concern entry referencing a non-existent script file
- a platform binding referencing an unknown concern name
- a platform binding referencing an unknown event (outside the
  vocabulary in `docs/contracts/hook-architecture-v1.md`)
- a `native_event_aliases` block referencing an unknown agent-config
  event or an unknown platform
- a `scripts/hooks/<platform>-dispatcher.sh` trampoline that exists on
  disk without a corresponding non-empty platform block in the
  manifest (orphan trampoline)

Soft-warns on:

- platform blocks set to `null` / empty (Phase 7.5–7.8 placeholders)
- concerns declared but not bound to any platform (dead concern)

Exit codes:
  0 — clean (warnings allowed)
  1 — at least one hard failure
  2 — file or schema-load error

Invocation:

    python3 scripts/lint_hook_manifest.py [--manifest PATH] [--strict]

`--strict` upgrades warnings to errors. Wired into `task ci` via the
`lint-hook-manifest` task.
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_MANIFEST = REPO_ROOT / "scripts" / "hook_manifest.yaml"
HOOKS_DIR = REPO_ROOT / "scripts" / "hooks"

# Canonical event vocabulary — keep in lock-step with
# docs/contracts/hook-architecture-v1.md and dispatch_hook.EVENT_VOCABULARY.
# `agent_error` added in Round 2 (2026-05-04) — synthetic event the
# wrapper fires on host crashes outside a concern.
EVENT_VOCABULARY: set[str] = {
    "session_start", "session_end",
    "user_prompt_submit",
    "pre_tool_use", "post_tool_use",
    "stop", "pre_compact",
    "agent_error",
}

# Known platform identifiers. New platforms MUST be added here as they
# land — the linter is the gate that proves no orphan slot escapes.
KNOWN_PLATFORMS: set[str] = {
    "augment", "claude", "cowork",
    "cursor", "cline", "windsurf", "gemini", "copilot",
}


def _load_manifest(path: Path) -> dict:
    """Reuse the dispatcher's loader so the linter sees exactly what
    the runtime sees — including the fallback parser when PyYAML is
    not installed."""
    sys.path.insert(0, str(REPO_ROOT / "scripts"))
    from hooks.dispatch_hook import _load_yaml  # noqa: E402
    return _load_yaml(path)


def _check_concerns(manifest: dict, errors: list[str]) -> set[str]:
    concerns = manifest.get("concerns") or {}
    if not isinstance(concerns, dict) or not concerns:
        errors.append("manifest: 'concerns' must be a non-empty mapping")
        return set()
    names: set[str] = set()
    for name, spec in concerns.items():
        if not isinstance(spec, dict):
            errors.append(f"concerns.{name}: must be a mapping, got {type(spec).__name__}")
            continue
        script = spec.get("script")
        if not script or not isinstance(script, str):
            errors.append(f"concerns.{name}: 'script' must be a relative path")
            continue
        if not (REPO_ROOT / script).is_file():
            errors.append(f"concerns.{name}: script not found at '{script}'")
        names.add(name)
    return names


def _check_platforms(manifest: dict, concern_names: set[str],
                     errors: list[str], warnings: list[str]) -> set[str]:
    platforms = manifest.get("platforms") or {}
    if not isinstance(platforms, dict) or not platforms:
        errors.append("manifest: 'platforms' must be a non-empty mapping")
        return set()
    bound: set[str] = set()
    for plat, block in platforms.items():
        if plat not in KNOWN_PLATFORMS:
            errors.append(f"platforms.{plat}: unknown platform "
                          f"(allowed: {sorted(KNOWN_PLATFORMS)})")
            continue
        if block is None:
            warnings.append(f"platforms.{plat}: placeholder (no events bound)")
            continue
        if not isinstance(block, dict):
            errors.append(f"platforms.{plat}: must be mapping or null")
            continue
        if block.get("fallback_only"):
            continue  # Copilot — intentional, no event surface
        for event, names in block.items():
            if event not in EVENT_VOCABULARY:
                errors.append(f"platforms.{plat}.{event}: unknown event "
                              f"(allowed: {sorted(EVENT_VOCABULARY)})")
                continue
            if not isinstance(names, list):
                errors.append(f"platforms.{plat}.{event}: must be a list of concern names")
                continue
            for n in names:
                if n not in concern_names:
                    errors.append(f"platforms.{plat}.{event}: unknown concern '{n}'")
                else:
                    bound.add(n)
    return bound


def _check_aliases(manifest: dict, errors: list[str]) -> None:
    aliases = manifest.get("native_event_aliases") or {}
    if not isinstance(aliases, dict):
        errors.append("native_event_aliases: must be a mapping")
        return
    for plat, mapping in aliases.items():
        if plat not in KNOWN_PLATFORMS:
            errors.append(f"native_event_aliases.{plat}: unknown platform")
            continue
        if not isinstance(mapping, dict):
            errors.append(f"native_event_aliases.{plat}: must be a mapping")
            continue
        for native, target in mapping.items():
            if target not in EVENT_VOCABULARY:
                errors.append(f"native_event_aliases.{plat}.{native}: "
                              f"target '{target}' not in vocabulary")


def _check_orphan_trampolines(manifest: dict, errors: list[str]) -> None:
    """A `<platform>-dispatcher.sh` on disk MUST have a non-null,
    non-empty manifest block — otherwise the trampoline runs but no
    concerns fire (silent no-op, hardest class of bug to debug)."""
    if not HOOKS_DIR.is_dir():
        return
    platforms = manifest.get("platforms") or {}
    for entry in sorted(HOOKS_DIR.iterdir()):
        if not entry.name.endswith("-dispatcher.sh"):
            continue
        plat = entry.name[: -len("-dispatcher.sh")]
        if plat not in KNOWN_PLATFORMS:
            errors.append(f"orphan trampoline {entry.name}: unknown platform '{plat}'")
            continue
        block = platforms.get(plat)
        if block is None or (isinstance(block, dict)
                             and not any(k in EVENT_VOCABULARY for k in block)):
            errors.append(f"orphan trampoline {entry.name}: "
                          f"platform '{plat}' has no event bindings in manifest")


def _check_dead_concerns(concern_names: set[str], bound: set[str],
                         warnings: list[str]) -> None:
    for n in sorted(concern_names - bound):
        warnings.append(f"concerns.{n}: declared but not bound to any platform")


def lint(manifest_path: Path, *, strict: bool) -> int:
    if not manifest_path.is_file():
        sys.stderr.write(f"lint_hook_manifest: file not found: {manifest_path}\n")
        return 2
    try:
        manifest = _load_manifest(manifest_path)
    except Exception as exc:  # pragma: no cover — covered by malformed-yaml test
        sys.stderr.write(f"lint_hook_manifest: load error: {exc}\n")
        return 2
    if not isinstance(manifest, dict) or manifest.get("schema_version") != 1:
        sys.stderr.write("lint_hook_manifest: schema_version must be 1\n")
        return 1

    errors: list[str] = []
    warnings: list[str] = []
    concern_names = _check_concerns(manifest, errors)
    bound = _check_platforms(manifest, concern_names, errors, warnings)
    _check_aliases(manifest, errors)
    _check_orphan_trampolines(manifest, errors)
    _check_dead_concerns(concern_names, bound, warnings)

    for w in warnings:
        sys.stderr.write(f"warn: {w}\n")
    for e in errors:
        sys.stderr.write(f"error: {e}\n")

    if errors:
        return 1
    if strict and warnings:
        return 1
    return 0


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--manifest", type=Path, default=DEFAULT_MANIFEST)
    parser.add_argument("--strict", action="store_true")
    args = parser.parse_args(argv)
    return lint(args.manifest, strict=args.strict)


if __name__ == "__main__":
    raise SystemExit(main())
