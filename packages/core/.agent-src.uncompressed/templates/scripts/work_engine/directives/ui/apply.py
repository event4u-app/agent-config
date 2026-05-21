"""``apply`` step — stack-dispatched UI implementation.

Phase 3 Step 2 of ``agents/roadmaps/road-to-product-ui-track.md``: the
apply step turns the locked design brief into actual files. Routes on
``state.stack.frontend`` to the appropriate implementation skill bundle:

- ``blade-livewire-flux`` → ``ui-apply-blade-livewire-flux`` (composes
  ``flux`` + ``livewire`` + ``blade-ui``)
- ``react-shadcn`` → ``ui-apply-react-shadcn`` (new skill, Phase 3 Step 3)
- ``vue`` → ``ui-apply-vue``
- ``plain`` → ``ui-apply-plain`` (``blade-ui`` + Tailwind base)

Routes on ``state.ticket["ui_apply"]`` shape:

- **Empty / None** — first pass. Emit the stack-specific
  ``@agent-directive:`` halt; on the rebound the agent writes the
  apply envelope back.
- **Populated, rendered text contains placeholder patterns** — emit a
  rejection halt. The design-brief lock failed; placeholder strings
  (``<placeholder>``, ``Lorem``, ``TODO:``) must never reach apply
  output. Halt forces the agent to re-render with the locked microcopy.
- **Populated, well-formed** — record changes from the envelope,
  return ``SUCCESS``.

Apply does **not** re-validate the design brief itself — that is the
design step's job. It validates the *output* against the brief's
microcopy lock so a mid-loop hallucination is caught at the boundary.
"""
from __future__ import annotations

from typing import Any

from ...delivery_state import (
    DeliveryState,
    Outcome,
    StepResult,
    agent_directive,
)
from .design import PLACEHOLDER_PATTERNS

STACK_DIRECTIVES: dict[str, str] = {
    "blade-livewire-flux": "ui-apply-blade-livewire-flux",
    "react-shadcn": "ui-apply-react-shadcn",
    "vue": "ui-apply-vue",
    "plain": "ui-apply-plain",
}
"""Map ``state.stack.frontend`` → agent-directive skill name.

Mirrors the heuristic table in :mod:`work_engine.stack.detect`. An
unknown stack falls through to ``ui-apply-plain`` (Tailwind defaults)
rather than raising — a wrong skill pick is recoverable, a crash
mid-dispatch is not.
"""

DEFAULT_DIRECTIVE = "ui-apply-plain"
"""Fallback directive when ``state.stack`` is missing or malformed."""

AMBIGUITIES: tuple[dict[str, str], ...] = (
    {
        "code": "apply_envelope_missing",
        "trigger": "state.ticket['ui_apply'] unset — first pass, "
        "stack-specific skill has not run yet",
        "resolution": "agent directive `ui-apply-<stack>` → skill "
        "bundle implements the brief and writes the envelope back",
    },
    {
        "code": "apply_placeholders_in_output",
        "trigger": "rendered text in apply envelope contains "
        "placeholder patterns (<placeholder>, Lorem, TODO:, TBD, XXX) "
        "— design-brief lock failed mid-loop",
    "resolution": "agent re-renders the components with the locked "
    "microcopy verbatim from state.ui_design.microcopy",
    },
)
"""Declared ambiguity surfaces for this step."""


def run(state: DeliveryState) -> StepResult:
    """Apply the stack-dispatched implementation gate."""
    envelope = _apply_envelope(state)
    if envelope is None:
        return _delegate_to_stack_skill(state)

    violations = _placeholder_violations_in_output(envelope)
    if violations:
        return _halt_placeholders(state, violations)

    _record_changes(state, envelope)
    return StepResult(outcome=Outcome.SUCCESS)


def _apply_envelope(state: DeliveryState) -> dict[str, Any] | None:
    """Return the agent-written ``ui_apply`` envelope, or ``None``."""
    data = state.ticket or {}
    envelope = data.get("ui_apply")
    if isinstance(envelope, dict) and envelope:
        return envelope
    return None


