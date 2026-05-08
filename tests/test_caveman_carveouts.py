"""Phase 8.4 / 8.4b carve-out preservation tests.

Validates the [`caveman-speak`](../.agent-src.uncompressed/rules/caveman-speak.md)
rule's enforcement contract: the snapshot \u2192 rewrite \u2192 validate \u2192
restore loop must reliably identify every protected region. This
test asserts the regex layer (the cheap layer) before any prose
rewrite runs.

Stdlib only. CI runner for `tests/golden/caveman/`.
"""
from __future__ import annotations

import json
import re
from pathlib import Path

import pytest

from tests.golden.caveman.fuzz_inputs import (
    CARVE_OUT_REGEX,
    generate_cases,
)

CAVEMAN_DIR = Path(__file__).parent / "golden" / "caveman"

LOCKED_FIXTURES = [
    "numbered-options.json",
    "iron-law-literal.json",
    "code-block.json",
    "error-marker.json",
]


def _matched_lines(text: str, pattern: str) -> list[str]:
    rx = re.compile(pattern)
    return [line for line in text.splitlines() if rx.match(line)]


@pytest.mark.parametrize("fixture_name", LOCKED_FIXTURES)
def test_carveout_regex_identifies_all_expected_lines(fixture_name: str) -> None:
    """Every line in `expected_preserved_lines` must match
    `carve_out_regex`, and no other line in `input` may match."""
    fixture = CAVEMAN_DIR / fixture_name
    assert fixture.exists(), f"missing carve-out fixture: {fixture}"
    data = json.loads(fixture.read_text(encoding="utf-8"))
    matched = _matched_lines(data["input"], data["carve_out_regex"])
    assert matched == data["expected_preserved_lines"], (
        f"{fixture_name}: regex did not isolate the protected region.\n"
        f"  matched: {matched}\n"
        f"  expected: {data['expected_preserved_lines']}"
    )


def test_fuzz_carveout_regex_preserves_every_block() -> None:
    """20 deterministic prose + carve-out combinations; the unified
    regex must catch every protected line in every case."""
    cases = generate_cases()
    rx = re.compile(CARVE_OUT_REGEX)
    failures: list[str] = []
    for case in cases:
        matched = [ln for ln in case.lines if rx.match(ln)]
        if matched != case.expected_preserved:
            failures.append(
                f"{case.name}: matched={matched} expected={case.expected_preserved}"
            )
    assert not failures, "fuzz carve-out drift:\n  - " + "\n  - ".join(failures)
