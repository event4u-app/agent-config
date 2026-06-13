"""Guard: the tier/visibility enforcement lints must stay wired into CI.

`lint_command_tiers.py` (ADR-090 — every command declares a valid `tier:` +
`visibility:`, with the two consistent) and `lint_rule_tiers.py` (every rule
declares a valid `tier:`) are the ONLY CI enforcers of those frontmatter
fields. `validate_frontmatter` treats them as optional, and the lints
otherwise live only in the local `task ci`/`ci-strict` meta-tasks that no
workflow invokes — so they are run as an explicit step in the `skill-lint`
workflow.

This test fails if that wiring regresses (the step is renamed away or a lint is
dropped). Without it, a newly-created rule or command missing a valid
tier/visibility would silently pass CI — the exact gap ADR-090 closed.
"""
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
SKILL_LINT_WORKFLOW = REPO / ".github" / "workflows" / "skill-lint.yml"

# The enforcement lints that MUST run on every PR, as Task targets.
REQUIRED_CI_TASKS = ("task lint-command-tiers", "task lint-rule-tiers")


def test_tier_visibility_lints_wired_in_skill_lint_ci() -> None:
    assert SKILL_LINT_WORKFLOW.is_file(), f"missing workflow: {SKILL_LINT_WORKFLOW}"
    text = SKILL_LINT_WORKFLOW.read_text(encoding="utf-8")
    missing = [t for t in REQUIRED_CI_TASKS if t not in text]
    assert not missing, (
        "tier/visibility enforcement lints not wired into the skill-lint "
        f"workflow: {missing}. They must run in CI on every PR (ADR-090) so a "
        "new rule/command without a valid tier/visibility cannot slip through. "
        "Re-add the step or update this guard if the wiring moved to another "
        "PR-triggered workflow."
    )
