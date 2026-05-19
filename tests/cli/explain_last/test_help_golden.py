"""Help-text snapshot for ``agent-config explain last`` (Phase 4 #4).

The CLI surface is part of the public contract — any drift in argparse
flags, exit-code documentation, or the why-slot rundown is caught here
before it lands on a user's terminal. The golden file lives next to
this test under ``__fixtures__/help.txt``; regenerate with::

    python3 -m scripts._cli.cmd_explain last --help \
        > tests/cli/explain_last/__fixtures__/help.txt

That command must stay the source of truth — keep it green on purpose.
"""
from __future__ import annotations

import subprocess
import sys
from pathlib import Path

FIXTURE = Path(__file__).parent / "__fixtures__" / "help.txt"
REPO_ROOT = Path(__file__).resolve().parents[2].parent


def _run_help() -> str:
    proc = subprocess.run(
        [sys.executable, "-m", "scripts._cli.cmd_explain", "last", "--help"],
        cwd=REPO_ROOT,
        capture_output=True,
        text=True,
        check=True,
    )
    return proc.stdout


def test_last_help_matches_golden() -> None:
    expected = FIXTURE.read_text(encoding="utf-8")
    actual = _run_help()
    assert actual == expected, (
        "explain last --help drifted from "
        "tests/cli/explain_last/__fixtures__/help.txt — regenerate with:\n"
        "  python3 -m scripts._cli.cmd_explain last --help "
        "> tests/cli/explain_last/__fixtures__/help.txt"
    )


def test_last_help_documents_exit_codes() -> None:
    # Surface check: exit-code block must be present so users do not
    # have to read source to script around the CLI.
    text = FIXTURE.read_text(encoding="utf-8")
    assert "exit codes:" in text
    assert "0  trace rendered" in text
    assert "1  no recent run" in text
    assert "2  invocation error" in text


def test_last_help_documents_no_network_promise() -> None:
    text = FIXTURE.read_text(encoding="utf-8")
    assert "never" in text.lower() and "network" in text.lower()
