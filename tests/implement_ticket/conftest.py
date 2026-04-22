"""Test-time path wiring for the ``implement_ticket`` template package.

The production code lives under
``.agent-src.uncompressed/templates/scripts/implement_ticket/`` so the
installer can ship it into consumer projects. We add that directory to
``sys.path`` here (rather than creating an editable install) to match
the convention used by the other script-package tests in this repo
(see ``tests/test_skill_trigger_eval.py`` and friends).
"""
from __future__ import annotations

import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
TEMPLATE_SCRIPTS = REPO_ROOT / ".agent-src.uncompressed" / "templates" / "scripts"

if str(TEMPLATE_SCRIPTS) not in sys.path:
    sys.path.insert(0, str(TEMPLATE_SCRIPTS))
