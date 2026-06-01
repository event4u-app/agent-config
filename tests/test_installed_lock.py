"""Tests for ``scripts/_lib/installed_lock.py`` and the global-install
lifecycle that depends on it.

Phase 1.7 of road-to-global-first-install.md. Covers:

- ``read_lockfile`` on missing file / malformed file.
- ``write_lockfile`` atomic write, tool de-duplication + sort, schema.
- ``check_version`` match / mismatch / no-lockfile semantics.
- ``current_package_version`` reads the package's own ``package.json``.
- ``LOCKFILE_ENV`` override redirects the lockfile location.
- ``install.install_global`` round-trip: fresh write, merge on re-run,
  refusal on version mismatch (exit 1), ``--force`` override.
- ``cmd_update._refresh_global_lockfile``: no-op when absent, refresh
  when present, idempotent on same version.
"""
from __future__ import annotations

import io
import os
import sys
from contextlib import redirect_stderr, redirect_stdout
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT / "scripts"))

from scripts._cli import cmd_update  # noqa: E402
from scripts._lib import installed_lock  # noqa: E402

import install  # noqa: E402  # top-level import (scripts/install.py)


# --- installed_lock module ---


def test_read_lockfile_missing_returns_none(tmp_path: Path) -> None:
    assert installed_lock.read_lockfile(tmp_path / "absent.lock") is None


def test_write_lockfile_renders_expected_schema(tmp_path: Path) -> None:
    target = tmp_path / "installed.lock"
    written = installed_lock.write_lockfile(
        "2.1.0", ["cursor", "claude-code", "cursor"], path=target
    )
    assert written == target
    text = target.read_text(encoding="utf-8")
    assert text.startswith("schema_version: 1\n")
    assert 'agent_config_version: "2.1.0"\n' in text
    assert "installed_at:" in text
    # tools de-duplicated and sorted
    assert "  - claude-code\n" in text
    assert "  - cursor\n" in text
    assert text.count("- cursor") == 1


def test_read_lockfile_round_trip(tmp_path: Path) -> None:
    target = tmp_path / "installed.lock"
    installed_lock.write_lockfile("2.0.5", ["aider", "codex"], path=target)
    data = installed_lock.read_lockfile(target)
    assert data is not None
    assert data["schema_version"] == 1
    assert data["agent_config_version"] == "2.0.5"
    assert data["tools"] == ["aider", "codex"]


def test_read_lockfile_tolerates_garbage(tmp_path: Path) -> None:
    target = tmp_path / "installed.lock"
    target.write_text("this is not yaml\nrandom junk\n", encoding="utf-8")
    data = installed_lock.read_lockfile(target)
    assert data == {"tools": []}


def test_check_version_no_lockfile(tmp_path: Path) -> None:
    ok, recorded = installed_lock.check_version("2.1.0", path=tmp_path / "absent.lock")
    assert ok is True
    assert recorded is None


def test_check_version_match(tmp_path: Path) -> None:
    target = tmp_path / "installed.lock"
    installed_lock.write_lockfile("2.1.0", ["cursor"], path=target)
    ok, recorded = installed_lock.check_version("2.1.0", path=target)
    assert ok is True
    assert recorded == "2.1.0"


def test_check_version_mismatch(tmp_path: Path) -> None:
    target = tmp_path / "installed.lock"
    installed_lock.write_lockfile("2.0.5", ["cursor"], path=target)
    ok, recorded = installed_lock.check_version("2.1.0", path=target)
    assert ok is False
    assert recorded == "2.0.5"


# --- classify_mismatch (Phase 2 of road-to-claude-code-global-distribution) ---


def test_classify_mismatch_none_when_recorded_missing() -> None:
    assert installed_lock.classify_mismatch("2.1.0", None) == "none"


def test_classify_mismatch_match_when_equal() -> None:
    assert installed_lock.classify_mismatch("2.1.0", "2.1.0") == "match"


def test_classify_mismatch_upgrade_when_recorded_lower() -> None:
    assert installed_lock.classify_mismatch("4.7.2", "1.42.0") == "upgrade"
    assert installed_lock.classify_mismatch("2.1.0", "2.0.5") == "upgrade"
    assert installed_lock.classify_mismatch("2.0.0", "1.99.99") == "upgrade"


def test_classify_mismatch_downgrade_when_recorded_higher() -> None:
    assert installed_lock.classify_mismatch("4.7.2", "99.0.0") == "downgrade"
    assert installed_lock.classify_mismatch("2.0.5", "2.1.0") == "downgrade"


