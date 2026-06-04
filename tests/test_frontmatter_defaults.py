"""Schema-default injection parity (road-to-abstraction-reduction.md Phase 1).

Proves the contract in
``agents/evidence/analysis/abstraction-reduction-preflight.md``:

  - every "safe to default" field reads back its default when omitted,
  - a present (non-default) value is never overwritten,
  - fields kept explicit (``execution.type``, ``command.type``) are never
    fabricated,
  - an artefact that omits every defaulted field still validates,
  - the discovery drift checksum is byte-stable between the explicit form and
    the omitted form (inject-then-checksum, preflight Decision B).
"""
from __future__ import annotations

import sys
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT / "src" / "scripts"))

from validate_frontmatter import (  # noqa: E402
    apply_schema_defaults,
    load_schema,
    validate,
)

# (artefact_type, dotted-path, default value) — one row per safe-to-default field.
SAFE_DEFAULTS = [
    ("skill", "source", "package"),
    ("skill", "lifecycle", "active"),
    ("skill", "trust.level", "core"),
    ("skill", "trust.confidence", "high"),
    ("skill", "trust.human_review_required", False),
    ("skill", "install.default", True),
    ("skill", "install.removable", False),
    ("rule", "source", "package"),
    ("rule", "lifecycle", "active"),
    ("rule", "trust.level", "core"),
    ("rule", "trust.confidence", "high"),
    ("rule", "trust.human_review_required", False),
    ("rule", "install.default", True),
    ("rule", "install.removable", False),
    ("command", "disable-model-invocation", True),
    ("command", "lifecycle", "active"),
    ("command", "trust.level", "core"),
    ("command", "trust.confidence", "high"),
    ("command", "trust.human_review_required", False),
    ("command", "install.default", True),
    ("command", "install.removable", False),
    ("persona", "version", "1.0"),
    ("persona", "source", "package"),
]


def _dig(data: dict, dotted: str):
    cur = data
    for part in dotted.split("."):
        assert isinstance(cur, dict), f"{dotted}: parent not a dict"
        assert part in cur, f"{dotted}: `{part}` not injected"
        cur = cur[part]
    return cur


def _minimal(artefact_type: str) -> dict:
    """A frontmatter dict carrying only the non-defaultable required keys."""
    return {
        "skill": {"name": "x", "description": "d", "domain": "quality"},
        "rule": {"type": "auto", "description": "d"},
        "command": {"name": "x", "description": "d"},
        "persona": {
            "id": "x", "role": "r", "description": "d",
            "tier": "core", "mode": "developer",
        },
    }[artefact_type]


@pytest.mark.parametrize("artefact_type,dotted,default", SAFE_DEFAULTS)
def test_absent_field_reads_back_default(artefact_type, dotted, default):
    data = _minimal(artefact_type)
    apply_schema_defaults(data, load_schema(artefact_type))
    assert _dig(data, dotted) == default


@pytest.mark.parametrize("artefact_type,dotted,default", SAFE_DEFAULTS)
def test_present_value_not_overwritten(artefact_type, dotted, default):
    # Pick a non-default sentinel of the right type.
    if isinstance(default, bool):
        sentinel = not default
    elif dotted.endswith("source"):
        sentinel = "project"
    elif dotted.endswith("level"):
        sentinel = "advisory"
    elif dotted.endswith("confidence"):
        sentinel = "low"
    elif dotted.endswith("lifecycle"):
        sentinel = "deprecated"
    elif dotted.endswith("version"):
        sentinel = "2.0"
    elif dotted == "disable-model-invocation":
        sentinel = True  # enum-locked to true; "present" still means not-injected
    else:
        sentinel = "sentinel"
    data = _minimal(artefact_type)
    # Set the explicit nested value.
    parts = dotted.split(".")
    cur = data
    for part in parts[:-1]:
        cur = cur.setdefault(part, {})
    cur[parts[-1]] = sentinel
    apply_schema_defaults(data, load_schema(artefact_type))
    assert _dig(data, dotted) == sentinel


def test_omitted_artefact_still_validates():
    for artefact_type in ("skill", "rule", "command", "persona"):
        data = _minimal(artefact_type)
        schema = load_schema(artefact_type)
        apply_schema_defaults(data, schema)
        fatal = [e for e in validate(data, schema) if e.severity == "error"]
        assert fatal == [], f"{artefact_type}: {fatal}"


def test_kept_explicit_fields_never_fabricated():
    # skill.execution is optional and has no sub-defaults → never injected.
    skill = _minimal("skill")
    apply_schema_defaults(skill, load_schema("skill"))
    assert "execution" not in skill
    # command.type (orchestrator) carries no default → never injected.
    cmd = _minimal("command")
    apply_schema_defaults(cmd, load_schema("command"))
    assert "type" not in cmd


def test_partial_trust_block_is_filled_not_replaced():
    rule = _minimal("rule")
    rule["trust"] = {"level": "advisory", "human_review_required": True}
    apply_schema_defaults(rule, load_schema("rule"))
    assert rule["trust"] == {
        "level": "advisory",
        "human_review_required": True,
        "confidence": "high",  # filled from default
    }


def test_checksum_stable_between_explicit_and_omitted_forms():
    """inject-then-checksum: the drift checksum is identical whether the
    artefact carries the explicit defaults on disk or omits them
    (preflight Decision B)."""
    from build_discovery_manifest import _artefact_checksum  # noqa: E402

    body = "\n# Heading\n\nbody text\n"
    explicit_fm = {
        "name": "demo", "description": "d", "domain": "quality",
        "workspaces": ["engineering"], "packs": ["engineering-base"],
        "source": "package", "lifecycle": "active",
        "trust": {"level": "core", "confidence": "high", "human_review_required": False},
        "install": {"default": True, "removable": False},
    }
    omitted_fm = {
        "name": "demo", "description": "d", "domain": "quality",
        "workspaces": ["engineering"], "packs": ["engineering-base"],
    }
    apply_schema_defaults(omitted_fm, load_schema("skill"))

    tmp = REPO_ROOT / "tests" / "_tmp_checksum_probe.md"
    try:
        tmp.write_text("---\nx\n---\n" + body, encoding="utf-8")
        c_explicit = _artefact_checksum(tmp, explicit_fm)
        c_omitted = _artefact_checksum(tmp, omitted_fm)
        assert c_explicit == c_omitted
    finally:
        tmp.unlink(missing_ok=True)
