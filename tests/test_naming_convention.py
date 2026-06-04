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

import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO_ROOT / "src" / "scripts"))
from _lib.agent_src import artefact_roots  # noqa: E402

POLICY_VERB_SUFFIXES = ("-policy", "-gate", "-floor", "-authority")
TOOL_NOUN_SUFFIXES = (
    "-evidence", "-audit", "-mapper", "-router",
    "-tool", "-checker", "-finder", "-analyzer", "-tracker",
)


def _rule_names() -> list[str]:
    seen: set[str] = set()
    for root in artefact_roots():
        rules_dir = root / "rules"
        if rules_dir.is_dir():
            for p in rules_dir.glob("*.md"):
                seen.add(p.stem)
    return sorted(seen)


def _skill_names() -> list[str]:
    seen: set[str] = set()
    for root in artefact_roots():
        skills_dir = root / "skills"
        if skills_dir.is_dir():
            for p in skills_dir.iterdir():
                if p.is_dir():
                    seen.add(p.name)
    return sorted(seen)


def test_no_rule_uses_tool_noun_suffix() -> None:
    """Rules must not end in tool-noun suffixes (those names belong to skills)."""
    offenders = [
        name for name in _rule_names()
        if any(name.endswith(suf) for suf in TOOL_NOUN_SUFFIXES)
    ]
    assert not offenders, (
        f"Rules using tool-noun suffix (should be skill names): {offenders}. "
        f"Tool-noun suffixes reserved for skills: {TOOL_NOUN_SUFFIXES}. "
        f"Rename the rule with a policy-verb suffix or move it to .agent-src.uncondensed/skills/."
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
        f"Rename the skill with a tool-noun suffix or move it to .agent-src.uncondensed/rules/."
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
