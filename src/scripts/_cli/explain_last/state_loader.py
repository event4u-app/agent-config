"""Read and validate the persisted ``.work-state.json`` envelope.

The work-engine writes a versioned schema documented at
:mod:`work_engine.state` (template) and mirrored to consumer projects.
Phase 2 of the explain roadmap only ever reads the file. Schema-bumps
are caught by :func:`load_state` and surface a discoverable error
rather than rendering nonsense (backend-architect council fix —
roadmap § "External AI-Council pass / backend-architect").
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any

EXPECTED_VERSION = 1


class StateLoadError(Exception):
    """Raised when the state file is missing, unreadable, or version-skewed."""

    def __init__(self, message: str, *, exit_code: int = 2) -> None:
        super().__init__(message)
        self.exit_code = exit_code


def load_state(state_file: Path) -> dict[str, Any]:
    """Return the parsed state dict or raise :class:`StateLoadError`.

    Validation is intentionally permissive — unknown keys pass through
    because the schema is additive. Only three failure modes raise:

    1. File does not exist.
    2. File is not valid JSON.
    3. ``version`` field is present and not equal to ``EXPECTED_VERSION``.

    A missing ``version`` field is treated as legacy (v0) and raises
    the same skew message; the CLI converts the raise into the
    user-facing "trace format upgraded; rerun the upstream command on
    this branch to regenerate" hint required by the council fix.
    """
    if not state_file.exists():
        raise StateLoadError(
            f"state file not found: {state_file}",
            exit_code=1,
        )
    try:
        text = state_file.read_text(encoding="utf-8")
    except OSError as exc:
        raise StateLoadError(
            f"cannot read state file {state_file}: {exc}",
        ) from exc
    try:
        payload = json.loads(text)
    except json.JSONDecodeError as exc:
        raise StateLoadError(
            f"state file {state_file} is not valid JSON: {exc}",
        ) from exc
    if not isinstance(payload, dict):
        raise StateLoadError(
            f"state file {state_file} must contain a JSON object",
        )
    version = payload.get("version")
    if version != EXPECTED_VERSION:
        raise StateLoadError(
            (
                "trace format upgraded; rerun the upstream command on "
                "this branch to regenerate "
                f"(found version={version!r}, expected {EXPECTED_VERSION})"
            ),
            exit_code=0,  # informational, not a failure (council fix).
        )
    return payload


__all__ = ["EXPECTED_VERSION", "StateLoadError", "load_state"]
