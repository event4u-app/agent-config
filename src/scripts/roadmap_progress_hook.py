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
import os
import subprocess
import sys
from pathlib import Path

REPLAY_ENV_VAR = "AGENT_CONFIG_REPLAY"

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

REGEN_NAME = "update_roadmap_progress.py"
# Distributed-content script subtrees that may ship the regenerator,
# in priority order. Project-scoped installs land it under .augment/ or
# .agent-src/; the package itself carries the same projection.
DIST_SCRIPT_SUBDIRS = (
    Path(".augment") / "scripts",
    Path(".agent-src") / "scripts",
    Path(".agent-src.uncondensed") / "scripts",
)
# Set by the dispatcher (scripts/hooks/dispatch_hook.py) to its own
# resolved package root, so a globally-installed binary (ADR-020
# global-only) can locate the shipped regenerator even when the consumer
# repo carries no project-local distributed content.
PACKAGE_ROOT_ENV_VAR = "AGENT_CONFIG_PACKAGE_ROOT"


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


def _relativize(path: str, root: Path) -> str:
    """Make an absolute path project-relative so the `agents/roadmaps/` prefix
    check fires.

    Claude Code passes an absolute `tool_input.file_path`
    (`/Users/.../<repo>/agents/roadmaps/x.md`); Augment passes a repo-relative
    one. Without this, an absolute path never matches the relative prefix and
    the hook silently no-ops. Already-relative paths and out-of-tree paths are
    returned unchanged — an out-of-tree roadmap correctly fails the prefix
    check downstream.
    """
    p = Path(path)
    if not p.is_absolute():
        return path
    try:
        return str(p.resolve().relative_to(root.resolve()))
    except (ValueError, OSError):
        return path


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


def _package_roots() -> list[Path]:
    """Package roots to search for the shipped regenerator, in priority
    order, when the consumer carries no project-local copy.

    A global-only consumer (ADR-020) never has `.augment/` / `.agent-src/`
    in its repo — those trees are *distributed content*, which global-only
    installs keep in the globally-installed package, not the project. The
    regenerator therefore lives next to the running code, not next to the
    edited roadmap.

    1. ``AGENT_CONFIG_PACKAGE_ROOT`` — the dispatcher passes its own
       resolved package root (``dispatch_hook.REPO_ROOT``). This is the
       same root the dispatcher already trusts to locate this concern, so
       it survives editable installs, plugin-cache moves, and symlinks
       that a naive ``__file__`` walk would mis-resolve.
    2. This hook's own location (``<pkg>/scripts/roadmap_progress_hook.py``
       → ``<pkg>``) — last-resort fallback for standalone invocation
       outside the dispatcher.
    """
    roots: list[Path] = []
    env_root = os.environ.get(PACKAGE_ROOT_ENV_VAR, "").strip()
    if env_root:
        roots.append(Path(env_root).expanduser())
    roots.append(Path(__file__).resolve().parent.parent)
    return roots


def _resolve_regenerator(consumer_root: Path) -> Path | None:
    """Find the regenerator script.

    Project-local copy first (project-scoped installs), then the package
    the hook itself ships in (global-only consumers, per ADR-020 — the
    repo has no project-local distributed content). Returns ``None`` only
    when no copy exists in either place.
    """
    for subdir in DIST_SCRIPT_SUBDIRS:
        candidate = consumer_root / subdir / REGEN_NAME
        if candidate.is_file():
            return candidate
    for root in _package_roots():
        for subdir in DIST_SCRIPT_SUBDIRS:
            candidate = root / subdir / REGEN_NAME
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

    paths = [_relativize(p, consumer_root) for p in _candidate_paths(payload)]
    if not any(_is_roadmap_touch(p) for p in paths):
        return 0

    script = _resolve_regenerator(consumer_root)
    if script is None:
        # Phase 1 of road-to-hooks-actually-fire-in-consumers: log
        # dispatch issue directly (this hook runs as a subprocess from
        # the universal dispatcher; routing through the dispatcher
        # would add latency for no benefit).
        try:
            sys.path.insert(0, str(Path(__file__).resolve().parent / "hooks"))
            from dispatch_issues import log_dispatch_issue  # noqa: PLC0415
            log_dispatch_issue(
                workspace_root=consumer_root,
                hook="roadmap-progress",
                issue="prerequisite_missing",
                detail=(
                    "update_roadmap_progress.py not found at any of: "
                    ".augment/scripts/, .agent-src/scripts/, "
                    ".agent-src.uncondensed/scripts/"
                ),
                resolution=(
                    "./agent-config hooks:install --regen "
                    "(or ./agent-config init)"
                ),
            )
        except (ImportError, OSError):
            pass  # observability never breaks the hook
        if verbose:
            print("roadmap-progress-hook: regenerator not found, skipping",
                  file=sys.stderr)
        return 0

    # Replay mode (`AGENT_CONFIG_REPLAY=1`) skips the regenerator subprocess
    # so fixture dispatches never rewrite agents/roadmaps-progress.md.
    if os.environ.get(REPLAY_ENV_VAR, "").strip() == "1":
        if verbose:
            print("roadmap-progress-hook: replay mode, skipping regenerator",
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
    parser.add_argument("--project-dir", default="",
                        help="project root override; falls back to cwd. The "
                             "Claude plugin passes $CLAUDE_PROJECT_DIR so a "
                             "globally-resolved binary (ADR-020) scans the "
                             "right project's agents/roadmaps/.")
    parser.add_argument("--verbose", action="store_true",
                        help="emit one stderr line per invocation")
    args = parser.parse_args(argv)
    root = Path(args.project_dir).expanduser() if args.project_dir else Path.cwd()
    return run(sys.stdin.read(), consumer_root=root, verbose=args.verbose)


if __name__ == "__main__":  # pragma: no cover
    sys.exit(main())
