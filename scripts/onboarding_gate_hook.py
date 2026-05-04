#!/usr/bin/env python3
"""Platform-agnostic hook for the `onboarding-gate` rule.

Reads `.agent-settings.yml` from the consumer repo and writes a
deterministic state file the rule body can cite as the source of
truth for "do I need to prompt the user about /onboard?".

Output is written to `agents/state/onboarding-gate.json` with:
  {
    "required": <bool>,         // true → rule fires on first turn
    "reason":   "<string>",     // why this state was set
    "checked_at": "<iso8601>",  // last hook run
    "settings_present": <bool>  // .agent-settings.yml exists
  }

Exit code is **always 0**. Hooks must never block the agent loop.

Output discipline:
  - stdout: nothing (Augment surfaces stdout to the user)
  - stderr: one short line in --verbose mode, otherwise silent

CLI:
  python3 scripts/onboarding_gate_hook.py [--platform NAME] [--verbose]
"""
from __future__ import annotations

import argparse
import datetime as _dt
import json
import re
import sys
from pathlib import Path

SETTINGS_FILE = ".agent-settings.yml"
STATE_DIR = Path("agents") / "state"
STATE_FILE = STATE_DIR / "onboarding-gate.json"


def _read_onboarded(settings_path: Path) -> tuple[bool, str]:
    """Return (required, reason) — minimal, dependency-free YAML parsing.

    We only need a single key under the `onboarding:` block. Full YAML is
    overkill (and would pull in a runtime dep). We scan line-by-line for
    `onboarded: <bool>` inside the `onboarding:` section.
    """
    if not settings_path.is_file():
        return (False, "settings_file_missing")  # legacy: do not block

    try:
        text = settings_path.read_text(encoding="utf-8")
    except OSError:
        return (False, "settings_file_unreadable")

    in_onboarding = False
    onboarded_value: str | None = None
    for raw in text.splitlines():
        line = raw.rstrip()
        if not line or line.lstrip().startswith("#"):
            continue
        if re.match(r"^onboarding\s*:\s*$", line):
            in_onboarding = True
            continue
        if in_onboarding:
            # Section ends when a top-level (non-indented) key starts.
            if line and not line.startswith((" ", "\t")):
                break
            m = re.match(r"^\s+onboarded\s*:\s*(\S+)\s*(?:#.*)?$", line)
            if m:
                onboarded_value = m.group(1).strip().lower()

    if onboarded_value is None:
        return (False, "key_missing")  # legacy / pre-rule project
    if onboarded_value in ("true", "yes", "on"):
        return (False, "already_onboarded")
    if onboarded_value in ("false", "no", "off"):
        return (True, "explicit_false")
    return (False, f"unknown_value:{onboarded_value}")


def _write_state(consumer_root: Path, required: bool, reason: str,
                 settings_present: bool) -> None:
    """Write `agents/state/onboarding-gate.json` atomically."""
    state_dir = consumer_root / STATE_DIR
    state_dir.mkdir(parents=True, exist_ok=True)
    payload = {
        "required": required,
        "reason": reason,
        "checked_at": _dt.datetime.now(_dt.timezone.utc).isoformat(
            timespec="seconds"),
        "settings_present": settings_present,
    }
    target = consumer_root / STATE_FILE
    tmp = target.with_suffix(".json.tmp")
    tmp.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    tmp.replace(target)


def run(*, consumer_root: Path, verbose: bool = False) -> int:
    settings_path = consumer_root / SETTINGS_FILE
    settings_present = settings_path.is_file()
    try:
        required, reason = _read_onboarded(settings_path)
    except Exception:  # pragma: no cover — defensive
        required, reason = (False, "hook_error")

    try:
        _write_state(consumer_root, required, reason, settings_present)
    except OSError:
        if verbose:
            print("onboarding-gate-hook: state write failed",
                  file=sys.stderr)
        return 0  # never block

    if verbose:
        print(f"onboarding-gate-hook: required={required} reason={reason}",
              file=sys.stderr)
    return 0


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--platform", default="generic",
                        help="informational platform tag")
    parser.add_argument("--verbose", action="store_true",
                        help="emit one stderr line per invocation")
    args = parser.parse_args(argv)
    # Drain stdin so callers piping JSON don't block on a SIGPIPE on
    # platforms that strictly require stdin to be consumed.
    try:
        sys.stdin.read()
    except Exception:
        pass
    return run(consumer_root=Path.cwd(), verbose=args.verbose)


if __name__ == "__main__":  # pragma: no cover
    sys.exit(main())
