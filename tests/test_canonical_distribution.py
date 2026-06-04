"""Canonical distribution channel — regression test (Phase A Step 5).

Locks the canonical-channel contract at
``docs/contracts/skill-distribution-channels.md`` against ``scripts/install.sh``.

The contract picks **filesystem** as the canonical channel for all six
supported AI tools. The installer's consumer-install path must therefore:

1. Not project ``.claude-plugin/marketplace.json`` into the target by default.
2. Only project it when the operator explicitly passes ``--legacy-both``.

The tests dry-run the installer into a tmpdir (no real filesystem writes)
and inspect what would be written. ``--dry-run`` plus the verbose log
gives us a stable assertion surface without invoking the full payload
sync (which would symlink hundreds of files into the tmpdir on every run).
"""

from __future__ import annotations

import shutil
import subprocess
import sys
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parents[1]
INSTALL_SH = REPO_ROOT / "src" / "scripts" / "install.sh"


def _run_install(target: Path, extra: list[str]) -> subprocess.CompletedProcess[str]:
    cmd = [
        "bash",
        str(INSTALL_SH),
        "--source", str(REPO_ROOT),
        "--target", str(target),
        "--skip-gitignore",
        "--verbose",
        "--dry-run",
        *extra,
    ]
    return subprocess.run(cmd, capture_output=True, text=True, check=False)


@pytest.fixture(scope="module")
def installer_help() -> str:
    return subprocess.run(
        ["bash", str(INSTALL_SH), "--help"],
        capture_output=True, text=True, check=True,
    ).stdout


def test_legacy_both_flag_documented(installer_help: str) -> None:
    """The installer help text must surface --legacy-both per the contract."""
    assert "--legacy-both" in installer_help, (
        "--legacy-both must appear in scripts/install.sh --help (canonical-channel contract)"
    )
    assert "filesystem" in installer_help.lower() or "canonical" in installer_help.lower(), (
        "The help text must mention the canonical-channel context"
    )


def test_install_sh_default_skips_plugin_manifest(tmp_path: Path) -> None:
    """Default consumer install must NOT project .claude-plugin/marketplace.json."""
    result = _run_install(tmp_path, [])
    assert result.returncode == 0, f"install.sh dry-run failed: {result.stderr}"

    combined = result.stdout + result.stderr
    # The new project_legacy_plugin_manifest helper must log that it's
    # skipping the manifest in the default path.
    assert (
        "skip .claude-plugin/marketplace.json" in combined
        or "filesystem is canonical" in combined
    ), (
        "default install.sh run must log the .claude-plugin/marketplace.json skip; "
        "found neither marker.\n--- stdout ---\n" + result.stdout + "\n--- stderr ---\n" + result.stderr
    )


def test_install_sh_legacy_both_opts_into_manifest(tmp_path: Path) -> None:
    """--legacy-both must surface the projection in the dry-run log."""
    result = _run_install(tmp_path, ["--legacy-both"])
    assert result.returncode == 0, f"install.sh dry-run failed: {result.stderr}"

    combined = result.stdout + result.stderr
    assert (
        "copy .claude-plugin/marketplace.json" in combined
        or "Projected .claude-plugin/marketplace.json" in combined
        or "--legacy-both" in combined
    ), (
        "--legacy-both run must surface a marketplace-projection log line.\n"
        "--- stdout ---\n" + result.stdout + "\n--- stderr ---\n" + result.stderr
    )


def test_canonical_contract_pins_filesystem_per_tool() -> None:
    """The contract doc must name 'filesystem' as canonical for every supported tool."""
    contract = (REPO_ROOT / "docs" / "contracts" / "skill-distribution-channels.md").read_text(encoding="utf-8")
    tools = ["Claude Code", "Augment", "Cursor", "Cline", "Windsurf", "Copilot"]
    for tool in tools:
        assert tool in contract, f"Contract must name '{tool}' in the per-tool matrix"
    # The literal table cell value "**filesystem**" is the canonical choice marker.
    assert contract.count("**filesystem**") >= len(tools), (
        f"Contract must mark every supported tool as filesystem-canonical "
        f"(found {contract.count('**filesystem**')} markers, expected ≥ {len(tools)})"
    )


def test_no_plugin_manifest_in_install_sh_default_flow() -> None:
    """install.sh must NOT contain an unconditional marketplace.json copy.

    Static scan: every copy/projection of `.claude-plugin/marketplace.json`
    must be gated on LEGACY_BOTH or the project_legacy_plugin_manifest helper.
    """
    text = INSTALL_SH.read_text(encoding="utf-8")
    # The opt-in helper must exist.
    assert "project_legacy_plugin_manifest" in text, (
        "install.sh must define project_legacy_plugin_manifest()"
    )
    # The LEGACY_BOTH gate must exist.
    assert "LEGACY_BOTH=false" in text, "LEGACY_BOTH must default to false"
    # No path in the script should reference marketplace.json outside the
    # gated helper. We allow occurrences inside the gated function body.
    occurrences = [
        i for i, line in enumerate(text.splitlines(), 1)
        if "marketplace.json" in line
    ]
    # Build a coarse map of function boundaries to assert each occurrence
    # is inside project_legacy_plugin_manifest (or a comment/help block).
    legacy_section_start = text.index("project_legacy_plugin_manifest() {")
    legacy_section_end = text.index("# Create GEMINI.md symlink", legacy_section_start)
    legacy_lines: set[int] = set()
    for i, line in enumerate(text.splitlines(), 1):
        offset = sum(len(x) + 1 for x in text.splitlines()[:i - 1])
        if legacy_section_start <= offset < legacy_section_end:
            legacy_lines.add(i)

    # Allow lines inside the legacy helper, in the --legacy-both help text,
    # and in the LEGACY_BOTH comment block at the top of the globals.
    for line_no in occurrences:
        line = text.splitlines()[line_no - 1]
        in_helper = line_no in legacy_lines
        in_help_or_comment = (
            "--legacy-both" in line
            or line.strip().startswith("#")
            or line.strip().startswith("(.claude-plugin/marketplace.json)")
            or line.strip().startswith("at docs/contracts/")
        )
        assert in_helper or in_help_or_comment, (
            f"line {line_no} references marketplace.json outside the gated helper: {line!r}"
        )
