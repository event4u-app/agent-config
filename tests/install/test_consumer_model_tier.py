"""Step 19b — consumer model-tier auto-switch reaches the installed tree.

`install.finalize_claude_model_tiers` rewrites the payload-synced
`.claude/skills/<skill>` symlinks so model-tier-bearing skills carry a native
Claude `model:` key when the consumer opted into `model.auto_switch: auto`.
Mirrors the repo generator (`condense.py::generate_claude_skills`).

Regression guard: 5.10.0 shipped `~/.claude/skills/` with raw `model_tier:`
and zero native `model:`, so Claude Code never performed the per-turn switch.
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(REPO_ROOT / "src" / "scripts"))

import install  # type: ignore  # noqa: E402


def _stage_consumer(root: Path, auto_switch: str) -> None:
    """Stage a consumer with two augment skills (one model-tier, one inherit),
    each symlinked into .claude/skills/ exactly as install.sh does."""
    settings = root / "agents" / "settings" / ".agent-settings.yml"
    settings.parent.mkdir(parents=True, exist_ok=True)
    settings.write_text(f"model:\n  auto_switch: {auto_switch}\n", encoding="utf-8")

    augment = root / ".augment" / "skills"
    claude = root / ".claude" / "skills"
    augment.mkdir(parents=True, exist_ok=True)
    claude.mkdir(parents=True, exist_ok=True)

    def _skill(name: str, tier_line: str) -> None:
        sdir = augment / name
        sdir.mkdir(parents=True, exist_ok=True)
        (sdir / "SKILL.md").write_text(
            f"---\nname: {name}\n{tier_line}\n---\n\n# {name}\n\nbody\n",
            encoding="utf-8",
        )
        (sdir / "reference.md").write_text("ref\n", encoding="utf-8")
        # install.sh shape: .claude/skills/<name> -> ../../.augment/skills/<name>
        os.symlink(Path("../../.augment/skills") / name, claude / name)

    _skill("tiered-skill", "model_tier: medium")
    _skill("inherit-skill", "model_tier: inherit")


def test_auto_switch_renders_native_model(tmp_path, monkeypatch):
    monkeypatch.setattr(install, "QUIET", True, raising=False)
    _stage_consumer(tmp_path, "auto")

    rendered = install.finalize_claude_model_tiers(tmp_path)
    assert rendered == 1  # only the model-tier skill

    claude = tmp_path / ".claude" / "skills"
    # The model-tier skill is now a REAL dir with a rendered SKILL.md.
    tiered = claude / "tiered-skill"
    assert tiered.is_dir() and not tiered.is_symlink()
    skill_md = (tiered / "SKILL.md").read_text(encoding="utf-8")
    assert "model: sonnet" in skill_md
    assert "model_tier:" not in skill_md
    # Non-SKILL.md files stay symlinks into .augment/skills.
    assert (tiered / "reference.md").is_symlink()
    assert os.readlink(tiered / "reference.md") == "../../../.augment/skills/tiered-skill/reference.md"

    # The inherit skill is untouched (still a symlink, raw frontmatter).
    inherit = claude / "inherit-skill"
    assert inherit.is_symlink()


def test_suggest_is_noop(tmp_path, monkeypatch):
    monkeypatch.setattr(install, "QUIET", True, raising=False)
    _stage_consumer(tmp_path, "suggest")

    rendered = install.finalize_claude_model_tiers(tmp_path)
    assert rendered == 0
    # Both skills remain pure symlinks — no native model: injected.
    assert (tmp_path / ".claude" / "skills" / "tiered-skill").is_symlink()
    assert (tmp_path / ".claude" / "skills" / "inherit-skill").is_symlink()


def test_missing_trees_is_noop(tmp_path, monkeypatch):
    monkeypatch.setattr(install, "QUIET", True, raising=False)
    # No .claude/.augment trees at all → silent 0, never raises.
    assert install.finalize_claude_model_tiers(tmp_path) == 0
