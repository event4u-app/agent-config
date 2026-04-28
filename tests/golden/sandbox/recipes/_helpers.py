"""Shared mutation helpers used by all five Golden Transcript recipes.

The helpers are deliberately small and side-effect-explicit: each
edits a single file under ``workspace/`` or runs a single pytest
invocation. Recipes compose them; nothing here invents behaviour.
"""
from __future__ import annotations

import os
import re
import subprocess
from pathlib import Path
from typing import Any

_PYTEST_DURATION_RE = re.compile(r"\bin \d+\.\d+s\b")
"""Pytest emits ``in 0.00s`` / ``in 0.42s`` on the verdict line. The
exact wallclock is non-deterministic across machines (a fast CI may
print ``0.00s`` where a contended laptop prints ``0.01s``), so it is
scrubbed to ``in <DURATION>s`` before being persisted into state. See
``_summarise``."""


def append_to_file(workspace: Path, relpath: str, text: str) -> None:
    """Append ``text`` to ``workspace/relpath`` (newline-terminated)."""
    target = workspace / relpath
    target.parent.mkdir(parents=True, exist_ok=True)
    existing = target.read_text(encoding="utf-8") if target.exists() else ""
    if existing and not existing.endswith("\n"):
        existing += "\n"
    target.write_text(existing + text.rstrip() + "\n", encoding="utf-8")


def replace_in_file(
    workspace: Path,
    relpath: str,
    old: str,
    new: str,
) -> None:
    """Replace the unique occurrence of ``old`` with ``new``.

    Raises ``ValueError`` when ``old`` is missing or appears more than
    once — the recipes must stay deterministic, so silent partial
    replacements are not acceptable.
    """
    target = workspace / relpath
    body = target.read_text(encoding="utf-8")
    count = body.count(old)
    if count != 1:
        raise ValueError(
            f"replace_in_file: expected exactly 1 occurrence of "
            f"{old!r} in {relpath}, found {count}",
        )
    target.write_text(body.replace(old, new, 1), encoding="utf-8")


def run_pytest(workspace: Path, *extra: str) -> dict[str, Any]:
    """Run ``pytest`` inside ``workspace`` and return a state.tests dict.

    The verdict mapping follows the engine contract:

    - exit ``0``                 → ``success``
    - exit ``1`` (failures)      → ``failed``
    - exit ``2`` (collect error) → ``failed``
    - any other code             → ``mixed``

    ``stdout`` / ``stderr`` are stored under ``targeted`` so the
    transcript records what the agent saw without inflating the
    state file with the full pytest dump.
    """
    env = os.environ.copy()
    env.update({
        "PYTHONIOENCODING": "utf-8",
        "PYTHONHASHSEED": "0",
        "LC_ALL": "C.UTF-8",
        "LANG": "C.UTF-8",
        "NO_COLOR": "1",
        "PYTHONDONTWRITEBYTECODE": "1",
    })
    cmd = ["python3", "-m", "pytest", *extra]
    proc = subprocess.run(
        cmd,
        cwd=str(workspace),
        env=env,
        capture_output=True,
        text=True,
        check=False,
    )
    if proc.returncode == 0:
        verdict = "success"
    elif proc.returncode in (1, 2):
        verdict = "failed"
    else:
        verdict = "mixed"
    return {
        "verdict": verdict,
        "scope": "targeted",
        "exit_code": proc.returncode,
        "targeted": _summarise(proc.stdout),
    }


def _summarise(stdout: str) -> str:
    """Return the last non-empty line of pytest stdout, with timing scrubbed.

    The literal pytest duration (``in 0.00s``, ``in 0.42s``) is the
    only non-deterministic field in the verdict line — every other
    token (``passed``, ``failed``, the equals-sign banner) is a
    function of the test outcome, which the recipes hold fixed. The
    duration is replaced with ``in <DURATION>s`` so Golden Transcripts
    stay byte-equal across machines.
    """
    for line in reversed(stdout.splitlines()):
        if line.strip():
            return _PYTEST_DURATION_RE.sub("in <DURATION>s", line.strip())
    return ""


def simulated_review_verdict() -> dict[str, Any]:
    """Stable ``state.verify`` payload used by every happy-path recipe.

    The sandbox does not run the four judges. Recipes record the
    verdict the orchestrator would have produced after a clean
    review, mirroring the contract in ``verify.py``.
    """
    return {
        "verdict": "success",
        "confidence": "high",
        "judges": ["bug-hunter", "security", "test-coverage", "code-quality"],
        "findings": [],
    }


def base_changes(*paths: str) -> list[dict[str, Any]]:
    """Render a minimal ``state.changes`` list for the given files."""
    return [{"path": p, "purpose": "applied by GT recipe"} for p in paths]


def standard_plan(title: str, *steps: str) -> list[dict[str, Any]]:
    """Render a ``state.plan`` shape accepted by ``plan.py``."""
    return [
        {"title": title, "detail": step}
        for step in steps
    ]


def write_prompt_refinement(
    state: dict[str, Any],
    *,
    reconstructed_ac: list[str],
    assumptions: list[str],
) -> dict[str, Any]:
    """Persist the ``refine-prompt`` skill's output back into v1 state.

    The deterministic gate in :mod:`work_engine.directives.backend.refine`
    reads ``state.input.data["reconstructed_ac"]`` and ``["assumptions"]``
    on the rebound after the ``refine-prompt`` directive halts. Recipes
    use this helper to mirror what the agent would write — a single
    well-named seam keeps the prompt-mode recipes from drifting on the
    state shape.
    """
    data = state.setdefault("input", {}).setdefault("data", {})
    data["reconstructed_ac"] = list(reconstructed_ac)
    data["assumptions"] = list(assumptions)
    return state


__all__ = [
    "append_to_file",
    "base_changes",
    "replace_in_file",
    "run_pytest",
    "simulated_review_verdict",
    "standard_plan",
    "write_prompt_refinement",
]
