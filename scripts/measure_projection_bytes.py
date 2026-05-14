#!/usr/bin/env python3
"""Measure per-tool projection bytes.

Phase 2.1 deliverable for `agents/roadmaps/step-1-v2-feedback-followup.md`
(council finding U1 — the 0.45 % source/dist headline metric measures the
wrong boundary). Replaces the single headline figure with per-tool numbers
and an explicit projection-method label.

Usage:
    python3 scripts/measure_projection_bytes.py           # human-readable
    python3 scripts/measure_projection_bytes.py --json    # machine-readable
    python3 scripts/measure_projection_bytes.py --regenerate
        # runs `task clean-tools && task generate-tools` with *all* tools
        # enabled (via temporary .agent-tools.yml override) before measuring,
        # then restores the original `.agent-tools.yml`. Use this to produce
        # a complete table when the local repo only enables a subset.

Output is intentionally non-cached and read fresh from disk every run.
"""

from __future__ import annotations

import argparse
import json
import shutil
import subprocess
import sys
from pathlib import Path

import yaml

PROJECT_ROOT = Path(__file__).resolve().parent.parent

# (surface, kind, projection-method). Surface paths are relative to the repo
# root. `kind` is "dir" (walk recursively) or "file" (single file size).
SURFACES: list[tuple[str, str, str]] = [
    (".agent-src.uncompressed", "dir", "verbose source (input)"),
    (".agent-src", "dir", "source projection (path-rewrite + .npmignore)"),
    (".augment", "dir", "Augment Code — copies (rules) + symlinks (skills/cmds)"),
    (".claude", "dir", "Claude Code — pure symlinks"),
    (".cursor", "dir", "Cursor — per-rule `.mdc` materialized + symlinks"),
    (".clinerules", "dir", "Cline — pure symlinks"),
    (".windsurf", "dir", "Windsurf — per-rule wave-8 `.md` + symlinks"),
    (".windsurfrules", "file", "Windsurf legacy — concatenated single file"),
    ("GEMINI.md", "file", "Gemini CLI — symlink → AGENTS.md"),
]


def _measure_dir(path: Path) -> tuple[int, int, int]:
    """Return (file_count, symlink_count, materialized_bytes) for *path*."""
    if not path.exists():
        return (0, 0, 0)
    files = 0
    links = 0
    size = 0
    for p in path.rglob("*"):
        if p.is_symlink():
            links += 1
        elif p.is_file():
            files += 1
            try:
                size += p.stat().st_size
            except OSError:
                pass
    return (files, links, size)


def _measure_file(path: Path) -> tuple[int, int, int]:
    if path.is_symlink():
        return (0, 1, 0)
    if path.is_file():
        return (1, 0, path.stat().st_size)
    return (0, 0, 0)


def collect() -> list[dict]:
    rows: list[dict] = []
    for surface, kind, method in SURFACES:
        path = PROJECT_ROOT / surface
        files, links, size = (
            _measure_dir(path) if kind == "dir" else _measure_file(path)
        )
        rows.append(
            {
                "surface": surface,
                "kind": kind,
                "method": method,
                "files": files,
                "symlinks": links,
                "bytes_materialized": size,
                "exists": files + links > 0,
            }
        )
    return rows


def _temporarily_enable_all_tools() -> str | None:
    tools_file = PROJECT_ROOT / ".agent-tools.yml"
    if not tools_file.exists():
        return None
    original = tools_file.read_text()
    data = yaml.safe_load(original) or {}
    data["tools"] = [
        "claude-code", "claude-desktop", "augment", "copilot",
        "cursor", "windsurf", "cline", "gemini",
    ]
    tools_file.write_text(
        "# TEMPORARY override by measure_projection_bytes.py — restored on exit\n"
        + yaml.safe_dump(data, sort_keys=False)
    )
    return original


def regenerate_all() -> None:
    backup = _temporarily_enable_all_tools()
    try:
        subprocess.run(["task", "clean-tools"], check=True, capture_output=True)
        subprocess.run(["task", "generate-tools"], check=True, capture_output=True)
    finally:
        if backup is not None:
            (PROJECT_ROOT / ".agent-tools.yml").write_text(backup)


def render_table(rows: list[dict]) -> str:
    width = max(len(r["surface"]) for r in rows)
    lines = [f"{'Surface':<{width}}  Files  Symlinks  Bytes        Method"]
    lines.append("-" * (width + 50))
    for r in rows:
        lines.append(
            f"{r['surface']:<{width}}  {r['files']:>5}  {r['symlinks']:>8}  "
            f"{r['bytes_materialized']:>10,}  {r['method']}"
        )
    return "\n".join(lines)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--json", action="store_true", help="machine-readable output")
    parser.add_argument(
        "--regenerate",
        action="store_true",
        help="regenerate all tool projections before measuring",
    )
    args = parser.parse_args()
    if args.regenerate:
        if not shutil.which("task"):
            print("❌  `task` CLI required for --regenerate", file=sys.stderr)
            return 2
        regenerate_all()
    rows = collect()
    if args.json:
        print(json.dumps({"surfaces": rows}, indent=2))
    else:
        print(render_table(rows))
    return 0


if __name__ == "__main__":
    sys.exit(main())
