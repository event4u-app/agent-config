"""GT-U6B — stack dispatch: react-shadcn apply directive.

Pins the contract for ``ui.apply`` stack-dispatch on a React /
shadcn-ui project: when ``state.stack['frontend'] == "react-shadcn"``,
the apply step emits ``@agent-directive: ui-apply-react-shadcn`` (not
the default ``ui-apply-plain``). Mirrors the lookup table in
``directives/ui/apply.py::STACK_DIRECTIVES``.

Sister scenario to GT-U6A; both share the same prompt and seeded
audit / design / review — the *only* difference is
``state.stack.frontend`` and the resulting directive. Capturing both
locks the dispatch table against silent re-routing.

Halt budget — locked by this golden:

- **1 halt total** — ``ui-apply-react-shadcn`` on cycle 1.
- No ``existing-ui-audit`` / ``ui-design-brief`` / review / polish
  halts (all gated by clean seeds).

Cycle map (cap = 4):

1. ``ui-apply-react-shadcn`` — audit / design return SUCCESS; apply
                               halts on the stack-specific directive.
                               Recipe writes a TSX rendered envelope.
2. ``report`` runs           — apply re-runs with the envelope,
                               review / polish short-circuit; report
                               renders; engine exits 0.
"""
from __future__ import annotations

from pathlib import Path
from typing import Any

from ._helpers import stack_state

META = {
    "gt_id": "GT-U6B",
    "prompt_relpath": "prompts/gt-u6-stack-dispatch.txt",
    "persona": None,
    "cycle_cap": 4,
}


def seed_state(workspace: Path) -> dict[str, Any]:
    """Pre-populate state so cycle 1 halts on the React stack apply.

    Identical envelope to GT-U6A except for ``state.stack.frontend``,
    which flips the dispatch from ``ui-apply-blade-livewire-flux`` to
    ``ui-apply-react-shadcn``. Audit / design / review seeds match
    GT-U6A so any diff in the resulting directive is unambiguously
    attributable to the stack value.
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
        "stack": stack_state(frontend="react-shadcn", php_framework=None),
        "ui_audit": {
            "components_found": [
                {
                    "path": "src/components/ui/empty-state.tsx",
                    "name": "EmptyState",
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
                    "primitives": ["EmptyState", "Icon"],
                },
            ],
            "states": {
                "empty": "illustration + heading + body copy + primary action",
                "loading": "Skeleton placeholder while sidebar loads",
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
            "reused_from_audit": ["EmptyState"],
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
                "Sidebar empty-state rendered as React + shadcn-ui component"
            ),
            "rendered": {
                "src/components/sidebar/empty-state.tsx": (
                    "import { Card, CardContent } from \"@/components/ui/card\"; "
                    "import { Button } from \"@/components/ui/button\"; "
                    "import { Inbox } from \"lucide-react\"; "
                    "export function SidebarEmptyState() { "
                    "return (<Card className=\"text-center\">"
                    "<CardContent className=\"py-8\">"
                    "<Inbox className=\"mx-auto h-12 w-12 text-muted-foreground\" />"
                    "<h3 className=\"mt-2 text-sm font-medium\">Nothing here yet</h3>"
                    "<p className=\"mt-1 text-sm text-muted-foreground\">"
                    "Items you create will appear in this list.</p>"
                    "<Button className=\"mt-4\">Create one</Button>"
                    "</CardContent></Card>); }"
                ),
            },
            "files": ["src/components/sidebar/empty-state.tsx"],
        }
        record.recipe_notes.append(
            "ui_apply envelope written for react-shadcn stack "
            "(1 file: TSX component using Card + Button primitives)",
        )
        return state

    return {
        "ui-apply-react-shadcn": on_apply,
    }


__all__ = ["META", "build_recipe", "seed_state"]
