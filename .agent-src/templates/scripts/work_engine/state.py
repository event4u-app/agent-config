"""Schema v1 of the universal-engine work state.

The wire format adds five envelope fields on top of the legacy
``DeliveryState`` shape from ``implement_ticket.delivery_state``:

- ``version`` — integer schema version, currently ``1``.
- ``input.kind`` — typed input variant (only ``"ticket"`` for R1).
- ``input.data`` — the original payload (was ``state.ticket`` in v0).
- ``intent`` — coarse intent label (``"backend-coding"`` for R1).
- ``directive_set`` — name of the directive bundle the dispatcher
  loads. The enum is forward-compatible: ``ui``, ``ui-trivial``, and
  ``mixed`` are accepted by the schema even though only ``backend``
  has working directives in R1 (Phase 4 Step 4 — pre-listed to avoid
  a schema bump when R3 V2 lands).
- ``stack`` — optional ``{frontend, mtime}`` cache populated by
  :mod:`work_engine.stack.detect` (R3 Phase 1). ``None`` while the
  detector has not yet run; the dispatcher fills it on the first UI
  dispatch and re-runs detection when ``mtime`` no longer matches the
  filesystem (manifest edited).
- ``ui_audit`` — optional inventory written by the
  ``existing-ui-audit`` skill (R3 Phase 2). ``None`` while the audit
  has not run; populated dict once the skill returns. ``greenfield``
  flag plus ``greenfield_decision`` carry the user's scaffolding
  pick. The audit gate (:mod:`work_engine.directives.ui.audit`)
  refuses to advance to design/apply while the slot is empty or
  while ``greenfield`` is set without a recorded decision.
- ``ui_design`` — optional design brief produced by
  :mod:`work_engine.directives.ui.design` (R3 Phase 3 Step 1). Locks
  layout / components / states / microcopy / a11y; ``design_confirmed``
  carries the user's sign-off.
- ``ui_review`` — optional review-pass output written by
  :mod:`work_engine.directives.ui.review` (R3 Phase 3 Step 4). Carries
  the design-review findings list and a ``review_clean`` flag set when
  no findings remain.
- ``ui_polish`` — optional polish-pass log written by
  :mod:`work_engine.directives.ui.polish` (R3 Phase 3 Step 5). Tracks
  the round counter (``rounds`` ≤ 2 ceiling) and the per-round
  applied-fix list so a re-entry knows whether the loop has been
  exhausted.
- ``contract`` — optional backend-contract envelope written by
  :mod:`work_engine.directives.mixed.contract` (R3 Phase 4 Step 1).
  Locks ``data_model`` and ``api_surface`` before any UI work starts;
  ``contract_confirmed`` carries the user's sign-off. The mixed UI
  step refuses to advance without a confirmed contract — this is the
  sentinel that prevents UI work from racing ahead of the backend.
- ``stitch`` — optional integration-verification envelope written by
  :mod:`work_engine.directives.mixed.stitch` (R3 Phase 4 Step 3).
  Carries the end-to-end smoke ``scenarios`` list, an aggregate
  ``verdict`` (success / blocked / partial), and the
  ``integration_confirmed`` flag the user sets after reviewing the
  integration evidence.

All other fields keep their v0 names so the dispatcher can read the
legacy slice unchanged once Phase 3 wires the steps over.

The module exposes:

- :data:`SCHEMA_VERSION` — the integer carried in ``version``.
- :data:`KNOWN_INPUT_KINDS` / :data:`KNOWN_DIRECTIVE_SETS` — the
  whitelists used by validation.
- :class:`Input`, :class:`WorkState` — typed dataclasses.
- :func:`from_dict` / :func:`to_dict` — JSON round-trip helpers.
- :class:`SchemaError` — raised on every validation failure.
"""
from __future__ import annotations

import json
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

SCHEMA_VERSION = 1
"""Integer version stored under the ``version`` key on disk."""

DEFAULT_INTENT = "backend-coding"
"""Intent applied when migrating a v0 file or building a fresh state."""

DEFAULT_DIRECTIVE_SET = "backend"
"""Directive set applied when migrating a v0 file or building a fresh state."""

