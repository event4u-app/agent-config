#!/usr/bin/env python3
"""Platform-agnostic PostToolUse hook for the `context-hygiene` rule.

Maintains a deterministic state file the rule body cites for the
freshness threshold, the 3-failure stop, and tool-loop detection. The
agent's job shrinks from "remember three counters" to "read this file
before responding".

Output: `agents/state/context-hygiene.json`
  {
    "tool_calls": <int>,                 // running PostToolUse count
    "consecutive_same_tool": <int>,      // includes the latest call
    "last_tool": "<name>",
    "tool_history": [..., last 5 names],
    "loop_detected": <bool>,             // ≥ 3 same tool in a row
    "freshness_threshold": <int|null>,   // 20/40/60 milestone hit
    "checked_at": "<iso8601>"
  }

Exit code is always 0.

CLI:
  python3 scripts/context_hygiene_hook.py [--platform NAME] [--verbose]
"""
from __future__ import annotations

import argparse
import datetime as _dt
import json
import sys
from pathlib import Path

STATE_DIR = Path("agents") / "state"
STATE_FILE = STATE_DIR / "context-hygiene.json"

LOOP_THRESHOLD = 3                  # 3+ consecutive same-tool calls
HISTORY_DEPTH = 5
FRESHNESS_MILESTONES = (20, 40, 60)


def _load_state(target: Path) -> dict:
    if not target.is_file():
        return {
            "tool_calls": 0,
            "consecutive_same_tool": 0,
            "last_tool": None,
            "tool_history": [],
            "loop_detected": False,
            "freshness_threshold": None,
        }
    try:
        decoded = json.loads(target.read_text(encoding="utf-8"))
        if isinstance(decoded, dict):
            return decoded
    except (OSError, json.JSONDecodeError):
        pass
    # Corrupt — start fresh, never block.
    return {
        "tool_calls": 0,
        "consecutive_same_tool": 0,
        "last_tool": None,
        "tool_history": [],
        "loop_detected": False,
        "freshness_threshold": None,
    }


def _extract_tool(payload: dict) -> str | None:
    for key in ("tool_name", "toolName", "tool"):
        v = payload.get(key)
        if isinstance(v, str) and v:
            return v
    return None


def _milestone_hit(prev: int, curr: int) -> int | None:
    """Return the milestone crossed by going from `prev` to `curr`, else None."""
    for ms in FRESHNESS_MILESTONES:
        if prev < ms <= curr:
            return ms
    return None


def _update(state: dict, tool: str | None) -> dict:
    if tool is None:
        # Non-tool event (e.g. malformed payload) — still mark we ran.
        state["checked_at"] = _dt.datetime.now(_dt.timezone.utc).isoformat(
            timespec="seconds")
        return state

    prev_count = int(state.get("tool_calls") or 0)
    curr_count = prev_count + 1
    state["tool_calls"] = curr_count

    last = state.get("last_tool")
    if last == tool:
        state["consecutive_same_tool"] = int(
            state.get("consecutive_same_tool") or 0) + 1
    else:
        state["consecutive_same_tool"] = 1
    state["last_tool"] = tool

    hist = state.get("tool_history") or []
    if not isinstance(hist, list):
        hist = []
    hist.append(tool)
    state["tool_history"] = hist[-HISTORY_DEPTH:]

    state["loop_detected"] = (
        state["consecutive_same_tool"] >= LOOP_THRESHOLD)

    ms = _milestone_hit(prev_count, curr_count)
    if ms is not None:
        state["freshness_threshold"] = ms
    state["checked_at"] = _dt.datetime.now(_dt.timezone.utc).isoformat(
        timespec="seconds")
    return state


def _write_state(consumer_root: Path, state: dict) -> None:
    state_dir = consumer_root / STATE_DIR
    state_dir.mkdir(parents=True, exist_ok=True)
    target = consumer_root / STATE_FILE
    tmp = target.with_suffix(".json.tmp")
    tmp.write_text(json.dumps(state, indent=2) + "\n", encoding="utf-8")
    tmp.replace(target)


def run(stdin_text: str, *, consumer_root: Path, verbose: bool = False) -> int:
    payload: dict = {}
    if stdin_text.strip():
        try:
            decoded = json.loads(stdin_text)
            if isinstance(decoded, dict):
                payload = decoded
        except json.JSONDecodeError:
            pass  # silent no-op, never block

    target = consumer_root / STATE_FILE
    state = _load_state(target)
    state = _update(state, _extract_tool(payload))

    try:
        _write_state(consumer_root, state)
    except OSError:
        if verbose:
            print("context-hygiene-hook: state write failed",
                  file=sys.stderr)
        return 0

    if verbose:
        print(
            f"context-hygiene-hook: tool_calls={state.get('tool_calls')} "
            f"loop={state.get('loop_detected')} "
            f"threshold={state.get('freshness_threshold')}",
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
