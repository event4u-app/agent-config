"""F3.2 CI guard — enforce policy-verb (rules) vs tool-noun (skills) split.

Per `road-to-governance-cleanup.md` Finding 3:
  - Rules use **policy verbs**: `*-policy`, `*-gate`, `*-floor`, `*-authority`.
  - Skills use **tool nouns**: `*-evidence`, `*-audit`, `*-mapper`, `*-router`,
    `*-tool`, `*-checker`, `*-finder`, `*-analyzer`, `*-tracker`.

The split prevents the historic confusion where a rule (obligation) and a
skill (procedure) shared the same name (e.g. `verify-before-complete` rule
+ skill). After F3.1 the namespace is clean — this guard locks it in.

Three checks:
  1. No rule may end in a tool-noun suffix (those names belong to skills).
  2. No skill may end in a policy-verb suffix (those names belong to rules).
  3. No rule and skill may share the same name.
"""

from __future__ import annotations

from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
RULES_DIR = REPO_ROOT / ".agent-src.uncompressed" / "rules"
SKILLS_DIR = REPO_ROOT / ".agent-src.uncompressed" / "skills"

POLICY_VERB_SUFFIXES = ("-policy", "-gate", "-floor", "-authority")
TOOL_NOUN_SUFFIXES = (
    "-evidence", "-audit", "-mapper", "-router",
    "-tool", "-checker", "-finder", "-analyzer", "-tracker",
)


def _rule_names() -> list[str]:
    return sorted(p.stem for p in RULES_DIR.glob("*.md"))


def _skill_names() -> list[str]:
    return sorted(p.name for p in SKILLS_DIR.iterdir() if p.is_dir())


def test_no_rule_uses_tool_noun_suffix() -> None:
    """Rules must not end in tool-noun suffixes (those names belong to skills)."""
    offenders = [
        name for name in _rule_names()
        if any(name.endswith(suf) for suf in TOOL_NOUN_SUFFIXES)
    ]
    assert not offenders, (
        f"Rules using tool-noun suffix (should be skill names): {offenders}. "
        f"Tool-noun suffixes reserved for skills: {TOOL_NOUN_SUFFIXES}. "
        f"Rename the rule with a policy-verb suffix or move it to .agent-src.uncompressed/skills/."
    )


def test_no_skill_uses_policy_verb_suffix() -> None:
    """Skills must not end in policy-verb suffixes (those names belong to rules)."""
    offenders = [
        name for name in _skill_names()
        if any(name.endswith(suf) for suf in POLICY_VERB_SUFFIXES)
    ]
    assert not offenders, (
        f"Skills using policy-verb suffix (should be rule names): {offenders}. "
        f"Policy-verb suffixes reserved for rules: {POLICY_VERB_SUFFIXES}. "
        f"Rename the skill with a tool-noun suffix or move it to .agent-src.uncompressed/rules/."
    )


def test_no_rule_skill_name_collision() -> None:
    """A rule and a skill must not share the same name (historic collision risk)."""
    rules = set(_rule_names())
    skills = set(_skill_names())
    collisions = sorted(rules & skills)
    assert not collisions, (
        f"Rule↔skill name collision: {collisions}. "
        f"Rules use policy verbs, skills use tool nouns — no shared identifiers. "
        f"Rename one side per F3 convention."
    )
