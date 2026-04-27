"""Shared mutation helpers used by all five Golden Transcript recipes.

The helpers are deliberately small and side-effect-explicit: each
edits a single file under ``workspace/`` or runs a single pytest
invocation. Recipes compose them; nothing here invents behaviour.
"""
from __future__ import annotations

import os
import subprocess
from pathlib import Path
from typing import Any


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
    """Return the last non-empty line of pytest stdout (the verdict line)."""
    for line in reversed(stdout.splitlines()):
        if line.strip():
            return line.strip()
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


__all__ = [
    "append_to_file",
    "base_changes",
    "replace_in_file",
    "run_pytest",
    "simulated_review_verdict",
    "standard_plan",
]
