"""Discovery-frontmatter roundtrip invariant (ADR-013, Monorepo Phase 1).

The condenseor under ``scripts/condense.py`` rewrites .md content but
MUST leave the YAML frontmatter byte-identical between source and
condensed copies. ``scripts/check_condensation.py`` already asserts
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
sys.path.insert(0, str(REPO_ROOT / "src" / "scripts"))

from check_condensation import extract_frontmatter  # noqa: E402
from validate_frontmatter import apply_schema_defaults, load_schema, parse_frontmatter  # noqa: E402
from _lib.agent_src import resolve_logical  # noqa: E402

# Phase-1 keys that carry a schema default and MAY be omitted on disk
# (abstraction-reduction migration); injected at read time.
_DEFAULTED_KEYS = ("lifecycle", "trust", "install")
# Phase-1 keys with no default — must stay byte-present in both layers.
_REQUIRED_KEYS = ("workspaces", "packs")

DST = REPO_ROOT / "dist/agent-src"

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
    """Both source and condensed must carry a parseable frontmatter block.

    Byte-equality on the entire block is enforced by
    ``scripts/check_condensation.py`` (which applies the load_context
    path rewrite before comparison); this test pins the structural
    contract that frontmatter survives condensation at all.
    """
    src_fm = extract_frontmatter(src.read_text(encoding="utf-8"))
    dst_fm = extract_frontmatter(dst.read_text(encoding="utf-8"))
    assert src_fm, f"{label}: source has no frontmatter ({src})"
    assert dst_fm, f"{label}: condensed has no frontmatter ({dst})"


@pytest.mark.parametrize("label,src,dst", _pairs(), ids=lambda x: x if isinstance(x, str) else "")
def test_phase_1_keys_present_in_both_layers(label, src, dst):
    """Every Phase-1 key MUST resolve identically in both layers.

    Post abstraction-reduction, lifecycle/trust/install carry schema defaults
    and may be omitted on disk; workspaces/packs have no default and must stay
    byte-present. The condensation roundtrip keeps source and condensed
    frontmatter byte-identical, so an omitted key is omitted in BOTH layers —
    and after default injection every Phase-1 key resolves to the same value.
    """
    src_parsed, _ = parse_frontmatter(src.read_text(encoding="utf-8"))
    dst_parsed, _ = parse_frontmatter(dst.read_text(encoding="utf-8"))
    assert isinstance(src_parsed, dict), f"{label}: source frontmatter unparseable"
    assert isinstance(dst_parsed, dict), f"{label}: condensed frontmatter unparseable"

    # Non-defaulted keys must be byte-present in both layers.
    for key in _REQUIRED_KEYS:
        assert key in src_parsed, f"{label}: source missing `{key}`"
        assert key in dst_parsed, f"{label}: condensed missing `{key}`"

    # Roundtrip: each Phase-1 key must agree across layers before injection
    # (present-and-equal, or absent in both).
    for key in PHASE_1_KEYS:
        assert (key in src_parsed) == (key in dst_parsed), (
            f"{label}: `{key}` present in one layer only (src={key in src_parsed}, "
            f"dst={key in dst_parsed})"
        )

    # After default injection, every Phase-1 key resolves identically.
    schema = load_schema(label)
    apply_schema_defaults(src_parsed, schema)
    apply_schema_defaults(dst_parsed, schema)
    for key in PHASE_1_KEYS:
        assert key in src_parsed, f"{label}: `{key}` missing after defaults (src)"
        assert key in dst_parsed, f"{label}: `{key}` missing after defaults (dst)"
        assert src_parsed[key] == dst_parsed[key], (
            f"{label}: key `{key}` diverged: {src_parsed[key]!r} vs {dst_parsed[key]!r}"
        )


def test_roundtrip_invariant_pairs_non_empty():
    """Guard against a silently-empty parameterisation: at least one pair."""
    assert _pairs(), (
        "Roundtrip test found no source/condensed pairs. "
        "Either the fixture skills moved or `task sync` has not run."
    )
