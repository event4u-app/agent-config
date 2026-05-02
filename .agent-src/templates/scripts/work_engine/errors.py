"""CLI-layer error type used by the dispatcher entry point.

Lives in its own module so the helper modules (``state_io``,
``input_builders``, etc.) can raise it without depending on
``cli.py``, which would create an import cycle.

Behaviour is identical to the original ``cli._CLIError`` it replaced
in P2.3 of ``road-to-post-pr29-optimize.md`` — same name (private,
underscore-prefixed) and same role: convert to exit code ``2`` at the
``main()`` boundary.
"""
from __future__ import annotations


class _CLIError(Exception):
    """Raised on configuration or I/O problems. Converted to exit code 2."""


__all__ = ["_CLIError"]
