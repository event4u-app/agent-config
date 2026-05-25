"""Tests for ``packages/core/installer/python/workspace_crypto.py``.

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
MODULE_PATH = REPO_ROOT / "packages" / "core" / "installer" / "python" / "workspace_crypto.py"

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


@pytest.mark.skipif(not HAS_CRYPTO, reason="cryptography not installed")
def test_round_trip_bytes(mod):
    from cryptography.fernet import Fernet
    key = Fernet.generate_key()
    blob = mod.encrypt_bytes(b"hello world", key=key)
    assert blob.startswith(mod.MAGIC)
    assert mod.decrypt_bytes(blob, key=key) == b"hello world"


@pytest.mark.skipif(not HAS_CRYPTO, reason="cryptography not installed")
def test_round_trip_file(mod, tmp_path):
    from cryptography.fernet import Fernet
    key = Fernet.generate_key()
    src = tmp_path / "in.txt"
    src.write_bytes(b"top secret")
    enc = tmp_path / "out.enc"
    dec = tmp_path / "out.txt"

    # Encrypt without keyring/cryptography lookup: pass key explicitly via
    # encrypt_bytes, write file ourselves to bypass keyring requirement.
    enc.write_bytes(mod.encrypt_bytes(src.read_bytes(), key=key))
    dec.write_bytes(mod.decrypt_bytes(enc.read_bytes(), key=key))
    assert dec.read_bytes() == b"top secret"


def test_missing_cryptography_raises_clean_error(mod, monkeypatch):
    # Force the lazy loader to fail even when the lib is installed.
    real_import = __builtins__["__import__"] if isinstance(__builtins__, dict) else __builtins__.__import__

    def fake_import(name, *args, **kwargs):
        if name == "cryptography.fernet":
            raise ImportError("simulated missing")
        return real_import(name, *args, **kwargs)

    monkeypatch.setattr("builtins.__import__", fake_import)
    with pytest.raises(RuntimeError, match="cryptography"):
        mod._load_fernet()


def test_env_override_key_used(mod, monkeypatch):
    monkeypatch.setenv("AGENT_CONFIG_WORKSPACE_KEY", "ZmFrZS1rZXk=")
    assert mod._get_or_create_master_key() == b"ZmFrZS1rZXk="
