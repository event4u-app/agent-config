"""Tests for the ``report`` step — markdown delivery report renderer.

The report schema is public contract: downstream consumers grep for
section headings. These tests lock the schema in and verify the
"drop the Memory section when no hit influenced an outcome" rule.
"""
from __future__ import annotations

from work_engine import DeliveryState, Outcome
from work_engine.steps import report


def _state(**overrides) -> DeliveryState:
    base = {"ticket": {"id": "TICKET-42", "title": "Add export button"}}
    base.update(overrides)
    return DeliveryState(**base)


def test_report_returns_success_and_writes_markdown_into_state() -> None:
    state = _state()

    result = report.run(state)

    assert result.outcome is Outcome.SUCCESS
    assert state.report.startswith("## Ticket")
    assert "TICKET-42 — Add export button" in state.report


def test_report_always_emits_the_stable_section_headings() -> None:
    state = _state()

    report.run(state)

    # Memory section is allowed to be absent when no hit mattered,
    # but the other eight headings are stable contract.
    for heading in (
        "## Ticket",
        "## Persona",
        "## Plan",
        "## Changes",
        "## Tests",
        "## Verify",
        "## Follow-ups",
        "## Suggested next commands",
    ):
        assert heading in state.report, f"missing section: {heading}"


def test_report_drops_memory_section_when_no_hit_changed_an_outcome() -> None:
    state = _state(memory=[
        {"id": "inv-1", "type": "domain-invariant"},  # no changed_outcome
        {"id": "dec-9", "type": "architecture-decision"},
    ])

    report.run(state)

    assert "## Memory that mattered" not in state.report


def test_report_includes_memory_section_for_hits_that_changed_an_outcome() -> None:
    state = _state(memory=[
        {"id": "inv-1", "type": "domain-invariant"},
        {
            "id": "dec-9",
            "type": "architecture-decision",
            "changed_outcome": True,
            "note": "forced Option A delegation",
        },
    ])

    report.run(state)

    assert "## Memory that mattered" in state.report
    assert "`dec-9`" in state.report
    assert "forced Option A delegation" in state.report
    # The uninfluential hit must NOT leak into the section.
    assert "`inv-1`" not in state.report


def test_report_renders_list_plan_as_numbered_markdown() -> None:
    state = _state(plan=[
        {"title": "Add export endpoint", "detail": "GET /api/exports"},
        "Wire frontend button",
    ])

    report.run(state)

    assert "1. **Add export endpoint** — GET /api/exports" in state.report
    assert "2. Wire frontend button" in state.report


def test_report_renders_changes_with_path_range_and_purpose() -> None:
    state = _state(changes=[
        {"path": "app/Http/Controllers/Export.php", "lines": "12-34", "purpose": "new endpoint"},
        {"path": "resources/views/exports.blade.php"},
    ])

    report.run(state)

    assert "`app/Http/Controllers/Export.php` (12-34) — new endpoint" in state.report
    assert "`resources/views/exports.blade.php`" in state.report


def test_report_suggests_create_pr_only_when_verify_succeeded() -> None:
    state = _state()
    state.outcomes["verify"] = Outcome.SUCCESS.value

    report.run(state)

    assert "`/commit`" in state.report
    assert "`/create-pr`" in state.report


def test_report_omits_create_pr_when_verify_did_not_succeed() -> None:
    state = _state()
    # verify either halted or never ran — create-pr is not safe yet.
    state.outcomes["verify"] = Outcome.BLOCKED.value

    report.run(state)

    assert "`/commit`" in state.report
    assert "`/create-pr`" not in state.report


def test_report_aggregates_followups_from_plan_verify_and_tests() -> None:
    state = _state(
        plan={"followups": [{"note": "extract helper", "anchor": "app/Helper.php:22"}]},
        verify={"followups": [{"note": "add rate limit"}]},
        tests={"followups": [{"note": "cover edge case", "anchor": "tests/ExportTest.php"}]},
    )

    report.run(state)

    assert "- extract helper — `app/Helper.php:22`" in state.report
    assert "- add rate limit" in state.report
    assert "- cover edge case — `tests/ExportTest.php`" in state.report


def test_report_placeholders_when_slices_are_empty() -> None:
    state = _state()

    report.run(state)

    assert "_(no plan recorded)_" in state.report
    assert "_(no file changes recorded)_" in state.report
    assert "_(no tests ran)_" in state.report
    assert "_(no verify verdict)_" in state.report
    assert "_(none)_" in state.report  # follow-ups placeholder
