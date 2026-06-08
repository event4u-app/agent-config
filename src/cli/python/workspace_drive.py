#!/usr/bin/env python3
"""Tier-1 host drive loop — ADR-070 (v0: single-turn, claude-code only).

A Tier-1 host (Claude Code / Codex / Gemini — ADR-023, host-agent-protocol) is
CLI-drivable: spawn `claude -p "<prompt>" --output-format json`, parse the JSON
envelope, and record the turn. This module is the executor `detectHostTier`
(ADR-068) reported as `tier1-drive-pending`. The rendered prompt comes from
`workspace_render.py` (ADR-069); the caller appends the returned turn to the
session store via `workspace_sessions.py append --kind host.turn`.

Design (AI-council 2026-06-08, claude-sonnet-4-5 + gpt-4o, design mode):

- **Single-turn v0.** One prompt → one host call → one turn record. Tool calls
  in the envelope are **recorded as opaque JSON, never executed** — agentic
  multi-turn (feeding results back) is v1.
- **Explicit envelope contract per host.** Each host config names its
  `required` / `optional` keys; a missing required key (or `is_error: true`)
  **fails closed** — the caller degrades to the Tier-3 inbox hand-off rather
  than fabricating a turn.
- **Unified adapter.** One `drive(host, prompt, …)` with a per-host config
  (arg builder + envelope normaliser), mirroring the proven `ai-council`
  subprocess shape. v0 ships the `claude-code` config; `codex` / `gemini`
  slot in without touching the control flow.
- **Sync, bounded.** Default 90 s timeout. CLI-missing / non-zero-exit /
  timeout / unrecognised-envelope all return an `ok=False` error turn (with an
  `error_kind`) so the caller records `host.error` and degrades — the user is
  never stuck.
- **`runner` injectable** so tests never spawn a real host CLI.

Deferred to v1 (debt, recorded in ADR-070): multi-turn agentic loops, tool-call
execution, `codex` / `gemini` configs, drive success/timeout **metrics** +
kill-switch observability, error-taxonomy refinement.

CLI::

    workspace_drive.py drive --host <id> --prompt-file <f|-> [--cwd <d>] \
        [--timeout <s>] [--json]
"""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
from pathlib import Path

DEFAULT_TIMEOUT = 90  # seconds (AI-council 2026-06-08: realistic for LLM+tools)


class EnvelopeError(ValueError):
    """The host CLI returned output that does not match its declared contract."""


# --- per-host envelope normalisers -----------------------------------------

def _normalise_claude(env: dict) -> dict:
    """Map a `claude -p --output-format json` envelope → uniform turn.

    Required: ``result`` (the assistant text). A truthy ``is_error`` fails
    closed. Everything else is optional and copied through when present.
    """
    if not isinstance(env, dict):
        raise EnvelopeError("envelope is not a JSON object")
    if env.get("is_error") is True:
        raise EnvelopeError(f"host reported is_error: {env.get('result', '')[:200]}")
    if not isinstance(env.get("result"), str):
        raise EnvelopeError("missing required key: result")
    usage = env.get("usage") if isinstance(env.get("usage"), dict) else None
    return {
        "text": env["result"],
        "model": env.get("model"),
        "usage": usage,
        "session_id": env.get("session_id"),
        "cost_usd": env.get("total_cost_usd"),
        "num_turns": env.get("num_turns"),
        # v0 records tool calls opaquely; the simple json mode rarely carries
        # them, but pass through whatever is present (never executed).
        "tool_calls": env.get("tool_calls") if isinstance(env.get("tool_calls"), list) else [],
    }


HOST_CONFIGS: dict[str, dict] = {
    # v0 ships claude-code only. codex / gemini land in a later PR with their
    # own build_args + normaliser — the unified drive() never changes.
    "claude-code": {
        "build_args": lambda prompt, cwd: ["claude", "-p", prompt, "--output-format", "json"],
        "normalise": _normalise_claude,
    },
}


def _subprocess_runner(args: list[str], cwd: str | None, timeout: int) -> tuple[int, str, str]:
    """Default runner: spawn the host CLI. Injectable so tests stay hermetic."""
    proc = subprocess.run(
        args, cwd=cwd, capture_output=True, text=True, timeout=timeout, check=False,
    )
    return proc.returncode, proc.stdout, proc.stderr


def _error_turn(host: str, message: str, kind: str) -> dict:
    return {"ok": False, "host": host, "error": message, "error_kind": kind}


def drive(
    host: str,
    prompt: str,
    *,
    cwd: str | None = None,
    timeout: int = DEFAULT_TIMEOUT,
    runner=None,
) -> dict:
    """Drive one Tier-1 host turn → a uniform turn record.

    Returns ``{ok: True, host, text, model, usage, session_id, cost_usd,
    num_turns, tool_calls}`` on success, or ``{ok: False, host, error,
    error_kind}`` on any failure (caller records ``host.error`` + degrades to
    the Tier-3 inbox). Never raises for an operational failure.
    """
    cfg = HOST_CONFIGS.get(host)
    if cfg is None:
        return _error_turn(host, f"host is not a drivable Tier-1 host in v0: {host}", "unsupported-host")
    if not isinstance(prompt, str) or prompt.strip() == "":
        return _error_turn(host, "prompt is empty", "empty-prompt")

    args = cfg["build_args"](prompt, cwd)
    run = runner or _subprocess_runner
    try:
        rc, stdout, stderr = run(args, cwd, timeout)
    except subprocess.TimeoutExpired:
        return _error_turn(host, f"host CLI timed out after {timeout}s", "timeout")
    except FileNotFoundError:
        return _error_turn(host, f"host CLI not found: {args[0]}", "cli-missing")
    except OSError as err:
        return _error_turn(host, f"host CLI spawn failed: {err}", "spawn-failed")

    if rc != 0:
        return _error_turn(host, f"host CLI exited {rc}: {(stderr or '').strip()[:200]}", "nonzero-exit")

    try:
        env = json.loads(stdout)
        turn = cfg["normalise"](env)
    except (json.JSONDecodeError, EnvelopeError) as err:
        return _error_turn(host, f"unrecognised envelope: {err}", "bad-envelope")

    turn["ok"] = True
    turn["host"] = host
    return turn


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(prog="workspace_drive")
    sub = p.add_subparsers(dest="cmd", required=True)
    d = sub.add_parser("drive")
    d.add_argument("--host", required=True)
    d.add_argument("--prompt-file", required=True, help="path to the rendered prompt, or '-' for stdin")
    d.add_argument("--cwd")
    d.add_argument("--timeout", type=int, default=DEFAULT_TIMEOUT)
    d.add_argument("--json", action="store_true", help="emit the turn record as JSON")
    args = p.parse_args(argv)

    if args.cmd == "drive":
        prompt = sys.stdin.read() if args.prompt_file == "-" else Path(args.prompt_file).read_text(encoding="utf-8")
        turn = drive(args.host, prompt, cwd=args.cwd, timeout=args.timeout)
        if args.json:
            print(json.dumps(turn, sort_keys=True))
        elif turn["ok"]:
            sys.stdout.write(turn["text"])
        else:
            print(f"{turn['error_kind']}: {turn['error']}", file=sys.stderr)
        # Exit 1 on a failed drive so the Node caller degrades to the inbox.
        return 0 if turn["ok"] else 1
    return 2


if __name__ == "__main__":
    sys.exit(main())
