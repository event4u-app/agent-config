"""Conformance: every shipped fixture validates against the v1 envelope."""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from tests.conformance.retrieval.validator import (
    ValidationError,
    validate_health,
    validate_retrieve,
)

FIXTURES_DIR = Path(__file__).resolve().parents[2] / "fixtures" / "retrieval"

RETRIEVE_FIXTURES = [
    "01-empty.json",
    "02-single-type-hit.json",
    "03-multi-type-partial.json",
    "04-error-all-slices.json",
    "05-shadowed-by.json",
]
HEALTH_FIXTURES = [
    "06-health-ok.json",
]


def _load(name: str) -> dict:
    return json.loads((FIXTURES_DIR / name).read_text(encoding="utf-8"))


@pytest.mark.parametrize("name", RETRIEVE_FIXTURES)
def test_retrieve_fixture_passes_validation(name: str) -> None:
    validate_retrieve(_load(name))


@pytest.mark.parametrize("name", HEALTH_FIXTURES)
def test_health_fixture_passes_validation(name: str) -> None:
    validate_health(_load(name))


def test_envelope_status_matches_slice_outcomes() -> None:
    """Cross-check: envelope status is consistent with slice statuses.

    - every slice ok → envelope `ok`
    - every slice failed → envelope `error`
    - at least one ok + at least one failed → envelope `partial`
    """
    for name in RETRIEVE_FIXTURES:
        env = _load(name)
        slices = env["slices"]
        oks = [s for s in slices.values() if s["status"] == "ok"]
        fails = [s for s in slices.values() if s["status"] != "ok"]
        expected = (
            "ok" if fails == []
            else "error" if oks == []
            else "partial"
        )
        assert env["status"] == expected, (
            f"{name}: envelope status={env['status']!r}, "
            f"expected {expected!r} from slices {slices}"
        )


def test_all_fixtures_are_listed() -> None:
    """Guards against a fixture file landing without being wired to a test."""
    shipped = {
        p.name for p in FIXTURES_DIR.iterdir()
        if p.is_file() and p.suffix == ".json"
    }
    declared = set(RETRIEVE_FIXTURES) | set(HEALTH_FIXTURES)
    missing = shipped - declared
    assert not missing, (
        f"fixture(s) on disk but not covered by a test: {sorted(missing)}. "
        f"Add them to RETRIEVE_FIXTURES or HEALTH_FIXTURES."
    )


def test_shadowed_by_is_non_null_only_for_operational_source() -> None:
    """Repo entries never get `shadowed_by` set — only operational losers do."""
    for name in RETRIEVE_FIXTURES:
        env = _load(name)
        for i, e in enumerate(env["entries"]):
            if e.get("shadowed_by"):
                assert e["source"] == "operational", (
                    f"{name} entry[{i}] id={e['id']}: "
                    f"shadowed_by set but source={e['source']!r}"
                )


def test_validator_rejects_unknown_top_level_key() -> None:
    """Sanity: the validator actually catches drift, not just happy paths."""
    env = _load("01-empty.json")
    env["unexpected_field"] = "drift"
    with pytest.raises(ValidationError) as exc:
        validate_retrieve(env)
    assert "unexpected_field" in str(exc.value) or "unexpected keys" in str(exc.value)


def test_validator_rejects_wrong_contract_version() -> None:
    env = _load("01-empty.json")
    env["contract_version"] = 2
    with pytest.raises(ValidationError) as exc:
        validate_retrieve(env)
    assert "contract_version" in str(exc.value)


def test_validator_rejects_confidence_out_of_range() -> None:
    env = _load("02-single-type-hit.json")
    env["entries"][0]["confidence"] = 1.5
    with pytest.raises(ValidationError) as exc:
        validate_retrieve(env)
    assert "confidence" in str(exc.value)


def test_validator_rejects_bad_shadowed_by_format() -> None:
    env = _load("05-shadowed-by.json")
    env["entries"][1]["shadowed_by"] = "operational:xyz"
    with pytest.raises(ValidationError) as exc:
        validate_retrieve(env)
    assert "shadowed_by" in str(exc.value)
