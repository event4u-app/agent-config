"""``app_spec`` step — greenfield grounding gate (the ``memory`` slot).

greenfield-scaffold Phase 2 of
``agents/roadmaps/road-to-greenfield-scaffold.md``: before any
scaffolding, derive the app shape and confirm it fast (decision 3 —
disambiguation, not BDUF). The step occupies the UI set's ``memory``
slot, which runs **before** ``analyze`` (design); it replaces the
former no-op pass-through there.

The gate is **scoped to the greenfield-scaffold path only**. It acts
only when ``state.ui_audit`` records ``greenfield == True`` and
``greenfield_decision == "scaffold"``. Every other UI flow — improve
an existing screen, ``bare`` / ``external_reference`` greenfield, the
``diff`` / ``file`` envelopes — sees this slot as a clean ``SUCCESS``
no-op, exactly as the pass-through behaved, so those flows stay
byte-identical.

Routes on ``state.app_spec`` shape (greenfield-scaffold only):

- **Bypassed** — ``app_spec.bypassed`` truthy: the user chose "just
  scaffold". Round-trips through ``SUCCESS`` so scaffold runs without
  a confirmed spec (the engine's existing fence idiom).
- **Empty / None / non-dict / no ``pages``** — first pass. Emit an
  ``@agent-directive: app-spec`` halt; on the rebound the skill writes
  ``{pages, entity_model, flow_map}`` back into ``state.app_spec``.
  The halt also offers a "just scaffold" bypass and an abort.
- **Populated, not confirmed** — the lightweight confirm halt
  (``app_spec_unconfirmed``): the user confirms / edits the derived
  page-set + entity model in one numbered-options halt, or bypasses.
- **Populated, confirmed** — ``app_spec.confirmed is True`` round-trips
  through ``SUCCESS``; the dispatcher advances to ``analyze`` (design).

The deterministic checks live here (not in the skill) for the same
reason as :mod:`work_engine.directives.ui.audit`: the dispatcher is
synchronous Python and cannot delegate mid-loop. Making the gate
deterministic keeps "no scaffold without a confirmed-or-bypassed app
spec" enforceable from code, not norms.
"""
from __future__ import annotations

from typing import Any

from ...delivery_state import (
    DeliveryState,
    Outcome,
    StepResult,
    agent_directive,
)

AMBIGUITIES: tuple[dict[str, str], ...] = (
    {
        "code": "app_spec_missing",
        "trigger": "greenfield scaffold path and state.app_spec is None / "
        "empty / carries no `pages` — the app-spec skill has not derived "
        "the page-set yet",
        "resolution": "agent directive `app-spec` → skill derives "
        "{pages, entity_model, flow_map} and writes them into "
        "state.app_spec (or the user bypasses with 'just scaffold')",
    },
    {
        "code": "app_spec_unconfirmed",
        "trigger": "greenfield scaffold path and state.app_spec carries a "
        "derived page-set but `confirmed` is not True and `bypassed` is "
        "not set — the user has not signed off on the derived shape",
        "resolution": "user confirms the derived page-set + entity model "
        "(agent sets state.app_spec.confirmed = True), edits and re-runs, "
        "or bypasses ('just scaffold' → state.app_spec.bypassed = True)",
    },
)
"""Declared ambiguity surfaces for this step."""


def run(state: DeliveryState) -> StepResult:
    """Apply the greenfield app-spec grounding gate.

    No-op ``SUCCESS`` for every non-greenfield-scaffold flow; the
    confirm/bypass gate only engages when the audit recorded a
    ``scaffold`` greenfield decision.
    """
    if not _is_greenfield_scaffold(state):
        return StepResult(outcome=Outcome.SUCCESS)

    spec = state.app_spec

    # Explicit bypass — "just scaffold" / fenced step. Honoured before
    # any populated-check so the user can skip derivation entirely.
    if isinstance(spec, dict) and spec.get("bypassed"):
        return StepResult(outcome=Outcome.SUCCESS)

    if not _is_populated(spec):
        return _delegate_to_app_spec_skill(state)

    # Idempotent: a confirmed spec round-trips through SUCCESS without
    # re-emitting the halt the user already answered.
    if spec.get("confirmed") is True:
        return StepResult(outcome=Outcome.SUCCESS)

    return _halt_unconfirmed(state, spec)


