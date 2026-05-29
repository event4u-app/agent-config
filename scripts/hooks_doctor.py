#!/usr/bin/env python3
"""Hook doctor — read-only diagnostic over the hook runtime.

Wraps `scripts/hooks_status.py` (bridge presence + manifest bindings)
and adds three diagnostics the bare status table does not surface:

  * **Concerns** — every concern declared in the manifest, its
    `fail_closed` posture, the on-disk script path, and a one-line
    file-exists check.
  * **Trampolines** — per-platform shell trampoline expected under
    `scripts/hooks/<platform>-dispatcher.sh`; flags any platform that
    has manifest bindings but no trampoline on disk.
  * **Last feedback** — for each concern, the most-recent dispatcher
    feedback file under `agents/runtime/state/.dispatcher/*/<concern>.json`,
    plus the per-rule state file under `agents/runtime/state/<concern>.json`
    when one exists.

This is a **read-only** report. It never installs, modifies, or runs
anything — same contract as `hooks_status.py`. CI uses `--strict` to
turn missing bindings / trampolines into a non-zero exit.

Schema: docs/contracts/hook-architecture-v1.md.
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO_ROOT / "scripts"))
sys.path.insert(0, str(REPO_ROOT / "scripts" / "hooks"))

import dispatch_hook  # noqa: E402
import hooks_status  # noqa: E402

TRAMPOLINE_DIR = REPO_ROOT / "scripts" / "hooks"
STATE_DIR_DEFAULT = "agents/runtime/state"

# Platforms whose bridge file (settings.json) invokes the universal
# dispatcher directly — no shell trampoline required. Excluded from the
# "missing trampoline" check.
NATIVE_DISPATCH_PLATFORMS = frozenset({"claude"})


def _trampoline_for(platform: str) -> Path:
    return TRAMPOLINE_DIR / f"{platform}-dispatcher.sh"


def _concern_state_file(state_dir: Path, concern: str) -> Path | None:
    target = state_dir / f"{concern}.json"
    return target if target.is_file() else None


def _latest_feedback(state_dir: Path, concern: str) -> Path | None:
    """Return the most-recent dispatcher feedback file for the concern,
    walking `agents/runtime/state/.dispatcher/<session>/<concern>.json`."""
    dispatcher_dir = state_dir / ".dispatcher"
    if not dispatcher_dir.is_dir():
        return None
    candidates = sorted(
        dispatcher_dir.glob(f"*/{concern}.json"),
        key=lambda p: p.stat().st_mtime,
        reverse=True,
    )
    return candidates[0] if candidates else None


def _rel(path: Path | None, root: Path) -> str | None:
    if path is None:
        return None
    try:
        return str(path.resolve().relative_to(root.resolve()))
    except ValueError:
        return str(path)


def collect(project_root: Path, manifest: dict,
            state_dir_rel: str = STATE_DIR_DEFAULT) -> dict:
    """Build the doctor payload — JSON-serialisable."""
    matrix = hooks_status.collect(project_root, manifest)
    state_dir = project_root / state_dir_rel

    concerns_def = manifest.get("concerns") or {}
    concerns: list[dict] = []
    for name, spec in sorted(concerns_def.items()):
        script_rel = (spec or {}).get("script") or ""
        script_path = REPO_ROOT / script_rel if script_rel else None
        state_file = _concern_state_file(state_dir, name)
        last_feedback = _latest_feedback(state_dir, name)
        concerns.append({
            "concern": name,
            "fail_closed": bool((spec or {}).get("fail_closed", False)),
            "script": script_rel or None,
            "script_present": bool(script_path and script_path.is_file()),
            "state_file": _rel(state_file, project_root),
            "last_feedback": _rel(last_feedback, project_root),
        })

    trampolines: list[dict] = []
    for row in matrix["platforms"]:
        platform = row["platform"]
        needs_trampoline = bool(row["bindings"]) and platform not in NATIVE_DISPATCH_PLATFORMS
        tpath = _trampoline_for(platform)
        trampolines.append({
            "platform": platform,
            "expected": _rel(tpath, REPO_ROOT),
            "present": tpath.is_file(),
            "required": needs_trampoline,
            "missing": needs_trampoline and not tpath.is_file(),
        })

    # Phase 1 of road-to-hooks-actually-fire-in-consumers: surface
    # the dispatch-issues log so users see hooks that tried and failed.
    state_root = REPO_ROOT / STATE_DIR_DEFAULT
    issues: list[dict] = []
    try:
        sys.path.insert(0, str(REPO_ROOT / "scripts" / "hooks"))
        from dispatch_issues import read_dispatch_issues  # noqa: PLC0415
        issues = read_dispatch_issues(REPO_ROOT)[-20:]  # last 20
    except (ImportError, OSError):
        issues = []

    return {
        "schema_version": 1,
        "platforms": matrix["platforms"],
        "concerns": concerns,
        "trampolines": trampolines,
        "dispatch_issues": issues,
    }


def _render_table(payload: dict) -> str:
    lines: list[str] = []
    # Phase 1 CTA — surfaces at the TOP when issues exist, so a user
    # reading the report can't miss it.
    if payload.get("dispatch_issues"):
        n = len(payload["dispatch_issues"])
        lines.append(
            f"⚠️  Hooks tried to fire but couldn't ({n} entry"
            f"{'ies' if n != 1 else 'y'} in dispatch-issues.jsonl) — "
            "run `./agent-config hooks:install --claude --regen` "
            "(or follow the per-concern hints below)"
        )
        lines.append("")
    lines.append(hooks_status._render_table(payload))
    lines.append("")
    lines.append("Concerns")
    lines.append("-" * 60)
    for c in payload["concerns"]:
        posture = "fail-closed" if c["fail_closed"] else "fail-open"
        script_mark = "✅ " if c["script_present"] else "❌ "
        lines.append(f"{script_mark}{c['concern']:<22} {posture:<11} {c['script'] or '(no script)'}")
        if c["state_file"]:
            lines.append(f"    state:    {c['state_file']}")
        if c["last_feedback"]:
            lines.append(f"    feedback: {c['last_feedback']}")
    lines.append("")
    lines.append("Trampolines")
    lines.append("-" * 60)
    for t in payload["trampolines"]:
        marker = "❌ " if t["missing"] else ("·  " if not t["required"] else "✅ ")
        suffix = "" if t["required"] else "  (not required)"
        lines.append(f"{marker}{t['platform']:<9} {t['expected']}{suffix}")
    # Dispatch-issues detail — last 20 grouped by concern.
    if payload.get("dispatch_issues"):
        lines.append("")
        lines.append("Dispatch issues (last 20)")
        lines.append("-" * 60)
        grouped: dict[str, list[dict]] = {}
        for entry in payload["dispatch_issues"]:
            grouped.setdefault(entry.get("hook", "?"), []).append(entry)
        for hook, entries in sorted(grouped.items()):
            lines.append(f"⚠️  {hook}: {len(entries)} issue(s)")
            # Show the most recent reason + resolution per concern.
            latest = entries[-1]
            lines.append(f"    {latest.get('issue')}: {latest.get('detail')}")
            lines.append(f"    fix → {latest.get('resolution')}")
    return "\n".join(lines)


def _final_exit_code(payload: dict, strict: bool) -> int:
    if not strict:
        return 0
    rc = hooks_status._final_exit_code(payload, strict)
    if rc:
        return rc
    if any(t["missing"] for t in payload["trampolines"]):
        return 1
    if any(not c["script_present"] for c in payload["concerns"]):
        return 1
    return 0


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--format", choices=["table", "json"], default="table")
    parser.add_argument("--project-root", default=".",
                        help="Project root to inspect (default: cwd)")
    parser.add_argument("--manifest", default=str(dispatch_hook.MANIFEST_PATH))
    parser.add_argument("--strict", action="store_true",
                        help="Exit non-zero on missing bridges, trampolines, "
                             "or concern scripts (CI-friendly).")
    args = parser.parse_args(argv)

    manifest_path = Path(args.manifest)
    if not manifest_path.exists():
        sys.stderr.write(f"hooks_doctor: manifest missing at {manifest_path}\n")
        return 2
    manifest = dispatch_hook._load_yaml(manifest_path)
    project_root = Path(args.project_root).resolve()
    payload = collect(project_root, manifest)

    if args.format == "json":
        print(json.dumps(payload, indent=2, sort_keys=True))
    else:
        print(_render_table(payload))
    return _final_exit_code(payload, args.strict)


if __name__ == "__main__":
    raise SystemExit(main())
