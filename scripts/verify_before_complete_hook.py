#!/usr/bin/env python3
"""Platform-agnostic hook for the `verify-before-complete` rule.

Records observable evidence that a verification command (tests, quality
tools, build) ran. The rule body cites the resulting state file as the
source of truth for the "have I verified this turn?" question. The hook
itself never blocks — it is observability infra, not control flow.

Wired to multiple events via the manifest:
  - session_start / user_prompt_submit → reset turn-scoped counters
  - post_tool_use → inspect tool + command, record verifications
  - stop                                → record stop fired (claim-done window)

Output: `agents/state/verify-before-complete.json`
  {
    "schema_version": 1,
    "session_id": "<str>",
    "turn_started_at": "<iso8601|null>",
    "last_verification": {"command": ..., "tool": ..., "at": ...} | null,
    "verifications_this_turn": <int>,
    "verifications_this_session": <int>,
    "last_stop_at": "<iso8601|null>",
    "verified_this_turn": <bool>,
    "checked_at": "<iso8601>"
  }

Exit code is always 0.
"""
from __future__ import annotations

import argparse
import datetime as _dt
import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from hooks.state_io import atomic_write_json  # noqa: E402

STATE_FILE = Path("agents") / "state" / "verify-before-complete.json"

# Tool names across platforms whose `command` / `tool_input.command` field
# carries a shell command we can inspect. Edit tools are deliberately
# excluded — they cannot run verification.
COMMAND_TOOLS = frozenset({
    "launch-process", "launch_process",     # Augment
    "Bash", "BashTool",                     # Claude Code
    "run-process", "runProcess",            # variants
    "shell", "execute_shell",               # generic / Cline
    "RunShellCommand",                      # Cursor
})

# Permissive verification-command pattern. Observability — false positives
# are cheaper than false negatives. Word-boundary anchored on common
# shell separators so chained commands (`task sync && task ci`) match.
_VERIFICATION_RE = re.compile(
    r'(?:^|[\s;&|`(])('
    r'task\s+(?:ci|test|tests|lint|check|qa|phpstan|rector|ecs|pest|pytest)'
    r'|(?:\./|\.venv/bin/|vendor/bin/)?(?:pest|phpunit|phpstan|psalm|rector|ecs)\b'
    r'|(?:python3?|\.venv/bin/python3?)\s+-m\s+pytest'
    r'|pytest\b'
    r'|(?:npm|pnpm|yarn|bun)\s+(?:run\s+)?(?:test|check|lint|typecheck|tsc)'
    r'|cargo\s+(?:test|check|clippy)'
    r'|go\s+test'
    r'|make\s+(?:test|check|lint)'
    r'|composer\s+(?:test|check|lint|phpstan)'
    r'|(?:php\s+)?artisan\s+test'
    r')',
    re.IGNORECASE,
)


def _now() -> str:
    return _dt.datetime.now(_dt.timezone.utc).isoformat(timespec="seconds")


def _empty_state() -> dict:
    return {
        "schema_version": 1,
        "session_id": "",
        "turn_started_at": None,
        "last_verification": None,
        "verifications_this_turn": 0,
        "verifications_this_session": 0,
        "last_stop_at": None,
        "verified_this_turn": False,
        "checked_at": _now(),
    }


def _load_state(target: Path) -> dict:
    if not target.is_file():
        return _empty_state()
    try:
        decoded = json.loads(target.read_text(encoding="utf-8"))
        if isinstance(decoded, dict):
            return {**_empty_state(), **decoded}
    except (OSError, json.JSONDecodeError):
        pass
    return _empty_state()


def _extract_command(payload: dict) -> tuple[str | None, str | None]:
    """Return (tool_name, command_text) from a tool-event payload."""
    tool = (payload.get("tool_name") or payload.get("toolName")
            or payload.get("tool"))
    if not isinstance(tool, str) or tool not in COMMAND_TOOLS:
        return (tool if isinstance(tool, str) else None, None)
    ti = payload.get("tool_input")
    if isinstance(ti, dict):
        for key in ("command", "cmd", "shell_command"):
            v = ti.get(key)
            if isinstance(v, str) and v:
                return (tool, v)
    # Some platforms surface the command at the top level.
    for key in ("command", "cmd"):
        v = payload.get(key)
        if isinstance(v, str) and v:
            return (tool, v)
    return (tool, None)


def _is_verification(command: str) -> bool:
    return bool(_VERIFICATION_RE.search(command))


def _reset_turn(state: dict, session_id: str) -> dict:
    state["session_id"] = session_id or state.get("session_id") or ""
    state["turn_started_at"] = _now()
    state["verifications_this_turn"] = 0
    state["verified_this_turn"] = False
    return state


def _update(state: dict, event: str, envelope: dict) -> dict:
    session_id = envelope.get("session_id") or state.get("session_id") or ""
    if session_id and session_id != state.get("session_id"):
        # Session boundary — reset session-scoped counters.
        state["session_id"] = session_id
        state["verifications_this_session"] = 0
        state = _reset_turn(state, session_id)

    payload = envelope.get("payload") or {}
    if not isinstance(payload, dict):
        payload = {}

    if event in ("session_start", "user_prompt_submit"):
        state = _reset_turn(state, session_id)
    elif event == "post_tool_use":
        tool, cmd = _extract_command(payload)
        if cmd and _is_verification(cmd):
            state["last_verification"] = {
                "command": cmd[:512],
                "tool": tool,
                "at": _now(),
                "platform": envelope.get("platform") or "",
            }
            state["verifications_this_turn"] = int(
                state.get("verifications_this_turn") or 0) + 1
            state["verifications_this_session"] = int(
                state.get("verifications_this_session") or 0) + 1
            state["verified_this_turn"] = True
    elif event == "stop":
        state["last_stop_at"] = _now()

    state["checked_at"] = _now()
    return state


def run(stdin_text: str, *, consumer_root: Path, verbose: bool = False) -> int:
    envelope: dict = {}
    if stdin_text.strip():
        try:
            decoded = json.loads(stdin_text)
            if isinstance(decoded, dict):
                envelope = decoded
        except json.JSONDecodeError:
            envelope = {}

    event = envelope.get("event") or ""
    target = consumer_root / STATE_FILE
    state = _load_state(target)
    state = _update(state, event, envelope)

    try:
        atomic_write_json(target, state)
    except OSError:
        if verbose:
            print("verify-before-complete-hook: state write failed",
                  file=sys.stderr)
        return 0

    if verbose:
        print(
            f"verify-before-complete-hook: event={event} "
            f"verified_this_turn={state.get('verified_this_turn')} "
            f"verifications_this_turn={state.get('verifications_this_turn')}",
            file=sys.stderr,
        )
    return 0


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--platform", default="generic",
                        help="informational platform tag")
    parser.add_argument("--verbose", action="store_true",
                        help="emit one stderr line per invocation")
    args = parser.parse_args(argv)
    return run(sys.stdin.read(), consumer_root=Path.cwd(),
               verbose=args.verbose)


if __name__ == "__main__":  # pragma: no cover
    sys.exit(main())