KNOWN_INPUT_KINDS: frozenset[str] = frozenset({"ticket", "prompt", "diff", "file"})
"""Input kinds accepted by the schema.

``ticket`` is the R1 kind: pre-structured ``{id, title, acceptance_criteria, …}``
fed by the ``/implement-ticket`` flow. ``prompt`` is the R2 kind: a free-form
user prompt wrapped via :mod:`work_engine.resolvers.prompt` into
``{raw, reconstructed_ac, assumptions}``; the engine refines the raw text
into actionable AC + a confidence band before plan/apply/test/review run.

``diff`` and ``file`` are the R3 Phase 1 UI-improve kinds. ``diff`` carries a
unified-diff / patch payload (``{raw, reconstructed_ac, assumptions}``) so the
``directives/ui`` set can take an "improve this screen" PR-style input; ``file``
carries a path reference to an existing component/page (``{path,
reconstructed_ac, assumptions}``) for the same surface. Both default-route to
``ui-improve`` via :func:`work_engine.intent.populate_routing`.

Per the schema/capability split documented on
:data:`work_engine.directives.backend.SUPPORTED_KINDS`, presence here only
means the *envelope* is accepted on disk — a directive set still has to
list the kind in its ``SUPPORTED_KINDS`` tuple before the dispatcher will
route it. R2 widens the envelope; R2 Phase 3 widens backend's capability
tuple in lockstep with the ``refine-prompt`` skill landing. R3 Phase 1 widens
the envelope further; ``ui`` capability is wired in Phase 3 of the UI track.

Other kinds are rejected so unknown values surface as errors instead of
silently falling through to a default branch."""

KNOWN_DIRECTIVE_SETS: frozenset[str] = frozenset(
    {"backend", "ui", "ui-trivial", "mixed"},
)
"""Directive sets recognised by the schema.

Per the roadmap (Phase 4 Step 4), ``ui``, ``ui-trivial``, and ``mixed``
are intentionally pre-listed so a future R3 V2 release does not need a
schema bump. Only ``backend`` has working directives in R1; the others
raise ``NotImplementedError`` at dispatch time."""


class SchemaError(ValueError):
    """Raised when a state payload violates the v1 contract."""


@dataclass
class Input:
    """Typed envelope for the user-supplied work item.

    ``kind`` is one of :data:`KNOWN_INPUT_KINDS`; ``data`` is the raw
    payload. The legacy ``state.ticket`` dict lands here as
    ``Input(kind="ticket", data=<dict>)`` after migration.
    """

    kind: str
    data: dict[str, Any] = field(default_factory=dict)


@dataclass
class WorkState:
    """Schema v1 of the persisted work state.

    Field order mirrors the on-disk JSON: envelope (``version``,
    ``input``, ``intent``, ``directive_set``, ``stack``) first, then
    the legacy ``DeliveryState`` slice (``persona`` … ``report``) so a
    diff between a v1 file and its v0 ancestor stays readable.
    """

    input: Input
    intent: str = DEFAULT_INTENT
    directive_set: str = DEFAULT_DIRECTIVE_SET
    stack: dict[str, Any] | None = None
    ui_audit: dict[str, Any] | None = None
    ui_design: dict[str, Any] | None = None
    ui_review: dict[str, Any] | None = None
    ui_polish: dict[str, Any] | None = None
    contract: dict[str, Any] | None = None
    stitch: dict[str, Any] | None = None
    version: int = SCHEMA_VERSION
    persona: str = "senior-engineer"
    memory: list[dict[str, Any]] = field(default_factory=list)
    plan: Any = None
    changes: list[dict[str, Any]] = field(default_factory=list)
    tests: Any = None
    verify: Any = None
    outcomes: dict[str, str] = field(default_factory=dict)
    questions: list[str] = field(default_factory=list)
    report: str = ""