def test_classify_mismatch_unparseable_legacy_shapes() -> None:
    # Pre-1.0 / namespace-migration legacy strings the parser cannot read
    # are treated as upgrade candidates so the install path can self-heal
    # rather than refuse.
    assert installed_lock.classify_mismatch("4.7.2", "legacy") == "unparseable"
    assert installed_lock.classify_mismatch("4.7.2", "0.9-rc") == "unparseable"


def test_classify_mismatch_tolerates_semver_suffixes() -> None:
    # ``v`` prefix and pre-release suffixes are ignored on the numeric
    # prefix comparison — they do not flip the classification.
    assert installed_lock.classify_mismatch("4.7.2", "v3.0.0") == "upgrade"
    assert installed_lock.classify_mismatch("4.7.2", "5.0.0-rc1") == "downgrade"


def test_current_package_version_reads_package_json() -> None:
    version = installed_lock.current_package_version()
    # package.json must carry a non-empty semver-shaped string
    assert version != "0.0.0"
    assert version.count(".") >= 1


def test_lockfile_env_override(tmp_path: Path, monkeypatch) -> None:
    custom = tmp_path / "custom.lock"
    monkeypatch.setenv("AGENT_CONFIG_INSTALLED_LOCK", str(custom))
    assert installed_lock.lockfile_path() == custom


# --- install.install_global integration ---


@pytest.fixture
def isolated_lock(tmp_path, monkeypatch):
    target = tmp_path / "installed.lock"
    monkeypatch.setenv("AGENT_CONFIG_INSTALLED_LOCK", str(target))
    # Redirect HOME so content deployment in `install_global` writes into
    # `tmp_path` instead of the developer's real `~/.claude`, `~/.augment`,
    # etc. `Path.home()` / `expanduser()` honour `$HOME` on POSIX and
    # `%USERPROFILE%` on Windows — patch both so the fixture is portable.
    fake_home = tmp_path / "home"
    fake_home.mkdir()
    monkeypatch.setenv("HOME", str(fake_home))
    monkeypatch.setenv("USERPROFILE", str(fake_home))
    install.QUIET = True
    yield target
    install.QUIET = False


def _silent_install_global(tools, *, force=False) -> int:
    buf = io.StringIO()
    with redirect_stdout(buf), redirect_stderr(buf):
        return install.install_global(set(tools), force)


def test_install_global_writes_lockfile(isolated_lock: Path) -> None:
    rc = _silent_install_global(["claude-code"])
    assert rc == 0
    assert isolated_lock.exists()
    data = installed_lock.read_lockfile(isolated_lock)
    assert data is not None
    assert data["tools"] == ["claude-code"]


def test_install_global_merges_tools_on_rerun(isolated_lock: Path) -> None:
    _silent_install_global(["claude-code"])
    _silent_install_global(["cursor"])
    data = installed_lock.read_lockfile(isolated_lock)
    assert data is not None
    assert data["tools"] == ["claude-code", "cursor"]


def test_install_global_refuses_on_version_mismatch(isolated_lock: Path) -> None:
    # Seed a lockfile recording a *newer* version than the running
    # package — that is the downgrade path, which still requires
    # explicit `--force` per the Phase 2 self-heal contract.
    installed_lock.write_lockfile("99.0.0", ["cursor"], path=isolated_lock)
    rc = _silent_install_global(["claude-code"])
    assert rc == 1
    # lockfile untouched on refusal
    data = installed_lock.read_lockfile(isolated_lock)
    assert data is not None
    assert data["agent_config_version"] == "99.0.0"


def test_install_global_heals_pre_2x_lockfile(
    isolated_lock: Path, tmp_path: Path
) -> None:
    # Phase 2 of road-to-claude-code-global-distribution: a stale
    # lockfile recording a *lower* version must NOT refuse the install
    # — it must self-heal, claim the new version slot, and deploy the
    # tool content. The pre-2.x silent-refusal trap (recorded 1.42.0,
    # running 4.7.2 → exit 1 without touching ~/.claude/) is the exact
    # bug this regression test guards.
    installed_lock.write_lockfile("1.42.0", ["claude-code"], path=isolated_lock)

    rc = _silent_install_global(["claude-code"])
    assert rc == 0

    # Lockfile rewritten to the current package version.
    data = installed_lock.read_lockfile(isolated_lock)
    assert data is not None
    assert data["agent_config_version"] == installed_lock.current_package_version()
    assert "claude-code" in data["tools"]

    # Deploy actually ran — ~/.claude/skills/ exists under the isolated
    # HOME. This is the "silent exit 1" symptom inverted into a positive
    # assertion: stale lockfiles no longer block the deploy.
    home = tmp_path / "home"
    assert (home / ".claude" / "skills").is_dir()


