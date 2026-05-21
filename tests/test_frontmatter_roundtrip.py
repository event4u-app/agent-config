"""Discovery-frontmatter roundtrip invariant (ADR-013, Monorepo Phase 1).

The compressor under ``scripts/compress.py`` rewrites .md content but
MUST leave the YAML frontmatter byte-identical between source and
compressed copies. ``scripts/check_compression.py`` already asserts
this for every artefact in the live repo; this module pins the
invariant explicitly for the five Phase-1 keys
(``workspaces``, ``packs``, ``lifecycle``, ``trust``, ``install``) and
covers the artefact categories the discovery scanner walks
(skills, rules, commands, templates).
"""
from __future__ import annotations

import sys
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT / "scripts"))

from check_compression import extract_frontmatter  # noqa: E402
from validate_frontmatter import parse_frontmatter  # noqa: E402
from _lib.agent_src import resolve_logical  # noqa: E402

DST = REPO_ROOT / ".agent-src"

PHASE_1_KEYS = ("workspaces", "packs", "lifecycle", "trust", "install")


def _pairs():
    """Yield (label, src_path, dst_path) for one artefact per category."""
    logical_candidates = [
        ("skill", "skills/dcf-modeling/SKILL.md"),
        ("rule", "rules/commit-policy.md"),
        ("command", "commands/commit.md"),
    ]
    pairs = []
    for label, logical in logical_candidates:
        src = resolve_logical(logical)
        if src is None:
            continue
        dst = DST / logical
        if not dst.exists():
            continue
        pairs.append((label, src, dst))
    return pairs


@pytest.mark.parametrize("label,src,dst", _pairs(), ids=lambda x: x if isinstance(x, str) else "")
def test_frontmatter_block_present_on_both_layers(label, src, dst):
    """Both source and compressed must carry a parseable frontmatter block.

    Byte-equality on the entire block is enforced by
    ``scripts/check_compression.py`` (which applies the load_context
    path rewrite before comparison); this test pins the structural
    contract that frontmatter survives compression at all.
    """
    src_fm = extract_frontmatter(src.read_text(encoding="utf-8"))
    dst_fm = extract_frontmatter(dst.read_text(encoding="utf-8"))
    assert src_fm, f"{label}: source has no frontmatter ({src})"
    assert dst_fm, f"{label}: compressed has no frontmatter ({dst})"


@pytest.mark.parametrize("label,src,dst", _pairs(), ids=lambda x: x if isinstance(x, str) else "")
def test_phase_1_keys_present_in_both_layers(label, src, dst):
    """Every Phase-1 key parsed from source MUST also parse from compressed."""
    src_parsed, _ = parse_frontmatter(src.read_text(encoding="utf-8"))
    dst_parsed, _ = parse_frontmatter(dst.read_text(encoding="utf-8"))
    assert isinstance(src_parsed, dict), f"{label}: source frontmatter unparseable"
    assert isinstance(dst_parsed, dict), f"{label}: compressed frontmatter unparseable"
    for key in PHASE_1_KEYS:
        assert key in src_parsed, f"{label}: source missing `{key}`"
        assert key in dst_parsed, f"{label}: compressed missing `{key}`"
        assert src_parsed[key] == dst_parsed[key], (
            f"{label}: key `{key}` diverged: {src_parsed[key]!r} vs {dst_parsed[key]!r}"
        )


def test_roundtrip_invariant_pairs_non_empty():
    """Guard against a silently-empty parameterisation: at least one pair."""
    assert _pairs(), (
        "Roundtrip test found no source/compressed pairs. "
        "Either the fixture skills moved or `task sync` has not run."
    )
