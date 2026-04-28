"""Recipe-driven capture runner for the Golden Transcript sandbox.

Plays the role of the orchestrator in the Option-A loop:

1. Spawn ``./agent-config implement-ticket`` (or ``./agent-config work``
   for prompt-driven scenarios) against a sandbox repo.
2. Read the resulting state JSON, stdout, exit code.
3. Hand the post-cycle state to a recipe step keyed by the directive
   (or by the halt code when the engine blocks without a directive).
4. Persist the mutated state and re-invoke the engine.
5. Stop when the engine exits ``0`` (SUCCESS), the recipe declares
   completion, or the cycle cap trips.

The runner never edits the engine state via private imports — all
mutation happens through the same JSON file the agent would write,
keeping the captured transcripts representative of production use.

Two input modes are supported:

- **ticket mode** (R1) — ``ticket_file`` is a JSON envelope passed via
  ``--ticket-file`` to ``implement-ticket``. State files round-trip in
  v0 wire format.
- **prompt mode** (R2 Phase 5) — ``prompt_file`` is a plain-text file
  passed via ``--prompt-file`` to ``work``. State files round-trip in
  v1 wire format.

The two are mutually exclusive per :func:`run_capture`. Recipes
declare which mode they want via their ``META`` dict
(``ticket_relpath`` vs ``prompt_relpath``).
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

CMD_TICKET = "implement-ticket"
CMD_WORK = "work"
"""Subcommand names exposed by ``./agent-config``. Ticket mode uses the
former, prompt mode the latter — see module docstring."""


@dataclass
class CycleRecord:
    """One ``./agent-config <subcommand>`` invocation."""

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
    """Aggregated transcript for a single Golden Transcript run.

    Exactly one of ``ticket_file`` and ``prompt_file`` is set per run;
    the other stays ``None``. ``subcommand`` records which CLI verb the
    runner invoked so transcripts and reproduction notes stay accurate.
    """

    gt_id: str
    ticket_file: Optional[Path]
    persona: Optional[str]
    workspace: Path
    prompt_file: Optional[Path] = None
    subcommand: str = CMD_TICKET
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
    prompt_file: Optional[Path] = None,
    subcommand: str = CMD_TICKET,
    persona: Optional[str] = None,
) -> tuple[int, str, str, dict[str, Any]]:
    """Run one engine cycle and return ``(exit, stdout, stderr, state)``.

    The state file is read after the process exits regardless of exit
    code — the engine writes it on success and on BLOCKED halts. On
    exit code 2 (config/IO error) it is *not* written; we surface an
    empty dict so the recipe can decide whether to abort.

    Exactly one of ``ticket_file`` / ``prompt_file`` must be non-``None``
    on the first cycle; on resume both stay ``None`` because the engine
    rebuilds its envelope from the persisted state file. ``subcommand``
    selects ``implement-ticket`` (ticket mode) or ``work`` (prompt mode);
    both subcommands route through the same engine but the user-facing
    verb stays accurate in the transcript.
    """
    cmd: list[str] = [str(AGENT_CONFIG), subcommand,
                      "--state-file", str(state_file)]
    if ticket_file is not None:
        cmd += ["--ticket-file", str(ticket_file)]
    if prompt_file is not None:
        cmd += ["--prompt-file", str(prompt_file)]
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
    workspace: Path,
    recipe: dict[str, RecipeStep],
    ticket_file: Optional[Path] = None,
    prompt_file: Optional[Path] = None,
    persona: Optional[str] = None,
    cycle_cap: int = DEFAULT_CYCLE_CAP,
    state_filename: str = ".implement-ticket-state.json",
) -> CaptureResult:
    """Drive a Golden Transcript end-to-end and return the transcript.

    Exactly one of ``ticket_file`` / ``prompt_file`` must be supplied —
    they pick the subcommand (``implement-ticket`` vs ``work``) and the
    initial input flag. ``recipe`` keys are directive verbs
    (``create-plan``, ``apply-plan``, ``run-tests``, ``review-changes``,
    plus ``refine-prompt`` in prompt mode) and the sentinel
    ``"_no_directive"`` for halts without an agent-addressed line
    (refine ambiguity, UI-intent rejection, bad-verdict halts). Each
    step receives the post-cycle state and the ``CycleRecord`` and must
    return the state to persist before the next invocation.
    """
    if (ticket_file is None) == (prompt_file is None):
        raise ValueError(
            "run_capture requires exactly one of ticket_file / prompt_file; "
            f"got ticket_file={ticket_file!r}, prompt_file={prompt_file!r}",
        )
    subcommand = CMD_TICKET if ticket_file is not None else CMD_WORK
    prepare_workspace(workspace)
    state_file = workspace / state_filename
    result = CaptureResult(
        gt_id=gt_id,
        ticket_file=ticket_file,
        prompt_file=prompt_file,
        subcommand=subcommand,
        persona=persona,
        workspace=workspace,
    )

    for cycle_index in range(1, cycle_cap + 1):
        ticket_arg = ticket_file if cycle_index == 1 else None
        prompt_arg = prompt_file if cycle_index == 1 else None
        persona_arg = persona if cycle_index == 1 else None
        exit_code, stdout, stderr, state = invoke_engine(
            workspace,
            state_file=state_file,
            ticket_file=ticket_arg,
            prompt_file=prompt_arg,
            subcommand=subcommand,
            persona=persona_arg,
        )
        directive = detect_directive(state) if state else None
        record = CycleRecord(
            index=cycle_index,
            cmd=_relative_cmd(
                workspace,
                subcommand=subcommand,
                ticket=ticket_arg,
                prompt=prompt_arg,
                persona=persona_arg,
                state_file=state_file,
            ),
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
    *,
    subcommand: str = CMD_TICKET,
    ticket: Optional[Path] = None,
    prompt: Optional[Path] = None,
    persona: Optional[str] = None,
    state_file: Path,
) -> list[str]:
    """Produce a workspace-relative cmd list for stable transcripts."""
    cmd = ["./agent-config", subcommand,
           "--state-file", _rel(workspace, state_file)]
    if ticket is not None:
        cmd += ["--ticket-file", _rel(workspace, ticket)]
    if prompt is not None:
        cmd += ["--prompt-file", _rel(workspace, prompt)]
    if persona is not None:
        cmd += ["--persona", persona]
    return cmd


def _rel(base: Path, target: Path) -> str:
    """Render ``target`` relative to ``base`` for transcript stability.

    Falls back to a ``SANDBOX_ROOT``-relative path when ``target`` lives
    outside the per-run workspace (e.g. shared ticket fixtures under
    ``tests/golden/sandbox/tickets/``). The absolute fallback is kept as
    a last resort but produces machine-specific transcripts and must
    never be triggered by paths under this repo.
    """
    try:
        return str(target.relative_to(base))
    except ValueError:
        pass
    try:
        return str(target.relative_to(SANDBOX_ROOT))
    except ValueError:
        return str(target)


def serialise_capture(result: CaptureResult) -> dict[str, Any]:
    """Produce the JSON-safe transcript payload for a Capture Pack.

    Backwards-compatible field set:

    - **Ticket mode** (R1) emits the original shape — ``gt_id``,
      ``ticket_file``, ``persona``, ``final_outcome``, ``final_exit_code``,
      ``cycles``. No ``subcommand`` / ``prompt_file`` keys, so the
      GT-1..GT-5 baselines stay byte-equal under the Phase 5 iron law.
    - **Prompt mode** (R2 P5) replaces ``ticket_file`` with
      ``prompt_file`` and adds ``subcommand: "work"`` so the captured
      transcript is unambiguous about how the run was invoked.
    """
    payload: dict[str, Any] = {"gt_id": result.gt_id}
    if result.prompt_file is not None:
        payload["subcommand"] = result.subcommand
        payload["prompt_file"] = _rel_fixture(result.prompt_file)
    else:
        payload["ticket_file"] = _rel_fixture(result.ticket_file)
    payload["persona"] = result.persona
    payload["final_outcome"] = result.final_outcome
    payload["final_exit_code"] = result.final_exit_code
    payload["cycles"] = [_cycle_to_dict(c) for c in result.cycles]
    return payload


def _rel_fixture(path: Optional[Path]) -> Optional[str]:
    """Render ``path`` relative to ``SANDBOX_ROOT`` for transcript stability."""
    if path is None:
        return None
    if path.is_relative_to(SANDBOX_ROOT):
        return str(path.relative_to(SANDBOX_ROOT))
    return str(path)


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
