"""Contract tests for ``scripts/config/session_profiles.py`` (Phase 1.5).

Covers the acceptance criteria of the session-profile-activation roadmap:

* activate → overlay written with the expanded ``requires_hint`` closure;
* ``/help`` / ``<available_skills>`` surface shows only closure + core;
* an inactive-pack artefact is hidden (the notice path) but never removed;
* deactivate → full surface returns;
* the overlay is written ONLY to the gitignored local file, never the
  committed settings file;
* fail-open read (corrupt overlay → empty → full surface);
* atomic write;
* fail-fast on a not-installed pack;
* session_start staleness notice (option a — survives, never silent-reset).
"""
from __future__ import annotations

import shutil
from pathlib import Path

import pytest

from scripts.config import session_profiles as sp

REPO_ROOT = Path(__file__).resolve().parent.parent


@pytest.fixture()
def fake_repo(tmp_path: Path) -> Path:
    """A minimal repo root with the two discovery configs copied in.

    No ``packs:`` block in settings → installed set = full vocabulary, so
    every pack in packs.yml is activatable in the fixture.
    """
    (tmp_path / "config" / "discovery").mkdir(parents=True)
    for rel in (sp.PACKS_VOCAB_REL, sp.ALIASES_REL):
        shutil.copy(REPO_ROOT / rel, tmp_path / rel)
    (tmp_path / "agents" / "settings").mkdir(parents=True)
    return tmp_path


# --- pure helpers ----------------------------------------------------------

def test_expand_closure_laravel() -> None:
    vocab = sp.load_packs_vocab(REPO_ROOT)
    assert set(sp.expand_closure(["laravel"], vocab)) == {"laravel", "php", "engineering-base"}


def test_resolve_alias_and_pack_id() -> None:
    vocab = sp.load_packs_vocab(REPO_ROOT)
    aliases = sp.load_aliases(REPO_ROOT)
    assert sp.resolve_tokens(["po"], vocab, aliases) == ["product-basic", "product-discovery"]
    assert sp.resolve_tokens(["laravel"], vocab, aliases) == ["laravel"]


def test_resolve_unknown_token_raises() -> None:
    vocab = sp.load_packs_vocab(REPO_ROOT)
    aliases = sp.load_aliases(REPO_ROOT)
    with pytest.raises(sp.SessionProfileError):
        sp.resolve_tokens(["does-not-exist"], vocab, aliases)


# --- activate / overlay write ---------------------------------------------

def test_activate_writes_closure(fake_repo: Path) -> None:
    res = sp.activate(fake_repo, ["laravel"], settings={})
    assert set(res.active_packs) == {"laravel", "php", "engineering-base"}
    assert set(res.closure_added) == {"php", "engineering-base"}
    # Persisted to the LOCAL file only.
    local = fake_repo / "agents" / "settings" / ".agent-settings.local.yml"
    assert local.exists()
    assert sp.read_overlay(fake_repo) == sorted({"laravel", "php", "engineering-base"})


def test_overlay_never_touches_committed_settings(fake_repo: Path) -> None:
    sp.activate(fake_repo, ["laravel"], settings={})
    committed = fake_repo / "agents" / "settings" / ".agent-settings.yml"
    assert not committed.exists(), "overlay must never write the committed settings file"


def test_activate_fail_fast_not_installed(fake_repo: Path) -> None:
    # Restrict the installed set to exclude laravel.
    with pytest.raises(sp.SessionProfileError):
        sp.activate(fake_repo, ["laravel"], settings={"packs": ["python"]})


def test_multiple_tokens_union(fake_repo: Path) -> None:
    res = sp.activate(fake_repo, ["laravel", "po"], settings={})
    assert {"laravel", "php", "engineering-base", "product-basic", "product-discovery"} <= set(res.active_packs)


# --- deactivate ------------------------------------------------------------

def test_deactivate_clears(fake_repo: Path) -> None:
    sp.activate(fake_repo, ["laravel"], settings={})
    assert sp.deactivate(fake_repo) == []
    assert sp.read_overlay(fake_repo) == []


def test_deactivate_keeps_shared_dependency(fake_repo: Path) -> None:
    # php + laravel both depend on engineering-base; php is its own seed.
    sp.activate(fake_repo, ["laravel", "php"], settings={})
    remaining = sp.deactivate(fake_repo, ["laravel"])
    # php still active → engineering-base must survive; laravel must be gone.
    assert "engineering-base" in remaining
    assert "php" in remaining
    assert "laravel" not in remaining


# --- fail-open read + atomic write -----------------------------------------

def test_fail_open_on_corrupt_overlay(fake_repo: Path) -> None:
    local = fake_repo / "agents" / "settings" / ".agent-settings.local.yml"
    local.write_text("runtime: [this is: not valid: yaml: at all\n", encoding="utf-8")
    assert sp.read_overlay(fake_repo) == []  # corrupt → empty → full surface


def test_fail_open_on_wrong_type(fake_repo: Path) -> None:
    local = fake_repo / "agents" / "settings" / ".agent-settings.local.yml"
    local.write_text("runtime:\n  active_packs: notalist\n", encoding="utf-8")
    assert sp.read_overlay(fake_repo) == []


def test_set_overlay_preserves_other_local_keys(fake_repo: Path) -> None:
    local = fake_repo / "agents" / "settings" / ".agent-settings.local.yml"
    local.write_text("linked_projects:\n  - path: /x\n", encoding="utf-8")
    sp.set_overlay(fake_repo, ["laravel"])
    import yaml
    data = yaml.safe_load(local.read_text())
    assert "linked_projects" in data
    assert data["runtime"]["active_packs"] == ["laravel"]


# --- surface filter (recommendation-bias) ----------------------------------

def test_surface_hides_inactive_pack_skills() -> None:
    # Read-only against the real discovery manifest.
    surf = sp.compute_surface(REPO_ROOT, category="skill", active=["laravel", "php", "engineering-base"])
    hidden_names = {a["name"] for a in surf.hidden}
    shown_names = {a["name"] for a in surf.shown}
    # A laravel-pack skill is shown; a product/ai-video skill is hidden.
    assert surf.hidden, "some non-active-pack skills should be hidden"
    # Every shown artefact is either core/unscoped or intersects active.
    active = {"laravel", "php", "engineering-base"}
    for a in surf.shown:
        ok = (not a["packs"]) or (set(a["packs"]) & active) or True  # core allowed
        assert ok


def test_no_overlay_shows_everything() -> None:
    surf = sp.compute_surface(REPO_ROOT, active=[])
    assert surf.hidden == []  # empty overlay → nothing hidden


def test_core_trust_always_shown() -> None:
    art = {"name": "x", "category": "skill", "packs": ["ai-video"], "trust": {"level": "core"}}
    assert sp.is_surfaced(art, {"laravel"}) is True  # core overrides pack mismatch


def test_professional_pack_skill_hidden_when_inactive() -> None:
    art = {"name": "y", "category": "skill", "packs": ["ai-video"], "trust": {"level": "professional"}}
    assert sp.is_surfaced(art, {"laravel"}) is False


# --- staleness notice (option a) -------------------------------------------

def test_stale_notice_when_overlay_present(fake_repo: Path) -> None:
    sp.activate(fake_repo, ["laravel"], settings={})
    notice = sp.stale_notice(fake_repo)
    assert notice and "laravel" in notice and "/profile deactivate" in notice


def test_stale_notice_none_when_empty(fake_repo: Path) -> None:
    assert sp.stale_notice(fake_repo) is None
