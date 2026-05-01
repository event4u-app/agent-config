"""GT-U5 — mixed flow orchestration: contract → ui-track → stitch.

Pins the contract for ``directive_set="mixed"``: when a prompt touches
both backend (data model + endpoints) and UI (form + screen), the
engine runs ``backend.refine → backend.memory → backend.analyze →
mixed.contract → mixed.ui → mixed.stitch → backend.verify →
backend.report``. The mixed-specific halts — contract sign-off,
``ui-track`` delegation, ``integration-test`` smoke — fire in that
exact order with the contract sentinel gating the UI handoff.

Halt budget — locked by this golden:

- **5 halts total** —
  1. ``contract-plan`` on cycle 1 (no contract yet).
  2. ``_no_directive`` on cycle 2 (contract populated, sign-off halt).
  3. ``ui-track`` on cycle 3 (contract confirmed, UI sub-flow handoff).
  4. ``integration-test`` on cycle 4 (UI clean, stitch smoke).
  5. ``review-changes`` on cycle 5 (verify gate).
- No ``refine-prompt`` halt (``outcomes.refine`` seeded ``success``).
- No ``memory`` halt (``outcomes.memory`` seeded ``success``; the step
  always succeeds anyway, but seeding skips it for byte-stability).
- No ``analyze`` halt (``outcomes.analyze`` seeded ``success``).

Cycle map (cap = 8):

1. ``contract-plan``       — plan(mixed.contract) halts; ``state.contract``
                             is None. Recipe writes ``data_model`` +
                             ``api_surface`` with ``confirmed=False`` so
                             the next cycle hits the sign-off halt.
2. ``_no_directive``       — plan re-runs; contract populated but not
                             confirmed. Recipe flips
                             ``contract_confirmed=True``.
3. ``ui-track``            — plan SUCCESS; implement(mixed.ui) halts on
                             the UI sub-flow handoff. Recipe writes
                             ``ui_review={review_clean: True}`` and seeds
                             ``state.changes`` so verify has something to
                             review.
4. ``integration-test``    — implement SUCCESS; test(mixed.stitch) halts;
                             ``state.stitch`` empty. Recipe writes a
                             ``success`` verdict over two scenarios.
5. ``review-changes``      — test SUCCESS; verify(backend.verify) halts;
                             ``state.verify`` empty. Recipe writes the
                             simulated review verdict.
6. ``report`` runs         — verify SUCCESS; report renders; engine
                             exits 0 with the delivery markdown.
"""
from __future__ import annotations

from pathlib import Path
from typing import Any

from ._helpers import base_changes, mixed_contract, simulated_review_verdict

META = {
    "gt_id": "GT-U5",
    "prompt_relpath": "prompts/gt-u5-mixed-flow.txt",
    "persona": None,
    "cycle_cap": 8,
}


def seed_state(workspace: Path) -> dict[str, Any]:
    """Pre-populate state so cycle 1 starts at plan (mixed.contract).

    Seeds ``outcomes`` with ``refine``/``memory``/``analyze`` already
    successful so the dispatcher skips them — the golden focuses on
    the mixed-specific contract → ui-track → stitch chain. The
    ``input.data`` envelope mirrors what the prompt resolver writes
    after a clean ``refine-prompt`` rebound: high-band confidence,
    reconstructed AC, no ``ui_intent`` flag (so the backend gate
    would not have re-routed away from mixed).
    """
    return {
        "version": 1,
        "input": {
            "kind": "prompt",
            "data": {
                "raw": (
                    "Add a customer feedback form: POST /api/feedback "
                    "persists to a `feedbacks` table, render the form "
                    "on `/feedback` with a success state.\n"
                ),
                "reconstructed_ac": [
                    "POST /api/feedback validates payload and persists to feedbacks",
                    "GET /feedback renders a form bound to forms.text-input",
                    "Successful submission swaps the form for a confirmation card",
                ],
                "assumptions": [
                    "feedbacks table is new; migration ships with this change",
                    "no admin moderation flow in this iteration",
                ],
                "confidence": {
                    "band": "high",
                    "score": 0.91,
                },
                "acceptance_criteria": [
                    "POST /api/feedback validates payload and persists to feedbacks",
                    "GET /feedback renders a form bound to forms.text-input",
                    "Successful submission swaps the form for a confirmation card",
                ],
            },
        },
        "intent": "mixed",
        "directive_set": "mixed",
        "stack": None,
        "ui_audit": None,
        "ui_design": None,
        "ui_review": None,
        "ui_polish": None,
        "contract": None,
        "stitch": None,
        "persona": "senior-engineer",
        "memory": [],
        "plan": None,
        "changes": [],
        "tests": None,
        "verify": None,
        "outcomes": {
            "refine": "success",
            "memory": "success",
            "analyze": "success",
        },
        "questions": [],
        "report": "",
    }


