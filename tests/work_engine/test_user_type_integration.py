"""Integration tests for the user-type axis.

User-types are CLI-only review lenses in v1 (no engine policy module —
Phase 4 decision in step-6 roadmap; docs/contracts/user-type-schema.md
§ 1). The "integration" surface this test locks down is therefore:

1. **Loading**: a user-type file in ``.agent-src.uncompressed/user-types/``
   loads through the linter the same way a persona does.
2. **`refine-ticket` invocation**: the CLI command markdown declares
   ``--user-type=<id>`` and the skill's procedure documents the
   composition contract — persona = methodology, user-type = end-user.
3. **Persona + user-type composition**: a user-type and a persona file
   can sit side-by-side; the linter routes each to its own classifier
   without cross-contamination.

The engine itself stays persona-only; user-types are loaded by the
``refine-ticket`` skill at runtime via the CLI flag.
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent / "scripts"))

from skill_linter import lint_file  # noqa: E402

REPO_ROOT = Path(__file__).resolve().parent.parent.parent


def write_file(tmp_path: Path, relative: str, content: str) -> Path:
    path = tmp_path / relative
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")
    return path


USER_TYPE_BODY = """---
id: test-lens
kind: user-type
description: "Test review lens."
version: "1.0"
source: project
---

# Test Lens

## Focus

Review-lens only, never operational instruction source.

## Daily Workflow

- 06:00 brief
- 15:00 proof

## Vocabulary

- term

## Operational Constraints

- gloves + cold
- offline + dead zones
- timestamped photo proof

## Unique Questions

- Question one.
- Question two.
- Question three.

## Ticket Red Flags

- Missing offline-queue spec

## Anti-Patterns

- Review-only, never operational instruction.
- No trade-execution instructions.
"""

PERSONA_BODY = """---
id: test-reviewer
role: Test Reviewer
description: "Methodology lens for tests."
tier: core
mode: developer
version: "1.0"
source: package
---

# Test Reviewer

## Focus

One paragraph framing the methodology.

## Mindset

- Default assumption.

## Unique Questions

- Question one.
- Question two.
- Question three.

## Output Expectations

Short bullets.

## Anti-Patterns

- Do NOT skip evidence.
"""


def test_user_type_file_loads_through_linter(tmp_path: Path) -> None:
    """A well-formed user-type file lints clean — no errors."""
    path = write_file(
        tmp_path,
        ".agent-src.uncompressed/user-types/test-lens.md",
        USER_TYPE_BODY,
    )
    result = lint_file(path)
    assert result.artifact_type == "user-type"
    assert not any(i.severity == "error" for i in result.issues)


def test_user_type_and_persona_compose_without_cross_contamination(tmp_path: Path) -> None:
    """A user-type and a persona file side-by-side both lint clean
    under their own classifier — neither is routed through the other's
    rules."""
    ut = write_file(
        tmp_path,
        ".agent-src.uncompressed/user-types/test-lens.md",
        USER_TYPE_BODY,
    )
    pe = write_file(
        tmp_path,
        ".agent-src.uncompressed/personas/test-reviewer.md",
        PERSONA_BODY,
    )
    ut_result = lint_file(ut)
    pe_result = lint_file(pe)

    assert ut_result.artifact_type == "user-type"
    assert pe_result.artifact_type == "persona"
    assert not any(i.severity == "error" for i in ut_result.issues)
    assert not any(i.severity == "error" for i in pe_result.issues)


def test_refine_ticket_command_declares_user_type_flag() -> None:
    """The CLI surface contract: ``--user-type=<id>`` is documented in
    the refine-ticket command markdown alongside ``--personas=``."""
    cmd = (REPO_ROOT / ".agent-src.uncompressed" / "commands" / "refine-ticket.md").read_text(
        encoding="utf-8"
    )
    assert "--user-type=" in cmd
    assert "--personas=" in cmd


def test_refine_ticket_skill_documents_composition_contract() -> None:
    """The skill procedure spells out persona = methodology, user-type
    = end-user — the orthogonal-composition contract."""
    skill = (
        REPO_ROOT / ".agent-src.uncompressed" / "skills" / "refine-ticket" / "SKILL.md"
    ).read_text(encoding="utf-8")
    assert "--user-type=" in skill
    assert "methodology" in skill.lower()
    assert "end-user" in skill.lower()
