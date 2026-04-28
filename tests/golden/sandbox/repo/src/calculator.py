"""Toy calculator — fixture for the golden-capture sandbox.

Intentionally tiny. Each Golden Transcript scenario adds (or fails to
add) one operation. The shape is locked: integer arithmetic only, no
I/O, no dependencies — keeping every transcript deterministic.

The ``power`` function ships with a known sign-handling bug so GT-3
(test-failure-recovery) has a deterministic failure to exercise. The
fix recipe lives in ``../recipes/gt-3-recovery.md``.
"""
from __future__ import annotations


def add(a: int, b: int) -> int:
    return a + b


def subtract(a: int, b: int) -> int:
    return a - b


def power(a: int, b: int) -> int:
    """Buggy stub — see ``recipes/gt-3-recovery.md`` for the fix."""
    return abs(a) ** b
