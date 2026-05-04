"""Concern envelope helpers — read the dispatcher's stdin contract.

Per `docs/contracts/hook-architecture-v1.md`, the universal dispatcher
writes a JSON object to each concern's stdin with shape:

    {
      "schema_version": 1,
      "platform": "augment",
      "event": "stop",
      "native_event": "Stop",
      "session_id": "…",
      "workspace_root": "/abs/path",
      "payload": { /* opaque, platform-native */ },
      "settings": { /* materialized .agent-settings.yml subset */ }
    }

Concern scripts must accept BOTH the new envelope shape AND the legacy
"raw platform payload directly on stdin" shape — the latter is what every
existing trampoline produced before Phase 7.3, and direct invocations
(e.g. `./agent-config chat-history:hook --platform claude < event.json`)
are still supported during the migration window.

`unwrap()` returns the (envelope, payload, platform) triple. When
called with raw platform JSON it synthesises a minimal envelope so
callers never need to branch.
"""
from __future__ import annotations

import json
from typing import Any

ENVELOPE_KEYS = ("schema_version", "platform", "event", "payload")


def looks_like_envelope(obj: Any) -> bool:
    """Heuristic — `obj` is a dispatcher envelope if it is a dict that
    carries every required envelope key. The `payload` value itself is
    the concern's platform-native data, so a payload that happens to
    contain `schema_version` does NOT trigger this branch (the four
    keys must all be at the top level).
    """
    if not isinstance(obj, dict):
        return False
    return all(key in obj for key in ENVELOPE_KEYS)


def unwrap(stdin_text: str, default_platform: str = "generic") -> tuple[dict, dict, str]:
    """Parse stdin and return (envelope, payload, platform).

    - Empty / non-JSON stdin → ({}, {}, default_platform).
    - Raw platform JSON → synth envelope with schema_version=1,
      platform=default_platform, event="", payload=<raw>.
    - Already-an-envelope → return as-is, payload extracted.

    Never raises — concerns must remain crash-safe in the agent loop.
    """
    text = (stdin_text or "").strip()
    if not text:
        return ({}, {}, default_platform)
    try:
        decoded = json.loads(text)
    except (ValueError, TypeError):
        return ({}, {}, default_platform)

    if looks_like_envelope(decoded):
        payload = decoded.get("payload") or {}
        if not isinstance(payload, dict):
            payload = {}
        platform = str(decoded.get("platform") or default_platform)
        return (decoded, payload, platform)

    # Legacy direct-invocation path. Whatever shape the platform sent
    # is treated as the payload itself; callers fall back to their
    # pre-7.3 extraction logic.
    payload = decoded if isinstance(decoded, dict) else {}
    return (
        {
            "schema_version": 1,
            "platform": default_platform,
            "event": "",
            "native_event": "",
            "session_id": "",
            "workspace_root": "",
            "payload": payload,
            "settings": {},
        },
        payload,
        default_platform,
    )


def envelope_field(envelope: dict, key: str, default: Any = "") -> Any:
    """Safe accessor — concerns should treat unknown / missing keys as
    forward-compat extensions and never raise."""
    if not isinstance(envelope, dict):
        return default
    value = envelope.get(key)
    return default if value is None else value
