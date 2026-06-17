"""Install-layout ABI conformance test.

Locks the on-disk install layout (Phase 1 of
``road-to-install-contract-stability``). The layout is frozen as a
versioned contract in ``docs/contracts/install-layout.md`` and pinned as a
golden snapshot in ``tests/fixtures/install_layout_v<N>.json``.

The test builds a *layout descriptor* from the live installer constants and
asserts it equals the golden for the current ``INSTALL_LAYOUT_VERSION``. On
mismatch the layout changed without a version bump — either revert the
change, or bump ``INSTALL_LAYOUT_VERSION`` (+ add a new golden fixture and a
``### Breaking`` / deprecation note per ``BREAKING_CHANGES.md``).

**Scope (honest about what is locked):**

- *Structurally locked* (live-derived from source, so a source change trips
  the test): the supported-tools set, per-tool project bridge markers,
  user-scope anchor paths, global deploy sources, and the global-lockfile
  rendered field set + version constants.
- *Doc-locked* (pinned in the golden + cross-checked against the contract
  doc, so a doc change trips the test): the claimed JSON-pointer keys. These
  are inline literals in ``install.py`` (not a single constant), so the test
  cannot read them from source without a refactor that Phase 1 deliberately
  excludes. Source-level pointer drift is covered by code review and the
  structural breaking detector (``check_structural_breaking.py``).
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT / "src"))
sys.path.insert(0, str(ROOT / "src" / "scripts"))

import install  # noqa: E402  # top-level import (src/scripts/install.py)
from scripts._lib import installed_lock  # noqa: E402
from scripts._lib.install_layout import INSTALL_LAYOUT_VERSION  # noqa: E402

FIXTURE_DIR = ROOT / "tests" / "fixtures"
CONTRACT_DOC = ROOT / "docs" / "contracts" / "install-layout.md"

# Claimed JSON-pointer keys (RFC-6901), doc-locked. Kept in sync with the
# "Claimed JSON-pointer keys" table in install-layout.md; the test asserts
# each appears in the contract doc.
CLAIMED_POINTER_KEYS = [
    "/enabledPlugins/agent-config@event4u",
    "/enabledPlugins/agent-config@event4u-agent-config",
    "/hooks/sessionStart",
    "/hooks/sessionEnd",
    "/hooks/stop",
    "/hooks/beforeSubmitPrompt",
    "/hooks/postToolUse",
    "/hooks/post_setup_worktree",
    "/hooks/pre_user_prompt",
    "/hooks/post_cascade_response",
    "/marketplace/name",
    "/marketplace/plugins/0",
    "/chat/pluginLocations",
]


def _lockfile_field_order() -> list[str]:
    """The rendered global-lockfile field order (shape, not values)."""
    rendered = installed_lock._render("0.0.0", ["claude-code"], "2026-01-01T00:00:00Z")
    fields: list[str] = []
    for line in rendered.splitlines():
        if line and not line.startswith((" ", "\t", "-")) and ":" in line:
            fields.append(line.split(":", 1)[0].strip())
    return fields


def build_layout_descriptor() -> dict:
    """The live install-layout ABI descriptor, derived from source constants."""
    return {
        "install_layout_version": INSTALL_LAYOUT_VERSION,
        "valid_tools": sorted(install._VALID_TOOLS),
        "project_bridge_markers": dict(sorted(install.PROJECT_BRIDGE_MARKERS.items())),
        "user_scope_paths": {
            k: str(v) for k, v in sorted(install.USER_SCOPE_PATHS.items())
        },
        "global_deploy_sources": {
            k: [list(t) for t in install.GLOBAL_DEPLOY_SOURCES[k]]
            for k in sorted(install.GLOBAL_DEPLOY_SOURCES)
        },
        "lockfile": {
            "schema_version": installed_lock.SCHEMA_VERSION,
            "field_order": _lockfile_field_order(),
        },
        "claimed_pointer_keys": sorted(CLAIMED_POINTER_KEYS),
    }


def _golden_path() -> Path:
    return FIXTURE_DIR / f"install_layout_v{INSTALL_LAYOUT_VERSION}.json"


def test_golden_fixture_exists() -> None:
    """A golden snapshot must exist for the current layout version."""
    assert _golden_path().exists(), (
        f"No golden fixture for install_layout_version={INSTALL_LAYOUT_VERSION}. "
        f"Bumping INSTALL_LAYOUT_VERSION requires adding {_golden_path().name} "
        f"(snapshot the new shape) + a ### Breaking note in BREAKING_CHANGES.md."
    )


def test_install_layout_matches_golden() -> None:
    """The live layout must match the frozen golden for the current version.

    Failure = the install ABI changed without a version bump. Either revert,
    or bump INSTALL_LAYOUT_VERSION + add a new golden + a deprecation note.
    """
    golden = json.loads(_golden_path().read_text(encoding="utf-8"))
    live = build_layout_descriptor()
    assert live == golden, (
        "Install layout drifted from the frozen golden for "
        f"install_layout_version={INSTALL_LAYOUT_VERSION}. If this change is "
        "intentional: bump INSTALL_LAYOUT_VERSION in src/scripts/_lib/"
        "install_layout.py, regenerate the golden fixture, and add a "
        "### Breaking deprecation-window note in BREAKING_CHANGES.md. "
        "Otherwise revert the install-layout change."
    )


def test_claimed_pointer_keys_documented() -> None:
    """Every claimed JSON-pointer key must appear in the contract doc."""
    doc = CONTRACT_DOC.read_text(encoding="utf-8")
    missing = [k for k in CLAIMED_POINTER_KEYS if k.rsplit("/", 1)[-1] not in doc]
    assert not missing, (
        f"Claimed pointer keys missing from {CONTRACT_DOC.name}: {missing}. "
        "Keep the pointer-key table in install-layout.md in sync with "
        "CLAIMED_POINTER_KEYS."
    )


def test_layout_version_is_positive() -> None:
    assert INSTALL_LAYOUT_VERSION >= 1


# --- in-place migration (Phase 1.5) ---

PRE_FREEZE_LOCK = (
    'schema_version: 1\n'
    'agent_config_version: "5.0.0"\n'
    'installed_at: "2026-01-15T09:30:00Z"\n'
    "tools:\n"
    "  - claude-code\n"
    "  - cursor\n"
)


def test_migrate_absent_lockfile_returns_none(tmp_path: Path) -> None:
    assert installed_lock.migrate_layout(path=tmp_path / "absent.lock") is None


def test_migrate_pre_freeze_tree_stamps_and_preserves(tmp_path: Path) -> None:
    p = tmp_path / "installed.lock"
    p.write_text(PRE_FREEZE_LOCK, encoding="utf-8")

    res = installed_lock.migrate_layout(path=p)
    assert res == {
        "from": 0,
        "to": INSTALL_LAYOUT_VERSION,
        "changed": [f"install_layout_version 0 → {INSTALL_LAYOUT_VERSION}"],
    }

    data = installed_lock.read_lockfile(path=p)
    assert data["install_layout_version"] == INSTALL_LAYOUT_VERSION
    assert data["agent_config_version"] == "5.0.0"
    assert sorted(data["tools"]) == ["claude-code", "cursor"]
    # installed_at is preserved across the in-place migration
    assert data["installed_at"] == "2026-01-15T09:30:00Z"


def test_migrate_is_idempotent(tmp_path: Path) -> None:
    p = tmp_path / "installed.lock"
    p.write_text(PRE_FREEZE_LOCK, encoding="utf-8")
    installed_lock.migrate_layout(path=p)
    res2 = installed_lock.migrate_layout(path=p)
    assert res2 == {
        "from": INSTALL_LAYOUT_VERSION,
        "to": INSTALL_LAYOUT_VERSION,
        "changed": [],
    }


def test_current_tree_migration_is_noop(tmp_path: Path) -> None:
    p = tmp_path / "installed.lock"
    installed_lock.write_lockfile("6.1.0", ["claude-code"], path=p)
    res = installed_lock.migrate_layout(path=p)
    assert res["changed"] == []


# --- surface-tier resolution (Phase 2 Step 2) ---

from scripts._lib import surface_tiers  # noqa: E402


def test_load_lab_pack_ids_reads_packs_yml() -> None:
    ids = surface_tiers.load_lab_pack_ids(ROOT)
    # The day-one lab packs are tagged surface_tier: lab in packs.yml.
    assert {"ai-video", "ai-image", "fun"} <= ids


def test_frontmatter_packs_command_scalar(tmp_path: Path) -> None:
    p = tmp_path / "cmd.md"
    p.write_text("---\nname: video-scene\npack: ai-video\ntier: 2\n---\nbody\n")
    assert surface_tiers.frontmatter_packs(p) == {"ai-video"}


def test_frontmatter_packs_skill_list(tmp_path: Path) -> None:
    p = tmp_path / "SKILL.md"
    p.write_text("---\nname: video-director\npacks:\n  - ai-video\n---\nbody\n")
    assert surface_tiers.frontmatter_packs(p) == {"ai-video"}


def test_is_lab_artefact(tmp_path: Path) -> None:
    lab = tmp_path / "lab.md"
    lab.write_text("---\npack: ai-video\n---\n")
    core = tmp_path / "core.md"
    core.write_text("---\npacks:\n  - engineering-base\n---\n")
    lab_ids = {"ai-video", "ai-image", "fun"}
    assert surface_tiers.is_lab_artefact(lab, lab_ids) is True
    assert surface_tiers.is_lab_artefact(core, lab_ids) is False


def test_frontmatter_packs_no_tag(tmp_path: Path) -> None:
    p = tmp_path / "plain.md"
    p.write_text("# no frontmatter\n")
    assert surface_tiers.frontmatter_packs(p) == set()


# --- boundary guard (Phase 2 Step 3) ---

import importlib.util  # noqa: E402

_GUARD_PATH = ROOT / "src" / "scripts" / "check_surface_tiers.py"
_spec = importlib.util.spec_from_file_location("check_surface_tiers", _GUARD_PATH)
check_surface_tiers = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(check_surface_tiers)


def test_registry_is_exhaustive_over_clusters() -> None:
    clusters, _ = check_surface_tiers._load_registry()
    assert check_surface_tiers.check_exhaustive(clusters) == []


def test_no_unguarded_core_to_lab_imports() -> None:
    clusters, lab_modules = check_surface_tiers._load_registry()
    violations = check_surface_tiers.check_imports(clusters, lab_modules)
    assert violations == [], "\n".join(violations)


def test_module_tier_resolution() -> None:
    clusters, lab_modules = check_surface_tiers._load_registry()
    mt = check_surface_tiers._module_tier
    assert mt("scripts.ai_council.session", clusters, lab_modules) == "lab"
    assert mt("scripts._lib.installed_lock", clusters, lab_modules) == "core"
    assert mt("council_cli", clusters, lab_modules) == "lab"
    assert mt("json", clusters, lab_modules) == "core"


def test_guarded_handler_import_is_allowed(tmp_path: Path) -> None:
    """A re-import inside an except ModuleNotFoundError handler is guarded."""
    src = (
        "try:\n"
        "    from scripts.ai_council.x import y\n"
        "except ModuleNotFoundError:\n"
        "    import sys\n"
        "    from scripts.ai_council.x import y\n"
    )
    import ast

    guarded = check_surface_tiers._guarded_import_lines(ast.parse(src))
    # both the try-body import (line 2) and the handler import (line 5) guarded
    assert {2, 5} <= guarded
