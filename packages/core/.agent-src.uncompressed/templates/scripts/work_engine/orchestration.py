"""State machine stub for the ``/orchestrate`` command.

Reads a pipeline file conforming to
``docs/contracts/orchestration-dsl-v1.md`` and produces an ordered
sequence of step descriptors the agent dispatches one at a time.
The runtime itself is **not** in Python — each step is executed by the
agent via skill / command / persona / subagent dispatch. This module
holds the deterministic bookkeeping:

- load + interpolate
- step iteration with success / failure / when-guard tracking
- output-map resolution at the end

Design constraints (R1 carve-outs from
``road-to-distribution-and-adoption.md``):

- No external dependencies. YAML loading reuses the dispatcher's
  loader so the runtime sees what the linter sees.
- No side effects. The state machine never edits files, runs commands,
  or emits hooks of its own. Audit emission is the caller's job.
- Forward-ref free. ``steps[].with`` references can only reach
  earlier steps; this is enforced both by the linter and at runtime.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Iterator

_INTERP_RE = re.compile(
    r"\$\{\{\s*(inputs|steps)\.([a-z0-9_-]+)(?:\.output)?\s*\}\}"
)


@dataclass
class StepResult:
    """One step's record after dispatch."""
    step_id: str
    kind: str
    ref: str
    success: bool = False
    output: str = ""
    error: str | None = None


@dataclass
class PipelineState:
    """Bookkeeping for a single ``/orchestrate`` run."""
    name: str
    inputs: dict[str, str]
    results: dict[str, StepResult] = field(default_factory=dict)
    halted: bool = False
    halt_reason: str | None = None


def _load_pipeline(path: Path) -> dict[str, Any]:
    """Reuse the linter's loader so the runtime accepts the same shape.

    Walks parents to find ``scripts/hooks/dispatch_hook.py`` so the
    loader is reachable both when this module runs from the consumer
    projection (``.agent-src/templates/scripts/work_engine/``) and
    from the source-of-truth tree
    (``packages/<pack>/.agent-src.uncompressed/templates/scripts/work_engine/``).
    Loaded via ``importlib.util`` by file path to avoid namespace
    collisions with test packages named ``hooks``.
    """
    import importlib.util
    here = Path(__file__).resolve()
    candidate: Path | None = None
    for parent in here.parents:
        probe = parent / "scripts" / "hooks" / "dispatch_hook.py"
        if probe.is_file():
            candidate = probe
            break
    if candidate is None:
        raise RuntimeError(
            "could not locate scripts/hooks/dispatch_hook.py from "
            f"{here}"
        )
    spec = importlib.util.spec_from_file_location(
        "_work_engine_dispatch_hook", candidate
    )
    if spec is None or spec.loader is None:
        raise RuntimeError(f"cannot load spec for {candidate}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    doc = module._load_yaml(path)
    if not isinstance(doc, dict):
        raise ValueError(f"{path}: top-level must be a mapping")
    return doc


def _interpolate(value: Any, state: PipelineState) -> Any:
    """Substitute ``${{ inputs.X }}`` / ``${{ steps.Y.output }}`` in a
    nested value. Unknown references raise — the linter should have
    caught them, but the runtime double-checks."""
    if isinstance(value, str):
        def replace(match: re.Match[str]) -> str:
            ns, ident = match.group(1), match.group(2)
            if ns == "inputs":
                if ident not in state.inputs:
                    raise KeyError(f"unknown input '{ident}'")
                return state.inputs[ident]
            if ident not in state.results:
                raise KeyError(f"unknown step '{ident}'")
            return state.results[ident].output
        return _INTERP_RE.sub(replace, value)
    if isinstance(value, dict):
        return {k: _interpolate(v, state) for k, v in value.items()}
    if isinstance(value, list):
        return [_interpolate(v, state) for v in value]
    return value


def _when_passes(when: str | None, state: PipelineState) -> bool:
    """Evaluate the limited ``when`` mini-language. Supports
    ``steps.X.success`` / ``steps.X.failure`` and equality on a
    single ``${{ steps.X.output }}`` template against a literal."""
    if not when:
        return True
    when = when.strip()
    m = re.fullmatch(r"steps\.([a-z0-9_-]+)\.(success|failure)", when)
    if m:
        sid, kind = m.group(1), m.group(2)
        if sid not in state.results:
            return False
        return state.results[sid].success if kind == "success" else not state.results[sid].success
    m = re.fullmatch(r'\$\{\{\s*steps\.([a-z0-9_-]+)\.output\s*\}\}\s*==\s*"([^"]*)"', when)
    if m:
        sid, literal = m.group(1), m.group(2)
        return state.results.get(sid, StepResult(sid, "", "")).output == literal
    raise ValueError(f"unsupported when expression: {when!r}")


def iter_steps(path: Path, inputs: dict[str, str]) -> Iterator[dict[str, Any]]:
    """Yield interpolated step descriptors in order.

    Caller dispatches each descriptor via skill / command / persona /
    subagent and feeds the result back via :func:`record_result`.
    """
    doc = _load_pipeline(path)
    merged_inputs = {
        inp["id"]: inputs.get(inp["id"], inp.get("default", ""))
        for inp in (doc.get("inputs") or [])
        if isinstance(inp, dict) and isinstance(inp.get("id"), str)
    }
    state = PipelineState(name=doc.get("name", ""), inputs=merged_inputs)
    for step in doc.get("steps") or []:
        if state.halted:
            break
        if not _when_passes(step.get("when"), state):
            continue
        yield {
            "id": step["id"],
            "kind": step["kind"],
            "ref": step["ref"],
            "with": _interpolate(step.get("with") or {}, state),
            "_state": state,
        }


def record_result(descriptor: dict[str, Any], *, success: bool, output: str = "", error: str | None = None) -> None:
    """Caller hands the descriptor + outcome back so subsequent steps
    can see ``${{ steps.<id>.output }}``."""
    state: PipelineState = descriptor["_state"]
    state.results[descriptor["id"]] = StepResult(
        step_id=descriptor["id"], kind=descriptor["kind"], ref=descriptor["ref"],
        success=success, output=output, error=error,
    )
    if not success:
        state.halted = True
        state.halt_reason = f"step {descriptor['id']} failed"


def resolve_outputs(path: Path, state: PipelineState) -> dict[str, str]:
    """Resolve the pipeline's ``outputs:`` map against the captured
    step outputs. Returns an empty map if the pipeline declares no
    outputs."""
    doc = _load_pipeline(path)
    raw = doc.get("outputs") or {}
    return {k: _interpolate(v, state) for k, v in raw.items()}
