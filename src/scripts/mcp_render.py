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

ENV_PLACEHOLDER = re.compile(r"\$\{env:([^}]+)\}")

# Project root defaults to the current working directory so the renderer
# works both for package maintainers (running from the package root via
# Taskfile) and for consumer projects (running via `./agent-config
# mcp:render` from their own repo root). Override with --project-root.
def default_project_root() -> Path:
    return Path.cwd().resolve()


def in_project_targets(project_root: Path) -> dict[str, Path]:
    return {
        "cursor": project_root / ".cursor" / "mcp.json",
        "windsurf": project_root / ".windsurf" / "mcp.json",
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


def collect_targets(project_root: Path, include_claude_desktop: bool) -> dict[str, Path]:
    targets = dict(in_project_targets(project_root))
    if include_claude_desktop:
        targets["claude-desktop"] = CLAUDE_DESKTOP_TARGET
    return targets


def resolve_source(args: argparse.Namespace, project_root: Path) -> Path:
    return Path(args.source) if args.source else project_root / "mcp.json"


def cmd_render(args: argparse.Namespace) -> int:
    project_root = Path(args.project_root).resolve() if args.project_root else default_project_root()
    data = load_source(resolve_source(args, project_root))
    rendered, missing = render(data)
    if missing:
        print(format_missing_report(missing), file=sys.stderr)
        return 1
    targets = collect_targets(project_root, args.claude_desktop)
    for name, path in targets.items():
        write_target(path, rendered)
        print(f"✅  {name:16} → {path}")
    return 0


def cmd_check(args: argparse.Namespace) -> int:
    project_root = Path(args.project_root).resolve() if args.project_root else default_project_root()
    data = load_source(resolve_source(args, project_root))
    rendered, missing = render(data)
    if missing:
        print(format_missing_report(missing), file=sys.stderr)
        return 1
    serialized = json.dumps(rendered, indent=2, sort_keys=True) + "\n"
    targets = collect_targets(project_root, args.claude_desktop)
    diffs = []
    for name, path in targets.items():
        actual = path.read_text(encoding="utf-8") if path.exists() else ""
        if actual != serialized:
            diffs.append((name, path))
    if diffs:
        print("❌  Targets out of date (run `./agent-config mcp:render`):", file=sys.stderr)
        for name, path in diffs:
            print(f"  - {name}: {path}", file=sys.stderr)
        return 1
    print("✅  All MCP targets match source.")
    return 0


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Render mcp.json → per-tool config files.")
    parser.add_argument("--source", default=None, help="Source mcp.json (default: <project-root>/mcp.json)")
    parser.add_argument("--project-root", default=None, help="Project root for resolving source and targets (default: CWD)")
    parser.add_argument("--claude-desktop", action="store_true", help="Also write Claude Desktop user-scope config")
    parser.add_argument("--check", action="store_true", help="Dry-run; exit non-zero if targets are stale")
    args = parser.parse_args(argv)
    return cmd_check(args) if args.check else cmd_render(args)


if __name__ == "__main__":
    sys.exit(main())
