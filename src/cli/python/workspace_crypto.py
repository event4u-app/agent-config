#!/usr/bin/env python3
"""Workspace encryption-at-rest — Phase 8 of ``road-to-employee-product``.

Implements ``docs/contracts/at-rest-encryption.md``. Local-only
**AES-256-GCM** with the contract's ``AC1\\0`` envelope; master key wrapped
in the OS keyring. Cipher choice + architecture locked in
``docs/decisions/ADR-062-encrypt-at-rest-store-architecture.md`` (Part A:
the prior Fernet implementation drifted from the spec — this aligns the code
to the contract so the same envelope is byte-reproducible in Node's
``node:crypto`` for the later Python-authoritative store wiring).

The feature is **opt-in** via ``.agent-settings.yml → workspace.encrypt_at_rest``.
When disabled, callers write plaintext; ``decrypt_bytes`` passes plaintext
through unchanged (no magic prefix), so reads stay back-compatible.

Encryption and keyring libraries are imported lazily — when the feature flag
is off (the default), this module loads without any optional deps.

Envelope (per the contract):

    | 4 bytes  | magic    "AC1\\0"  (0x41 0x43 0x31 0x00)
    | 1 byte   | version  0x01
    | 12 bytes | GCM nonce
    | 16 bytes | GCM auth tag
    | N bytes  | ciphertext

CLI::

    workspace_crypto.py encrypt --in <p> --out <p>
    workspace_crypto.py decrypt --in <p> --out <p>
    workspace_crypto.py status
    workspace_crypto.py rotate-key
"""

from __future__ import annotations

import argparse
import base64
import binascii
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

# Envelope constants (docs/contracts/at-rest-encryption.md).
MAGIC = b"AC1\x00"
VERSION = 1
_NONCE_LEN = 12
_TAG_LEN = 16
_KEY_LEN = 32
_HEADER_LEN = len(MAGIC) + 1  # magic + version byte


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


def _load_aesgcm():
    try:
        from cryptography.hazmat.primitives.ciphers.aead import (  # type: ignore[import-not-found]
            AESGCM,
        )
    except ImportError as err:
        raise RuntimeError(
            "workspace_crypto: install the 'cryptography' package to use encryption"
        ) from err
    return AESGCM


def _coerce_key(material: bytes) -> bytes:
    """Accept a raw 32-byte key or its base64 encoding; return raw 32 bytes."""
    if len(material) == _KEY_LEN:
        return material
    try:
        decoded = base64.b64decode(material, validate=True)
    except (ValueError, binascii.Error) as err:
        raise ValueError(
            "workspace_crypto: master key is not 32 bytes or valid base64"
        ) from err
    if len(decoded) != _KEY_LEN:
        raise ValueError(
            f"workspace_crypto: master key must be {_KEY_LEN} bytes, got {len(decoded)}"
        )
    return decoded


def _generate_key_b64() -> str:
    return base64.b64encode(secrets.token_bytes(_KEY_LEN)).decode("ascii")


def _get_or_create_master_key(*, override: str | None = None) -> bytes:
    """Resolve the 32-byte master key. Order: override → env → keyring → file."""
    if override is not None:
        return _coerce_key(override.encode("ascii"))
    env_key = os.environ.get(ENV_OVERRIDE_KEY)
    if env_key:
        return _coerce_key(env_key.encode("ascii"))
    try:
        import keyring  # type: ignore[import-not-found]
    except ImportError:
        keyring = None
    if keyring is not None:
        existing = keyring.get_password(KEYRING_SERVICE, KEYRING_USER)
        if existing:
            return _coerce_key(existing.encode("ascii"))
        key_b64 = _generate_key_b64()
        keyring.set_password(KEYRING_SERVICE, KEYRING_USER, key_b64)
        return _coerce_key(key_b64.encode("ascii"))
    # No keyring backend: fall back to a file under the workspace home,
    # mode 0o600. Documented in the contract as the recovery path.
    WORKSPACE_HOME.mkdir(parents=True, exist_ok=True)
    keyfile = WORKSPACE_HOME / ".master-key"
    if keyfile.exists():
        return _coerce_key(keyfile.read_bytes().strip())
    key_b64 = _generate_key_b64()
    keyfile.write_bytes(key_b64.encode("ascii"))
    try:
        os.chmod(keyfile, 0o600)
    except OSError:
        pass
    return _coerce_key(key_b64.encode("ascii"))


def encrypt_bytes(payload: bytes, *, key: bytes | None = None) -> bytes:
    """AES-256-GCM encrypt. ``key`` is 32 raw bytes (or base64); None → master."""
    AESGCM = _load_aesgcm()
    k = _coerce_key(key) if key is not None else _get_or_create_master_key()
    nonce = secrets.token_bytes(_NONCE_LEN)
    ct_with_tag = AESGCM(k).encrypt(nonce, payload, None)
    ciphertext, tag = ct_with_tag[:-_TAG_LEN], ct_with_tag[-_TAG_LEN:]
    return MAGIC + bytes([VERSION]) + nonce + tag + ciphertext


def decrypt_bytes(payload: bytes, *, key: bytes | None = None) -> bytes:
    if not payload.startswith(MAGIC):
        # Plaintext payload — feature flag was off at write time.
        return payload
    version = payload[len(MAGIC)]
    if version != VERSION:
        raise ValueError(f"workspace_crypto: unsupported envelope version {version}")
    body = payload[_HEADER_LEN:]
    nonce = body[:_NONCE_LEN]
    tag = body[_NONCE_LEN:_NONCE_LEN + _TAG_LEN]
    ciphertext = body[_NONCE_LEN + _TAG_LEN:]
    AESGCM = _load_aesgcm()
    k = _coerce_key(key) if key is not None else _get_or_create_master_key()
    return AESGCM(k).decrypt(nonce, ciphertext + tag, None)


def encrypt_file(src: Path, dst: Path, *, key: bytes | None = None) -> None:
    dst.parent.mkdir(parents=True, exist_ok=True)
    dst.write_bytes(encrypt_bytes(src.read_bytes(), key=key))


def decrypt_file(src: Path, dst: Path, *, key: bytes | None = None) -> None:
    dst.parent.mkdir(parents=True, exist_ok=True)
    dst.write_bytes(decrypt_bytes(src.read_bytes(), key=key))


def rotate_key() -> bytes:
    """Generate a new master key, replace the keyring/keyfile entry. Returns raw key."""
    key_b64 = _generate_key_b64()
    try:
        import keyring  # type: ignore[import-not-found]
        keyring.set_password(KEYRING_SERVICE, KEYRING_USER, key_b64)
    except ImportError:
        keyfile = WORKSPACE_HOME / ".master-key"
        WORKSPACE_HOME.mkdir(parents=True, exist_ok=True)
        keyfile.write_bytes(key_b64.encode("ascii"))
        try:
            os.chmod(keyfile, 0o600)
        except OSError:
            pass
    return _coerce_key(key_b64.encode("ascii"))


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
