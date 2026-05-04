#!/usr/bin/env python3
"""Platform-agnostic hook for the `minimal-safe-diff` rule.

Pre-edit gate: counts unique files touched in the current turn (or
session, when the platform lacks a turn-boundary signal) and warns
when the count exceeds the configured threshold. The hook never
blocks — it is observability infra. The rule body cites the resulting
state file when the agent prepares a diff for review.

Wired to multiple events via the manifest:
  - session_start / user_prompt_submit → reset turn-scoped counters
  - pre_tool_use → record the planned edit's path before execution

Output: `agents/state/minimal-safe-diff.json`
  {
    "schema_version": 1,
    "session_id": "<str>",
    "turn_started_at": "<iso8601|null>",
    "files_touched_this_turn": ["a", "b", ...],
    "count": <int>,
    "threshold": <int>,
    "warning": <bool>,
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

STATE_FILE = Path("agents") / "state" / "minimal-safe-diff.json"
SETTINGS_FILE = ".agent-settings.yml"
DEFAULT_THRESHOLD = 5
MAX_TRACKED_PATHS = 200  # hard cap to keep the state file bounded

# Edit-tool names across platforms whose successful invocation results
# in a file being modified, created, or deleted. Keep explicit so an
# unknown tool doesn't trigger a false positive.
EDIT_TOOLS = frozenset({
    "str-replace-editor", "str_replace_editor",       # Augment
    "save-file", "save_file",                          # Augment
    "remove-files", "remove_files",                    # Augment
    "Edit", "Write", "MultiEdit",                      # Claude Code
    "edit_file", "edit-file",                          # Cursor
    "create_file", "create-file", "delete_file",       # variants
})


def _now() -> str:
    return _dt.datetime.now(_dt.timezone.utc).isoformat(timespec="seconds")


def _empty_state(threshold: int) -> dict:
    return {
        "schema_version": 1,
        "session_id": "",
        "turn_started_at": None,
        "files_touched_this_turn": [],
        "count": 0,
        "threshold": threshold,
        "warning": False,
        "checked_at": _now(),
    }


def _read_threshold(consumer_root: Path) -> int:
    """Parse `hooks.minimal_safe_diff.threshold` from .agent-settings.yml.

    Dependency-free YAML scan — we only need a single integer under a
    nested block; pulling pyyaml in for this would be overkill.
    """
    settings = consumer_root / SETTINGS_FILE
    if not settings.is_file():
        return DEFAULT_THRESHOLD
    try:
        text = settings.read_text(encoding="utf-8")
    except OSError:
        return DEFAULT_THRESHOLD

    in_hooks = False
    in_msd = False
    for raw in text.splitlines():
        line = raw.rstrip()
        if not line or line.lstrip().startswith("#"):
            continue
        # top-level key resets nested context
        if line and not line.startswith((" ", "\t")):
            in_hooks = re.match(r"^hooks\s*:\s*$", line) is not None
            in_msd = False
            continue
        if in_hooks:
            m = re.match(r"^\s+minimal_safe_diff\s*:\s*$", line)
            if m:
                in_msd = True
                continue
            # leaving the minimal_safe_diff block when indent decreases
            if in_msd and re.match(r"^\s{0,3}\S", line):
                in_msd = False
        if in_msd:
            m = re.match(r"^\s+threshold\s*:\s*(\d+)\s*(?:#.*)?$", line)
            if m:
                try:
                    val = int(m.group(1))
                    return val if val > 0 else DEFAULT_THRESHOLD
                except ValueError:
                    return DEFAULT_THRESHOLD
    return DEFAULT_THRESHOLD


def _load_state(target: Path, threshold: int) -> dict:
    if not target.is_file():
        return _empty_state(threshold)
    try:
        decoded = json.loads(target.read_text(encoding="utf-8"))
        if isinstance(decoded, dict):
            base = _empty_state(threshold)
            base.update(decoded)
            base["threshold"] = threshold  # always reflect current setting
            return base
    except (OSError, json.JSONDecodeError):
        pass
    return _empty_state(threshold)


def _candidate_paths(payload: dict) -> list[str]:
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
        for key in ("path", "file_path", "target_file", "filename"):
            v = ti.get(key)
            if isinstance(v, str) and v:
                out.append(v)
    return out



def _normalize(path: str) -> str:
    return path.lstrip("./").replace("\\", "/")


def _reset_turn(state: dict, session_id: str) -> dict:
    state["session_id"] = session_id or state.get("session_id") or ""
    state["turn_started_at"] = _now()
    state["files_touched_this_turn"] = []
    state["count"] = 0
    state["warning"] = False
    return state


def _update(state: dict, event: str, envelope: dict, threshold: int) -> dict:
    session_id = envelope.get("session_id") or state.get("session_id") or ""
    if session_id and session_id != state.get("session_id"):
        state = _reset_turn(state, session_id)

    payload = envelope.get("payload") or {}
    if not isinstance(payload, dict):
        payload = {}

    if event in ("session_start", "user_prompt_submit"):
        state = _reset_turn(state, session_id)
    elif event in ("pre_tool_use", "post_tool_use"):
        tool = (payload.get("tool_name") or payload.get("toolName")
                or payload.get("tool"))
        if isinstance(tool, str) and tool in EDIT_TOOLS:
            touched: list[str] = list(state.get("files_touched_this_turn") or [])
            seen = set(touched)
            for raw in _candidate_paths(payload):
                norm = _normalize(raw)
                if norm and norm not in seen:
                    seen.add(norm)
                    touched.append(norm)
            if len(touched) > MAX_TRACKED_PATHS:
                touched = touched[-MAX_TRACKED_PATHS:]
            state["files_touched_this_turn"] = touched
            state["count"] = len(touched)
            state["warning"] = state["count"] > threshold

    state["threshold"] = threshold
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
    threshold = _read_threshold(consumer_root)
    target = consumer_root / STATE_FILE
    state = _load_state(target, threshold)
    state = _update(state, event, envelope, threshold)

    try:
        atomic_write_json(target, state)
    except OSError:
        if verbose:
            print("minimal-safe-diff-hook: state write failed",
                  file=sys.stderr)
        return 0

    if verbose:
        print(
            f"minimal-safe-diff-hook: event={event} "
            f"count={state.get('count')} threshold={threshold} "
            f"warning={state.get('warning')}",
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