def test_install_global_heals_unparseable_legacy_version(
    isolated_lock: Path, tmp_path: Path
) -> None:
    # Pre-1.0 / 1.x namespace-migration installs may record a recorded
    # version the semver parser cannot read. Classification falls back
    # to "unparseable", which the install path treats as upgrade — same
    # self-heal as a numeric upgrade. No --force needed.
    isolated_lock.parent.mkdir(parents=True, exist_ok=True)
    isolated_lock.write_text(
        'schema_version: 1\n'
        'agent_config_version: "legacy-pre-2x"\n'
        'installed_at: "2024-01-01T00:00:00Z"\n'
        "tools:\n  - claude-code\n",
        encoding="utf-8",
    )

    rc = _silent_install_global(["claude-code"])
    assert rc == 0
    data = installed_lock.read_lockfile(isolated_lock)
    assert data is not None
    assert data["agent_config_version"] == installed_lock.current_package_version()


def test_install_global_force_overrides_mismatch(isolated_lock: Path) -> None:
    installed_lock.write_lockfile("99.0.0", ["cursor"], path=isolated_lock)
    rc = _silent_install_global(["claude-code"], force=True)
    assert rc == 0
    data = installed_lock.read_lockfile(isolated_lock)
    assert data is not None
    assert data["agent_config_version"] == installed_lock.current_package_version()
    # force still merges existing tools
    assert "claude-code" in data["tools"]
    assert "cursor" in data["tools"]


# --- install.install_global: per-tool content deployment ---


def test_install_global_deploys_claude_code_content(
    isolated_lock: Path, tmp_path: Path
) -> None:
    rc = _silent_install_global(["claude-code"])
    assert rc == 0
    home = tmp_path / "home"
    # `.claude/rules/` and `.claude/skills/` must be populated from the
    # package; symlinks in the source must be dereferenced into real files.
    assert (home / ".claude" / "rules").is_dir()
    rules_files = list((home / ".claude" / "rules").glob("*.md"))
    assert rules_files, "expected at least one rule file in ~/.claude/rules/"
    for rule in rules_files:
        assert not rule.is_symlink(), f"{rule} should be a real file, not a symlink"
    assert (home / ".claude" / "skills").is_dir()
    skills = list((home / ".claude" / "skills").iterdir())
    assert skills, "expected at least one skill in ~/.claude/skills/"


def test_install_global_deploys_augment_content(
    isolated_lock: Path, tmp_path: Path
) -> None:
    rc = _silent_install_global(["augment"])
    assert rc == 0
    home = tmp_path / "home"
    assert (home / ".augment" / "rules").is_dir()
    assert list((home / ".augment" / "rules").glob("*.md"))


def test_install_global_writes_claude_desktop_marker(
    isolated_lock: Path, tmp_path: Path
) -> None:
    rc = _silent_install_global(["claude-desktop"])
    assert rc == 0
    home = tmp_path / "home"
    marker = home / "Library" / "Application Support" / "Claude" / "agent-config.md"
    assert marker.is_file()
    body = marker.read_text(encoding="utf-8")
    assert "agent-config" in body
    assert "ADR-007" in body


def test_install_global_overwrites_existing_files_without_force(
    isolated_lock: Path, tmp_path: Path
) -> None:
    # Deployed rule files are OUR content, not user config — a re-run
    # refreshes them with the current package content even without
    # --force. (User configuration like .agent-settings.yml is protected
    # by the settings layer, not by this deploy path.)
    rc = _silent_install_global(["claude-code"])
    assert rc == 0
    home = tmp_path / "home"
    sample = next((home / ".claude" / "rules").glob("*.md"))
    sample.write_text("STALE_LOCAL_EDIT\n", encoding="utf-8")
    rc = _silent_install_global(["claude-code"])
    assert rc == 0
    assert sample.read_text(encoding="utf-8") != "STALE_LOCAL_EDIT\n"