def build_recipe(workspace: Path) -> dict[str, Any]:
    """Return the directive→step mapping with ``workspace`` bound in."""

    def on_contract_plan(state: dict[str, Any], record) -> dict[str, Any]:
        state["contract"] = mixed_contract(
            data_model=[
                {
                    "entity": "Feedback",
                    "table": "feedbacks",
                    "fields": [
                        {"name": "id", "type": "uuid", "primary": True},
                        {"name": "name", "type": "string", "required": True},
                        {"name": "email", "type": "email", "required": True},
                        {"name": "message", "type": "text", "required": True},
                        {"name": "created_at", "type": "datetime"},
                    ],
                },
            ],
            api_surface=[
                {
                    "method": "POST",
                    "path": "/api/feedback",
                    "request": ["name", "email", "message"],
                    "response": {"201": "FeedbackResource", "422": "ValidationError"},
                },
                {
                    "method": "GET",
                    "path": "/feedback",
                    "response": {"200": "feedback.show view"},
                },
            ],
            confirmed=False,
        )
        record.recipe_notes.append(
            "contract written: 1 entity (Feedback), 2 endpoints; awaiting confirmation",
        )
        return state

    def on_contract_confirm(state: dict[str, Any], record) -> dict[str, Any]:
        contract = state.get("contract") or {}
        contract["contract_confirmed"] = True
        state["contract"] = contract
        record.recipe_notes.append("contract_confirmed=True (sign-off halt resolved)")
        return state

    def on_ui_track(state: dict[str, Any], record) -> dict[str, Any]:
        state["ui_review"] = {
            "findings": [],
            "review_clean": True,
        }
        state["ui_audit"] = {
            "components_found": [
                {
                    "path": "resources/views/components/forms/text-input.blade.php",
                    "name": "forms.text-input",
                    "kind": "form-primitive",
                    "similarity": 0.82,
                },
            ],
            "design_tokens": {"spacing": ["sm", "md", "lg"]},
        }
        state["ui_design"] = {
            "layout": "single-column form on /feedback, max-w-md",
            "components": [
                {
                    "name": "FeedbackForm",
                    "primitives": ["forms.text-input", "button"],
                },
            ],
            "states": {
                "empty": "fields empty, submit disabled until valid",
                "loading": "submit pressed: spinner, fields disabled",
                "error": "field-level validation messages",
                "success": "form replaced by confirmation card",
                "disabled": "fields disabled while loading",
            },
            "reused_from_audit": ["forms.text-input"],
            "design_confirmed": True,
        }
        state["changes"] = base_changes(
            "app/Http/Controllers/FeedbackController.php",
            "app/Models/Feedback.php",
            "database/migrations/2026_05_01_create_feedbacks_table.php",
            "resources/views/feedback/show.blade.php",
            "routes/web.php",
        )
        record.recipe_notes.append(
            "ui-track returned clean; 5 changes recorded (controller, model, "
            "migration, view, route)",
        )
        return state

    def on_integration_test(state: dict[str, Any], record) -> dict[str, Any]:
        state["stitch"] = {
            "verdict": "success",
            "scenarios": [
                {
                    "name": "happy: submit feedback round-trips to confirmation",
                    "outcome": "passed",
                },
                {
                    "name": "validation: empty payload returns 422 with field errors",
                    "outcome": "passed",
                },
            ],
        }
        record.recipe_notes.append(
            "stitch verdict=success across 2 scenarios (happy + validation)",
        )
        return state

    def on_review_changes(state: dict[str, Any], record) -> dict[str, Any]:
        state["verify"] = simulated_review_verdict()
        record.recipe_notes.append("review-changes simulated success (4 judges, no findings)")
        return state

    return {
        "contract-plan": on_contract_plan,
        "_no_directive": on_contract_confirm,
        "ui-track": on_ui_track,
        "integration-test": on_integration_test,
        "review-changes": on_review_changes,
    }


__all__ = ["META", "build_recipe", "seed_state"]
