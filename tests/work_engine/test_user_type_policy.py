"""Schema / lint tests for the user-type axis.

User-types are CLI-only review lenses (no engine policy module —
docs/contracts/user-type-schema.md § 1 fixes the contract; Phase 4
decision: CLI-only in v1, no skill-level default). These tests lock
the linter behavior for the user-type axis the way
``test_persona_policy.py`` locks the persona engine policy.

Covered (per roadmap step-6 Phase 5 step 2):
- schema validation (required frontmatter keys, `kind` const)
- section spine enforcement (seven-section spine, locked)
- ``≥ 3`` bullets in ``Unique Questions``
- size budget (≤ 120 lines)
- ``id`` matches filename stem
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent / "scripts"))

from skill_linter import lint_file  # noqa: E402


def write_file(tmp_path: Path, relative: str, content: str) -> Path:
    path = tmp_path / relative
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")
    return path


USER_TYPE_TEMPLATE = """---
id: {id}
kind: {kind}
description: "Test review lens for the user-type axis."
version: "1.0"
source: project
---

# Test User-Type

## Focus

One paragraph framing the lens. Review-lens only, never operational
instruction source.

## Daily Workflow

- 06:00 morning brief
- 10:00 execution
- 15:00 end-of-day proof

## Vocabulary

- term-one
- term-two

## Operational Constraints

- gloves + capacitive touch fail at 4 °C
- no signal in cellar yards
- end-of-day proof = photo + signature + GPS

## Unique Questions

- Question one — falsifiable against the ticket.
- Question two — falsifiable against the ticket.
- Question three — falsifiable against the ticket.

## Ticket Red Flags

- Missing offline-queue spec
- No proof-of-work artefact

## Anti-Patterns

- Review-only, never operational instruction.
- No trade-execution instructions (welding, electrical, structural).
- No dangerous how-to.
{extra}
"""


def _body(*, id: str = "test-user-type", kind: str = "user-type", extra: str = "") -> str:
    return USER_TYPE_TEMPLATE.format(id=id, kind=kind, extra=extra)


def test_valid_user_type_passes(tmp_path: Path) -> None:
    path = write_file(
        tmp_path,
        ".agent-src.uncompressed/user-types/test-user-type.md",
        _body(),
    )
    result = lint_file(path)
    assert result.status in ("pass", "pass_with_warnings")
    assert not any(i.severity == "error" for i in result.issues)


def test_missing_section_fails(tmp_path: Path) -> None:
    """Drop the Anti-Patterns header to verify section-spine enforcement."""
    body = _body().replace("## Anti-Patterns", "## Notes")
    path = write_file(
        tmp_path,
        ".agent-src.uncompressed/user-types/test-user-type.md",
        body,
    )
    result = lint_file(path)
    missing = {i.message for i in result.issues if i.code == "missing_section"}
    assert any("Anti-Patterns" in m for m in missing)


def test_too_few_unique_questions_warns(tmp_path: Path) -> None:
    body = _body().replace(
        "- Question three — falsifiable against the ticket.\n", ""
    )
    path = write_file(
        tmp_path,
        ".agent-src.uncompressed/user-types/test-user-type.md",
        body,
    )
    result = lint_file(path)
    assert any(i.code == "too_few_unique_questions" for i in result.issues)


def test_invalid_kind_fails(tmp_path: Path) -> None:
    path = write_file(
        tmp_path,
        ".agent-src.uncompressed/user-types/test-user-type.md",
        _body(kind="persona"),
    )
    result = lint_file(path)
    assert any(i.code == "invalid_kind" for i in result.issues)


def test_id_must_match_filename(tmp_path: Path) -> None:
    path = write_file(
        tmp_path,
        ".agent-src.uncompressed/user-types/test-user-type.md",
        _body(id="other-id"),
    )
    result = lint_file(path)
    assert any(i.code == "id_filename_mismatch" for i in result.issues)


def test_size_budget_warns_above_120(tmp_path: Path) -> None:
    body = _body() + ("\n<!-- pad -->" * 100)
    path = write_file(
        tmp_path,
        ".agent-src.uncompressed/user-types/test-user-type.md",
        body,
    )
    result = lint_file(path)
    assert any(i.code == "size_budget" for i in result.issues)
