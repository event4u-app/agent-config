"""Append-only log of dispatch-time issues — Phase 1 of `road-to-hooks-actually-fire-in-consumers`.

When a concern's resolver returns `None` (script missing, regenerator
missing, `./agent-config` symlink unresolvable) the dispatcher (or the
concern hook itself, when invoked as a subprocess) records ONE line in
`agents/runtime/state/dispatch-issues.jsonl` so the failure is
discoverable post-hoc instead of vanishing into the never-block
contract.

**Schema** (locked by Council R3 pre-check, 2026-05-29):

    {
      "timestamp": "<ISO-8601 UTC>",
      "hook":      "<concern-id>",
      "issue":     "prerequisite_missing | script_not_found | "
                   "permission_denied | execution_failed",
      "detail":    "<freeform one-line explanation>",
      "resolution": "<one-line command or doc link>"
    }

**Cap:** 200 entries (council-revised from the original 50; debug
sessions with many tool calls would have lost evidence at the old
cap). Rotation drops the oldest line.

Errors writing the log are swallowed — observability never breaks
the agent loop.
"""
from __future__ import annotations

import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional


LOG_CAP = 200

VALID_ISSUE = frozenset({
    "prerequisite_missing",
    "script_not_found",
    "permission_denied",
    "execution_failed",
})


def _utc_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds").replace(
        "+00:00", "Z"
    )


def _log_path(workspace_root: Path) -> Path:
    return Path(workspace_root) / "agents" / "runtime" / "state" / "dispatch-issues.jsonl"


def log_dispatch_issue(
    workspace_root: Path,
    hook: str,
    issue: str,
    detail: str,
    resolution: str,
) -> None:
    """Append one dispatch-issue line. Best-effort; never raises.

    No-op when `AGENT_CONFIG_REPLAY=1` is set — fixture-driven replay
    must not mutate state (contract: `docs/contracts/hook-architecture-v1.md`
    § Replay mode).
    """
    if os.environ.get("AGENT_CONFIG_REPLAY") == "1":
        return

    if issue not in VALID_ISSUE:
        # Schema violation is a bug in the caller, not a runtime
        # failure — surface on stderr so it's noticed during dev, but
        # do not crash.
        sys.stderr.write(
            f"dispatch_issues: invalid issue {issue!r} (valid: "
            f"{sorted(VALID_ISSUE)})\n"
        )
        return

    log = _log_path(workspace_root)
    entry = {
        "timestamp": _utc_iso(),
        "hook": str(hook),
        "issue": issue,
        "detail": str(detail),
        "resolution": str(resolution),
    }

    try:
        log.parent.mkdir(parents=True, exist_ok=True)
        # Read existing lines (cheap — bounded log).
        existing: list[str] = []
        if log.exists():
            try:
                existing = log.read_text(encoding="utf-8").splitlines()
            except OSError:
                existing = []
        existing.append(json.dumps(entry, ensure_ascii=False))
        # Cap rotation: drop the oldest entries.
        if len(existing) > LOG_CAP:
            existing = existing[-LOG_CAP:]
        log.write_text("\n".join(existing) + "\n", encoding="utf-8")
    except OSError as exc:
        # Observability never blocks the agent.
        sys.stderr.write(
            f"dispatch_issues: failed to append to {log}: {exc}\n"
        )


def read_dispatch_issues(workspace_root: Path) -> list[dict]:
    """Return the log as a list of dicts. Empty list when missing."""
    log = _log_path(workspace_root)
    if not log.exists():
        return []
    out: list[dict] = []
    try:
        for line in log.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if not line:
                continue
            try:
                out.append(json.loads(line))
            except json.JSONDecodeError:
                continue
    except OSError:
        return []
    return out


def fix_hint(workspace_root: Optional[Path] = None) -> str:
    """Best-known fix hint string. Returned for use in `resolution` field."""
    return "./agent-config init"
