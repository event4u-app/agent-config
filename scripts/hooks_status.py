#!/usr/bin/env python3
"""Print the runtime hook matrix per `docs/contracts/hook-architecture-v1.md`.

For each platform in `scripts/hook_manifest.yaml`, prints whether the
project-scope bridge files exist on disk, which (event → concerns)
bindings the manifest declares, and a one-line install hint when the
bridge is missing. Copilot has no native hook surface — its row carries
the `degraded: rule-only fallback` marker per Phase 7.12 / Round 2.

This is a **read-only** report. It never installs, modifies, or fires
anything; that is the contract callers depend on (`task hooks-status`,
post-install smoke, CI).
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO_ROOT / "scripts" / "hooks"))

import dispatch_hook  # noqa: E402  — reuse the manifest loader

# (label, project-relative bridge path, install hint).
# Path may be a directory (cline) — existence => any file inside.
#
# Cowork has no project-scope bridge path: the Claude desktop app's
# local-agent-mode runtime is upstream-blocked from reading any of
# Claude Code's three settings sources (anthropics/claude-code#40495,
# #27398). We register cowork here so the manifest's `cowork:`
# bindings are surfaced in the status report, but the empty bridge
# path resolves to status="n/a" — strict mode does not fail on
# n/a (see _final_exit_code), matching Copilot's no-bridge posture.
# Once upstream lands the fix and a stable settings location is
# documented, swap the empty path here for that location.
PLATFORM_BRIDGES: dict[str, tuple[str, str]] = {
    "augment":  (".augment/settings.json",      "scripts/install.py"),
    "claude":   (".claude/settings.json",       "scripts/install.py"),
    "cowork":   ("",                            "upstream-blocked: anthropics/claude-code#40495 + #27398 (settings.json ignored in Cowork sandbox)"),
    "cursor":   (".cursor/hooks.json",          "scripts/install.py"),
    "cline":    (".clinerules/hooks",           "scripts/install.py"),
    "windsurf": (".windsurf/hooks.json",        "scripts/install.py"),
    "gemini":   (".gemini/settings.json",       "scripts/install.py"),
    "copilot":  ("",                            "rule-only fallback (no hook surface)"),
}


def _bridge_status(project_root: Path, rel_path: str) -> str:
    if not rel_path:
        return "n/a"
    target = project_root / rel_path
    if target.is_dir():
        return "installed" if any(target.iterdir()) else "empty"
    return "installed" if target.is_file() else "missing"


def collect(project_root: Path, manifest: dict) -> dict:
    """Build the runtime matrix as a plain dict — JSON-serialisable."""
    platforms = manifest.get("platforms") or {}
    rows: list[dict] = []
    for platform in PLATFORM_BRIDGES:
        rel, hint = PLATFORM_BRIDGES[platform]
        block = platforms.get(platform) or {}
        fallback_only = bool(block.get("fallback_only"))
        bindings = (
            {} if fallback_only
            else {ev: list(c) for ev, c in block.items()
                  if isinstance(c, list)}
        )
        status = "degraded" if fallback_only else _bridge_status(project_root, rel)
        rows.append({
            "platform": platform,
            "status": status,
            "bridge_path": rel or None,
            "fallback_only": fallback_only,
            "bindings": bindings,
            "hint": hint if status in {"missing", "empty", "degraded", "n/a"} else None,
        })
    return {"schema_version": 1, "platforms": rows}


def _render_table(matrix: dict) -> str:
    lines: list[str] = []
    lines.append("agent-config hook matrix")
    lines.append("=" * 60)
    for row in matrix["platforms"]:
        marker = {
            "installed": "✅ ",
            "missing":   "❌ ",
            "empty":     "⚠️  ",
            "degraded":  "⚠️  ",
            "n/a":       "·  ",
        }.get(row["status"], "?  ")
        head = f"{marker}{row['platform']:<9} {row['status']}"
        if row["bridge_path"]:
            head += f"  ({row['bridge_path']})"
        lines.append(head)
        if row["fallback_only"]:
            lines.append("    degraded: rule-only fallback "
                         "— hooks are not auto-firing on this platform.")
            continue
        if not row["bindings"]:
            lines.append("    (no bindings declared in manifest)")
            continue
        for event in sorted(row["bindings"]):
            concerns = ", ".join(row["bindings"][event]) or "—"
            lines.append(f"    {event:<22} → {concerns}")
        if row["hint"]:
            lines.append(f"    hint: run {row['hint']}")
    lines.append("")
    lines.append("Source of truth: scripts/hook_manifest.yaml")
    lines.append("Contract: docs/contracts/hook-architecture-v1.md")
    return "\n".join(lines)


def _final_exit_code(matrix: dict, strict: bool) -> int:
    if not strict:
        return 0
    # Strict mode: any platform with declared bindings whose bridge is
    # missing is a CI failure. `degraded`/`n/a` never fail (Copilot is
    # an explicit no-hook platform; n/a means no bridge expected).
    for row in matrix["platforms"]:
        if row["status"] == "missing" and row["bindings"]:
            return 1
    return 0


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--format", choices=["table", "json"], default="table")
    parser.add_argument("--project-root", default=".",
                        help="Project root to inspect (default: cwd)")
    parser.add_argument("--manifest", default=str(dispatch_hook.MANIFEST_PATH))
    parser.add_argument("--strict", action="store_true",
                        help="Exit non-zero if any platform with bindings is "
                             "missing its bridge (CI-friendly).")
    args = parser.parse_args(argv)

    manifest_path = Path(args.manifest)
    if not manifest_path.exists():
        sys.stderr.write(f"hooks_status: manifest missing at {manifest_path}\n")
        return 2
    manifest = dispatch_hook._load_yaml(manifest_path)
    project_root = Path(args.project_root).resolve()
    matrix = collect(project_root, manifest)

    if args.format == "json":
        print(json.dumps(matrix, indent=2, sort_keys=True))
    else:
        print(_render_table(matrix))
    return _final_exit_code(matrix, args.strict)


if __name__ == "__main__":
    raise SystemExit(main())
