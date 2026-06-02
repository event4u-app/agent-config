#!/usr/bin/env python3
"""Session-profile staleness notice — `session_start` hook.

Phase 1 companion to the locked Phase-0.1 decision (option a, explicit
`/profile deactivate`). The `runtime.active_packs` overlay survives an IDE
restart, so this hook does **not** reset it — it only surfaces a one-line
**staleness notice** when a new session starts with an overlay carried over
from a previous session. Silently resetting on `session_start` is the
registry-refresh Catch-22 the council ruled out (see
`agents/settings/contexts/session-host-capability-audit.md`).

Contract: never blocks. Reads the JSON envelope on stdin (ignored — the
notice is derived from the overlay file), emits at most one stderr line,
returns 0 on every path.
"""
from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

# Make `scripts` importable when invoked as a bare script path.
_REPO = Path(__file__).resolve().parent.parent
if str(_REPO) not in sys.path:
    sys.path.insert(0, str(_REPO))

try:
    from scripts.config import session_profiles
except Exception:  # pragma: no cover - defensive; never block the loop
    session_profiles = None  # type: ignore


def _project_root() -> Path:
    env = os.environ.get("CLAUDE_PROJECT_DIR") or os.environ.get("AGENT_CONFIG_PROJECT_DIR")
    if env:
        return Path(env)
    return Path.cwd()


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description="Session-profile staleness notice (session_start).")
    ap.add_argument("--root", default=None)
    args, _ = ap.parse_known_args(argv)

    # Drain stdin (the dispatcher passes a JSON envelope); we do not need it.
    try:
        if not sys.stdin.isatty():
            sys.stdin.read()
    except Exception:
        pass

    if session_profiles is None:
        return 0

    root = Path(args.root) if args.root else _project_root()
    try:
        notice = session_profiles.stale_notice(root)
    except Exception:
        return 0  # fail-open — never block the session

    if notice:
        print(f"[profile] {notice}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