def to_dict(state: WorkState) -> dict[str, Any]:
    """Serialise ``state`` to the canonical v1 JSON shape.

    Field order is fixed: ``version`` → ``input`` → ``intent`` →
    ``directive_set`` → legacy slice. Stable order keeps state
    snapshots diff-friendly across re-runs and across the freeze-guard
    replay. Validation runs before serialisation so an in-memory
    object that was mutated past the schema cannot reach disk.
    """
    _validate_kind(state.input.kind)
    _validate_directive_set(state.directive_set)
    if state.version != SCHEMA_VERSION:
        raise SchemaError(
            f"version must be {SCHEMA_VERSION}; got {state.version!r}",
        )
    _validate_stack(state.stack)
    _validate_ui_audit(state.ui_audit)
    _validate_ui_design(state.ui_design)
    _validate_ui_review(state.ui_review)
    _validate_ui_polish(state.ui_polish)
    _validate_contract(state.contract)
    _validate_stitch(state.stitch)
    return {
        "version": state.version,
        "input": {"kind": state.input.kind, "data": state.input.data},
        "intent": state.intent,
        "directive_set": state.directive_set,
        "stack": state.stack,
        "ui_audit": state.ui_audit,
        "ui_design": state.ui_design,
        "ui_review": state.ui_review,
        "ui_polish": state.ui_polish,
        "contract": state.contract,
        "stitch": state.stitch,
        "persona": state.persona,
        "memory": state.memory,
        "plan": state.plan,
        "changes": state.changes,
        "tests": state.tests,
        "verify": state.verify,
        "outcomes": state.outcomes,
        "questions": state.questions,
        "report": state.report,
    }


def from_dict(payload: Any) -> WorkState:
    """Build a :class:`WorkState` from a parsed JSON payload.

    Validates the envelope (``version``, ``input.kind``,
    ``directive_set``) before instantiating the dataclass. Unknown
    top-level keys are tolerated and dropped — the schema is additive,
    not strict-rejecting, so a future field rolled out by a newer
    engine version does not crash an older reader.
    """
    if not isinstance(payload, dict):
        raise SchemaError(
            f"state payload must be a JSON object; got {type(payload).__name__}",
        )

    version = payload.get("version")
    if version != SCHEMA_VERSION:
        raise SchemaError(
            f"version must be {SCHEMA_VERSION}; got {version!r}. "
            "Run the v0→v1 migration before loading legacy files.",
        )

    raw_input = payload.get("input")
    if not isinstance(raw_input, dict):
        raise SchemaError(
            "state.input must be a JSON object with 'kind' and 'data' keys",
        )
    kind = raw_input.get("kind")
    _validate_kind(kind)
    data = raw_input.get("data", {})
    if not isinstance(data, dict):
        raise SchemaError(
            f"state.input.data must be a JSON object; got {type(data).__name__}",
        )

    directive_set = payload.get("directive_set", DEFAULT_DIRECTIVE_SET)
    _validate_directive_set(directive_set)

    stack = payload.get("stack")
    _validate_stack(stack)

    ui_audit = payload.get("ui_audit")
    _validate_ui_audit(ui_audit)

    ui_design = payload.get("ui_design")
    _validate_ui_design(ui_design)

    ui_review = payload.get("ui_review")
    _validate_ui_review(ui_review)

    ui_polish = payload.get("ui_polish")
    _validate_ui_polish(ui_polish)

    contract = payload.get("contract")
    _validate_contract(contract)

    stitch = payload.get("stitch")
    _validate_stitch(stitch)

    return WorkState(
        input=Input(kind=kind, data=data),
        intent=payload.get("intent", DEFAULT_INTENT),
        directive_set=directive_set,
        stack=dict(stack) if isinstance(stack, dict) else None,
        ui_audit=dict(ui_audit) if isinstance(ui_audit, dict) else None,
        ui_design=dict(ui_design) if isinstance(ui_design, dict) else None,
        ui_review=dict(ui_review) if isinstance(ui_review, dict) else None,
        ui_polish=dict(ui_polish) if isinstance(ui_polish, dict) else None,
        contract=dict(contract) if isinstance(contract, dict) else None,
        stitch=dict(stitch) if isinstance(stitch, dict) else None,
        version=version,
        persona=payload.get("persona", "senior-engineer"),
        memory=list(payload.get("memory", [])),
        plan=payload.get("plan"),
        changes=list(payload.get("changes", [])),
        tests=payload.get("tests"),
        verify=payload.get("verify"),
        outcomes=dict(payload.get("outcomes", {})),
        questions=list(payload.get("questions", [])),
        report=payload.get("report", ""),
    )


