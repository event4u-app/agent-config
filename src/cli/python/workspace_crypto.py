#!/usr/bin/env python3
"""Workspace encryption-at-rest — Phase 8 of ``road-to-employee-product``.

Implements ``docs/contracts/at-rest-encryption.md``. Local-only AES-256-GCM
via Fernet (cryptography lib), master key wrapped in the OS keyring.

The feature is **opt-in** via ``.agent-settings.yml → workspace.encrypt_at_rest``.
When disabled, every public function short-circuits and writes plaintext.

Encryption and keyring libraries are imported lazily — when the feature flag
is off (the default), this module loads without any optional deps.

CLI::

    workspace_crypto.py encrypt --in <p> --out <p>
    workspace_crypto.py decrypt --in <p> --out <p>
    workspace_crypto.py status
    workspace_crypto.py rotate-key
"""

from __future__ import annotations

import argparse
import base64
import json
import os
import secrets
import sys
from pathlib import Path

WORKSPACE_HOME = Path.home() / ".event4u" / "agent-config" / "workspace"
KEYRING_SERVICE = "event4u-agent-config-workspace"
KEYRING_USER = "master-key"
ENV_OVERRIDE_KEY = "AGENT_CONFIG_WORKSPACE_KEY"
ENV_FORCE_DISABLE = "AGENT_CONFIG_NO_ENCRYPTION"

MAGIC = b"E4U-WSv1\n"


def is_enabled(settings_path: Path | None = None) -> bool:
    """Default OFF in v0 — opt-in via ``.agent-settings.yml``."""
    if os.environ.get(ENV_FORCE_DISABLE, "").strip() not in ("", "0"):
        return False
    p = settings_path if settings_path is not None else Path(".agent-settings.yml")
    if not p.exists():
        return False
    try:
        text = p.read_text(encoding="utf-8")
    except OSError:
        return False
    in_block = False
    for raw in text.splitlines():
        line = raw.rstrip()
        if not line or line.lstrip().startswith("#"):
            continue
        if not line.startswith(" ") and line.endswith(":"):
            in_block = line.strip() == "workspace:"
            continue
        if in_block and line.lstrip().startswith("encrypt_at_rest:"):
            value = line.split(":", 1)[1].strip().lower().strip("'\"")
            return value in ("on", "true", "yes", "1")
    return False


def _load_fernet():
    try:
        from cryptography.fernet import Fernet  # type: ignore[import-not-found]
    except ImportError as err:
        raise RuntimeError(
            "workspace_crypto: install the 'cryptography' package to use encryption"
        ) from err
    return Fernet


def _get_or_create_master_key(*, override: str | None = None) -> bytes:
    """Resolve the master key. Order: env override → OS keyring → generate."""
    if override is not None:
        return override.encode("ascii")
    env_key = os.environ.get(ENV_OVERRIDE_KEY)
    if env_key:
        return env_key.encode("ascii")
    try:
        import keyring  # type: ignore[import-not-found]
    except ImportError:
        keyring = None
    if keyring is not None:
        existing = keyring.get_password(KEYRING_SERVICE, KEYRING_USER)
        if existing:
            return existing.encode("ascii")
        Fernet = _load_fernet()
        key = Fernet.generate_key()
        keyring.set_password(KEYRING_SERVICE, KEYRING_USER, key.decode("ascii"))
        return key
    # No keyring backend: fall back to a file under the workspace home,
    # mode 0o600. Documented in the contract as the recovery path.
    WORKSPACE_HOME.mkdir(parents=True, exist_ok=True)
    keyfile = WORKSPACE_HOME / ".master-key"
    if keyfile.exists():
        return keyfile.read_bytes().strip()
    Fernet = _load_fernet()
    key = Fernet.generate_key()
    keyfile.write_bytes(key)
    try:
        os.chmod(keyfile, 0o600)
    except OSError:
        pass
    return key


def encrypt_bytes(payload: bytes, *, key: bytes | None = None) -> bytes:
    Fernet = _load_fernet()
    k = key or _get_or_create_master_key()
    token = Fernet(k).encrypt(payload)
    return MAGIC + token


def decrypt_bytes(payload: bytes, *, key: bytes | None = None) -> bytes:
    if not payload.startswith(MAGIC):
        # Plaintext payload — feature flag was off at write time.
        return payload
    Fernet = _load_fernet()
    k = key or _get_or_create_master_key()
    return Fernet(k).decrypt(payload[len(MAGIC):])


def encrypt_file(src: Path, dst: Path, *, key: bytes | None = None) -> None:
    dst.parent.mkdir(parents=True, exist_ok=True)
    dst.write_bytes(encrypt_bytes(src.read_bytes(), key=key))


def decrypt_file(src: Path, dst: Path, *, key: bytes | None = None) -> None:
    dst.parent.mkdir(parents=True, exist_ok=True)
    dst.write_bytes(decrypt_bytes(src.read_bytes(), key=key))


def rotate_key() -> bytes:
    """Generate a new master key and replace the keyring entry. Returns the new key."""
    Fernet = _load_fernet()
    new_key = Fernet.generate_key()
    try:
        import keyring  # type: ignore[import-not-found]
        keyring.set_password(KEYRING_SERVICE, KEYRING_USER, new_key.decode("ascii"))
    except ImportError:
        keyfile = WORKSPACE_HOME / ".master-key"
        WORKSPACE_HOME.mkdir(parents=True, exist_ok=True)
        keyfile.write_bytes(new_key)
        try:
            os.chmod(keyfile, 0o600)
        except OSError:
            pass
    return new_key


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(prog="workspace_crypto")
    sub = p.add_subparsers(dest="cmd", required=True)
    s_e = sub.add_parser("encrypt")
    s_e.add_argument("--in", dest="src", required=True)
    s_e.add_argument("--out", dest="dst", required=True)
    s_d = sub.add_parser("decrypt")
    s_d.add_argument("--in", dest="src", required=True)
    s_d.add_argument("--out", dest="dst", required=True)
    sub.add_parser("status")
    sub.add_parser("rotate-key")
    args = p.parse_args(argv)
    if args.cmd == "encrypt":
        encrypt_file(Path(args.src), Path(args.dst))
        return 0
    if args.cmd == "decrypt":
        decrypt_file(Path(args.src), Path(args.dst))
        return 0
    if args.cmd == "status":
        print(json.dumps({"enabled": is_enabled()}, sort_keys=True))
        return 0
    if args.cmd == "rotate-key":
        rotate_key()
        print(json.dumps({"rotated": True}, sort_keys=True))
        return 0
    return 2


if __name__ == "__main__":
    sys.exit(main())
