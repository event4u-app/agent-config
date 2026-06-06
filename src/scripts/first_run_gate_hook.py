#!/usr/bin/env python3
"""First-run gate — surface the marketplace-install-but-unscaffolded shape.

Phase 2 of `road-to-hooks-actually-fire-in-consumers`.

When a consumer enables the plugin via `/plugin install` but never
runs `agent-config init` (or `hooks:install --claude --regen`), the
hooks declared in `hooks/hooks.json` fire but cannot do anything —
their commands resolve through an `$CLAUDE_PROJECT_DIR/agent-config`
that does not exist, or call a regenerator script that lives only in
package source-checkouts. The user has no way to discover this.

This hook runs on `session_start` only. It detects the failure shape
and surfaces it two ways (Council R3 HIGH — stderr alone is invisible
to the average user):

1. One stderr line — Claude shows session-start hook stderr in its
   lifecycle log; power users will see it there.
2. A file at `$CLAUDE_PROJECT_DIR/.augment/.first-run-action-needed.md`
   that the user discovers on the next `ls` of their tree.

Setup-complete detector (Council R3 MEDIUM — prevents banner spam):
the hook exits early without writing if the checklist passes
(`./agent-config` symlink executable + `.augment/scripts/update_roadmap_progress.py`
exists). Once the user runs `hooks:install --claude --regen`, the
file written by a prior run gets cleaned up the next time this hook
runs successfully.

Contract: never blocks. Returns 0 on every path.
"""
from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path


PLUGIN_ID = "agent-config@event4u-agent-config"
ACTION_NEEDED_FILE = ".augment/.first-run-action-needed.md"

REGENERATOR_PATHS = (
    ".augment/scripts/update_roadmap_progress.py",
    "dist/agent-src/scripts/update_roadmap_progress.py",
    # 6.0.x (ADR-051): uncondensed source container moved to src/agent-src/.
    "src/agent-src/scripts/update_roadmap_progress.py",
)

ACTION_NEEDED_BODY = """# First-run action needed — `agent-config` plugin

You enabled the `agent-config@event4u-agent-config` plugin via
`/plugin install`, but your project is missing the prerequisites
the plugin's hooks need to actually fire:

- `./agent-config` symlink at the repo root (needed by every hook).
- `.augment/scripts/update_roadmap_progress.py` (needed by the
  roadmap-progress hook to regenerate the dashboard).

Fix in one command:

```bash
./agent-config hooks:install --claude --regen
```

Or run the full installer:

```bash
./agent-config init
```

After either command, this file deletes itself on the next session
start. If you don't want the plugin's hooks, disable it via
`/plugin disable agent-config@event4u-agent-config` and delete
this file manually.
"""


def _plugin_enabled(consumer_root: Path) -> bool:
    """Returns True iff `.claude/settings.json` has the plugin id under
    `enabledPlugins` with a truthy value."""
    settings = consumer_root / ".claude" / "settings.json"
    if not settings.is_file():
        return False
    try:
        data = json.loads(settings.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return False
    if not isinstance(data, dict):
        return False
    enabled = data.get("enabledPlugins")
    if not isinstance(enabled, dict):
        return False
    return bool(enabled.get(PLUGIN_ID))


def _agent_config_executable(consumer_root: Path) -> bool:
    """`./agent-config` exists AND is executable (whether file or symlink)."""
    p = consumer_root / "agent-config"
    if not p.exists():
        return False
    return os.access(p, os.X_OK)


def _regenerator_present(consumer_root: Path) -> bool:
    return any((consumer_root / rel).is_file() for rel in REGENERATOR_PATHS)


def _setup_complete(consumer_root: Path) -> bool:
    return _agent_config_executable(consumer_root) and _regenerator_present(consumer_root)


def _write_action_file(consumer_root: Path) -> bool:
    """Best-effort write. Returns True on success."""
    target = consumer_root / ACTION_NEEDED_FILE
    try:
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(ACTION_NEEDED_BODY, encoding="utf-8")
        return True
    except OSError as exc:
        sys.stderr.write(
            f"first-run-gate: could not write {target}: {exc}\n"
        )
        return False


def _cleanup_action_file(consumer_root: Path) -> None:
    """Remove the action-needed file once setup is complete. Best-effort."""
    target = consumer_root / ACTION_NEEDED_FILE
    if target.exists():
        try:
            target.unlink()
        except OSError:
            pass


def run(consumer_root: Path) -> int:
    if os.environ.get("AGENT_CONFIG_REPLAY") == "1":
        # Fixture-driven replay must not mutate state.
        return 0
    if not _plugin_enabled(consumer_root):
        # Plugin not enabled — nothing to gate on. Silent.
        return 0
    if _setup_complete(consumer_root):
        # Setup checklist passes — clean up any stale action-needed file
        # left by a prior run, then exit silently.
        _cleanup_action_file(consumer_root)
        return 0

    # Failure shape detected. Two visible surfaces:
    sys.stderr.write(
        "first-run-gate: agent-config plugin is enabled but "
        "scaffolding is missing — run `./agent-config hooks:install "
        "--claude --regen` (details written to "
        f"{ACTION_NEEDED_FILE})\n"
    )
    _write_action_file(consumer_root)
    return 0


def parse_args(argv: list[str]) -> argparse.Namespace:
    p = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    p.add_argument("--platform", default="generic")
    return p.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    _ = parse_args(argv if argv is not None else sys.argv[1:])
    # Drain stdin envelope so the dispatcher pipe contract holds.
    try:
        sys.stdin.read()
    except OSError:
        pass
    consumer_root = Path(os.environ.get("CLAUDE_PROJECT_DIR") or os.getcwd())
    return run(consumer_root)


if __name__ == "__main__":
    raise SystemExit(main())
