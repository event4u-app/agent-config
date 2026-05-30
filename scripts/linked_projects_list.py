"""`agent-config linked-projects:list` — list opted-in IDE-attached siblings.

Phase 4 of `road-to-leaner-core-and-discovery`; closes the ADR-032 follow-up
"expose the detector as a CLI subcommand for consumer reach". Pure wrapper over
`scripts/_lib/linked_projects.detect_linked_projects` + the
`agents/settings/.agent-settings.local.yml` → `linked_projects[]` opt-in
cascade. No detection logic is duplicated here.

Prints opted-in siblings (`path · detected_via · large`). `--all` shows every
detected sibling with its opt-in status; `--format json` is machine-readable.
Read-only, no network.

Usage:
    python3 scripts/linked_projects_list.py [--all] [--format text|json] [--root PATH]
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import yaml

REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT / "scripts"))
from _lib.linked_projects import detect_linked_projects  # type: ignore  # noqa: E402

LOCAL_SETTINGS = Path("agents") / "settings" / ".agent-settings.local.yml"


def _opt_in_map(root: Path) -> dict[str, bool]:
    """Map resolved sibling path → include flag from the local settings cascade."""
    f = root / LOCAL_SETTINGS
    if not f.is_file():
        return {}
    try:
        data = yaml.safe_load(f.read_text(encoding="utf-8", errors="replace")) or {}
    except yaml.YAMLError:
        return {}
    out: dict[str, bool] = {}
    for entry in (data.get("linked_projects") or []):
        if isinstance(entry, dict) and entry.get("path"):
            try:
                out[str(Path(entry["path"]).expanduser().resolve())] = bool(entry.get("include"))
            except OSError:
                out[str(entry["path"])] = bool(entry.get("include"))
    return out


def collect(root: Path, show_all: bool) -> list[dict]:
    detected = detect_linked_projects(root)
    opt_in = _opt_in_map(root)
    rows: list[dict] = []
    for d in detected:
        include = opt_in.get(d["path"])  # None = undecided
        if not show_all and include is not True:
            continue
        rows.append({**d, "include": include})
    return rows


def render_text(rows: list[dict], show_all: bool) -> str:
    if not rows:
        scope = "detected" if show_all else "opted-in"
        return f"No {scope} linked-project siblings. (Attach a sibling repo in your IDE and opt in.)"
    lines = ["| path | detected via | large | opted in |", "|---|---|---|---|"]
    for r in rows:
        inc = {True: "yes", False: "no", None: "undecided"}[r.get("include")]
        lines.append(f"| {r['path']} | {r['detected_via']} | {'yes' if r['large'] else 'no'} | {inc} |")
    return "\n".join(lines)


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description="List opted-in IDE-attached sibling projects (read-only).")
    ap.add_argument("--all", action="store_true", help="Show every detected sibling, not only opted-in.")
    ap.add_argument("--format", choices=("text", "json"), default="text")
    ap.add_argument("--root", default=".", help="Project root (default: cwd).")
    args = ap.parse_args(argv)

    root = Path(args.root).resolve()
    rows = collect(root, args.all)
    if args.format == "json":
        print(json.dumps({"root": str(root), "siblings": rows}, indent=2))
    else:
        print(render_text(rows, args.all))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
