"""Deprecated CLI entry point — delegates to :mod:`work_engine`.

``python3 -m implement_ticket`` still works because the Golden-Transcript
freeze-guard pins that invocation. Internally it forwards to
``work_engine.cli.main`` after emitting a ``DeprecationWarning`` from
the package ``__init__``.
"""
from __future__ import annotations

import sys

from work_engine.cli import main

if __name__ == "__main__":
    sys.exit(main())