def _is_greenfield_scaffold(state: DeliveryState) -> bool:
    """True when the audit recorded a ``scaffold`` greenfield decision.

    The gate is inert for every other flow: improve-existing, the
    ``bare`` / ``external_reference`` greenfield picks, and the
    ``diff`` / ``file`` envelopes all leave ``ui_audit`` without the
    ``greenfield == True`` + ``greenfield_decision == "scaffold"`` pair.
    """
    audit = getattr(state, "ui_audit", None)
    if not isinstance(audit, dict):
        return False
    return (
        audit.get("greenfield") is True
        and audit.get("greenfield_decision") == "scaffold"
    )


def _is_populated(spec: Any) -> bool:
    """True when ``spec`` carries a derived page-set.

    Non-dict and empty-dict shapes are treated as "skill has not run".
    The skill's first deliverable is the ``pages`` list, so its
    presence is the populated signal (mirrors
    :func:`work_engine.directives.ui.audit._is_populated`).
    """
    return isinstance(spec, dict) and isinstance(spec.get("pages"), list)


def _preview_input(state: DeliveryState) -> str:
    """Render a one-line preview of the input being grounded."""
    data = state.ticket or {}
    raw = data.get("raw")
    if isinstance(raw, str) and raw.strip():
        text = " ".join(raw.split())
    else:
        title = data.get("title")
        text = title if isinstance(title, str) else (data.get("id") or "(no title)")
    if len(text) <= 80:
        return text
    return text[:79].rstrip() + "…"


def _delegate_to_app_spec_skill(state: DeliveryState) -> StepResult:
    """First-pass halt — emit the ``app-spec`` derivation directive."""
    preview = _preview_input(state)
    return StepResult(
        outcome=Outcome.BLOCKED,
        questions=[
            agent_directive("app-spec"),
            f"> Input: {preview}",
            "> Greenfield scaffold — grounding the app shape before any "
            "skeleton is planned. Derive the page-set, entity model, and "
            "flow-map from the prompt.",
            "> 1. Continue — derive {pages, entity_model, flow_map} "
            "into `state.app_spec`",
            "> 2. Just scaffold — skip the app spec (set "
            "`state.app_spec.bypassed = true` and go straight to scaffold)",
            "> 3. Abort — drop this UI request",
            "",
            "**Recommendation: 1 — derive the spec** — a "
            "confirmed page-set keeps the multi-page scaffold coherent "
            "and is seconds of work. Caveat: flip to 2 if the prompt "
            "already pins an exact, single-screen shape.",
        ],
        message=(
            "Greenfield app-spec missing; delegating to `app-spec` "
            "skill to derive the page-set before scaffold."
        ),
    )


def _halt_unconfirmed(state: DeliveryState, spec: dict[str, Any]) -> StepResult:
    """BLOCKED halt — derived spec needs the lightweight confirm or bypass."""
    pages = [p for p in spec.get("pages", []) if isinstance(p, (str, dict))]
    entities = [e for e in spec.get("entity_model", []) if isinstance(e, (str, dict))]
    lines = [
        f"> Input: {_preview_input(state)}",
        "> Derived app spec — confirm the shape before scaffold:",
        f"> Pages ({len(pages)}): {_summarize(pages)}",
        f"> Entities ({len(entities)}): {_summarize(entities)}",
        "> 1. Confirm — the derived page-set + entity model look right "
        "(set `state.app_spec.confirmed = true`)",
        "> 2. Edit — adjust the derived spec, then re-run the app-spec "
        "skill",
        "> 3. Just scaffold — skip confirmation (set "
        "`state.app_spec.bypassed = true`)",
        "",
        "**Recommendation: 1 — Confirm** — the derived shape is "
        "the cheapest point to catch a wrong page-set, before the scaffold "
        "plan locks routes and layout. Caveat: flip to 2 if a page or "
        "entity is missing / wrong.",
    ]
    return StepResult(
        outcome=Outcome.BLOCKED,
        questions=lines,
        message=(
            "Greenfield app-spec derived; halting for lightweight confirm "
            "(confirm / edit / bypass)."
        ),
    )


def _summarize(items: list[Any]) -> str:
    """Render up to three item names as a compact inline preview."""
    names: list[str] = []
    for item in items[:3]:
        if isinstance(item, str):
            names.append(item)
        elif isinstance(item, dict):
            name = item.get("name") or item.get("title") or item.get("path")
            names.append(str(name) if name else "(unnamed)")
    if not names:
        return "(none)"
    suffix = ", …" if len(items) > 3 else ""
    return ", ".join(names) + suffix


__all__ = ["AMBIGUITIES", "run"]
