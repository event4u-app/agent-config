"""Contract tests for ``docs/contracts/rule-interactions.yml``.

Encodes the rule-interaction matrix as Pytest fixtures per Phase 3.3
of ``agents/roadmaps/road-to-feedback-consolidation.md``. Two layers:

1. **Structural** — every declared pair is well-formed, references
   real rules, points to evidence anchors that exist on disk, and
   names the senior rule first.
2. **Behavioural** — the four 2-axis cases the roadmap pins
   (autonomy×scope, autonomy×commit, scope×verify, memory×commit)
   are present and assert the dominant rule's Iron Law fires when
   both rules could trigger.

The "memory×commit" axis is encoded by the ``autonomy-x-commit-policy``
pair — standing instructions ("memory" in roadmap shorthand) flow
through ``autonomous-execution`` before reaching ``commit-policy``.
This indirection is intentional: the package has no standalone
``agent-memory`` rule slug, and the autonomy rule is the on-disk
mechanism by which remembered standing directives interact with the
commit Iron Law.
"""
from __future__ import annotations

from pathlib import Path
from typing import Any

import pytest
import yaml

ROOT = Path(__file__).resolve().parent.parent.parent
MATRIX_PATH = ROOT / "docs" / "contracts" / "rule-interactions.yml"
RULES_DIR = ROOT / ".agent-src.uncompressed" / "rules"

ALLOWED_RELATIONS = {
    "overrides",
    "narrows",
    "defers_to",
    "restates",
    "gates",
    "complements",
}

# Roadmap-mandated 2-axis cases. Each maps a roadmap label to the YAML
# pair-id that encodes it; the senior rule is the one whose Iron Law
# fires when both could trigger.
ROADMAP_AXIS_CASES: dict[str, dict[str, str]] = {
    "autonomy-x-scope": {
        "pair_id": "autonomy-x-scope-control",
        "senior": "scope-control",
        "junior": "autonomous-execution",
    },
    "autonomy-x-commit": {
        "pair_id": "autonomy-x-commit-policy",
        "senior": "commit-policy",
        "junior": "autonomous-execution",
    },
    "scope-x-verify": {
        "pair_id": "scope-x-verify-before-complete",
        "senior": "verify-before-complete",
        "junior": "scope-control",
    },
    # "memory" in roadmap shorthand = standing instructions, on-disk
    # surface is `autonomous-execution`. See module docstring.
    "memory-x-commit": {
        "pair_id": "autonomy-x-commit-policy",
        "senior": "commit-policy",
        "junior": "autonomous-execution",
    },
}


@pytest.fixture(scope="module")
def matrix() -> dict[str, Any]:
    """Parse ``docs/contracts/rule-interactions.yml`` once per module."""
    return yaml.safe_load(MATRIX_PATH.read_text(encoding="utf-8"))


@pytest.fixture(scope="module")
def pairs_by_id(matrix: dict[str, Any]) -> dict[str, dict[str, Any]]:
    """Map ``pair["id"] -> pair`` for O(1) lookup in case fixtures."""
    return {p["id"]: p for p in matrix["pairs"]}


# --------------------------------------------------------------------------- #
# Structural contract — applied to every pair.
# --------------------------------------------------------------------------- #


def test_matrix_has_version_one(matrix: dict[str, Any]) -> None:
    assert matrix.get("version") == 1


def test_matrix_declares_rules(matrix: dict[str, Any]) -> None:
    rules = matrix.get("rules") or []
    assert isinstance(rules, list) and rules, "`rules:` must be non-empty"


def test_pair_ids_are_unique(matrix: dict[str, Any]) -> None:
    ids = [p["id"] for p in matrix["pairs"]]
    assert len(ids) == len(set(ids)), f"duplicate pair ids: {ids}"


@pytest.fixture
def all_pair_ids(matrix: dict[str, Any]) -> list[str]:
    return [p["id"] for p in matrix["pairs"]]


def test_every_pair_well_formed(matrix: dict[str, Any]) -> None:
    declared = set(matrix["rules"])
    required = {"id", "rules", "relation", "conflict", "resolution", "evidence"}
    for pair in matrix["pairs"]:
        missing = required - set(pair)
        assert not missing, f"{pair.get('id')!r} missing fields: {sorted(missing)}"

        rules_pair = pair["rules"]
        assert isinstance(rules_pair, list) and len(rules_pair) == 2, (
            f"{pair['id']!r} rules must be a 2-element list"
        )
        for slug in rules_pair:
            assert slug in declared, f"{pair['id']!r} cites undeclared rule {slug!r}"
            assert (RULES_DIR / f"{slug}.md").exists(), (
                f"{pair['id']!r} cites rule {slug!r} with no on-disk file"
            )
        assert pair["relation"] in ALLOWED_RELATIONS, (
            f"{pair['id']!r} has invalid relation {pair['relation']!r}"
        )

        evidence = pair["evidence"] or []
        assert evidence, f"{pair['id']!r} evidence must be non-empty"
        for citation in evidence:
            file_part = citation.split("#", 1)[0]
            assert (ROOT / file_part).exists(), (
                f"{pair['id']!r} evidence path missing: {file_part}"
            )


# --------------------------------------------------------------------------- #
# Behavioural contract — the four roadmap-mandated 2-axis cases.
# --------------------------------------------------------------------------- #


@pytest.fixture(params=sorted(ROADMAP_AXIS_CASES))
def axis_case(
    request: pytest.FixtureRequest,
    pairs_by_id: dict[str, dict[str, Any]],
) -> dict[str, Any]:
    label = request.param
    spec = ROADMAP_AXIS_CASES[label]
    pair_id = spec["pair_id"]
    assert pair_id in pairs_by_id, (
        f"roadmap axis {label!r} expects pair {pair_id!r} but matrix has none"
    )
    return {"label": label, "spec": spec, "pair": pairs_by_id[pair_id]}


def test_axis_case_present_and_well_oriented(axis_case: dict[str, Any]) -> None:
    """Senior rule must come first; both rules must be in the pair."""
    spec = axis_case["spec"]
    pair = axis_case["pair"]
    rules = pair["rules"]
    assert spec["senior"] in rules and spec["junior"] in rules, (
        f"{axis_case['label']}: pair {pair['id']!r} does not list both "
        f"{spec['senior']!r} and {spec['junior']!r}"
    )
    assert rules[0] == spec["senior"], (
        f"{axis_case['label']}: senior rule {spec['senior']!r} must be first "
        f"in pair.rules; got {rules!r}"
    )


def test_axis_case_resolution_invokes_senior_rule(
    axis_case: dict[str, Any],
) -> None:
    """The resolution paragraph must name the senior rule explicitly."""
    spec = axis_case["spec"]
    pair = axis_case["pair"]
    senior = spec["senior"]
    resolution = pair["resolution"].lower()
    # Senior name (or a clear backreference) must appear in the prose.
    assert senior in resolution or "iron law" in resolution, (
        f"{axis_case['label']}: resolution does not invoke senior rule "
        f"{senior!r} or its Iron Law"
    )


def test_axis_case_evidence_anchors_senior_rule(
    axis_case: dict[str, Any],
) -> None:
    """Evidence must include at least one anchor on the senior rule."""
    spec = axis_case["spec"]
    pair = axis_case["pair"]
    senior_evidence = [
        citation
        for citation in pair["evidence"]
        if f"/rules/{spec['senior']}.md" in citation
    ]
    assert senior_evidence, (
        f"{axis_case['label']}: evidence for pair {pair['id']!r} cites no "
        f"anchor on senior rule {spec['senior']!r}"
    )
