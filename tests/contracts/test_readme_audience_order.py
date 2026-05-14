"""Pin the README's three-audience entry section (P2.2 / road-to-proof-not-features).

The README must open with three audience-focused ``##`` headings in the
fixed order ``Use it in your project`` → ``Prove it`` → ``Contribute``
so consumer-side readers can self-route by role. AI Council is a
maintainer-only surface and MUST NOT appear in the user-facing
branches.
"""
from __future__ import annotations

import re
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
README = REPO_ROOT / "README.md"

AUDIENCE_HEADINGS = (
    "## Use it in your project",
    "## Prove it",
    "## Contribute",
)


def _readme_text() -> str:
    return README.read_text(encoding="utf-8")


def test_three_audience_headings_present() -> None:
    text = _readme_text()
    for heading in AUDIENCE_HEADINGS:
        assert heading in text, f"missing audience heading: {heading!r}"


def test_audience_headings_in_use_prove_contribute_order() -> None:
    text = _readme_text()
    positions = [text.index(heading) for heading in AUDIENCE_HEADINGS]
    assert positions == sorted(positions), (
        "README audience headings must appear in "
        "Use it in your project → Prove it → Contribute order; "
        f"got positions {positions} for {AUDIENCE_HEADINGS}"
    )


def test_audience_headings_appear_before_quickstart() -> None:
    text = _readme_text()
    quickstart_idx = text.index("## Quickstart")
    for heading in AUDIENCE_HEADINGS:
        assert text.index(heading) < quickstart_idx, (
            f"{heading!r} must appear before '## Quickstart'"
        )


def test_no_ai_council_in_user_facing_branches() -> None:
    """AI Council / /council MUST NOT appear between 'Use it' and 'Contribute'.

    The Council surface lives under maintainer telemetry; surfacing it
    in the user-facing branches confuses the consumer-side install path.
    """
    text = _readme_text()
    start = text.index(AUDIENCE_HEADINGS[0])
    end = text.index(AUDIENCE_HEADINGS[2])
    user_facing = text[start:end]
    pattern = re.compile(r"(?i)\b(?:ai[\s-]?council|/council)\b")
    matches = pattern.findall(user_facing)
    assert not matches, (
        "AI Council references found in user-facing README branches "
        f"between {AUDIENCE_HEADINGS[0]!r} and {AUDIENCE_HEADINGS[2]!r}: "
        f"{matches}"
    )
