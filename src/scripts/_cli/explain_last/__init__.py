"""``agent-config explain last`` — execution-trace builder.

Phase 2 of the *Explainability v2* roadmap
(``agents/roadmaps/explainability-v2-explain-last.md``). Reads the
persisted :mod:`work_engine` state plus its sibling artefacts (council
sessions, memory hits, router snapshot) and projects them into the
versioned :data:`ExplainTrace` v1 contract documented at
``docs/contracts/explain-trace.schema.json``.

Read-only by construction:

* never writes back to disk;
* never opens a network socket (Phase 4 enforces via ``test_no_network``);
* never raises on missing data — every slot degrades to ``null`` and the
  Markdown renderer emits a ``(none)`` placeholder instead.

The public surface is :func:`build_trace`. Everything else is internal
plumbing. The CLI dispatcher lives in :mod:`scripts._cli.cmd_explain`
and is the only intended caller besides the test suite.
"""
from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from scripts._cli.explain_last import (
    assumptions as _assumptions,
    council as _council,
    halt as _halt,
    inputs as _inputs,
    memory as _memory,
    provider as _provider,
    route as _route,
)
from scripts._cli.explain_last.scrubber import scrub_string
from scripts._cli.explain_last.state_loader import StateLoadError, load_state

TRACE_VERSION = 1
SUBJECT_BY_KIND = {
    "ticket": "implement-ticket",
    "prompt": "work",
    "diff": "work",
    "file": "work",
}


def _derive_subject(state: dict[str, Any]) -> str:
    """Map ``state.input.kind`` + ``state.directive_set`` to a trace subject.

    The schema enum is ``work | implement-ticket | council | video |
    unknown``. ``council`` and ``video`` are reserved for Phase 3 and
    forward; today they only fire when the engine explicitly stamps the
    directive set, never from a kind alone.
    """
    directive_set = state.get("directive_set") or ""
    if directive_set == "video":
        return "video"
    if directive_set == "council":
        return "council"
    kind = (state.get("input") or {}).get("kind")
    return SUBJECT_BY_KIND.get(kind or "", "unknown")


def _derive_run_id(state: dict[str, Any], state_file: Path) -> str:
    """Pull ``state.input.data.id`` with mtime fallback.

    Schema requires a non-empty string; the file mtime serialised as
    ISO-8601 UTC is the documented fallback. Both branches return scrub
    pre-processed values so a ticket id containing PII never leaks.
    """
    data = (state.get("input") or {}).get("data") or {}
    raw_id = data.get("id")
    if isinstance(raw_id, str) and raw_id.strip():
        return scrub_string(raw_id.strip())
    try:
        mtime = state_file.stat().st_mtime
    except OSError:
        mtime = 0.0
    return datetime.fromtimestamp(mtime, tz=timezone.utc).isoformat()


def build_trace(
    project_root: Path,
    state_file: Path,
    *,
    now: datetime | None = None,
) -> dict[str, Any]:
    """Aggregate every why-slot for the most recent ``/work`` run.

    Returns a JSON-serialisable dict that conforms to
    ``explain-trace.schema.json``. ``now`` is only injected by the test
    harness; the production caller passes ``None`` and gets the wall
    clock. All free-form strings pass through :func:`scrub_string`
    before being placed in the output (FATAL council fix — see roadmap
    § "External AI-Council pass").
    """
    state = load_state(state_file)
    generated_at = (now or datetime.now(tz=timezone.utc)).isoformat()
    return {
        "version": TRACE_VERSION,
        "generated_at": generated_at,
        "run_id": _derive_run_id(state, state_file),
        "subject": _derive_subject(state),
        "inputs": _inputs.build(project_root),
        "route": _route.build(project_root, state),
        "council": _council.build(project_root, state_file),
        "memory": _memory.build(project_root, state),
        "pack": _inputs.build_pack(project_root),
        "assumptions": _assumptions.build(state),
        "halt": _halt.build(state),
        "provider": _provider.build(state),
    }


__all__ = [
    "TRACE_VERSION",
    "StateLoadError",
    "build_trace",
    "load_state",
    "scrub_string",
]
