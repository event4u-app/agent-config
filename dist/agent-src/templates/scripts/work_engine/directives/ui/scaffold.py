"""``scaffold`` step — greenfield Zero-to-One skeleton gate (the ``plan`` slot).

greenfield-scaffold Phase 3 of
``agents/roadmaps/archive/road-to-greenfield-scaffold.md``: raise a real
multi-page skeleton from a confirmed app-spec, under gates, without the
engine ever writing app files. The step occupies the UI set's ``plan``
slot, which runs **after** ``analyze`` (design) and before ``implement``
(apply); it replaces the former no-op pass-through there.

Per the Phases 2-4 council (converged Option A), the order is
audit → app-spec → **design → scaffold** → apply: ``design`` fixes the
*abstract* visual language (tokens, component strategy, layout
principles), and ``scaffold`` maps that language onto *concrete*
structure. The recoverable state is "designed but not scaffolded" — the
plan is stack-agnostic and the engine writes zero files, so a failed
scaffold re-runs from this step alone.

The gate is **scoped to the greenfield-scaffold path only** (the same
guard as :mod:`work_engine.directives.ui.app_spec`). Every other UI flow
sees this slot as a clean ``SUCCESS`` no-op, exactly as the pass-through
behaved, so those flows stay byte-identical.

Two stages, both honouring the engine-never-renders contract:

1. **Plan** — ``state.ui_scaffold`` carries no structural plan yet. Emit
   ``@agent-directive: ui-scaffold-plan``: the agent/skill derives a
   stack-agnostic ``{pages, routes, layout_strategy, component_manifest,
   token_seed}`` from the confirmed ``app_spec`` + the locked design
   brief and writes it into ``state.ui_scaffold``.
2. **Build** — the plan exists but ``scaffolded`` is not ``True``. Emit
   the stack-specific ``@agent-directive: ui-scaffold-<stack>``: the
   stack skill consumes the plan, creates the skeleton files, and writes
   ``state.ui_scaffold.scaffolded = true`` + ``artifacts``.

Idempotent: a fully-scaffolded plan round-trips through ``SUCCESS``.
"""
from __future__ import annotations

from pathlib import Path
from typing import Any

from ...delivery_state import (
    DeliveryState,
    Outcome,
    StepResult,
    agent_directive,
)

BRAND_TOKEN_PATHS: tuple[str, ...] = (
    "tokens.json",
    "assets/tokens.json",
    "resources/tokens.json",
    "agents/settings/brand/tokens.json",
)
"""Conventional locations for a project's DTCG ``tokens.json``.

When one is present (authored by the ``design-tokens`` skill, or shipped
by ``pack-brand`` — see ``agents/settings/contexts/domain-watch/
brand-token-pipeline.md``), the scaffold plan's ``token_seed`` is seeded
from it — the anti-generic moat that makes a generated multi-page app
coherent rather than default-shadcn. Absent → sane defaults. The
dependency is acyclic and degrades gracefully (decision 5): scaffold
never *requires* ``pack-brand``."""

PLAN_DIRECTIVE = "ui-scaffold-plan"
"""Stack-agnostic directive that derives the scaffold plan.

The plan IS stack-agnostic (decision 2), so plan derivation is a single
directive regardless of frontend; only the build stage dispatches per
stack."""

STACK_DIRECTIVES: dict[str, str] = {
    "blade-livewire-flux": "ui-scaffold-blade-livewire-flux",
    "react-shadcn": "ui-scaffold-react-shadcn",
    "vue": "ui-scaffold-vue",
    "plain": "ui-scaffold-plain",
}
"""Map ``state.stack.frontend`` → build-stage agent-directive skill name.

Mirrors :data:`work_engine.directives.ui.apply.STACK_DIRECTIVES`. An
unknown / missing stack falls through to ``ui-scaffold-plain`` rather
than raising — a wrong skill pick is recoverable, a crash is not."""

DEFAULT_DIRECTIVE = "ui-scaffold-plain"
"""Fallback build directive when ``state.stack`` is missing or malformed."""

