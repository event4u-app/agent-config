"""`model_tier` + `context` enum validation (road-to-model-capability-tiers / ADR-035).

`model_tier` is an optional vendor-neutral capability band:
`lite | medium | high | inherit`. Vendor model names (opus/sonnet/gpt/haiku) are
rejected. `context` is an optional orthogonal modifier whose only value is
`large`.
"""
from __future__ import annotations

import sys
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT / "scripts"))

from validate_frontmatter import apply_schema_defaults, load_schema, validate  # noqa: E402


def _validate(artefact_type: str, fm: dict):
    schema = load_schema(artefact_type)
    apply_schema_defaults(fm, schema)
    return [e for e in validate(fm, schema) if e.severity == "error"]


def _skill(**extra):
    return {"name": "x", "description": "d", "domain": "quality", **extra}


def _command(**extra):
    return {"name": "x", "description": "d", **extra}


@pytest.mark.parametrize("value", ["lite", "medium", "high", "inherit"])
def test_valid_tier_passes(value):
    for at, fm in (("skill", _skill(model_tier=value)), ("command", _command(model_tier=value))):
        assert _validate(at, fm) == [], f"{at} model_tier={value}"


@pytest.mark.parametrize("value", ["opus", "sonnet", "gpt", "haiku", "frontier", "", "High"])
def test_vendor_names_and_unknowns_rejected(value):
    for at, fm in (("skill", _skill(model_tier=value)), ("command", _command(model_tier=value))):
        errs = _validate(at, fm)
        assert any(e.rule == "enum" and "model_tier" in e.path for e in errs), (
            f"{at} model_tier={value!r} should fail enum, got {errs}"
        )


def test_context_modifier():
    for at, mk in (("skill", _skill), ("command", _command)):
        assert _validate(at, mk(model_tier="high", context="large")) == []
        bad = _validate(at, mk(model_tier="high", context="huge"))
        assert any(e.rule == "enum" and "context" in e.path for e in bad), bad


def test_both_fields_optional():
    for at, fm in (("skill", _skill()), ("command", _command())):
        assert _validate(at, fm) == [], f"{at} without model_tier/context"
