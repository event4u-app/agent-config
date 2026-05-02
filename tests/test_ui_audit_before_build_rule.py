"""Content invariants for ``ui-audit-before-build`` (R3 Phase 2 Step 5).

The rule file is the defense-in-depth twin of the dispatcher gate in
``directives/ui/audit.py``: when an agent is acting outside the engine
(free-form edit, "add a tile" request, side conversation that bypasses
``/work`` or ``/implement-ticket``), this rule still refuses the write.

These tests pin the load-bearing content the rule body **must** carry
so a refactor cannot accidentally weaken the gate. Runtime enforcement
of the rule itself happens in agent context; this is the static
content gate.
"""
from __future__ import annotations

from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parent.parent
RULE_PATH = (
    REPO_ROOT
    / ".agent-src.uncompressed"
    / "rules"
    / "ui-audit-before-build.md"
)


@pytest.fixture(scope="module")
def rule_text() -> str:
    assert RULE_PATH.exists(), f"missing rule file: {RULE_PATH}"
    return RULE_PATH.read_text(encoding="utf-8")


def test_rule_declares_auto_trigger_frontmatter(rule_text: str) -> None:
    """Demoted to ``type: auto`` per F1.2 (always-rule budget). Description
    must carry an explicit UI-write trigger so the rule still fires before
    a component edit even though it is no longer always-loaded."""
    assert 'type: "auto"' in rule_text
    assert "alwaysApply: false" in rule_text
    # Trigger description must mention UI-write triggers so auto-routing fires.
    assert "Writing or editing UI" in rule_text or "UI" in rule_text


def test_rule_states_iron_law_verbatim(rule_text: str) -> None:
    """The Iron Law block is the load-bearing trigger phrase agents read."""
    assert "## The Iron Law" in rule_text
    assert "NO NEW COMPONENT, SCREEN, PARTIAL, OR PAGE WITHOUT AUDIT FINDINGS." in rule_text
    assert "EXISTING-UI-AUDIT RUNS FIRST. ALWAYS." in rule_text


def test_rule_documents_the_three_findings_shapes(rule_text: str) -> None:
    """``state.ui_audit`` must carry one of: components_found, greenfield, components."""
    assert "components_found" in rule_text
    assert "greenfield" in rule_text
    # Three legal greenfield decisions.
    assert "scaffold" in rule_text
    assert "bare" in rule_text
    assert "external_reference" in rule_text
    # Legacy alias kept for back-compat.
    assert "components" in rule_text


def test_rule_documents_ui_trivial_allow_list(rule_text: str) -> None:
    """The only escape is ``ui-trivial`` with bounded change preconditions."""
    assert "ui-trivial" in rule_text
    assert "≤ 1 file" in rule_text
    assert "≤ 5 changed lines" in rule_text


def test_rule_rejects_empty_audit(rule_text: str) -> None:
    """``state.ui_audit = {}`` must be explicitly called out as not findings."""
    assert "{}" in rule_text
    # Either "{}" inline or "empty dict is rejected" — both load-bearing.
    assert "empty dict is rejected" in rule_text


def test_rule_links_to_audit_dispatcher_twin(rule_text: str) -> None:
    """The rule explicitly names the dispatcher gate as its code-layer twin."""
    assert "directives/ui/audit.py" in rule_text


def test_rule_links_to_existing_ui_audit_skill(rule_text: str) -> None:
    """The rule must point agents at the skill that produces the findings."""
    assert "existing-ui-audit" in rule_text


def test_rule_has_failure_modes_section(rule_text: str) -> None:
    """``## Failure modes`` is the section reviewers grep for in PRs."""
    assert "## Failure modes" in rule_text
    # The single biggest failure: writing first, thinking about reuse later.
    assert "Writing the component first" in rule_text
