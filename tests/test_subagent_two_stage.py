"""P1.2 C — `do-and-judge-two-stage` mode contract.

The mode adds a SPEC-COMPLIANCE judge before a CODE-QUALITY judge. The
orchestrator's stage-routing rule (`SKILL.md` § *2. do-and-judge-two-
stage*) says:

  - stage-1 DONE                → run stage-2; final = stage-2 envelope
  - stage-1 DONE_WITH_CONCERNS  → run stage-2; merge concerns
  - stage-1 NEEDS_CONTEXT       → pause; stage-2 does NOT run
  - stage-1 BLOCKED             → final = stage-1; stage-2 does NOT run

These tests pin the contract at the doc level (so future edits can't
silently drop the cost-saving shortcut) and at the routing level (a
zero-dep Python implementation of the rule the orchestrator has to
follow).
"""

from __future__ import annotations

import json
import re
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parents[1]
SKILL_DIR = REPO_ROOT / ".agent-src.uncompressed/skills/subagent-orchestration"
SKILL_MD = SKILL_DIR / "SKILL.md"
PROMPT = SKILL_DIR / "prompts/do-and-judge-two-stage.md"
SCHEMA = SKILL_DIR / "schemas/subagent-status.json"


# --- Doc-level contract --------------------------------------------------


def test_skill_documents_two_stage_mode() -> None:
    text = SKILL_MD.read_text()
    assert re.search(
        r"^### 2\. do-and-judge-two-stage$", text, flags=re.MULTILINE
    ), "SKILL.md must declare mode 2 as do-and-judge-two-stage"


def test_skill_documents_stage_routing_rule() -> None:
    text = SKILL_MD.read_text()
    for keyword in (
        "DONE",
        "DONE_WITH_CONCERNS",
        "NEEDS_CONTEXT",
        "BLOCKED",
        "Stage-routing rule",
    ):
        assert keyword in text, f"SKILL.md missing stage-routing keyword: {keyword}"


def test_prompt_split_into_two_distinct_judges() -> None:
    text = PROMPT.read_text()
    # The whole point of two-stage is the rubric split.
    assert "SPEC COMPLIANCE judge" in text
    assert "CODE QUALITY judge" in text
    # Stage-1 must explicitly forbid quality commentary, stage-2 spec
    # commentary — that is the cost-of-collapsing rationale.
    assert "Stay in your lane" in text
    assert "NEVER re-litigate the spec" in text


def test_prompt_documents_cost_shortcut() -> None:
    text = PROMPT.read_text()
    assert "shortcut" in text.lower(), (
        "prompt must explain why BLOCKED at stage 1 short-circuits "
        "stage 2 — the cost discipline is the whole point"
    )


# --- Stage-routing rule (executable contract) ---------------------------


def stage_routing(stage_1_status: str, stage_2_status: str | None) -> dict:
    """Pure implementation of `SKILL.md` § 2 stage-routing rule.

    The orchestrator only runs stage 2 when stage 1 is DONE or
    DONE_WITH_CONCERNS. NEEDS_CONTEXT pauses; BLOCKED is the final
    verdict. Any other behavior would defeat the cost-discipline
    rationale.
    """
    if stage_1_status in {"NEEDS_CONTEXT", "BLOCKED"}:
        if stage_2_status is not None:
            raise ValueError(
                f"stage 2 must not run when stage 1 = {stage_1_status}"
            )
        return {"final_status": stage_1_status, "ran_stage_2": False}

    if stage_1_status not in {"DONE", "DONE_WITH_CONCERNS"}:
        raise ValueError(f"unknown stage-1 status: {stage_1_status}")

    if stage_2_status is None:
        raise ValueError(
            f"stage 1 = {stage_1_status} requires stage-2 verdict"
        )

    return {"final_status": stage_2_status, "ran_stage_2": True}


@pytest.mark.parametrize(
    "stage_1, stage_2, expected_ran, expected_final",
    [
        ("DONE", "DONE", True, "DONE"),
        ("DONE", "DONE_WITH_CONCERNS", True, "DONE_WITH_CONCERNS"),
        ("DONE", "BLOCKED", True, "BLOCKED"),
        ("DONE_WITH_CONCERNS", "DONE", True, "DONE"),
        ("DONE_WITH_CONCERNS", "DONE_WITH_CONCERNS", True, "DONE_WITH_CONCERNS"),
        ("NEEDS_CONTEXT", None, False, "NEEDS_CONTEXT"),
        ("BLOCKED", None, False, "BLOCKED"),
    ],
)
def test_stage_routing_obeys_skill_rule(
    stage_1: str, stage_2: str | None, expected_ran: bool, expected_final: str
) -> None:
    result = stage_routing(stage_1, stage_2)
    assert result["ran_stage_2"] is expected_ran
    assert result["final_status"] == expected_final


def test_stage_routing_rejects_stage_2_when_stage_1_blocks() -> None:
    with pytest.raises(ValueError, match="must not run"):
        stage_routing("BLOCKED", "DONE")
    with pytest.raises(ValueError, match="must not run"):
        stage_routing("NEEDS_CONTEXT", "DONE_WITH_CONCERNS")


def test_stage_routing_requires_stage_2_when_stage_1_passes() -> None:
    with pytest.raises(ValueError, match="requires stage-2"):
        stage_routing("DONE", None)
    with pytest.raises(ValueError, match="requires stage-2"):
        stage_routing("DONE_WITH_CONCERNS", None)


# --- Schema integration -------------------------------------------------


def test_schema_enum_covers_all_routing_inputs() -> None:
    schema = json.loads(SCHEMA.read_text())
    enum = set(schema["properties"]["status"]["enum"])
    required = {"DONE", "DONE_WITH_CONCERNS", "NEEDS_CONTEXT", "BLOCKED"}
    assert required.issubset(enum), (
        f"schema enum must cover every status the routing rule "
        f"references; missing: {required - enum}"
    )
