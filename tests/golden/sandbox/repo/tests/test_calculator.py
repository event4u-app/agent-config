"""Pytest suite for the sandbox calculator.

Tests for ``add`` and ``subtract`` ship pre-green so GT-1 (happy) can
run pytest and observe a clean verdict before the recipe-injected
edits land. ``test_power`` is intentionally green for the buggy stub
(positive base) so the failing case can be added by GT-3 itself.
"""
from __future__ import annotations

from src.calculator import add, power, subtract


def test_add_returns_sum() -> None:
    assert add(2, 3) == 5


def test_subtract_returns_difference() -> None:
    assert subtract(5, 3) == 2


def test_power_positive_base() -> None:
    assert power(2, 3) == 8
