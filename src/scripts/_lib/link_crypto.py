"""link_crypto — encrypt/decrypt stored third-party package links.

Why this exists
---------------
This package never stores a *readable* link to, or name of, an external
source that inspired an idea (see the source-confidentiality sweep). Where a
source link genuinely has to be retained — e.g. the upstream URL + pin in
``agents/settings/contexts/skills-provenance.yml`` for license / refresh
bookkeeping — it is stored **encrypted**, never in plaintext.

Key resolution (per the maintainer's contract)
----------------------------------------------
The symmetric key lives in ``.agent-settings.yml`` under
``secrets.link_encryption_key`` and is **never committed** (the file is
gitignored). It is read in this order:

  1. **Project** — ``<project-root>/.agent-settings.yml``.
  2. **User-global** — ``~/.event4u/agent-config/agent-settings.yml``
     (with the legacy-path fallback used by the rest of the suite).

``encrypt`` uses the first key it finds (project preferred). ``decrypt`` tries
the project key first and, only if that fails to authenticate, falls back to
the user-global key — matching "try the project key, if it doesn't work use
the global one".

Threat model
------------
The goal is **repo confidentiality**: someone browsing the committed tree (or
the published npm tarball / plugin mirror) must not be able to read which
external packages were used. It is authenticated symmetric encryption built
from the Python standard library only (PBKDF2-HMAC-SHA256 key derivation, an
HMAC-SHA256 counter-mode keystream, encrypt-then-MAC with HMAC-SHA256). No
third-party crypto dependency is added (scope-control). This is not intended
to withstand an offline attacker who already holds the key file.

Token format
------------
``ENC1:<base64( salt[16] || nonce[16] || ciphertext || tag[32] )>``
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import os
import re
import secrets
import sys
from pathlib import Path

MAGIC = "ENC1"
_SALT_LEN = 16
_NONCE_LEN = 16
_TAG_LEN = 32
_PBKDF2_ITERS = 200_000
_KEY_PATH = "secrets.link_encryption_key"
_USER_GLOBAL = Path.home() / ".event4u" / "agent-config" / "agent-settings.yml"
# Legacy user-global location kept readable for older installs.
_USER_GLOBAL_LEGACY = Path.home() / ".agent-config" / "agent-settings.yml"


# --------------------------------------------------------------------------- #
# Core crypto (stdlib only)
# --------------------------------------------------------------------------- #
def _derive(key: str, salt: bytes) -> tuple[bytes, bytes]:
    dk = hashlib.pbkdf2_hmac("sha256", key.encode("utf-8"), salt, _PBKDF2_ITERS, dklen=64)
    return dk[:32], dk[32:]  # (enc_key, mac_key)


def _keystream(enc_key: bytes, nonce: bytes, n: int) -> bytes:
    out = bytearray()
    counter = 0
    while len(out) < n:
        out += hmac.new(enc_key, nonce + counter.to_bytes(8, "big"), hashlib.sha256).digest()
        counter += 1
    return bytes(out[:n])


def encrypt(plaintext: str, key: str) -> str:
    """Encrypt ``plaintext`` with ``key`` → an ``ENC1:`` token."""
    if not key:
        raise ValueError("empty encryption key")
    salt = secrets.token_bytes(_SALT_LEN)
    nonce = secrets.token_bytes(_NONCE_LEN)
    enc_key, mac_key = _derive(key, salt)
    pt = plaintext.encode("utf-8")
    ct = bytes(a ^ b for a, b in zip(pt, _keystream(enc_key, nonce, len(pt))))
    tag = hmac.new(mac_key, salt + nonce + ct, hashlib.sha256).digest()
    return f"{MAGIC}:" + base64.b64encode(salt + nonce + ct + tag).decode("ascii")


def is_token(value: str) -> bool:
    return isinstance(value, str) and value.startswith(f"{MAGIC}:")


def _decrypt_one(token: str, key: str) -> str:
    raw = base64.b64decode(token[len(MAGIC) + 1:])
    salt, nonce, rest = raw[:_SALT_LEN], raw[_SALT_LEN:_SALT_LEN + _NONCE_LEN], raw[_SALT_LEN + _NONCE_LEN:]
    ct, tag = rest[:-_TAG_LEN], rest[-_TAG_LEN:]
    enc_key, mac_key = _derive(key, salt)
    expected = hmac.new(mac_key, salt + nonce + ct, hashlib.sha256).digest()
    if not hmac.compare_digest(expected, tag):
        raise ValueError("authentication failed (wrong key or corrupt token)")
    return bytes(a ^ b for a, b in zip(ct, _keystream(enc_key, nonce, len(ct)))).decode("utf-8")


def decrypt(token: str, keys: str | list[str]) -> str:
    """Decrypt ``token``, trying each key in order (project first, then global)."""
    if not is_token(token):
        raise ValueError("not an ENC1 token")
    candidates = [keys] if isinstance(keys, str) else list(keys)
    candidates = [k for k in candidates if k]
    if not candidates:
        raise ValueError("no decryption key available")
    last: Exception | None = None
    for k in candidates:
        try:
            return _decrypt_one(token, k)
        except Exception as exc:  # noqa: BLE001 — try next key
            last = exc
    raise ValueError(f"decryption failed with all configured keys: {last}")


# --------------------------------------------------------------------------- #
# Key resolution from .agent-settings.yml (project → user-global)
# --------------------------------------------------------------------------- #
def _read_key_from(path: Path | None) -> str | None:
    if not path or not path.is_file():
        return None
    # Minimal, dependency-free scalar read so this works even where PyYAML is
    # absent. Matches `link_encryption_key:` at any indentation.
    pat = re.compile(r'^\s*link_encryption_key:\s*["\']?([^"\'#\s]+)')
    for line in path.read_text(encoding="utf-8", errors="replace").splitlines():
        m = pat.match(line)
        if m:
            return m.group(1)
    return None


def project_key(project_root: Path | str | None = None) -> str | None:
    root = Path(project_root) if project_root else Path.cwd()
    return _read_key_from(root / ".agent-settings.yml")


def global_key() -> str | None:
    return _read_key_from(_USER_GLOBAL) or _read_key_from(_USER_GLOBAL_LEGACY)


def resolve_keys(project_root: Path | str | None = None) -> list[str]:
    """Ordered, de-duplicated key list: project first, then user-global.

    An ``EVENT4U_LINK_KEY`` environment variable, if set, is consulted last as
    a CI/automation escape hatch.
    """
    keys: list[str] = []
    for k in (project_key(project_root), global_key(), os.environ.get("EVENT4U_LINK_KEY")):
        if k and k not in keys:
            keys.append(k)
    return keys


# --------------------------------------------------------------------------- #
# CLI
# --------------------------------------------------------------------------- #
def _cli(argv: list[str]) -> int:
    import argparse

    p = argparse.ArgumentParser(prog="link_crypto", description=__doc__.split("\n", 1)[0])
    sub = p.add_subparsers(dest="cmd", required=True)
    pe = sub.add_parser("encrypt", help="encrypt a plaintext value (reads stdin if no --value)")
    pe.add_argument("--value")
    pd = sub.add_parser("decrypt", help="decrypt an ENC1 token (reads stdin if no --value)")
    pd.add_argument("--value")
    sub.add_parser("keygen", help="generate a fresh base64 key for .agent-settings.yml")
    sub.add_parser("keystatus", help="report which key sources resolve (no secrets printed)")
    args = p.parse_args(argv)

    if args.cmd == "keygen":
        print(base64.urlsafe_b64encode(secrets.token_bytes(32)).decode("ascii").rstrip("="))
        return 0

    if args.cmd == "keystatus":
        print(f"project key: {'present' if project_key() else 'absent'}")
        print(f"user-global key: {'present' if global_key() else 'absent'}")
        print(f"env EVENT4U_LINK_KEY: {'present' if os.environ.get('EVENT4U_LINK_KEY') else 'absent'}")
        print(f"resolved key count: {len(resolve_keys())}")
        return 0

    value = args.value if args.value is not None else sys.stdin.read().strip()
    keys = resolve_keys()
    if not keys:
        sys.stderr.write(
            "error: no link_encryption_key found in project or user-global "
            ".agent-settings.yml (secrets.link_encryption_key)\n"
        )
        return 2
    if args.cmd == "encrypt":
        print(encrypt(value, keys[0]))
    else:
        print(decrypt(value, keys))
    return 0


if __name__ == "__main__":
    raise SystemExit(_cli(sys.argv[1:]))
