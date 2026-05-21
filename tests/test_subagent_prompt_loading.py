"""P1.2 B / C — every subagent-orchestration mode has a loadable prompt.

The seven modes are named in `subagent-orchestration/SKILL.md` § "The
seven modes". Each must have a sibling file under `prompts/{mode}.md` that:

  1. Exists and is non-empty.
  2. References the status taxonomy schema by path.
  3. Mentions all four statuses (DONE, DONE_WITH_CONCERNS,
     NEEDS_CONTEXT, BLOCKED).
  4. Cites the SKILL.md mode reference for navigation.

Hand-written checks (no jsonschema runtime dep), matching the project
convention from `tests/test_subagent_status_schema.py`.
"""

from __future__ import annotations

import re
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parents[1]
# Post-monorepo Phase 4 the skill lives under packages/<pack>/...; use
# the shared discovery helper to find its physical location.
import sys as _sys  # noqa: E402

_sys.path.insert(0, str(REPO_ROOT / "scripts"))
from _lib.agent_src import resolve_logical  # noqa: E402

_skill_md = resolve_logical("skills/subagent-orchestration/SKILL.md")
assert _skill_md is not None, "subagent-orchestration/SKILL.md not found in any artefact root"
SKILL_DIR = _skill_md.parent
PROMPTS_DIR = SKILL_DIR / "prompts"
SKILL_MD = _skill_md

EXPECTED_MODES = (
    "do-and-judge",
    "do-and-judge-two-stage",
    "do-in-steps",
    "do-in-parallel",
    "do-competitively",
    "judge-with-debate",
    "do-in-worktrees",
)
REQUIRED_STATUSES = ("DONE", "DONE_WITH_CONCERNS", "NEEDS_CONTEXT", "BLOCKED")


def _mode_headings_in_skill() -> list[str]:
    """Extract mode headings from SKILL.md § 'The seven modes'."""
    text = SKILL_MD.read_text()
    section = re.split(r"^## The seven modes$", text, flags=re.MULTILINE)
    assert len(section) >= 2, "SKILL.md missing '## The seven modes' heading"
    body = section[1].split("\n## ", 1)[0]
    headings = re.findall(r"^### \d+\. ([a-z0-9-]+)$", body, flags=re.MULTILINE)
    return headings


def test_skill_lists_seven_modes() -> None:
    headings = _mode_headings_in_skill()
    assert len(headings) == 7, f"expected 7 mode headings, got {headings}"
    assert tuple(headings) == EXPECTED_MODES, (
        f"mode order/names drifted: SKILL.md has {headings}, "
        f"test expects {list(EXPECTED_MODES)}"
    )


def test_prompts_dir_exists_with_readme() -> None:
    assert PROMPTS_DIR.is_dir(), f"missing {PROMPTS_DIR}"
    readme = PROMPTS_DIR / "README.md"
    assert readme.exists(), "prompts/README.md required as index"
    text = readme.read_text()
    for mode in EXPECTED_MODES:
        assert f"{mode}.md" in text, f"README must reference {mode}.md"


@pytest.mark.parametrize("mode", EXPECTED_MODES)
def test_each_mode_has_loadable_prompt(mode: str) -> None:
    path = PROMPTS_DIR / f"{mode}.md"
    assert path.exists(), f"missing prompt file {path}"
    text = path.read_text()
    assert text.strip(), f"{path} is empty"
    assert len(text) > 200, f"{path} is suspiciously short ({len(text)} chars)"


@pytest.mark.parametrize("mode", EXPECTED_MODES)
def test_prompt_cites_status_schema(mode: str) -> None:
    text = (PROMPTS_DIR / f"{mode}.md").read_text()
    assert "schemas/subagent-status.json" in text, (
        f"{mode}.md must reference the status schema by path so prompt "
        f"edits stay in sync with the envelope contract"
    )


@pytest.mark.parametrize("mode", EXPECTED_MODES)
def test_prompt_mentions_all_four_statuses(mode: str) -> None:
    text = (PROMPTS_DIR / f"{mode}.md").read_text()
    missing = [s for s in REQUIRED_STATUSES if s not in text]
    assert not missing, (
        f"{mode}.md must mention all four statuses; missing: {missing}"
    )


@pytest.mark.parametrize("mode", EXPECTED_MODES)
def test_prompt_cites_skill_mode_reference(mode: str) -> None:
    text = (PROMPTS_DIR / f"{mode}.md").read_text()
    assert "../SKILL.md" in text, (
        f"{mode}.md must link back to ../SKILL.md so a reader of the "
        f"prompt can find the mode-selection matrix"
    )


def test_no_orphan_prompt_files() -> None:
    """Catch dead prompt files that no longer match any documented mode."""
    actual = {p.stem for p in PROMPTS_DIR.glob("*.md") if p.stem != "README"}
    expected = set(EXPECTED_MODES)
    orphans = actual - expected
    assert not orphans, (
        f"orphan prompt files: {sorted(orphans)}. Either add the mode "
        f"to SKILL.md § 'The six modes' or delete the file."
    )
