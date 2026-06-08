"""Tests for ``src/cli/python/workspace_crypto.py``.

Covers ``docs/contracts/at-rest-encryption.md`` (Phase 8):

* feature flag default is OFF (opt-in)
* env override + settings.yml block parsing
* round-trip ``encrypt_bytes`` / ``decrypt_bytes``
* magic header lets ``decrypt_bytes`` pass-through plaintext (back-compat)
* file-level encrypt/decrypt round-trip
* missing ``cryptography`` dep raises a clean RuntimeError on first use

The optional ``cryptography`` and ``keyring`` deps are imported lazily, so
the import-only tests run without them.
"""

from __future__ import annotations

import importlib.util
import sys
from pathlib import Path

import pytest


REPO_ROOT = Path(__file__).resolve().parents[1]
MODULE_PATH = REPO_ROOT / "src" / "cli" / "python" / "workspace_crypto.py"

try:
    import cryptography  # noqa: F401
    HAS_CRYPTO = True
except ImportError:
    HAS_CRYPTO = False


def _load():
    spec = importlib.util.spec_from_file_location("workspace_crypto", MODULE_PATH)
    assert spec and spec.loader
    mod = importlib.util.module_from_spec(spec)
    sys.modules["workspace_crypto"] = mod
    spec.loader.exec_module(mod)
    return mod


@pytest.fixture
def mod(tmp_path, monkeypatch):
    m = _load()
    monkeypatch.setattr(m, "WORKSPACE_HOME", tmp_path / "ws")
    monkeypatch.delenv("AGENT_CONFIG_WORKSPACE_KEY", raising=False)
    monkeypatch.delenv("AGENT_CONFIG_NO_ENCRYPTION", raising=False)
    return m


def test_default_is_disabled(mod, tmp_path):
    assert mod.is_enabled(settings_path=tmp_path / "missing.yml") is False


def test_settings_opt_in(mod, tmp_path):
    p = tmp_path / "settings.yml"
    p.write_text("workspace:\n  encrypt_at_rest: on\n", encoding="utf-8")
    assert mod.is_enabled(settings_path=p) is True


def test_settings_explicit_off(mod, tmp_path):
    p = tmp_path / "settings.yml"
    p.write_text("workspace:\n  encrypt_at_rest: false\n", encoding="utf-8")
    assert mod.is_enabled(settings_path=p) is False


def test_force_disable_via_env(mod, tmp_path, monkeypatch):
    p = tmp_path / "settings.yml"
    p.write_text("workspace:\n  encrypt_at_rest: on\n", encoding="utf-8")
    monkeypatch.setenv("AGENT_CONFIG_NO_ENCRYPTION", "1")
    assert mod.is_enabled(settings_path=p) is False


def test_decrypt_passes_through_plaintext(mod):
    payload = b"not encrypted"
    assert mod.decrypt_bytes(payload, key=b"unused") == payload


def _key(mod):
    """A raw 32-byte AES-256-GCM key (no keyring lookup)."""
    import os
    return os.urandom(mod._KEY_LEN)


@pytest.mark.skipif(not HAS_CRYPTO, reason="cryptography not installed")
def test_round_trip_bytes(mod):
    key = _key(mod)
    blob = mod.encrypt_bytes(b"hello world", key=key)
    assert blob.startswith(mod.MAGIC)
    assert blob[len(mod.MAGIC)] == mod.VERSION
    assert mod.decrypt_bytes(blob, key=key) == b"hello world"


@pytest.mark.skipif(not HAS_CRYPTO, reason="cryptography not installed")
def test_envelope_shape(mod):
    """Magic + version + 12-byte nonce + 16-byte tag precede ciphertext."""
    blob = mod.encrypt_bytes(b"x", key=_key(mod))
    assert blob[:4] == b"AC1\x00"
    assert len(blob) >= 5 + 12 + 16 + 1  # header + nonce + tag + >=1 ct byte


@pytest.mark.skipif(not HAS_CRYPTO, reason="cryptography not installed")
def test_wrong_key_raises(mod):
    blob = mod.encrypt_bytes(b"secret", key=_key(mod))
    with pytest.raises(Exception):  # cryptography InvalidTag
        mod.decrypt_bytes(blob, key=_key(mod))


@pytest.mark.skipif(not HAS_CRYPTO, reason="cryptography not installed")
def test_unknown_version_rejected(mod):
    key = _key(mod)
    blob = bytearray(mod.encrypt_bytes(b"secret", key=key))
    blob[len(mod.MAGIC)] = 0xFF  # corrupt the version byte
    with pytest.raises(ValueError, match="version"):
        mod.decrypt_bytes(bytes(blob), key=key)


@pytest.mark.skipif(not HAS_CRYPTO, reason="cryptography not installed")
def test_round_trip_file(mod, tmp_path):
    key = _key(mod)
    src = tmp_path / "in.txt"
    src.write_bytes(b"top secret")
    enc = tmp_path / "out.enc"
    dec = tmp_path / "out.txt"
    enc.write_bytes(mod.encrypt_bytes(src.read_bytes(), key=key))
    dec.write_bytes(mod.decrypt_bytes(enc.read_bytes(), key=key))
    assert dec.read_bytes() == b"top secret"


@pytest.mark.skipif(not HAS_CRYPTO, reason="cryptography not installed")
def test_key_accepts_base64_and_raw(mod):
    """A base64-encoded 32-byte key decrypts a blob made with the raw key."""
    import base64
    raw = _key(mod)
    blob = mod.encrypt_bytes(b"data", key=raw)
    assert mod.decrypt_bytes(blob, key=base64.b64encode(raw)) == b"data"


def test_missing_cryptography_raises_clean_error(mod, monkeypatch):
    # Force the lazy loader to fail even when the lib is installed.
    real_import = __builtins__["__import__"] if isinstance(__builtins__, dict) else __builtins__.__import__

    def fake_import(name, *args, **kwargs):
        if name.startswith("cryptography"):
            raise ImportError("simulated missing")
        return real_import(name, *args, **kwargs)

    monkeypatch.setattr("builtins.__import__", fake_import)
    with pytest.raises(RuntimeError, match="cryptography"):
        mod._load_aesgcm()


def test_env_override_key_used(mod, monkeypatch):
    import base64
    import os
    raw = os.urandom(mod._KEY_LEN)
    monkeypatch.setenv("AGENT_CONFIG_WORKSPACE_KEY", base64.b64encode(raw).decode("ascii"))
    assert mod._get_or_create_master_key() == raw


def test_env_override_rejects_bad_length(mod, monkeypatch):
    monkeypatch.setenv("AGENT_CONFIG_WORKSPACE_KEY", "ZmFrZS1rZXk=")  # 8 bytes
    with pytest.raises(ValueError, match="32 bytes"):
        mod._get_or_create_master_key()
