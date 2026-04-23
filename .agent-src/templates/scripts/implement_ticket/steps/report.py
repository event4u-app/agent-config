"""``report`` step — delivery report renderer.

Produces the markdown block described in
``agents/contexts/implement-ticket-flow.md#delivery-report-schema``.
All nine headings are present on every run — the schema is stable
for consumers — but section bodies are omitted when the matching
slice of ``DeliveryState`` is empty. The single exception is the
**Memory that mattered** section, which per contract is dropped
entirely (heading included) when no hit carries a
``changed_outcome`` marker.

The step is pure and deterministic: no I/O, no subprocess, no
randomness. It reads ``DeliveryState``, writes ``state.report``,
and always returns ``SUCCESS``.
"""
from __future__ import annotations

from typing import Any, Iterable

from ..delivery_state import DeliveryState, Outcome, StepResult


def run(state: DeliveryState) -> StepResult:
    """Render the delivery report into ``state.report`` and return SUCCESS."""
    state.report = _render(state)
    return StepResult(outcome=Outcome.SUCCESS)


def _render(state: DeliveryState) -> str:
    sections = [
        _ticket_section(state),
        _persona_section(state),
        _plan_section(state),
        _changes_section(state),
        _tests_section(state),
        _verify_section(state),
        _memory_section(state),
        _followups_section(state),
        _next_commands_section(state),
    ]
    # Drop sections that opted out (memory-that-mattered returns "" when no
    # hit influenced an outcome — per the report schema drop-rule).
    return "\n\n".join(section for section in sections if section)


def _ticket_section(state: DeliveryState) -> str:
    ticket = state.ticket or {}
    ticket_id = ticket.get("id") or "(no id)"
    title = ticket.get("title") or "(no title)"
    return f"## Ticket\n\n{ticket_id} — {title}"


def _persona_section(state: DeliveryState) -> str:
    return f"## Persona\n\n{state.persona or '(unset)'}"


def _plan_section(state: DeliveryState) -> str:
    body = _format_plan(state.plan)
    return "## Plan\n\n" + (body or "_(no plan recorded)_")


def _format_plan(plan: Any) -> str:
    """Render whatever shape ``state.plan`` carries.

    Accepts a list of step strings, a list of ``{title, detail}`` dicts,
    or a single string — the contract doc intentionally leaves the
    plan shape loose until ``feature-plan`` wiring lands in a later
    phase.
    """
    if not plan:
        return ""
    if isinstance(plan, str):
        return plan.strip()
    if isinstance(plan, list):
        lines = []
        for idx, item in enumerate(plan, start=1):
            if isinstance(item, dict):
                title = item.get("title") or item.get("step") or f"Step {idx}"
                detail = item.get("detail") or item.get("note") or ""
                lines.append(
                    f"{idx}. **{title}**" + (f" — {detail}" if detail else ""),
                )
            else:
                lines.append(f"{idx}. {item}")
        return "\n".join(lines)
    # Last resort: string-coerce an unknown shape so the renderer never
    # crashes on experimental plan structures.
    return str(plan)


def _changes_section(state: DeliveryState) -> str:
    if not state.changes:
        return "## Changes\n\n_(no file changes recorded)_"
    lines = ["## Changes", ""]
    for change in state.changes:
        path = change.get("path") or change.get("file") or "(unknown file)"
        lines_range = change.get("lines") or change.get("range") or ""
        purpose = change.get("purpose") or change.get("why") or ""
        prefix = f"- `{path}`"
        if lines_range:
            prefix += f" ({lines_range})"
        if purpose:
            prefix += f" — {purpose}"
        lines.append(prefix)
    return "\n".join(lines)


def _tests_section(state: DeliveryState) -> str:
    return "## Tests\n\n" + _format_kv_block(state.tests, "_(no tests ran)_")


def _verify_section(state: DeliveryState) -> str:
    return "## Verify\n\n" + _format_kv_block(state.verify, "_(no verify verdict)_")


def _memory_section(state: DeliveryState) -> str:
    """Render **only** hits that changed an outcome (per report schema)."""
    influential = [
        hit for hit in (state.memory or [])
        if isinstance(hit, dict) and hit.get("changed_outcome")
    ]
    if not influential:
        return ""  # drop the whole section — heading included
    lines = ["## Memory that mattered", ""]
    for hit in influential:
        hit_id = hit.get("id") or "(no id)"
        hit_type = hit.get("type") or "(no type)"
        note = hit.get("note") or hit.get("why") or ""
        suffix = f" — {note}" if note else ""
        lines.append(f"- `{hit_id}` ({hit_type}){suffix}")
    return "\n".join(lines)


def _followups_section(state: DeliveryState) -> str:
    followups = _extract_followups(state)
    if not followups:
        return "## Follow-ups\n\n_(none)_"
    lines = ["## Follow-ups", ""]
    for item in followups:
        anchor = item.get("anchor") or ""
        note = item.get("note") or item.get("title") or "(untitled)"
        prefix = f"- {note}"
        if anchor:
            prefix += f" — `{anchor}`"
        lines.append(prefix)
    return "\n".join(lines)


def _extract_followups(state: DeliveryState) -> list[dict[str, Any]]:
    """Follow-ups may live on any slice; aggregate them in reading order."""
    collected: list[dict[str, Any]] = []
    for source in (state.plan, state.verify, state.tests):
        if isinstance(source, dict):
            for item in source.get("followups") or []:
                if isinstance(item, dict):
                    collected.append(item)
    return collected


def _next_commands_section(state: DeliveryState) -> str:
    commands = _suggest_commands(state)
    lines = ["## Suggested next commands", ""]
    lines.extend(f"- `{cmd}`" for cmd in commands)
    return "\n".join(lines)


def _suggest_commands(state: DeliveryState) -> list[str]:
    """Always suggest ``/commit`` and ``/create-pr`` when verify was successful."""
    if state.outcomes.get("verify") == Outcome.SUCCESS.value:
        return ["/commit", "/create-pr"]
    return ["/commit"]


def _format_kv_block(value: Any, empty_placeholder: str) -> str:
    """Render a dict-ish slice as a bullet list; fall back to placeholder."""
    if not value:
        return empty_placeholder
    if isinstance(value, dict):
        return "\n".join(_render_kv_lines(value.items()))
    if isinstance(value, str):
        return value.strip() or empty_placeholder
    return str(value)


def _render_kv_lines(pairs: Iterable[tuple[str, Any]]) -> list[str]:
    """Render ``(key, value)`` pairs as one Markdown bullet per pair."""
    return [f"- **{key}:** {value}" for key, value in pairs]
