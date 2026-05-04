#!/usr/bin/env python3
"""Platform-agnostic PostToolUse hook for the `roadmap-progress-sync` rule.

Reads a JSON event from stdin (Augment / Claude / Cursor / Cline /
Windsurf / Gemini PostToolUse-shaped envelopes), decides whether the
tool call wrote to a roadmap file under `agents/roadmaps/`, and — when
it did — re-runs `update_roadmap_progress.py` so the dashboard stays
in sync without depending on agent self-discipline.

Exit code is **always 0**. Hooks must never block the agent loop; the
worst-case is a no-op when stdin is malformed or the regenerator is
missing.

Output discipline:
  - stdout: nothing (Augment would surface stdout to the user)
  - stderr: one short line in --verbose mode, otherwise silent

CLI:
  python3 scripts/roadmap_progress_hook.py [--platform NAME] [--verbose]

The `--platform` flag is informational only — the filter logic reads
the same field names across platforms (tool_name, tool_input.path,
file_changes[].path).
"""
from __future__ import annotations

import argparse
import json
import subprocess
import sys
from pathlib import Path

# Tools whose successful execution can write to a roadmap file. We keep
# the list explicit so an unknown tool name (e.g. a new MCP tool that
# happens to mention a roadmap path in its input) does not trigger a
# spurious regeneration.
WRITE_TOOLS = frozenset({
    "str-replace-editor",
    "save-file",
    "remove-files",
    # Claude Code / Cursor naming variants — kept for cross-platform
    # parity if this hook is ever wired beyond Augment.
    "Edit",
    "Write",
    "MultiEdit",
})

ROADMAP_PREFIX = "agents/roadmaps/"
# Paths under these subtrees are tracked but not part of the open list
# the dashboard summarises — regenerating on every archived edit would
# be wasteful. The check still fires on the parent dir itself.
ROADMAP_EXCLUDED_PARTS = frozenset({"archive", "skipped"})
DASHBOARD_PATH = "agents/roadmaps-progress.md"


def _candidate_paths(payload: dict) -> list[str]:
    """Pull every plausible file path out of a PostToolUse payload."""
    out: list[str] = []
    fc = payload.get("file_changes")
    if isinstance(fc, list):
        for entry in fc:
            if isinstance(entry, dict):
                p = entry.get("path")
                if isinstance(p, str) and p:
                    out.append(p)
    ti = payload.get("tool_input")
    if isinstance(ti, dict):
        for key in ("path", "file_path", "target_file"):
            v = ti.get(key)
            if isinstance(v, str) and v:
                out.append(v)
    return out


def _is_roadmap_touch(path: str) -> bool:
    """Return True if `path` is a roadmap file we should react to."""
    norm = path.lstrip("./").replace("\\", "/")
    if not norm.startswith(ROADMAP_PREFIX):
        return False
    if norm == DASHBOARD_PATH:
        # Defensive — the dashboard sits at agents/roadmaps-progress.md,
        # NOT inside agents/roadmaps/. The prefix check above already
        # excludes it, but keep this explicit so a future relocation
        # cannot turn the hook into an infinite loop.
        return False
    rest = norm[len(ROADMAP_PREFIX):]
    parts = rest.split("/")
    if len(parts) >= 2 and parts[0] in ROADMAP_EXCLUDED_PARTS:
        return False
    if not norm.endswith(".md"):
        return False
    return True


def _resolve_regenerator(consumer_root: Path) -> Path | None:
    """Find the regenerator script — package-shipped or installed copy."""
    for candidate in (
        consumer_root / ".augment" / "scripts" / "update_roadmap_progress.py",
        consumer_root / ".agent-src" / "scripts" / "update_roadmap_progress.py",
        consumer_root / ".agent-src.uncompressed" / "scripts" / "update_roadmap_progress.py",
    ):
        if candidate.is_file():
            return candidate
    return None


def run(stdin_text: str, *, consumer_root: Path, verbose: bool = False) -> int:
    payload: dict = {}
    if stdin_text.strip():
        try:
            decoded = json.loads(stdin_text)
            if isinstance(decoded, dict):
                payload = decoded
        except json.JSONDecodeError:
            return 0  # malformed stdin → silent no-op, never block

    # Unwrap dispatcher envelope (Phase 7.3, hook-architecture-v1.md).
    if all(k in payload for k in ("schema_version", "platform", "event", "payload")):
        inner = payload.get("payload")
        payload = inner if isinstance(inner, dict) else {}

    tool = payload.get("tool_name") or payload.get("toolName") or payload.get("tool")
    if not isinstance(tool, str) or tool not in WRITE_TOOLS:
        return 0

    paths = _candidate_paths(payload)
    if not any(_is_roadmap_touch(p) for p in paths):
        return 0

    script = _resolve_regenerator(consumer_root)
    if script is None:
        if verbose:
            print("roadmap-progress-hook: regenerator not found, skipping",
                  file=sys.stderr)
        return 0

    try:
        subprocess.run(
            [sys.executable, str(script)],
            cwd=consumer_root, check=False,
            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
            timeout=30,
        )
    except (OSError, subprocess.SubprocessError):
        pass  # never propagate regenerator failures into the agent loop

    if verbose:
        print(f"roadmap-progress-hook: regenerated for tool={tool}",
              file=sys.stderr)
    return 0


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--platform", default="generic",
                        help="informational platform tag (augment/claude/...)")
    parser.add_argument("--verbose", action="store_true",
                        help="emit one stderr line per invocation")
    args = parser.parse_args(argv)
    return run(sys.stdin.read(), consumer_root=Path.cwd(), verbose=args.verbose)


if __name__ == "__main__":  # pragma: no cover
    sys.exit(main())
