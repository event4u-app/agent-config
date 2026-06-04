#!/usr/bin/env python3
"""session_start concern — keep the project-local ``./agent-config`` fresh.

Defense-in-depth twin of the update-command refresh (``upgrade`` /
``refresh --project``). On every session_start the dispatcher runs this in
the consumer workspace; if a ``./agent-config`` wrapper exists there and
differs from the canonical template, it is re-stamped so an outdated,
fallback-less copy cannot keep breaking the hooks.

Bootstrapping note: this can only heal a wrapper functional enough to
invoke the dispatcher in the first place (the current template's global +
npx fallbacks guarantee that). A *completely* broken wrapper never reaches
this concern — that recovery path is ``agent-config upgrade`` /
``refresh --project``.

Contract: never creates a wrapper where none exists (that is an install
action); never touches the agent-config source repo; always fail-open
(exit 0) — hook self-heal must not block a session.
"""
from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

# Make `scripts` importable when invoked as a bare script path.
_REPO = Path(__file__).resolve().parent.parent.parent
if str(_REPO) not in sys.path:
    sys.path.insert(0, str(_REPO))

EXIT_ALLOW = 0


def _project_root() -> Path:
    env = os.environ.get("CLAUDE_PROJECT_DIR") or os.environ.get(
        "AGENT_CONFIG_PROJECT_DIR")
    if env:
        return Path(env)
    return Path.cwd()


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(
        description="Project ./agent-config wrapper freshness (session_start).")
    ap.add_argument("--root", default=None)
    args, _ = ap.parse_known_args(argv)

    # Drain stdin (the dispatcher passes a JSON envelope); we do not need it.
    try:
        if not sys.stdin.isatty():
            sys.stdin.read()
    except Exception:
        pass

    try:
        from scripts._lib import cli_wrapper
        from scripts._cli.cmd_refresh import _is_source_repo
    except Exception:  # pragma: no cover — defensive; never block the loop
        return EXIT_ALLOW

    root = Path(args.root) if args.root else _project_root()
    try:
        if _is_source_repo(root):
            return EXIT_ALLOW
        if not (root / "agent-config").is_file():
            return EXIT_ALLOW  # no wrapper here — never create one
        if not cli_wrapper.needs_refresh(root):
            return EXIT_ALLOW
        wrapper = cli_wrapper.install_cli_wrapper(root)
    except Exception:
        return EXIT_ALLOW  # fail-open — never block the session

    if wrapper is not None:
        print(f"[wrapper] re-stamped stale ./agent-config at {wrapper}",
              file=sys.stderr)
        sys.stdout.write(json.dumps({
            "decision": "allow",
            "reason": f"refreshed stale ./agent-config wrapper at {wrapper}",
        }))
    return EXIT_ALLOW


if __name__ == "__main__":
    raise SystemExit(main())
