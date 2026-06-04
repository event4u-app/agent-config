"""Phase 2 Step 5 contract tests for `scripts/hermetic-install.sh`.

Four sub-criteria from the roadmap, one test each:

- (a) tarball staging — accepts `--tarball <file.tgz>` and extracts.
- (b) checksum + GPG verification — separate-channel manifest with
      operator BYO key, no embedded trust root, no manifest-in-tarball.
- (c) install.py invocation — passes `--offline --package-dir=<staging>`
      and propagates hermetic metadata via env.
- (d) additive lockfile fields — sets the three env vars that
      `install.py` will translate into `installation_mode`,
      `package_checksum`, `signature_verified` in `installed.lock`.

The tests run the bash script in `--dry-run` mode end-to-end with a
locally-built fixture tarball and a locally-generated ephemeral GPG
key. Network access is not required.

Skip conditions: `gpg` missing, `tar` missing, or `bash` < 4.0.
"""
from __future__ import annotations

import hashlib
import os
import shutil
import subprocess
import sys
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parent.parent
SCRIPT = REPO_ROOT / "src" / "scripts" / "hermetic-install.sh"


def _have(cmd: str) -> bool:
    return shutil.which(cmd) is not None


pytestmark = pytest.mark.skipif(
    not (_have("gpg") and _have("tar") and _have("bash")),
    reason="hermetic-install requires gpg + tar + bash (Unix-only per Phase 2 council)",
)


def _make_pack(tmp_path: Path, version: str = "2.6.1") -> Path:
    """Build a fake npm-pack-shaped tarball with a minimal package/ tree."""
    staging = tmp_path / "src"
    pkg = staging / "package"
    (pkg / "scripts").mkdir(parents=True)
    (pkg / "package.json").write_text(
        f'{{"name":"@event4u/agent-config","version":"{version}"}}\n',
        encoding="utf-8",
    )
    # Stub install.py that echoes the env vars the bash wrapper sets.
    (pkg / "scripts" / "install.py").write_text(
        '#!/usr/bin/env python3\n'
        'import os, sys\n'
        'for k in ("AGENT_CONFIG_INSTALLATION_MODE",\n'
        '          "AGENT_CONFIG_PACKAGE_CHECKSUM",\n'
        '          "AGENT_CONFIG_SIGNATURE_VERIFIED",\n'
        '          "AGENT_CONFIG_PACKAGE_VERSION"):\n'
        '    print(f"{k}={os.environ.get(k, \'<unset>\')}")\n'
        'print("ARGV=" + " ".join(sys.argv[1:]))\n',
        encoding="utf-8",
    )
    tarball = tmp_path / f"agent-config-{version}.tgz"
    subprocess.run(
        ["tar", "-czf", str(tarball), "-C", str(staging), "package"],
        check=True,
    )
    return tarball


def _make_manifest(tmp_path: Path, tarball: Path, sig_dir: Path) -> tuple[Path, Path]:
    """Compute sha256 + GPG-detached-sign the manifest. Returns (manifest, key)."""
    digest = hashlib.sha256(tarball.read_bytes()).hexdigest()
    manifest = tmp_path / f"{tarball.name}.sha256"
    manifest.write_text(f"{digest}  {tarball.name}\n", encoding="utf-8")

    # GPG agent socket paths are capped at ~108 bytes on Unix. pytest's
    # tmpdir is often too long, so anchor GNUPGHOME under /tmp.
    import tempfile
    short_home = Path(tempfile.mkdtemp(prefix="gpgh-", dir="/tmp"))
    sig_dir = short_home
    env = os.environ.copy()
    env["GNUPGHOME"] = str(sig_dir)
    os.chmod(sig_dir, 0o700)

    batch = tmp_path / "gpg.batch"
    batch.write_text(
        "%no-protection\n"
        "Key-Type: EDDSA\n"
        "Key-Curve: ed25519\n"
        "Name-Real: hermetic-install test\n"
        "Name-Email: hermetic@test.local\n"
        "Expire-Date: 0\n"
        "%commit\n",
        encoding="utf-8",
    )
    subprocess.run(
        ["gpg", "--batch", "--quiet", "--generate-key", str(batch)],
        env=env, check=True,
    )
    pubkey = tmp_path / "public.gpg"
    subprocess.run(
        ["gpg", "--batch", "--quiet", "--export",
         "-o", str(pubkey), "hermetic@test.local"],
        env=env, check=True,
    )
    subprocess.run(
        ["gpg", "--batch", "--quiet", "--yes", "--detach-sign",
         "-o", str(manifest) + ".asc", str(manifest)],
        env=env, check=True,
    )
    return manifest, pubkey


