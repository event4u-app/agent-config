#!/usr/bin/env python3
"""Validate the 6.0.0 release-note migration instructions against fixtures.

road-to-6.0.0-final-readiness Phase 3 Step 3: "from a 5.10.1 fixture state,
follow the written steps verbatim and confirm the result matches the 6.0.0
expected state." Two breaking changes carry migration steps in CHANGELOG.md
§ "Breaking changes (6.0.0)"; this test reproduces each from a fixture.

Run: python3 -m pytest tests/test_6_0_0_migration_instructions.py -q
"""
import sys
from pathlib import Path

import pytest

REPO = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO / "src" / "scripts"))


# --- BC1: condensed output moved root `.agent-src/` → `dist/agent-src/` ---


def test_bc1_path_replacement_reproduces_expected_state():
    """Written step: 'replace `.agent-src/` with `dist/agent-src/` in any path
    you hard-code.' Fixture: a 5.10.1-style hard-coded path. Verify the
    documented replacement yields the 6.0.0 path AND that the target is real
    while the old root tree is gone (the 'removed' claim holds)."""
    # 5.10.1 fixture: a tool config / script hard-coding the old root tree.
    fixture_line = "skills_dir: .agent-src/skills/laravel/SKILL.md"
    # Follow the instruction verbatim.
    migrated = fixture_line.replace(".agent-src/", "dist/agent-src/")
    assert migrated == "skills_dir: dist/agent-src/skills/laravel/SKILL.md"
    # 6.0.0 expected state: the replacement target is a real shipped path...
    assert (REPO / "dist/agent-src/skills/laravel/SKILL.md").exists()
    # ...and the old root tree the instruction calls "removed" is truly gone.
    assert not (REPO / ".agent-src").exists()


def test_bc1_breaking_entry_present_in_changelog():
    """The release notes must actually carry the BC1 migration entry the
    walkthrough validates (guards against the section being dropped)."""
    changelog = (REPO / "CHANGELOG.md").read_text(encoding="utf-8")
    assert "Breaking changes (6.0.0)" in changelog
    assert "root `.agent-src/` → `dist/agent-src/`" in changelog


# --- BC2: settings key `cost_profile` → `rule_loading_tier` ---------------


def test_bc2_legacy_settings_migration_renames_cost_profile(tmp_path):
    """Written step: 'automatic — agent-config install/setup migrates existing
    settings.' Fixture: a 5.10.1-style flat `.agent-settings` carrying
    `cost_profile`. Verify the migration parser maps it to the new dotted key
    via LEGACY_RENAME_MAP (the mechanism `install` runs)."""
    import install  # noqa: WPS433 — sys.path prepared above

    legacy = "cost_profile=minimal\nuser_name=Mathias\n"
    values, unknown = install._parse_legacy_settings(legacy)
    # The legacy flat key is recognised (not 'unknown')...
    assert "cost_profile" not in unknown
    assert values.get("cost_profile") == "minimal"
    # ...and the rename map sends it to the 6.0.0 dotted key.
    assert install.LEGACY_RENAME_MAP["cost_profile"] == "rule_loading_tier"


if __name__ == "__main__":
    raise SystemExit(pytest.main([__file__, "-q"]))