def test_install_global_force_overwrites_existing_files(
    isolated_lock: Path, tmp_path: Path
) -> None:
    rc = _silent_install_global(["claude-code"])
    assert rc == 0
    home = tmp_path / "home"
    sample = next((home / ".claude" / "rules").glob("*.md"))
    sample.write_text("USER_OVERRIDE\n", encoding="utf-8")
    rc = _silent_install_global(["claude-code"], force=True)
    assert rc == 0
    assert sample.read_text(encoding="utf-8") != "USER_OVERRIDE\n"


def test_install_global_postcheck_drops_failed_tool_from_lockfile(
    isolated_lock: Path, tmp_path: Path, monkeypatch
) -> None:
    # Phase 5 (road-to-claude-code-global-distribution): wizard
    # postcheck. When _deploy_global_content reports `deploy_failed`
    # for a tool (verification could not confirm the expected anchor
    # subpaths exist + non-empty), the install must NOT leave that tool
    # in the lockfile's `tools` list — recording "installed" without
    # content on disk is the exact silent-failure class this phase
    # eliminates.
    #
    # Simulate verification failure by stubbing
    # `_verify_deploy_targets` to always report the bundle dest_sub
    # as missing for one tool. The deploy still copies files (so the
    # rest of the install succeeds); the postcheck downgrades the
    # status and the lockfile-correction loop drops the tool.
    original = install._verify_deploy_targets

    def fake_verify(anchor, plan):
        # Return non-empty list → simulates missing target. Only the
        # FIRST tool tested triggers a failure to keep the assertion
        # surface narrow.
        return [plan[0][1] or "."] if "fail-me-1" in str(anchor) else original(anchor, plan)

    fake_anchor = tmp_path / "fail-me-1"
    monkeypatch.setitem(install.USER_SCOPE_PATHS, "claude-code", str(fake_anchor))
    monkeypatch.setattr(install, "_verify_deploy_targets", fake_verify)

    rc = _silent_install_global(["claude-code", "augment"])
    assert rc == 0  # install does not error on one-tool postcheck failure

    data = installed_lock.read_lockfile(isolated_lock)
    assert data is not None
    # Failed tool must be absent from the recorded tools list.
    assert "claude-code" not in data["tools"], (
        "Phase 5 postcheck: tool whose deploy verification failed must "
        "NOT remain in the lockfile."
    )
    # Other tools that verified cleanly stay recorded.
    assert "augment" in data["tools"]


def test_install_global_copilot_reports_hint(
    isolated_lock: Path, tmp_path: Path
) -> None:
    # `copilot` has no user-scope convention; deploy must not error and
    # must not create `~/.copilot/` content.
    rc = _silent_install_global(["copilot"])
    assert rc == 0
    home = tmp_path / "home"
    # No content directory should be populated.
    assert not (home / ".copilot").exists() or not any((home / ".copilot").iterdir())


# --- cmd_update._refresh_global_lockfile ---


def test_refresh_global_lockfile_noop_when_absent(tmp_path, monkeypatch) -> None:
    monkeypatch.setenv("AGENT_CONFIG_INSTALLED_LOCK", str(tmp_path / "absent.lock"))
    buf = io.StringIO()
    cmd_update._refresh_global_lockfile("2.1.0", out=buf)
    assert not (tmp_path / "absent.lock").exists()
    assert buf.getvalue() == ""


def test_refresh_global_lockfile_writes_new_version(tmp_path, monkeypatch) -> None:
    target = tmp_path / "installed.lock"
    monkeypatch.setenv("AGENT_CONFIG_INSTALLED_LOCK", str(target))
    installed_lock.write_lockfile("2.0.5", ["cursor", "aider"], path=target)
    buf = io.StringIO()
    cmd_update._refresh_global_lockfile("2.1.0", out=buf)
    data = installed_lock.read_lockfile(target)
    assert data is not None
    assert data["agent_config_version"] == "2.1.0"
    # tools preserved
    assert data["tools"] == ["aider", "cursor"]
    assert "Refreshed global lockfile" in buf.getvalue()


def test_refresh_global_lockfile_idempotent_on_same_version(
    tmp_path, monkeypatch
) -> None:
    target = tmp_path / "installed.lock"
    monkeypatch.setenv("AGENT_CONFIG_INSTALLED_LOCK", str(target))
    installed_lock.write_lockfile("2.1.0", ["cursor"], path=target)
    before = target.read_text(encoding="utf-8")
    buf = io.StringIO()
    cmd_update._refresh_global_lockfile("2.1.0", out=buf)
    after = target.read_text(encoding="utf-8")
    assert before == after
    assert "already records 2.1.0" in buf.getvalue()