AMBIGUITIES: tuple[dict[str, str], ...] = (
    {
        "code": "scaffold_plan_missing",
        "trigger": "greenfield scaffold path and state.ui_scaffold carries no "
        "structural plan (no routes / layout_strategy / component_manifest) — "
        "the scaffold plan has not been derived yet",
        "resolution": "agent directive `ui-scaffold-plan` → derive a "
        "stack-agnostic {pages, routes, layout_strategy, component_manifest, "
        "token_seed} from the confirmed app_spec + locked design brief into "
        "state.ui_scaffold",
    },
    {
        "code": "scaffold_build_pending",
        "trigger": "greenfield scaffold path and state.ui_scaffold carries a "
        "plan but `scaffolded` is not True — the stack skill has not created "
        "the skeleton files yet",
        "resolution": "agent directive `ui-scaffold-<stack>` → stack skill "
        "consumes the plan, creates the skeleton, and writes "
        "state.ui_scaffold.scaffolded = true + artifacts",
    },
)
"""Declared ambiguity surfaces for this step."""


def run(state: DeliveryState) -> StepResult:
    """Apply the greenfield scaffold gate.

    No-op ``SUCCESS`` for every non-greenfield-scaffold flow; the
    plan → build loop only engages when the audit recorded a
    ``scaffold`` greenfield decision.
    """
    if not _is_greenfield_scaffold(state):
        return StepResult(outcome=Outcome.SUCCESS)

    scaffold = state.ui_scaffold

    if not _is_planned(scaffold):
        return _delegate_plan(state)

    if scaffold.get("scaffolded") is not True:
        return _delegate_build(state, scaffold)

    return StepResult(outcome=Outcome.SUCCESS)


def _is_greenfield_scaffold(state: DeliveryState) -> bool:
    """True when the audit recorded a ``scaffold`` greenfield decision.

    Identical guard to :func:`work_engine.directives.ui.app_spec
    ._is_greenfield_scaffold`: the gate is inert for improve-existing,
    the ``bare`` / ``external_reference`` greenfield picks, and the
    ``diff`` / ``file`` envelopes.
    """
    audit = getattr(state, "ui_audit", None)
    if not isinstance(audit, dict):
        return False
    return (
        audit.get("greenfield") is True
        and audit.get("greenfield_decision") == "scaffold"
    )


def _is_planned(scaffold: Any) -> bool:
    """True when ``scaffold`` carries a structural plan.

    The defining content of the scaffold plan is the structure the
    app-spec did not produce — routes, a layout strategy, or a
    component manifest. Their presence (any one) is the "plan derived"
    signal; an empty dict or a bare ``None`` is treated as "skill has
    not run". ``pages`` alone is *not* sufficient, since the app-spec
    slice also carries a page-set.
    """
    if not isinstance(scaffold, dict):
        return False
    return any(
        key in scaffold
        for key in ("routes", "layout_strategy", "component_manifest")
    )


def _preview_input(state: DeliveryState) -> str:
    """Render a one-line preview of the input being scaffolded."""
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


def _stack_label(state: DeliveryState) -> str:
    """Return the frontend stack label, defaulting to ``plain``."""
    stack = getattr(state, "stack", None) or {}
    if isinstance(stack, dict):
        frontend = stack.get("frontend")
        if isinstance(frontend, str) and frontend:
            return frontend
    return "plain"


def _resolve_build_directive(state: DeliveryState) -> str:
    """Pick the build-stage directive for the project's frontend stack."""
    stack = getattr(state, "stack", None) or {}
    if isinstance(stack, dict):
        frontend = stack.get("frontend")
        if isinstance(frontend, str) and frontend in STACK_DIRECTIVES:
            return STACK_DIRECTIVES[frontend]
    return DEFAULT_DIRECTIVE


def _brand_token_source(root: Path | None = None) -> str | None:
    """Return the relative path to a present ``tokens.json``, or ``None``.

    Checks :data:`BRAND_TOKEN_PATHS` under ``root`` (default: the current
    working directory, which is the consumer project root when the engine
    runs). The first existing file wins. Absent → ``None`` so the caller
    degrades to default tokens — the acyclic, graceful-degradation
    contract of decision 5.
    """
    base = root if root is not None else Path.cwd()
    for rel in BRAND_TOKEN_PATHS:
        try:
            if (base / rel).is_file():
                return rel
        except OSError:
            continue
    return None