def load(path: Path) -> WorkState:
    """Read a v1 state file from disk and return a :class:`WorkState`."""
    raw = path.read_text(encoding="utf-8")
    try:
        payload = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise SchemaError(f"invalid JSON in {path}: {exc}") from exc
    return from_dict(payload)


def dump(state: WorkState, path: Path) -> None:
    """Write ``state`` to ``path`` as pretty JSON, terminating newline included."""
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(to_dict(state), indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )


def _validate_kind(kind: Any) -> None:
    if not isinstance(kind, str):
        raise SchemaError(
            f"state.input.kind must be a string; got {type(kind).__name__}",
        )
    if kind not in KNOWN_INPUT_KINDS:
        raise SchemaError(
            f"unknown input.kind {kind!r}; "
            f"expected one of {sorted(KNOWN_INPUT_KINDS)}",
        )


def _validate_directive_set(name: Any) -> None:
    if not isinstance(name, str):
        raise SchemaError(
            f"state.directive_set must be a string; got {type(name).__name__}",
        )
    if name not in KNOWN_DIRECTIVE_SETS:
        raise SchemaError(
            f"unknown directive_set {name!r}; "
            f"expected one of {sorted(KNOWN_DIRECTIVE_SETS)}",
        )


def _validate_stack(stack: Any) -> None:
    """Reject malformed stack envelopes; tolerate ``None`` (not yet detected).

    The detector populates ``state.stack`` lazily — the first dispatch
    of a new state file may run without it set, then the dispatcher
    fills it in before any UI handler reads it. We only validate the
    shape when present so the absence-of-detection case stays a normal
    code path, not an error.
    """
    if stack is None:
        return
    if not isinstance(stack, dict):
        raise SchemaError(
            f"state.stack must be a JSON object or null; "
            f"got {type(stack).__name__}",
        )
    frontend = stack.get("frontend")
    if not isinstance(frontend, str) or not frontend:
        raise SchemaError(
            "state.stack.frontend must be a non-empty string",
        )
    mtime = stack.get("mtime", 0.0)
    if not isinstance(mtime, (int, float)):
        raise SchemaError(
            f"state.stack.mtime must be a number; got {type(mtime).__name__}",
        )


def _validate_ui_audit(ui_audit: Any) -> None:
    """Reject malformed ``ui_audit`` envelopes; tolerate ``None`` and ``{}``.

    ``None`` means the audit has not run yet — the dispatcher's audit
    gate (``directives.ui.audit``) will emit the agent-directive that
    populates it. An empty dict is the in-progress shape after the
    skill returns but before findings land; the gate treats it the
    same as ``None``. Once populated, ``greenfield`` (when present)
    must be a bool, and ``greenfield_decision`` (when present) must
    be one of the three documented choices. Other keys (``components``,
    ``patterns``, …) are validated by the audit handler against the
    skill contract — the schema only enforces shape, not content.
    """
    if ui_audit is None:
        return
    if not isinstance(ui_audit, dict):
        raise SchemaError(
            f"state.ui_audit must be a JSON object or null; "
            f"got {type(ui_audit).__name__}",
        )
    if "greenfield" in ui_audit and not isinstance(
        ui_audit["greenfield"], bool,
    ):
        raise SchemaError(
            "state.ui_audit.greenfield must be a boolean when present",
        )
    decision = ui_audit.get("greenfield_decision")
    if decision is not None and decision not in {
        "scaffold",
        "bare",
        "external_reference",
    }:
        raise SchemaError(
            f"state.ui_audit.greenfield_decision must be one of "
            f"'scaffold', 'bare', 'external_reference', or null; "
            f"got {decision!r}",
        )
    if "a11y_baseline" in ui_audit and not isinstance(
        ui_audit["a11y_baseline"], list,
    ):
        raise SchemaError(
            "state.ui_audit.a11y_baseline must be a list when present",
        )


