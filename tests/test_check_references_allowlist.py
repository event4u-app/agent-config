"""Tests for the content-class allowlist in scripts/check_references.py.

Guards the false-positive treadmill the linter-debt roadmap paid down:
prior to ALLOWLIST_PATTERNS, known non-reference token shapes (execution-type
enum values, pack identifiers, bare meta-qualifier keywords) tripped the
`X` skill / `X` rule prose patterns and were dodged by *rewording the prose
per file* (commits dc84ed01, bd02ef0b). The allowlist matches the token
class centrally instead. These tests assert both directions: each allowlist
class passes, and a genuine broken reference still fails.
"""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scripts"))
import check_references as cr  # noqa: E402


ARTIFACTS = {
    "skills": {"real-skill"},
    "rules": {"real-rule"},
    "commands": set(),
    "guidelines": set(),
    "personas": set(),
}


def _check(tmp_path: Path, body: str) -> list[cr.BrokenRef]:
    """Run check_file over a single .md file holding `body`."""
    md = tmp_path / "doc.md"
    md.write_text(body, encoding="utf-8")
    return cr.check_file(md, ARTIFACTS, tmp_path)


def _skill_rule_refs(broken: list[cr.BrokenRef]) -> list[cr.BrokenRef]:
    return [b for b in broken if b.ref_type in ("skill", "rule")]


# --- allowlist classes pass (no false positives) -------------------------

def test_execution_type_enum_passes(tmp_path):
    body = (
        "The preview shows whether it is a `manual` skill or an `assisted` "
        "skill, and whether an `automated` skill needs a handler.\n"
    )
    assert not _skill_rule_refs(_check(tmp_path, body))


def test_pack_identifier_passes(tmp_path):
    body = (
        "The sibling command declares four `pack-ai-video` skills, and the "
        "`pack-finance-basic` rule gates the disclosure footer.\n"
    )
    assert not _skill_rule_refs(_check(tmp_path, body))


def test_bare_meta_qualifier_passes(tmp_path):
    body = (
        "`agent-status` is a `command` skill surface, not a `skill` rule — "
        "the `command` vs `skill` distinction matters.\n"
    )
    assert not _skill_rule_refs(_check(tmp_path, body))


def test_restored_preview_line_passes(tmp_path):
    """The exact natural wording dc84ed01 distorted must pass."""
    body = (
        "Show the plain-language preview: the skill's execution type (a "
        "`manual` skill renders **\"instructional only\"**; an `assisted` "
        "skill renders its proposed actions).\n"
    )
    assert not _skill_rule_refs(_check(tmp_path, body))


def test_restored_roadmap_line_passes(tmp_path):
    """The exact natural wording bd02ef0b distorted must pass."""
    body = (
        "The sibling `/video:from-script` **already** declares four "
        "`pack-ai-video` skills and the repo's validator fails fast.\n"
    )
    assert not _skill_rule_refs(_check(tmp_path, body))


def test_real_skill_reference_passes(tmp_path):
    body = "Use the `real-skill` skill and the `real-rule` rule.\n"
    assert not _skill_rule_refs(_check(tmp_path, body))


# --- genuine broken references still fail (no over-allowlisting) ----------

def test_unknown_skill_reference_still_fails(tmp_path):
    body = "Use the `nonexistent-skill` skill for this.\n"
    broken = _skill_rule_refs(_check(tmp_path, body))
    assert any(b.ref == "nonexistent-skill" and b.ref_type == "skill" for b in broken)


def test_unknown_rule_reference_still_fails(tmp_path):
    body = "This honours the `nonexistent-rule` rule.\n"
    broken = _skill_rule_refs(_check(tmp_path, body))
    assert any(b.ref == "nonexistent-rule" and b.ref_type == "rule" for b in broken)


def test_pack_prefix_does_not_mask_unrelated_unknown(tmp_path):
    """`packaging-helper` is NOT a pack id — must still fail."""
    body = "Use the `packaging-helper` skill.\n"
    broken = _skill_rule_refs(_check(tmp_path, body))
    assert any(b.ref == "packaging-helper" for b in broken)


# --- structural guards on the allowlist itself ---------------------------

def test_every_allowlist_entry_has_a_reason():
    assert cr.ALLOWLIST_PATTERNS, "allowlist must not be empty"
    for entry in cr.ALLOWLIST_PATTERNS:
        assert entry.reason and entry.reason.strip(), \
            f"allowlist entry {entry.pattern.pattern!r} needs a reason"


def test_is_allowlisted_matches_expected_tokens():
    assert cr._is_allowlisted("manual")
    assert cr._is_allowlisted("assisted")
    assert cr._is_allowlisted("automated")
    assert cr._is_allowlisted("pack-ai-video")
    assert cr._is_allowlisted("command")
    # real and unknown artifact ids are NOT allowlisted
    assert not cr._is_allowlisted("real-skill")
    assert not cr._is_allowlisted("nonexistent-skill")
    assert not cr._is_allowlisted("packaging-helper")
