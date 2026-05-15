"""``agent-config validate`` — drift detection for the installed-tools manifest.

Phase 3.4 of road-to-global-first-install.md (ADR-008). Read-only check —
never edits the manifest, never re-runs the installer. Exits non-zero if any
drift is found so CI can gate on it. Surfaces three drift kinds documented in
ADR-008 §Lifecycle:

1. **marker_missing**     — recorded ``bridge_marker`` path does not exist.
2. **scope_divergence**   — recorded scope is ``project`` but the marker only
   exists at the user-scope anchor (or vice versa); the manifest is lying
   about where the tool actually lives.
3. **version_drift**      — manifest's ``agent_config_version`` no longer
   matches the package's currently-installed version (single repo-level
   check, surfaced once not per-tool).
"""
from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path
from typing import Iterable

from scripts._lib import installed_lock, installed_tools
from scripts._lib.agent_settings import resolve_project_root
from scripts.install import PROJECT_BRIDGE_MARKERS, USER_SCOPE_PATHS


def _resolve_marker(project_root: Path, bridge_marker: str, scope: str) -> Path:
    if scope == "global":
        return Path(bridge_marker).expanduser()
    candidate = Path(bridge_marker)
    return candidate if candidate.is_absolute() else (project_root / candidate)


def _counterpart_path(project_root: Path, tool_id: str, scope: str) -> Path | None:
    """Return the *other* scope's canonical marker path, or None if unknown."""
    if scope == "project":
        anchor = USER_SCOPE_PATHS.get(tool_id)
        return Path(anchor).expanduser() if anchor else None
    rel = PROJECT_BRIDGE_MARKERS.get(tool_id)
    return (project_root / rel) if rel else None


def _check_entry(project_root: Path, entry: dict) -> list[dict]:
    name = str(entry.get("name", "")).strip()
    scope = str(entry.get("scope", "")).strip()
    bridge_marker = str(entry.get("bridge_marker", "")).strip()
    issues: list[dict] = []
    if not name or scope not in ("project", "global") or not bridge_marker:
        issues.append({
            "kind": "manifest_corrupt",
            "name": name or "<unknown>",
            "detail": f"entry missing required fields (scope={scope!r}, marker={bridge_marker!r})",
        })
        return issues
    target = _resolve_marker(project_root, bridge_marker, scope)
    if not target.exists():
        counterpart = _counterpart_path(project_root, name, scope)
        if counterpart is not None and counterpart.exists():
            other_scope = "global" if scope == "project" else "project"
            issues.append({
                "kind": "scope_divergence",
                "name": name,
                "detail": (
                    f"recorded scope={scope} ({target}) is missing, but "
                    f"counterpart at scope={other_scope} ({counterpart}) exists"
                ),
            })
        else:
            issues.append({
                "kind": "marker_missing",
                "name": name,
                "detail": f"bridge_marker not found: {target}",
            })
    return issues


def _version_drift(manifest_version: str, current_version: str) -> dict | None:
    if not manifest_version or not current_version:
        return None
    if manifest_version != current_version:
        return {
            "kind": "version_drift",
            "name": "<manifest>",
            "detail": (
                f"manifest recorded agent_config_version={manifest_version}; "
                f"currently installed package is {current_version}"
            ),
        }
    return None


def _parse(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        prog="agent-config validate",
        description=(
            "Read-only drift detection for agents/installed-tools.lock. "
            "Exits 1 if any drift is found."
        ),
    )
    parser.add_argument("--project", default=None, help="Override project root.")
    parser.add_argument(
        "--quiet", action="store_true", help="Suppress non-essential output.",
    )
    parser.add_argument(
        "--skip-version-check",
        action="store_true",
        help="Skip the manifest-vs-package version drift check.",
    )
    return parser.parse_args(argv)


def _emit(quiet: bool, msg: str) -> None:
    if not quiet:
        print(msg)


def _format(issue: dict) -> str:
    return f"  ❌  [{issue['kind']}] {issue['name']}: {issue['detail']}"


def main(argv: list[str]) -> int:
    opts = _parse(argv)
    # Phase 3 — honor AGENT_CONFIG_PROJECT_ROOT + anchor walk via the
    # shared helper. Legacy ``PROJECT_ROOT`` env var stays as a fallback
    # so existing CI scripts keep working.
    arg = opts.project or os.environ.get("PROJECT_ROOT")
    project_root, _ = resolve_project_root(arg)
    manifest = installed_tools.manifest_path(project_root)
    data = installed_tools.read_manifest(manifest)

    if data is None:
        _emit(opts.quiet, f"❌  No manifest found at {manifest}")
        _emit(opts.quiet, "    Run `./agent-config init --tools=<id>` to create one.")
        _emit(opts.quiet, "    Diagnose: `./agent-config doctor --check manifest-integrity`")
        return 1

    entries = list(data.get("tools") or [])
    issues: list[dict] = []
    for entry in entries:
        issues.extend(_check_entry(project_root, entry))

    if not opts.skip_version_check:
        manifest_version = str(data.get("agent_config_version", "")).strip()
        current_version = installed_lock.current_package_version()
        drift = _version_drift(manifest_version, current_version)
        if drift is not None:
            issues.append(drift)

    _emit(opts.quiet, f"Manifest:  {manifest}")
    _emit(opts.quiet, f"Tools:     {len(entries)} entries")

    if not issues:
        _emit(opts.quiet, "✅  No drift detected.")
        return 0

    _emit(opts.quiet, f"Drift:     {len(issues)} issue(s)")
    for issue in issues:
        _emit(opts.quiet, _format(issue))
    _emit(opts.quiet, "")
    _emit(opts.quiet, "Run `./agent-config sync` to replay missing bridges, or")
    _emit(opts.quiet, "`./agent-config init --tools=<id> --force` to refresh the manifest.")
    # Deeplink: route per-kind to the matching `doctor` check so users can
    # copy-paste even though `doctor` is Tier-1 and absent from --help.
    kinds = {issue["kind"] for issue in issues}
    if "version_drift" in kinds:
        _emit(opts.quiet, "Diagnose:  `./agent-config doctor --check lockfile-freshness`")
    if kinds & {"marker_missing", "scope_divergence"}:
        _emit(opts.quiet, "Diagnose:  `./agent-config doctor --check bridge-drift`")
    if "manifest_corrupt" in kinds:
        _emit(opts.quiet, "Diagnose:  `./agent-config doctor --check manifest-integrity`")
    return 1


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
