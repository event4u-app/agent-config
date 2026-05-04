"""F13 — README hero-count drift regression (Phase 0b.1, Surface 3).

Failure mode replayed: the README badge line ships pre-release counts
that disagree with what the package actually contains. Reviewer 1 cited
this as a recurring pre-1.16 incident — the README on `main` claimed
pre-1.15 numbers for two release cycles. The 1.16 follow-up roadmap
(F13 → 0b.1) requires a regression test so the next divergence fails
CI instead of shipping silently.

The hero badge in `README.md` line ~10 must list:

    {S} Skills · {R} Rules · {C} Commands · {G} Guidelines · 8 AI Tools

where the counts come from disk:

  * Skills      = `.agent-src.uncompressed/skills/*` directory count
  * Rules       = `.agent-src.uncompressed/rules/*.md` file count
  * Commands    = `.agent-src.uncompressed/commands/*.md` minus files
                  with frontmatter `deprecated_in:` (deprecation shims
                  are documented separately in AGENTS.md)
  * Guidelines  = `docs/guidelines/**/*.md` recursive count

`AGENTS.md` carries the same skill/rule headline numbers and is checked
in the same pass. AI-tool count is held constant at 8 (Augment, Claude,
Cursor, Cline, Windsurf, Gemini, Copilot, Claude.ai) — drift in that
number requires documentation work, not a count update.
"""

from __future__ import annotations

import re
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
SRC = REPO_ROOT / ".agent-src.uncompressed"

HERO_RE = re.compile(
    r"<strong>(\d+)\s+Skills</strong>\s*·\s*"
    r"<strong>(\d+)\s+Rules</strong>\s*·\s*"
    r"<strong>(\d+)\s+Commands</strong>\s*·\s*"
    r"<strong>(\d+)\s+Guidelines</strong>"
)


def _count_skills() -> int:
    return sum(1 for p in (SRC / "skills").iterdir() if p.is_dir())


def _count_rules() -> int:
    return sum(1 for p in (SRC / "rules").glob("*.md"))


def _count_active_commands() -> int:
    total = 0
    deprecated = 0
    for p in (SRC / "commands").glob("*.md"):
        total += 1
        text = p.read_text(encoding="utf-8")
        if re.search(r"^deprecated_in:\s*", text, re.MULTILINE):
            deprecated += 1
    return total - deprecated


def _count_guidelines() -> int:
    return sum(1 for p in (REPO_ROOT / "docs" / "guidelines").rglob("*.md"))


def test_readme_hero_counts_match_disk() -> None:
    readme = (REPO_ROOT / "README.md").read_text(encoding="utf-8")
    m = HERO_RE.search(readme)
    assert m, (
        "README.md is missing the hero badge line — expected pattern "
        "`<strong>N Skills</strong> · <strong>N Rules</strong> · "
        "<strong>N Commands</strong> · <strong>N Guidelines</strong>`"
    )
    claimed = {
        "Skills": int(m.group(1)),
        "Rules": int(m.group(2)),
        "Commands": int(m.group(3)),
        "Guidelines": int(m.group(4)),
    }
    actual = {
        "Skills": _count_skills(),
        "Rules": _count_rules(),
        "Commands": _count_active_commands(),
        "Guidelines": _count_guidelines(),
    }
    drift = {k: (claimed[k], actual[k]) for k in claimed if claimed[k] != actual[k]}
    assert not drift, (
        "README.md hero counts drifted from disk reality:\n"
        + "\n".join(
            f"  {k}: README claims {c}, disk has {a} (Δ={a - c:+d})"
            for k, (c, a) in drift.items()
        )
        + "\n\nUpdate README.md (and AGENTS.md if needed) before merging."
    )


def test_agents_md_skill_rule_counts_match_disk() -> None:
    agents = (REPO_ROOT / "AGENTS.md").read_text(encoding="utf-8")
    skill_m = re.search(r"skills/\s*\((\d+) skills?\)", agents)
    rule_m = re.search(r"rules/\s*\((\d+) rules?\)", agents)
    assert skill_m and rule_m, (
        "AGENTS.md is missing the `skills/ (N skills)` / `rules/ (N rules)` "
        "headline lines under `## Repository layout`."
    )
    claimed_s = int(skill_m.group(1))
    claimed_r = int(rule_m.group(1))
    actual_s = _count_skills()
    actual_r = _count_rules()
    drift = []
    if claimed_s != actual_s:
        drift.append(f"  skills: AGENTS.md claims {claimed_s}, disk has {actual_s}")
    if claimed_r != actual_r:
        drift.append(f"  rules: AGENTS.md claims {claimed_r}, disk has {actual_r}")
    assert not drift, "AGENTS.md headline counts drifted:\n" + "\n".join(drift)