def _validate_ui_design(ui_design: Any) -> None:
    """Reject malformed ``ui_design`` envelopes; tolerate ``None`` and ``{}``.

    ``None`` means the design step has not produced a brief yet — the
    dispatcher's design gate (``directives.ui.design``) emits the
    agent-directive that populates it. An empty dict is the in-progress
    shape after the skill returns but before the brief lands; the gate
    treats it the same as ``None``. Once populated, ``design_confirmed``
    (when present) must be a bool. Other keys (``layout``, ``components``,
    ``states``, ``microcopy``, ``a11y``, ``reused_from_audit``) are
    validated by the design handler against the skill contract — the
    schema only enforces shape, not content.
    """
    if ui_design is None:
        return
    if not isinstance(ui_design, dict):
        raise SchemaError(
            f"state.ui_design must be a JSON object or null; "
            f"got {type(ui_design).__name__}",
        )
    if "design_confirmed" in ui_design and not isinstance(
        ui_design["design_confirmed"], bool,
    ):
        raise SchemaError(
            "state.ui_design.design_confirmed must be a boolean when present",
        )


def _validate_ui_review(ui_review: Any) -> None:
    """Reject malformed ``ui_review`` envelopes; tolerate ``None`` and ``{}``.

    ``None`` means the review pass has not run yet — the dispatcher's
    review gate (``directives.ui.review``) emits the agent-directive
    that populates it. An empty dict is the in-progress shape after
    the skill returns but before findings land. Once populated,
    ``findings`` (when present) must be a list and ``review_clean``
    (when present) must be a bool. Field content (severity labels,
    fix suggestions) is validated by the review handler; the schema
    enforces only shape.
    """
    if ui_review is None:
        return
    if not isinstance(ui_review, dict):
        raise SchemaError(
            f"state.ui_review must be a JSON object or null; "
            f"got {type(ui_review).__name__}",
        )
    if "findings" in ui_review and not isinstance(ui_review["findings"], list):
        raise SchemaError(
            "state.ui_review.findings must be a list when present",
        )
    if "review_clean" in ui_review and not isinstance(
        ui_review["review_clean"], bool,
    ):
        raise SchemaError(
            "state.ui_review.review_clean must be a boolean when present",
        )
    a11y = ui_review.get("a11y")
    if a11y is not None:
        if not isinstance(a11y, dict):
            raise SchemaError(
                "state.ui_review.a11y must be a JSON object or null when present",
            )
        if "violations" in a11y and not isinstance(a11y["violations"], list):
            raise SchemaError(
                "state.ui_review.a11y.violations must be a list when present",
            )
        floor = a11y.get("severity_floor")
        if floor is not None and floor not in {
            "minor",
            "moderate",
            "serious",
            "critical",
        }:
            raise SchemaError(
                f"state.ui_review.a11y.severity_floor must be one of "
                f"'minor', 'moderate', 'serious', 'critical', or null; "
                f"got {floor!r}",
            )
        if "accepted_violations" in a11y and not isinstance(
            a11y["accepted_violations"], list,
        ):
            raise SchemaError(
                "state.ui_review.a11y.accepted_violations must be a list when present",
            )
    preview = ui_review.get("preview")
    if preview is not None:
        if not isinstance(preview, dict):
            raise SchemaError(
                "state.ui_review.preview must be a JSON object or null when present",
            )
        if "render_ok" in preview and not isinstance(preview["render_ok"], bool):
            raise SchemaError(
                "state.ui_review.preview.render_ok must be a boolean when present",
            )


