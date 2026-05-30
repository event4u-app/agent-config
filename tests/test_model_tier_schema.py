"""`recommended_model` enum validation (road-to-per-skill-model-autoswitch.md Phase 2 / ADR-034).

The field is optional and tool-neutral; its value must be one of
`opus | sonnet | gpt | inherit`. `haiku` is deliberately out of the enum
(sonnet is the cheapest tier) and any unknown value is rejected.
"""
from __future__ import annotations

import sys
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT / "scripts"))

from validate_frontmatter import apply_schema_defaults, load_schema, validate  # noqa: E402


def _validate(artefact_type: str, fm: dict):
    """Inject schema defaults first (mirrors the loader), then validate —
    isolates the recommended_model check from unrelated required-field noise."""
    schema = load_schema(artefact_type)
    apply_schema_defaults(fm, schema)
    return [e for e in validate(fm, schema) if e.severity == "error"]


def _skill(value=None):
    fm = {"name": "x", "description": "d", "domain": "quality"}
    if value is not None:
        fm["recommended_model"] = value
    return fm


def _command(value=None):
    fm = {"name": "x", "description": "d"}
    if value is not None:
        fm["recommended_model"] = value
    return fm


@pytest.mark.parametrize("value", ["opus", "sonnet", "gpt", "inherit"])
def test_valid_recommended_model_passes(value):
    for artefact_type, fm in (("skill", _skill(value)), ("command", _command(value))):
        errs = _validate(artefact_type, fm)
        assert errs == [], f"{artefact_type} recommended_model={value}: {errs}"


@pytest.mark.parametrize("value", ["haiku", "gpt5", "opus-4", "", "Opus"])
def test_invalid_recommended_model_rejected(value):
    for artefact_type, fm in (("skill", _skill(value)), ("command", _command(value))):
        errs = _validate(artefact_type, fm)
        assert any(e.rule == "enum" and "recommended_model" in e.path for e in errs), (
            f"{artefact_type} recommended_model={value!r} should fail enum, got {errs}"
        )


def test_field_is_optional():
    # Absent recommended_model must not trigger a required/validation error.
    for artefact_type, fm in (("skill", _skill()), ("command", _command())):
        errs = _validate(artefact_type, fm)
        assert errs == [], f"{artefact_type} without recommended_model: {errs}"
