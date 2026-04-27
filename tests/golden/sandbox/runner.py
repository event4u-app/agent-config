"""Recipe-driven capture runner for the Golden Transcript sandbox.

Plays the role of the orchestrator in the Option-A loop:

1. Spawn ``./agent-config implement-ticket`` against a sandbox repo.
2. Read the resulting state JSON, stdout, exit code.
3. Hand the post-cycle state to a recipe step keyed by the directive
   (or by the halt code when the engine blocks without a directive).
4. Persist the mutated state and re-invoke the engine.
5. Stop when the engine exits ``0`` (SUCCESS), the recipe declares
   completion, or the cycle cap trips.

The runner never edits the engine state via private imports — all
mutation happens through the same JSON file the agent would write,
keeping the captured transcripts representative of production use.
"""
from __future__ import annotations

import dataclasses
import json
import os
import shutil
import subprocess
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Callable, Optional

REPO_ROOT = Path(__file__).resolve().parents[3]
"""Maintainer repo root — where ``./agent-config`` lives."""

SANDBOX_ROOT = Path(__file__).resolve().parent
"""``tests/golden/sandbox`` — sibling of this file."""

REPO_FIXTURE = SANDBOX_ROOT / "repo"
"""Pristine toy-domain template; copied into a workspace per run."""

AGENT_CONFIG = REPO_ROOT / "agent-config"
"""Maintainer-facing CLI entry point used by the captures."""

DEFAULT_CYCLE_CAP = 10
"""Hard cap on cycles per scenario — guards against runaway recipes."""


@dataclass
class CycleRecord:
    """One ``./agent-config implement-ticket`` invocation."""

    index: int
    cmd: list[str]
    exit_code: int
    stdout: str
    stderr: str
    state_after: dict[str, Any]
    directive: Optional[str] = None
    recipe_action: Optional[str] = None
    recipe_notes: list[str] = field(default_factory=list)


@dataclass
class CaptureResult:
    """Aggregated transcript for a single Golden Transcript run."""

    gt_id: str
    ticket_file: Path
    persona: Optional[str]
    workspace: Path
    cycles: list[CycleRecord] = field(default_factory=list)
    final_outcome: str = "unknown"
    final_exit_code: int = -1


RecipeStep = Callable[[dict[str, Any], CycleRecord], dict[str, Any]]
"""Recipe contract: take post-cycle state + record, return mutated state."""


def prepare_workspace(target: Path) -> None:
    """Materialise a fresh copy of the toy repo into ``target``.

    Each capture runs against a clean workspace so the engine never
    inherits artefacts from a previous scenario. ``shutil.copytree``
    follows the fixture's directory shape exactly — the runner does
    not invent files the production engine would not see.
    """
    if target.exists():
        shutil.rmtree(target)
    shutil.copytree(REPO_FIXTURE, target)


