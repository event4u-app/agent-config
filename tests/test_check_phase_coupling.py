"""Phase 0.3.3 CI guard — Phase 6 → 2B decoupling stays intact.

Mirrors `scripts/check_phase_coupling.py`. The contract artefact lives
at `agents/roadmaps/phase6-2b-coupling.md` and the linter is the
runtime enforcement.

Tests cover:
- Default state: 0 rule-references across the 13 Phase-2B targets.
- Dispatcher exclusion: `chat-history:hook` (and any
  `chat-history:*` colon-suffix) is **not** counted.
- Rule reference detection: a synthetic injection of
  `chat-history-cadence` into a target rule trips the linter.
"""

from __future__ import annotations

import importlib.util
import sys
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parents[1]
LINTER = REPO_ROOT / "scripts" / "check_phase_coupling.py"


def _load_linter():
    spec = importlib.util.spec_from_file_location(
        "check_phase_coupling", LINTER
    )
    assert spec and spec.loader
    mod = importlib.util.module_from_spec(spec)
    sys.modules.pop("check_phase_coupling", None)
    spec.loader.exec_module(mod)  # type: ignore[union-attr]
    return mod


def test_linter_passes_today() -> None:
    """Phase 0.3 audit: 0 hits across all 13 Phase-2B targets."""
    mod = _load_linter()
    hits, lines = mod._check_surface(
        "uncompressed", REPO_ROOT / ".agent-src.uncompressed" / "rules"
    )
    assert hits == 0, "uncompressed surface coupling regression:\n" + "\n".join(
        lines
    )
    hits, lines = mod._check_surface(
        "compressed", REPO_ROOT / ".agent-src" / "rules"
    )
    assert hits == 0, "compressed surface coupling regression:\n" + "\n".join(
        lines
    )


def test_dispatcher_subcommand_excluded() -> None:
    """`chat-history:hook` (CLI subcommand) must not match the rule probe."""
    mod = _load_linter()
    rgx = mod._RULE_REF_RE
    samples_excluded = [
        "./agent-config chat-history:hook --platform claude",
        "Run `chat-history:hook` from the dispatcher.",
        "chat-history-cadence:something-other",
        "`chat-history-ownership:status`",
    ]
    for s in samples_excluded:
        assert rgx.search(s) is None, (
            f"dispatcher / colon-suffix sample wrongly matched: {s!r}"
        )


def test_rule_reference_detected() -> None:
    """Bare rule names (not followed by colon) must match."""
    mod = _load_linter()
    rgx = mod._RULE_REF_RE
    samples_matched = [
        "see [`chat-history-cadence`](chat-history-cadence.md)",
        "rule `chat-history-ownership` fires when …",
        "load_context:\n  - .agent-src.uncompressed/rules/chat-history-visibility.md",
        "links to chat-history-visibility for the heartbeat",
    ]
    for s in samples_matched:
        assert rgx.search(s) is not None, (
            f"rule-name sample failed to match: {s!r}"
        )


def test_synthetic_injection_trips_linter(tmp_path: Path) -> None:
    """Injecting a rule-name reference into a target rule trips _scan()."""
    mod = _load_linter()
    fake = tmp_path / "package-ci-checks.md"
    fake.write_text(
        "---\ntype: auto\n---\n\nDelegates to `chat-history-cadence`.\n",
        encoding="utf-8",
    )
    hits = mod._scan(fake)
    assert len(hits) == 1
    assert "chat-history-cadence" in hits[0][1]


def test_target_rule_set_matches_roadmap() -> None:
    """The 13 names hard-coded in the linter must match the Phase-2B priority list."""
    mod = _load_linter()
    expected = {
        "roadmap-progress-sync",
        "user-interaction",
        "augment-source-of-truth",
        "command-suggestion-policy",
        "artifact-engagement-recording",
        "review-routing-awareness",
        "autonomous-execution",
        "docs-sync",
        "cli-output-handling",
        "augment-portability",
        "ui-audit-gate",
        "skill-quality",
        "package-ci-checks",
    }
    assert set(mod.TARGET_RULES) == expected
    assert len(mod.TARGET_RULES) == 13


def test_phase6_rule_set_is_three() -> None:
    mod = _load_linter()
    assert set(mod.PHASE6_RULES) == {
        "chat-history-cadence",
        "chat-history-ownership",
        "chat-history-visibility",
    }
