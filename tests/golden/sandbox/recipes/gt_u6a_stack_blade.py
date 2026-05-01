"""GT-U6A — stack dispatch: blade-livewire-flux apply directive.

Pins the contract for ``ui.apply`` stack-dispatch on a Blade /
Livewire / Flux project: when ``state.stack['frontend'] ==
"blade-livewire-flux"``, the apply step emits
``@agent-directive: ui-apply-blade-livewire-flux`` (not the default
``ui-apply-plain``). Mirrors the lookup table in
``directives/ui/apply.py::STACK_DIRECTIVES``.

Halt budget — locked by this golden:

- **1 halt total** — ``ui-apply-blade-livewire-flux`` on cycle 1.
- No ``existing-ui-audit`` halt (seeded ``state.ui_audit``).
- No ``ui-design-brief`` halt (seeded ``state.ui_design`` carries
  ``design_confirmed=True``).
- No ``ui-design-review-blade-livewire-flux`` / polish halt (seeded
  ``state.ui_review`` is clean).

Cycle map (cap = 4):

1. ``ui-apply-blade-livewire-flux`` — audit / design return SUCCESS;
                                      apply halts on the stack-specific
                                      directive (the dispatch this
                                      golden pins). Recipe writes a
                                      rendered envelope into
                                      ``state.input.data['ui_apply']``.
2. ``report`` runs                  — apply re-runs with the envelope,
                                      review / polish skip on clean
                                      seed; report renders.
"""
from __future__ import annotations

from pathlib import Path
from typing import Any

from ._helpers import stack_state

META = {
    "gt_id": "GT-U6A",
    "prompt_relpath": "prompts/gt-u6-stack-dispatch.txt",
    "persona": None,
    "cycle_cap": 4,
}


def seed_state(workspace: Path) -> dict[str, Any]:
    """Pre-populate state so cycle 1 halts on the stack-specific apply.

    Seeds ``state.stack`` with ``frontend="blade-livewire-flux"`` and
    pre-fills audit / design / review so the only halt is the apply
    directive — the dispatch this golden locks.
    """
    return {
        "version": 1,
        "input": {
            "kind": "prompt",
            "data": {
                "raw": (
                    "Add an empty-state component to the dashboard sidebar.\n"
                ),
                "reconstructed_ac": [
                    "Empty-state shown when the sidebar list is empty",
                    "Reuses the existing illustration + heading primitives",
                ],
                "assumptions": [
                    "sidebar already supports a slot for empty content",
                ],
                "confidence": {
                    "band": "high",
                    "score": 0.90,
                },
                "acceptance_criteria": [
                    "Empty-state shown when the sidebar list is empty",
                    "Reuses the existing illustration + heading primitives",
                ],
            },
        },
        "intent": "ui-build",
        "directive_set": "ui",
        "stack": stack_state(frontend="blade-livewire-flux", php_framework="laravel"),
        "ui_audit": {
            "components_found": [
                {
                    "path": "resources/views/components/empty-state.blade.php",
                    "name": "empty-state",
                    "kind": "ui-primitive",
                    "similarity": 0.78,
                },
            ],
            "design_tokens": {"spacing": ["sm", "md", "lg"]},
            "audit_path": "high_confidence",
        },
        "ui_design": {
            "layout": "sidebar empty-state slot, vertically centered",
            "components": [
                {
                    "name": "SidebarEmptyState",
                    "primitives": ["empty-state", "icon"],
                },
            ],
            "states": {
                "empty": "illustration + heading + body copy + primary action",
                "loading": "skeleton placeholder while sidebar loads",
                "error": "fallback message with retry action",
                "success": "list renders normally, empty-state hidden",
                "disabled": "n/a — empty-state never disabled",
            },
            "microcopy": {
                "heading": "Nothing here yet",
                "body": "Items you create will appear in this list.",
                "primary_action": "Create one",
            },
            "a11y": {
                "role": "status",
                "aria_live": "polite",
                "focus_target": "primary_action",
            },
            "reused_from_audit": ["empty-state"],
            "design_confirmed": True,
        },
        "ui_review": {
            "findings": [],
            "review_clean": True,
        },
        "ui_polish": None,
        "contract": None,
        "stitch": None,
        "persona": "senior-engineer",
        "memory": [],
        "plan": None,
        "changes": [],
        "tests": None,
        "verify": None,
        "outcomes": {},
        "questions": [],
        "report": "",
    }


def build_recipe(workspace: Path) -> dict[str, Any]:
    """Return the directive→step mapping with ``workspace`` bound in."""

    def on_apply(state: dict[str, Any], record) -> dict[str, Any]:
        data = state.setdefault("input", {}).setdefault("data", {})
        data["ui_apply"] = {
            "summary": (
                "Sidebar empty-state rendered as Flux + Livewire component"
            ),
            "rendered": {
                "resources/views/livewire/sidebar-empty-state.blade.php": (
                    "<flux:card class=\"text-center\">"
                    "<x-icon name=\"inbox\" class=\"mx-auto h-12 w-12\" />"
                    "<flux:heading size=\"sm\">Nothing here yet</flux:heading>"
                    "<flux:subheading>Items you create will appear in this list.</flux:subheading>"
                    "<flux:button wire:click=\"create\">Create one</flux:button>"
                    "</flux:card>"
                ),
                "app/Livewire/Sidebar/EmptyState.php": (
                    "namespace App\\Livewire\\Sidebar; "
                    "use Livewire\\Component; "
                    "class EmptyState extends Component { "
                    "public function create(): void {} "
                    "public function render() { "
                    "return view('livewire.sidebar-empty-state'); } }"
                ),
            },
            "files": [
                "resources/views/livewire/sidebar-empty-state.blade.php",
                "app/Livewire/Sidebar/EmptyState.php",
            ],
        }
        record.recipe_notes.append(
            "ui_apply envelope written for blade-livewire-flux stack "
            "(2 files: Livewire component + Flux blade view)",
        )
        return state

    return {
        "ui-apply-blade-livewire-flux": on_apply,
    }


__all__ = ["META", "build_recipe", "seed_state"]