def _resolve_directive(state: DeliveryState) -> str:
    """Pick the agent directive for the project's frontend stack."""
    stack = getattr(state, "stack", None) or {}
    if isinstance(stack, dict):
        frontend = stack.get("frontend")
        if isinstance(frontend, str) and frontend in STACK_DIRECTIVES:
            return STACK_DIRECTIVES[frontend]
    return DEFAULT_DIRECTIVE


def _placeholder_violations_in_output(
    envelope: dict[str, Any],
) -> list[str]:
    """Return paths into ``envelope['rendered']`` whose text matches
    a placeholder pattern.

    The agent writes ``rendered`` as a flat ``{path: text}`` map (or
    nested dict of strings). Walked recursively, lower-cased, and
    matched against :data:`PLACEHOLDER_PATTERNS` from the design step
    so the gate stays consistent with the brief's lock.
    """
    rendered = envelope.get("rendered")
    if not isinstance(rendered, dict):
        return []
    violations: list[str] = []
    _walk_rendered(rendered, prefix="", violations=violations)
    return violations


def _walk_rendered(
    node: dict[str, Any],
    *,
    prefix: str,
    violations: list[str],
) -> None:
    """Recursive helper for :func:`_placeholder_violations_in_output`."""
    for key, value in node.items():
        path = f"{prefix}.{key}" if prefix else str(key)
        if isinstance(value, dict):
            _walk_rendered(value, prefix=path, violations=violations)
            continue
        if not isinstance(value, str):
            continue
        lowered = value.lower()
        for pattern in PLACEHOLDER_PATTERNS:
            if pattern in lowered:
                violations.append(path)
                break


def _delegate_to_stack_skill(state: DeliveryState) -> StepResult:
    """First-pass halt — emit the stack-specific apply directive."""
    directive = _resolve_directive(state)
    stack_label = _stack_label(state)
    return StepResult(
        outcome=Outcome.BLOCKED,
        questions=[
            agent_directive(directive),
            f"> Stack: `{stack_label}`. Implementing the locked design brief.",
            "> Microcopy is locked \u2014 every button label, empty-state "
            "message, and validation message must come verbatim from "
            "`state.ui_design.microcopy`.",
            "> 1. Continue \u2014 implement the brief and write a "
            "`ui_apply` envelope back into state.ticket "
            "(rendered: {path: text}, files: [...])",
            "> 2. Abort \u2014 drop this UI request",
        ],
        message=(
            f"UI apply pending; delegating to `{directive}` for "
            f"stack `{stack_label}`."
        ),
    )


def _halt_placeholders(
    state: DeliveryState,
    violations: list[str],
) -> StepResult:
    """BLOCKED halt — rendered output still carries placeholder patterns."""
    directive = _resolve_directive(state)
    lines = [
        agent_directive(directive),
        "> Apply rejected: rendered output contains placeholder strings. "
        "The design-brief microcopy lock failed mid-loop.",
        "> Affected paths in `ui_apply.rendered`:",
    ]
    for path in violations:
        lines.append(f"> - `{path}`")
    lines.append(
        "> Re-render with the locked microcopy verbatim from "
        "`state.ui_design.microcopy`; apply will not write placeholder text.",
    )
    return StepResult(
        outcome=Outcome.BLOCKED,
        questions=lines,
        message=(
            f"UI apply rejected: {len(violations)} placeholder "
            f"violation(s) in rendered output."
        ),
    )


def _record_changes(
    state: DeliveryState,
    envelope: dict[str, Any],
) -> None:
    """Append one ``state.changes`` entry per file in the apply envelope."""
    files = envelope.get("files")
    if not isinstance(files, list):
        files = []
    summary = envelope.get("summary") or "ui apply"
    stack_label = _stack_label(state)
    for path in files:
        if not isinstance(path, str) or not path:
            continue
        state.changes.append(
            {
                "kind": "ui",
                "stack": stack_label,
                "file": path,
                "summary": summary,
            },
        )


def _stack_label(state: DeliveryState) -> str:
    """Return the frontend stack label, defaulting to ``plain``."""
    stack = getattr(state, "stack", None) or {}
    if isinstance(stack, dict):
        frontend = stack.get("frontend")
        if isinstance(frontend, str) and frontend:
            return frontend
    return "plain"


__all__ = [
    "AMBIGUITIES",
    "DEFAULT_DIRECTIVE",
    "STACK_DIRECTIVES",
    "run",
]