def _token_seed_line(state: DeliveryState) -> str:
    """Describe the token-seed source for the plan directive.

    Brand-seeds from a present DTCG ``tokens.json`` (decision 5) when one
    exists; otherwise instructs the skill to derive from the locked
    design brief + sane defaults. Graceful degradation: no token source
    → defaults, never a hard failure.
    """
    source = _brand_token_source()
    if source is not None:
        return (
            f"> `token_seed`: seed from the project's brand/design tokens "
            f"at `{source}` (DTCG `tokens.json`) — the anti-generic moat. "
            f"Do NOT fall back to default shadcn tokens when this source is "
            f"present; carry its primitives + semantic layers into the plan."
        )
    return (
        "> `token_seed`: derive from the locked design brief's tokens; "
        "fall back to sane defaults (neutral scale, system font) when the "
        "brief leaves a slot open (no `tokens.json` brand source detected)."
    )


def _delegate_plan(state: DeliveryState) -> StepResult:
    """Stage 1 — emit the stack-agnostic plan-derivation directive."""
    return StepResult(
        outcome=Outcome.BLOCKED,
        questions=[
            agent_directive(PLAN_DIRECTIVE),
            f"> Input: {_preview_input(state)}",
            "> Greenfield scaffold — derive a stack-agnostic skeleton plan "
            "from the confirmed `state.app_spec` (page-set + entity model) "
            "and the locked `state.ui_design` brief. The engine writes no "
            "files; this stage only produces the plan.",
            "> Write `state.ui_scaffold` = "
            "{pages, routes, layout_strategy, component_manifest, token_seed}.",
            _token_seed_line(state),
            "> 1. Continue — derive the scaffold plan into "
            "`state.ui_scaffold`",
            "> 2. Abort — drop this UI request",
            "",
            "**Recommendation: 1 — derive the plan** — the "
            "stack-agnostic plan is the recoverable checkpoint: if the build "
            "stage fails, scaffold re-runs from here without touching design "
            "or apply.",
        ],
        message=(
            "Greenfield scaffold plan missing; delegating to "
            "`ui-scaffold-plan` to derive the stack-agnostic skeleton plan."
        ),
    )


def _delegate_build(state: DeliveryState, scaffold: dict[str, Any]) -> StepResult:
    """Stage 2 — emit the stack-specific skeleton-build directive."""
    directive = _resolve_build_directive(state)
    stack_label = _stack_label(state)
    pages = scaffold.get("pages")
    page_count = len(pages) if isinstance(pages, list) else 0
    routes = scaffold.get("routes")
    route_count = len(routes) if isinstance(routes, list) else 0
    return StepResult(
        outcome=Outcome.BLOCKED,
        questions=[
            agent_directive(directive),
            f"> Stack: `{stack_label}`. Scaffold plan is ready "
            f"({page_count} page(s), {route_count} route(s)). Create the "
            "skeleton from `state.ui_scaffold` — routes, layout shell, and "
            "the component-manifest stubs.",
            "> The engine writes no files: the stack skill creates the "
            "skeleton and writes `state.ui_scaffold.scaffolded = true` plus "
            "`state.ui_scaffold.artifacts` (the created paths).",
            "> Recoverable: a failed build re-runs from this scaffold step "
            "alone — design and app-spec stay locked.",
            "> 1. Continue — create the skeleton and mark "
            "`scaffolded = true`",
            "> 2. Abort — drop this UI request",
            "",
            f"**Recommendation: 1 — build the skeleton** — the "
            f"`{stack_label}` scaffold skill materialises the confirmed plan; "
            f"the rendered output is verified downstream by the review gate.",
        ],
        message=(
            f"Greenfield scaffold plan ready; delegating to `{directive}` to "
            f"create the skeleton for stack `{stack_label}`."
        ),
    )


__all__ = [
    "AMBIGUITIES",
    "DEFAULT_DIRECTIVE",
    "PLAN_DIRECTIVE",
    "STACK_DIRECTIVES",
    "run",
]