@pytest.fixture()
def fixture(tmp_path: Path) -> dict[str, Path]:
    tarball = _make_pack(tmp_path)
    sig_home = tmp_path / "gpg-sign-home"
    manifest, pubkey = _make_manifest(tmp_path, tarball, sig_home)
    return {"tarball": tarball, "manifest": manifest, "key": pubkey, "root": tmp_path}


def _run(fixture: dict[str, Path], *extra: str) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        [
            "bash", str(SCRIPT),
            "--tarball", str(fixture["tarball"]),
            "--manifest", str(fixture["manifest"]),
            "--gpg-key", str(fixture["key"]),
            *extra,
        ],
        capture_output=True, text=True,
    )


def test_a_tarball_staging(fixture):
    """Sub-criterion (a): tarball is staged into a package-dir."""
    staging = fixture["root"] / "staging-a"
    result = _run(fixture, "--package-dir", str(staging), "--dry-run")
    assert result.returncode == 0, result.stderr
    assert (staging / "package" / "package.json").is_file()


def test_b_checksum_verification_separate_channel(fixture):
    """Sub-criterion (b): manifest lives outside the tarball.

    Asserted indirectly — the script accepts `--manifest` as a separate
    argument, the tarball staged in test_a has no `*.sha256` inside it,
    and a mismatch causes exit 2.
    """
    staging = fixture["root"] / "staging-b"
    # Confirm the manifest is not inside the tarball (separate channel).
    listing = subprocess.run(
        ["tar", "-tzf", str(fixture["tarball"])],
        capture_output=True, text=True, check=True,
    ).stdout
    assert ".sha256" not in listing, "manifest must NOT be packed in tarball"

    # Tamper with the tarball post-manifest-generation → exit 2.
    fixture["tarball"].write_bytes(fixture["tarball"].read_bytes() + b"\x00")
    result = _run(fixture, "--package-dir", str(staging), "--dry-run")
    assert result.returncode == 2, (result.returncode, result.stderr)
    assert "checksum mismatch" in result.stderr


def test_b_gpg_verification_byo_key(fixture):
    """Sub-criterion (b): operator GPG key is required (no embedded trust)."""
    bogus = fixture["root"] / "bogus.gpg"
    bogus.write_bytes(b"\x00not-a-key")
    result = subprocess.run(
        ["bash", str(SCRIPT),
         "--tarball", str(fixture["tarball"]),
         "--manifest", str(fixture["manifest"]),
         "--gpg-key", str(bogus),
         "--dry-run"],
        capture_output=True, text=True,
    )
    assert result.returncode != 0
    # gpg import or verify failure — both are acceptable rejection paths.


def test_c_install_py_invocation_offline_flag(fixture):
    """Sub-criterion (c): install.py is invoked with --offline + --package-dir."""
    staging = fixture["root"] / "staging-c"
    result = _run(fixture, "--package-dir", str(staging))
    assert result.returncode == 0, result.stderr
    assert "ARGV=--offline --package-dir=" in result.stdout
    assert str(staging / "package") in result.stdout


def test_d_additive_lockfile_fields_propagated(fixture):
    """Sub-criterion (d): hermetic metadata env vars reach install.py.

    The bash wrapper sets `AGENT_CONFIG_INSTALLATION_MODE=hermetic`,
    `AGENT_CONFIG_PACKAGE_CHECKSUM=sha256:…`, and
    `AGENT_CONFIG_SIGNATURE_VERIFIED=true` for `install.py` to translate
    into additive `installed.lock` fields under schema_version: 1
    (schema_version: 2 bump deferred per council verdict 3.2).
    """
    staging = fixture["root"] / "staging-d"
    result = _run(fixture, "--package-dir", str(staging))
    assert result.returncode == 0, result.stderr
    assert "AGENT_CONFIG_INSTALLATION_MODE=hermetic" in result.stdout
    assert "AGENT_CONFIG_PACKAGE_CHECKSUM=sha256:" in result.stdout
    assert "AGENT_CONFIG_SIGNATURE_VERIFIED=true" in result.stdout
    assert "AGENT_CONFIG_PACKAGE_VERSION=2.6.1" in result.stdout
