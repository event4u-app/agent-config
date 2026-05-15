"""Persistent council events log (step-8 phase 3).

Single-function module that appends one JSON line per council event to
``<project_root>/agents/council-events.log``. Schema v1 carries the
minimum needed to answer the "why did the council skip / block this?"
question at retro time without leaking prompt content.

Privacy floor:
    ``original_ask`` is never written verbatim — the caller passes the
    raw string, and :func:`append_event` writes ``sha256(value)[:12]``
    as ``original_ask_hash``. Mirrors the privacy floor in
    ``agents/low-impact-decisions.md``.

Kill-switch:
    ``AGENT_CONFIG_NO_EVENTS_LOG=1`` short-circuits :func:`append_event`
    to a no-op. Mirrors Step 7's ``AGENT_CONFIG_LEGACY_ANCHOR=1``
    pattern. Tested via env-var override; the agent never reads or
    parses the log itself.

See: ``agents/roadmaps/step-8-quota-necessity-transparency.md`` (D3,
D5) and ``docs/contracts/ai-council-config.md``.
"""

from __future__ import annotations

import hashlib
import json
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Literal

SCHEMA_VERSION = 1

EventAction = Literal["proceed", "skip_necessity", "block_quota"]

_VALID_ACTIONS: frozenset[str] = frozenset(
    {"proceed", "skip_necessity", "block_quota"},
)

#: Environment-variable kill-switch. Truthy values disable all writes;
#: the function silently returns. Designed for CI / sandboxed runs and
#: privacy-conscious power users.
_KILL_SWITCH_ENV = "AGENT_CONFIG_NO_EVENTS_LOG"

#: Default log path, resolved relative to the package root (two levels
#: above ``scripts/ai_council/``). Callers can override via
#: ``log_path=`` for tests.
_DEFAULT_LOG_PATH = (
    Path(__file__).resolve().parents[2] / "agents" / "council-events.log"
)


def _hash_original_ask(original_ask: str) -> str:
    """Return sha256(original_ask)[:12] — the privacy-floor hash.

    Empty / missing input maps to a stable sentinel so the schema field
    is always populated.
    """
    if not original_ask:
        return "0" * 12
    return hashlib.sha256(
        original_ask.encode("utf-8", errors="replace"),
    ).hexdigest()[:12]


def _kill_switch_active() -> bool:
    value = os.environ.get(_KILL_SWITCH_ENV, "")
    return value not in ("", "0", "false", "False")


def append_event(
    event: dict[str, Any], *, log_path: Path | None = None,
) -> bool:
    """Append a single JSON event line to the council events log.

    Args:
        event: Mapping with the v1 schema fields. Required keys:
            ``lens``, ``invocation``, ``action``, ``verdict``,
            ``provider_caps``, ``original_ask``. The function injects
            ``schema_version``, ``ts_utc``, and replaces
            ``original_ask`` with ``original_ask_hash``. Unknown keys
            pass through verbatim — callers should not abuse this for
            free-form payloads (privacy floor).
        log_path: Override for tests. Defaults to
            ``<project_root>/agents/council-events.log``.

    Returns:
        ``True`` when a line was written; ``False`` when the kill-switch
        suppressed the write. Never raises on missing parent dir — the
        function creates it on demand.

    Raises:
        ValueError: ``action`` not in :data:`_VALID_ACTIONS`.
    """
    if _kill_switch_active():
        return False

    action = event.get("action")
    if action not in _VALID_ACTIONS:
        raise ValueError(
            f"events_log: action={action!r} not in "
            f"{sorted(_VALID_ACTIONS)}.",
        )

    raw_ask = event.pop("original_ask", "") if "original_ask" in event else ""
    record = {
        "schema_version": SCHEMA_VERSION,
        "ts_utc": datetime.now(timezone.utc).isoformat(
            timespec="seconds",
        ).replace("+00:00", "Z"),
        "lens": event.get("lens", ""),
        "invocation": event.get("invocation", ""),
        "action": action,
        "verdict": event.get("verdict", ""),
        "provider_caps": event.get("provider_caps", {}),
        "original_ask_hash": _hash_original_ask(raw_ask),
    }
    # Pass-through for any caller-supplied diagnostic fields that are
    # not in the schema-v1 reserved set (e.g. `category`, `rationale`).
    # The schema-v1 fields above always win on collision.
    reserved = set(record) | {"original_ask"}
    for k, v in event.items():
        if k not in reserved:
            record[k] = v

    target = Path(log_path) if log_path is not None else _DEFAULT_LOG_PATH
    target.parent.mkdir(parents=True, exist_ok=True)
    line = json.dumps(record, ensure_ascii=False, separators=(",", ":"))
    with target.open("a", encoding="utf-8") as fh:
        fh.write(line + "\n")
    return True


def default_log_path() -> Path:
    """Return the canonical events-log path (callers / tests)."""
    return _DEFAULT_LOG_PATH
