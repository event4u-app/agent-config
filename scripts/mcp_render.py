#!/usr/bin/env python3
"""
MCP config renderer — one ``mcp.json`` → per-tool output files.

Reads ``mcp.json`` at repo root (``{ "servers": { <name>: { command, args,
env, cwd } } }``), substitutes ``${env:VAR}`` placeholders from the
environment, and writes each target tool's concrete config format.

Targets:
    .cursor/mcp.json                                       (in-project)
    .windsurf/mcp.json                                     (in-project)
    ~/.config/claude-desktop/claude_desktop_config.json    (user, opt-in)

All targets use the same ``mcpServers`` top-level key. The source file
uses ``servers`` to keep our internal schema stable if a downstream
format ever diverges.

Failure mode: unresolved ``${env:VAR}`` placeholders are collected first,
then reported together and a non-zero exit is raised. No target file is
written when any placeholder is missing.

See docs/mcp.md for schema, usage, and worked examples.
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
from pathlib import Path
from typing import Any

PROJECT_ROOT = Path(__file__).resolve().parent.parent
SOURCE_FILE = PROJECT_ROOT / "mcp.json"

ENV_PLACEHOLDER = re.compile(r"\$\{env:([^}]+)\}")

# In-project targets. Claude Desktop is user-scope, opt-in via --claude-desktop.
IN_PROJECT_TARGETS: dict[str, Path] = {
    "cursor": PROJECT_ROOT / ".cursor" / "mcp.json",
    "windsurf": PROJECT_ROOT / ".windsurf" / "mcp.json",
}
CLAUDE_DESKTOP_TARGET = Path.home() / ".config" / "claude-desktop" / "claude_desktop_config.json"


def substitute(value: Any, path: str, missing: list[tuple[str, str]]) -> Any:
    """Recursively substitute ${env:VAR} in strings.

    Missing variables are appended to ``missing`` as ``(var_name, json_path)``
    instead of raising, so a single run surfaces *all* gaps at once.
    """
    if isinstance(value, str):
        def repl(match: re.Match[str]) -> str:
            name = match.group(1)
            env_value = os.environ.get(name)
            if env_value is None:
                missing.append((name, path))
                return match.group(0)
            return env_value
        return ENV_PLACEHOLDER.sub(repl, value)
    if isinstance(value, dict):
        return {k: substitute(v, f"{path}.{k}", missing) for k, v in value.items()}
    if isinstance(value, list):
        return [substitute(v, f"{path}[{i}]", missing) for i, v in enumerate(value)]
    return value


def load_source(source: Path) -> dict[str, Any]:
    if not source.exists():
        raise SystemExit(f"❌  Source file not found: {source}")
    try:
        data = json.loads(source.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        raise SystemExit(f"❌  Invalid JSON in {source}: {exc}") from exc
    if not isinstance(data, dict) or "servers" not in data or not isinstance(data["servers"], dict):
        raise SystemExit(f"❌  {source} must contain a top-level 'servers' object.")
    return data


def render(data: dict[str, Any]) -> tuple[dict[str, Any], list[tuple[str, str]]]:
    """Return (rendered, missing). Caller decides what to do on missing."""
    missing: list[tuple[str, str]] = []
    resolved_servers = substitute(data["servers"], "servers", missing)
    return {"mcpServers": resolved_servers}, missing


def format_missing_report(missing: list[tuple[str, str]]) -> str:
    grouped: dict[str, list[str]] = {}
    for name, path in missing:
        grouped.setdefault(name, []).append(path)
    lines = [f"❌  Unresolved ${{env:VAR}} placeholders ({len(grouped)} variable(s)):"]
    for name in sorted(grouped):
        lines.append(f"  - {name}  used at:")
        for path in grouped[name]:
            lines.append(f"      {path}")
    lines.append("\nSet the variable(s) in your environment and re-run.")
    return "\n".join(lines)


def write_target(path: Path, content: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    serialized = json.dumps(content, indent=2, sort_keys=True) + "\n"
    path.write_text(serialized, encoding="utf-8")


def collect_targets(include_claude_desktop: bool) -> dict[str, Path]:
    targets = dict(IN_PROJECT_TARGETS)
    if include_claude_desktop:
        targets["claude-desktop"] = CLAUDE_DESKTOP_TARGET
    return targets


def cmd_render(args: argparse.Namespace) -> int:
    data = load_source(Path(args.source))
    rendered, missing = render(data)
    if missing:
        print(format_missing_report(missing), file=sys.stderr)
        return 1
    targets = collect_targets(args.claude_desktop)
    for name, path in targets.items():
        write_target(path, rendered)
        print(f"✅  {name:16} → {path}")
    return 0


def cmd_check(args: argparse.Namespace) -> int:
    data = load_source(Path(args.source))
    rendered, missing = render(data)
    if missing:
        print(format_missing_report(missing), file=sys.stderr)
        return 1
    serialized = json.dumps(rendered, indent=2, sort_keys=True) + "\n"
    targets = collect_targets(args.claude_desktop)
    diffs = []
    for name, path in targets.items():
        actual = path.read_text(encoding="utf-8") if path.exists() else ""
        if actual != serialized:
            diffs.append((name, path))
    if diffs:
        print("❌  Targets out of date (run `task mcp:render`):", file=sys.stderr)
        for name, path in diffs:
            print(f"  - {name}: {path}", file=sys.stderr)
        return 1
    print("✅  All MCP targets match source.")
    return 0


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Render mcp.json → per-tool config files.")
    parser.add_argument("--source", default=str(SOURCE_FILE), help="Source mcp.json (default: repo root)")
    parser.add_argument("--claude-desktop", action="store_true", help="Also write Claude Desktop user-scope config")
    parser.add_argument("--check", action="store_true", help="Dry-run; exit non-zero if targets are stale")
    args = parser.parse_args(argv)
    return cmd_check(args) if args.check else cmd_render(args)


if __name__ == "__main__":
    sys.exit(main())
