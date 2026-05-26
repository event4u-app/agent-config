"""Phase 8.4b fuzz fixture for telegraph carve-out preservation.

Generates 20 deterministic combinations of prose + carve-out regions
(numbered options, code blocks, Iron-Law fences, error markers) and
exposes them for `tests/test_telegraph_carveouts.py`. The carve-out
regex must match every protected line and miss every prose line.

Determinism: seeded with a fixed value so CI runs are reproducible.
"""
from __future__ import annotations

import random
from dataclasses import dataclass, field

SEED = 8408
NUM_CASES = 20

PROSE_LINES = [
    "Need decide approach.",
    "Run lint after edit.",
    "Check budget first.",
    "Compile router again.",
    "Verify output matches.",
    "Update fixture if drift.",
]

NUMBERED_OPTIONS = [
    "1. Ship now \u2014 fast, risky.",
    "2. Add tests first \u2014 standard.",
    "3. Full audit \u2014 slow, safe.",
    "**Recommendation:** option 2.",
]

CODE_BLOCK = [
    "```bash",
    "task lint-skills",
    "echo done",
    "```",
]

IRON_LAW = [
    "```",
    "NEVER COMMIT WITHOUT PERMISSION.",
    "```",
]

ERROR_MARKERS = [
    "\u274c  budget breach: +131 chars",
    "\u26a0\ufe0f  warn: target exceeded",
    "\u2705  sync-check passed",
]

CARVE_OUT_REGEX = (
    r"^("
    r">?\s*\d+\.\s.*"
    r"|\*\*Recommendation:\*\*.*"
    r"|\*\*Empfehlung:\*\*.*"
    r"|```.*"
    r"|task\s+\S+.*"
    r"|echo\s+\S+.*"
    r"|NEVER\s[A-Z ]+\."
    r"|[\u274c\u26a0\u2705][\ufe0f]?\s+.*"
    r")$"
)


@dataclass
class FuzzCase:
    name: str
    lines: list[str] = field(default_factory=list)
    expected_preserved: list[str] = field(default_factory=list)


def _block(kind: str) -> tuple[list[str], list[str]]:
    if kind == "numbered":
        return NUMBERED_OPTIONS, NUMBERED_OPTIONS
    if kind == "code":
        return CODE_BLOCK, CODE_BLOCK
    if kind == "iron":
        return IRON_LAW, IRON_LAW
    if kind == "error":
        return ERROR_MARKERS, ERROR_MARKERS
    raise ValueError(kind)


def generate_cases() -> list[FuzzCase]:
    rng = random.Random(SEED)
    kinds = ["numbered", "code", "iron", "error"]
    cases: list[FuzzCase] = []
    for i in range(NUM_CASES):
        case = FuzzCase(name=f"fuzz-{i:02d}")
        # 1-3 prose lines, 1-3 carve-out blocks, interleaved
        n_prose = rng.randint(1, 3)
        n_blocks = rng.randint(1, 3)
        sequence: list[str] = []
        for _ in range(n_prose):
            sequence.append("prose")
        for _ in range(n_blocks):
            sequence.append(rng.choice(kinds))
        rng.shuffle(sequence)
        for slot in sequence:
            if slot == "prose":
                case.lines.append(rng.choice(PROSE_LINES))
            else:
                block_lines, preserved = _block(slot)
                case.lines.extend(block_lines)
                case.expected_preserved.extend(preserved)
        cases.append(case)
    return cases
