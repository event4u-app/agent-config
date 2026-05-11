"""Parity guard for the work_engine template copy of ``agent_settings``.

Road-to-portable-dev-preferences P3 mirrors ``scripts/_lib/agent_settings.
py`` into ``.agent-src.uncompressed/templates/scripts/work_engine/_lib/
agent_settings.py`` so the loader ships with consumer-deployed bundles
without depending on the host package's ``scripts/_lib/`` layout.

This test fails on the next byte of drift between the two files. If you
intend to change one, regenerate the other:

    cp scripts/_lib/agent_settings.py \\
       .agent-src.uncompressed/templates/scripts/work_engine/_lib/agent_settings.py

Add a comment to the change to flag the new whitelist / behavior in the
roadmap so consumers know what cascaded.
"""
from __future__ import annotations

from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent

SOURCE = REPO_ROOT / "scripts" / "_lib" / "agent_settings.py"
TEMPLATE = (
    REPO_ROOT
    / ".agent-src.uncompressed"
    / "templates"
    / "scripts"
    / "work_engine"
    / "_lib"
    / "agent_settings.py"
)


def test_template_copy_is_byte_identical_to_source() -> None:
    assert SOURCE.is_file(), f"missing source loader at {SOURCE}"
    assert TEMPLATE.is_file(), f"missing template loader at {TEMPLATE}"
    assert SOURCE.read_bytes() == TEMPLATE.read_bytes(), (
        "scripts/_lib/agent_settings.py and the work_engine template copy "
        "have drifted. Re-mirror the file (see module docstring)."
    )