def invoke_engine(
    workspace: Path,
    *,
    state_file: Path,
    ticket_file: Optional[Path] = None,
    persona: Optional[str] = None,
) -> tuple[int, str, str, dict[str, Any]]:
    """Run one engine cycle and return ``(exit, stdout, stderr, state)``.

    The state file is read after the process exits regardless of exit
    code — the engine writes it on success and on BLOCKED halts. On
    exit code 2 (config/IO error) it is *not* written; we surface an
    empty dict so the recipe can decide whether to abort.
    """
    cmd: list[str] = [str(AGENT_CONFIG), "implement-ticket",
                      "--state-file", str(state_file)]
    if ticket_file is not None:
        cmd += ["--ticket-file", str(ticket_file)]
    if persona is not None:
        cmd += ["--persona", persona]

    env = os.environ.copy()
    # Keep stdout deterministic across machines: strip user locale,
    # force UTF-8, disable Python hash randomisation.
    env.update({
        "PYTHONIOENCODING": "utf-8",
        "PYTHONHASHSEED": "0",
        "LC_ALL": "C.UTF-8",
        "LANG": "C.UTF-8",
        "NO_COLOR": "1",
    })
    proc = subprocess.run(
        cmd,
        cwd=str(workspace),
        env=env,
        capture_output=True,
        text=True,
        check=False,
    )
    state: dict[str, Any] = {}
    if state_file.exists():
        try:
            state = json.loads(state_file.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            state = {}
    return proc.returncode, proc.stdout, proc.stderr, state


def detect_directive(state: dict[str, Any]) -> Optional[str]:
    """Return the directive verb when the engine halted with one.

    A directive line is the first entry of ``state.questions`` and
    starts with ``@agent-directive:``. The verb (``create-plan``,
    ``apply-plan``, ``run-tests``, ``review-changes``) drives recipe
    routing.
    """
    questions = state.get("questions") or []
    if not questions:
        return None
    first = questions[0]
    if not isinstance(first, str):
        return None
    marker = "@agent-directive:"
    if marker not in first:
        return None
    after = first.split(marker, 1)[1].strip()
    if not after:
        return None
    return after.split()[0]


def write_state(state_file: Path, state: dict[str, Any]) -> None:
    """Persist ``state`` exactly the way the engine itself does.

    Indented JSON, UTF-8, trailing newline — ``cli.py::_save`` writes
    the same shape. Matching it byte-for-byte means the locked
    transcripts diff cleanly against future engine runs.
    """
    state_file.parent.mkdir(parents=True, exist_ok=True)
    state_file.write_text(
        json.dumps(state, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )


def run_capture(
    *,
    gt_id: str,
    ticket_file: Path,
    workspace: Path,
    recipe: dict[str, RecipeStep],
    persona: Optional[str] = None,
    cycle_cap: int = DEFAULT_CYCLE_CAP,
    state_filename: str = ".implement-ticket-state.json",
) -> CaptureResult:
    """Drive a Golden Transcript end-to-end and return the transcript.

    ``recipe`` keys are directive verbs (``create-plan``,
    ``apply-plan``, ``run-tests``, ``review-changes``) plus the
    sentinel ``"_no_directive"`` for halts without an agent-addressed
    line (refine ambiguity, bad-verdict halts). Each step receives
    the post-cycle state and the ``CycleRecord`` and must return the
    state to persist before the next invocation.
    """
    prepare_workspace(workspace)
    state_file = workspace / state_filename
    result = CaptureResult(
        gt_id=gt_id,
        ticket_file=ticket_file,
        persona=persona,
        workspace=workspace,
    )

    for cycle_index in range(1, cycle_cap + 1):
        ticket_arg = ticket_file if cycle_index == 1 else None
        persona_arg = persona if cycle_index == 1 else None
        exit_code, stdout, stderr, state = invoke_engine(
            workspace,
            state_file=state_file,
            ticket_file=ticket_arg,
            persona=persona_arg,
        )
        directive = detect_directive(state) if state else None
        record = CycleRecord(
            index=cycle_index,
            cmd=_relative_cmd(workspace, ticket_arg, persona_arg, state_file),
            exit_code=exit_code,
            stdout=stdout,
            stderr=stderr,
            state_after=state,
            directive=directive,
        )
        result.cycles.append(record)

        if exit_code == 0:
            result.final_outcome = "success"
            result.final_exit_code = 0
            return result
        if exit_code == 2:
            result.final_outcome = "config_error"
            result.final_exit_code = 2
            return result

        # Engine blocked. Resolve via the matching recipe step.
        key = directive or "_no_directive"
        step = recipe.get(key)
        if step is None:
            result.final_outcome = f"halt_unhandled:{key}"
            result.final_exit_code = exit_code
            return result
        record.recipe_action = key
        new_state = step(state, record)
        write_state(state_file, new_state)

    result.final_outcome = "cycle_cap_reached"
    result.final_exit_code = result.cycles[-1].exit_code
    return result


def _relative_cmd(
    workspace: Path,
    ticket: Optional[Path],
    persona: Optional[str],
    state_file: Path,
) -> list[str]:
    """Produce a workspace-relative cmd list for stable transcripts."""
    cmd = ["./agent-config", "implement-ticket",
           "--state-file", _rel(workspace, state_file)]
    if ticket is not None:
        cmd += ["--ticket-file", _rel(workspace, ticket)]
    if persona is not None:
        cmd += ["--persona", persona]
    return cmd


def _rel(base: Path, target: Path) -> str:
    try:
        return str(target.relative_to(base))
    except ValueError:
        return str(target)


def serialise_capture(result: CaptureResult) -> dict[str, Any]:
    """Produce the JSON-safe transcript payload for a Capture Pack."""
    return {
        "gt_id": result.gt_id,
        "ticket_file": str(result.ticket_file.relative_to(SANDBOX_ROOT))
        if result.ticket_file.is_relative_to(SANDBOX_ROOT)
        else str(result.ticket_file),
        "persona": result.persona,
        "final_outcome": result.final_outcome,
        "final_exit_code": result.final_exit_code,
        "cycles": [_cycle_to_dict(c) for c in result.cycles],
    }


def _cycle_to_dict(cycle: CycleRecord) -> dict[str, Any]:
    payload = dataclasses.asdict(cycle)
    return payload


__all__ = [
    "AGENT_CONFIG",
    "CaptureResult",
    "CycleRecord",
    "DEFAULT_CYCLE_CAP",
    "REPO_FIXTURE",
    "REPO_ROOT",
    "RecipeStep",
    "SANDBOX_ROOT",
    "detect_directive",
    "invoke_engine",
    "prepare_workspace",
    "run_capture",
    "serialise_capture",
    "write_state",
]
