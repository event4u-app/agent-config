#!/usr/bin/env python3
"""Fixture-driven hook replay — read-only dispatch through the runtime.

Reads a stdin payload fixture from `tests/fixtures/hooks/` (one file per
event in `EVENT_VOCABULARY`), sets `AGENT_CONFIG_REPLAY=1`, and invokes
the universal dispatcher with the platform / event / payload tuple. The
replay flag tells `state_io` (and concerns that honour it) to skip every
write under `agents/state/` so the replay never mutates real session
state.

Invocation:

    python3 scripts/hooks/replay_hook.py \\
        --platform <name> \\
        --event <agent-config-event> \\
        --payload tests/fixtures/hooks/<event>.json \\
        [--native-event <native>] \\
        [--manifest <path>] \\
        [--json]

The `--json` flag prints a structured replay summary on stdout
(platform, event, dispatcher exit code, captured stderr lines).
Non-zero exit is propagated from the dispatcher.

Contract reference: `docs/contracts/hook-architecture-v1.md` § Replay
mode. Roadmap step: P2.4b of `agents/roadmaps/road-to-proof-not-features.md`.
"""
from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
DISPATCHER = REPO_ROOT / "scripts" / "hooks" / "dispatch_hook.py"
DEFAULT_MANIFEST = REPO_ROOT / "scripts" / "hook_manifest.yaml"
FIXTURE_DIR = REPO_ROOT / "tests" / "fixtures" / "hooks"
REPLAY_ENV_VAR = "AGENT_CONFIG_REPLAY"


def _resolve_payload(arg: str) -> Path:
    """Accept either an absolute path, a path relative to CWD, or a bare
    event name that resolves to `tests/fixtures/hooks/<name>.json`."""
    candidate = Path(arg)
    if candidate.is_file():
        return candidate
    bare = FIXTURE_DIR / f"{arg}.json"
    if bare.is_file():
        return bare
    raise FileNotFoundError(
        f"replay_hook: payload not found — tried '{candidate}' and '{bare}'")


def _build_argparser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--platform", required=True,
                   help="Platform key as declared in hook_manifest.yaml "
                        "(augment, claude, cursor, cline, windsurf, gemini, copilot).")
    p.add_argument("--event", required=True,
                   help="agent-config event (see EVENT_VOCABULARY in "
                        "scripts/hooks/dispatch_hook.py).")
    p.add_argument("--payload", required=True,
                   help="Path to a fixture JSON file, or a bare event name "
                        "resolved under tests/fixtures/hooks/.")
    p.add_argument("--native-event", default="",
                   help="Optional native event name for diagnostics.")
    p.add_argument("--manifest", default=str(DEFAULT_MANIFEST),
                   help=f"Hook manifest path (default: {DEFAULT_MANIFEST}).")
    p.add_argument("--json", action="store_true",
                   help="Emit a structured summary on stdout.")
    p.add_argument("--dry-run", action="store_true",
                   help="Resolve concerns and print the dispatch plan; "
                        "do not invoke concerns.")
    return p


def main(argv: list[str] | None = None) -> int:
    args = _build_argparser().parse_args(argv)

    try:
        payload_path = _resolve_payload(args.payload)
    except FileNotFoundError as exc:
        sys.stderr.write(f"❌  {exc}\n")
        return 2

    payload_text = payload_path.read_text(encoding="utf-8")
    # Validate JSON early so dispatcher stderr stays focused on real
    # concern problems. Empty / non-object payloads are still dispatched
    # — that mirrors the platform contract (stdin can be empty).
    try:
        decoded = json.loads(payload_text) if payload_text.strip() else {}
    except (ValueError, TypeError) as exc:
        sys.stderr.write(f"❌  replay_hook: invalid JSON in {payload_path}: {exc}\n")
        return 2

    env = dict(os.environ)
    env[REPLAY_ENV_VAR] = "1"

    cmd = [sys.executable, str(DISPATCHER),
           "--platform", args.platform,
           "--event", args.event,
           "--manifest", args.manifest]
    if args.native_event:
        cmd.extend(["--native-event", args.native_event])
    if args.dry_run:
        cmd.append("--dry-run")

    proc = subprocess.run(
        cmd, input=payload_text, capture_output=True, text=True, env=env,
        check=False,
    )

    if args.json:
        summary = {
            "platform": args.platform,
            "event": args.event,
            "native_event": args.native_event or "",
            "payload": str(payload_path.relative_to(REPO_ROOT)
                           if str(payload_path).startswith(str(REPO_ROOT))
                           else payload_path),
            "session_id": decoded.get("session_id") if isinstance(decoded, dict) else None,
            "exit_code": proc.returncode,
            "dispatcher_stdout": (proc.stdout or "").strip(),
            "dispatcher_stderr": (proc.stderr or "").strip(),
            "replay_mode": True,
        }
        print(json.dumps(summary, indent=2))
    else:
        if proc.stdout:
            sys.stdout.write(proc.stdout)
        if proc.stderr:
            sys.stderr.write(proc.stderr)
        sys.stderr.write(
            f"replay_hook: platform={args.platform} event={args.event} "
            f"payload={payload_path.name} rc={proc.returncode} "
            f"(AGENT_CONFIG_REPLAY=1, no writes)\n")
    return proc.returncode


if __name__ == "__main__":  # pragma: no cover
    sys.exit(main())