def _validate_ui_polish(ui_polish: Any) -> None:
    """Reject malformed ``ui_polish`` envelopes; tolerate ``None`` and ``{}``.

    ``None`` means the polish loop has not entered yet. Once
    populated, ``rounds`` (when present) must be an int in ``[0, 2]``
    by default — the polish-loop ceiling defined in
    ``agents/roadmaps/road-to-product-ui-track.md`` Phase 3 Step 5.
    R4 Phase 2 widens the upper bound to ``3`` when
    ``extension_used`` is ``True`` (one-shot a11y extension halt).
    ``applied`` (when present) must be a list. The polish handler
    enforces ceiling semantics; the schema enforces only shape.
    """
    if ui_polish is None:
        return
    if not isinstance(ui_polish, dict):
        raise SchemaError(
            f"state.ui_polish must be a JSON object or null; "
            f"got {type(ui_polish).__name__}",
        )
    if "extension_used" in ui_polish and not isinstance(
        ui_polish["extension_used"], bool,
    ):
        raise SchemaError(
            "state.ui_polish.extension_used must be a boolean when present",
        )
    extension_used = bool(ui_polish.get("extension_used", False))
    if "rounds" in ui_polish:
        rounds = ui_polish["rounds"]
        if not isinstance(rounds, int) or isinstance(rounds, bool):
            raise SchemaError(
                f"state.ui_polish.rounds must be an integer; got {type(rounds).__name__}",
            )
        max_rounds = 3 if extension_used else 2
        if rounds < 0 or rounds > max_rounds:
            raise SchemaError(
                f"state.ui_polish.rounds must be in [0, {max_rounds}]; "
                f"got {rounds} (extension_used={extension_used})",
            )
    if "applied" in ui_polish and not isinstance(ui_polish["applied"], list):
        raise SchemaError(
            "state.ui_polish.applied must be a list when present",
        )


def _validate_contract(contract: Any) -> None:
    """Reject malformed ``contract`` envelopes; tolerate ``None`` and ``{}``.

    ``None`` means the contract step has not run yet — the mixed
    ``contract`` directive (R3 Phase 4 Step 1) emits the
    agent-directive that populates it. Once populated,
    ``data_model`` and ``api_surface`` (when present) must be lists,
    and ``contract_confirmed`` (when present) must be a bool. Field
    content (entity names, endpoint shapes) is validated by the
    contract handler; the schema enforces only shape so the mixed UI
    step's sentinel check (``contract_confirmed is True``) stays a
    simple equality test.
    """
    if contract is None:
        return
    if not isinstance(contract, dict):
        raise SchemaError(
            f"state.contract must be a JSON object or null; "
            f"got {type(contract).__name__}",
        )
    if "data_model" in contract and not isinstance(contract["data_model"], list):
        raise SchemaError(
            "state.contract.data_model must be a list when present",
        )
    if "api_surface" in contract and not isinstance(contract["api_surface"], list):
        raise SchemaError(
            "state.contract.api_surface must be a list when present",
        )
    if "contract_confirmed" in contract and not isinstance(
        contract["contract_confirmed"], bool
    ):
        raise SchemaError(
            "state.contract.contract_confirmed must be a bool when present",
        )


def _validate_stitch(stitch: Any) -> None:
    """Reject malformed ``stitch`` envelopes; tolerate ``None`` and ``{}``.

    ``None`` means the integration-verification step has not run yet
    — the mixed ``stitch`` directive (R3 Phase 4 Step 3) emits the
    agent-directive that populates it. Once populated, ``scenarios``
    (when present) must be a list of integration smoke cases,
    ``verdict`` (when present) must be one of
    ``{"success", "blocked", "partial"}``, and
    ``integration_confirmed`` (when present) must be a bool. The
    stitch handler enforces verdict semantics; the schema enforces
    only shape.
    """
    if stitch is None:
        return
    if not isinstance(stitch, dict):
        raise SchemaError(
            f"state.stitch must be a JSON object or null; "
            f"got {type(stitch).__name__}",
        )
    if "scenarios" in stitch and not isinstance(stitch["scenarios"], list):
        raise SchemaError(
            "state.stitch.scenarios must be a list when present",
        )
    if "verdict" in stitch:
        verdict = stitch["verdict"]
        if verdict not in {"success", "blocked", "partial"}:
            raise SchemaError(
                f"state.stitch.verdict must be one of success/blocked/partial; "
                f"got {verdict!r}",
            )
    if "integration_confirmed" in stitch and not isinstance(
        stitch["integration_confirmed"], bool
    ):
        raise SchemaError(
            "state.stitch.integration_confirmed must be a bool when present",
        )


__all__ = [
    "DEFAULT_DIRECTIVE_SET",
    "DEFAULT_INTENT",
    "Input",
    "KNOWN_DIRECTIVE_SETS",
    "KNOWN_INPUT_KINDS",
    "SCHEMA_VERSION",
    "SchemaError",
    "WorkState",
    "dump",
    "from_dict",
    "load",
    "to_dict",
]
