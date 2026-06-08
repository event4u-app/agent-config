"""Tests for ``src/cli/python/workspace_documents.py``.

Covers ``docs/contracts/workspace-documents.md``:

* ``create`` writes ``<slug>.md`` with full frontmatter + opens history
* ``save`` appends one history record per edit, updates ``last_edited_at``
* ``read`` round-trips body without frontmatter
* ``list_documents`` orders by mtime, filters by type/role
* ``export`` copies markdown identity; pdf/docx without pandoc → RuntimeError
* unknown type / missing slug → clean error
"""

from __future__ import annotations

import importlib.util
import json
import sys
from pathlib import Path

import pytest


REPO_ROOT = Path(__file__).resolve().parents[1]
MODULE_PATH = REPO_ROOT / "src" / "cli" / "python" / "workspace_documents.py"


def _load():
    spec = importlib.util.spec_from_file_location("workspace_documents", MODULE_PATH)
    assert spec and spec.loader
    mod = importlib.util.module_from_spec(spec)
    sys.modules["workspace_documents"] = mod
    spec.loader.exec_module(mod)
    return mod


@pytest.fixture
def docs(tmp_path, monkeypatch):
    mod = _load()
    monkeypatch.setattr(mod, "WORKSPACE_HOME", tmp_path / "documents")
    # Default: encryption OFF (flag default). Deterministic regardless of any
    # repo-root .agent-settings.yml in the cwd.
    monkeypatch.setattr(mod.workspace_crypto, "is_enabled", lambda *a, **k: False)
    return mod


try:
    import cryptography  # noqa: F401
    HAS_CRYPTO = True
except ImportError:
    HAS_CRYPTO = False


@pytest.fixture
def enc_docs(tmp_path, monkeypatch):
    """Document store fixture with encryption-at-rest ON and a fixed key."""
    import base64
    import os as _os
    mod = _load()
    monkeypatch.setattr(mod, "WORKSPACE_HOME", tmp_path / "documents")
    monkeypatch.setattr(mod.workspace_crypto, "is_enabled", lambda *a, **k: True)
    key_b64 = base64.b64encode(_os.urandom(32)).decode("ascii")
    monkeypatch.setenv("AGENT_CONFIG_WORKSPACE_KEY", key_b64)
    return mod


def test_create_writes_frontmatter_and_history(docs):
    doc = docs.create(type="offer", title="Spring Cleanup",
                      body="# Hello\n\nBody line.\n",
                      role="galabau",
                      source_prompt="schreib ein Angebot",
                      source_session="20250505T080000Z-abcd1234",
                      tags=["lawn", "spring"])
    raw = doc.path.read_text(encoding="utf-8")
    assert raw.startswith("---\n")
    assert "type: offer" in raw
    assert "title: Spring Cleanup" in raw
    assert "role: galabau" in raw
    assert "schema: workspace-document/v0" in raw
    history = [json.loads(l) for l in doc.history_path.read_text(encoding="utf-8").splitlines()]
    assert len(history) == 1
    assert history[0]["actor"] == "host"
    assert history[0]["kind"] == "save"
    assert "body_sha256" in history[0]


def test_create_rejects_unknown_type(docs):
    with pytest.raises(ValueError):
        docs.create(type="not-a-type", title="x", body="y")


def test_create_dedupes_slug_on_collision(docs):
    d1 = docs.create(type="memo", title="Same Title", body="A\n")
    d2 = docs.create(type="memo", title="Same Title", body="B\n")
    assert d1.slug != d2.slug
    assert d2.slug.endswith("-2")


def test_save_appends_history_and_updates_last_edited(docs):
    doc = docs.create(type="memo", title="Memo", body="line 1\n")
    entry = docs.save("memo", doc.slug, "line 1\nline 2\nline 3\n", actor="user")
    history = [json.loads(l) for l in doc.history_path.read_text(encoding="utf-8").splitlines()]
    assert len(history) == 2
    assert history[1]["actor"] == "user"
    assert history[1]["delta"]["added"] == 2
    assert entry["body_sha256"]
    body_now = doc.path.read_text(encoding="utf-8")
    assert "line 3" in body_now


def test_save_missing_document_raises(docs):
    with pytest.raises(FileNotFoundError):
        docs.save("memo", "no-such-slug", "x\n")


def test_read_returns_body_without_frontmatter(docs):
    doc = docs.create(type="memo", title="Read Me", body="The body.\n")
    got = docs.read("memo", doc.slug)
    assert got is not None
    assert got.title == "Read Me"
    assert got.body.strip() == "The body."


def test_read_unknown_returns_none(docs):
    assert docs.read("memo", "absent") is None


def test_list_documents_orders_by_mtime_and_filters(docs):
    d1 = docs.create(type="memo", title="One", body="x\n", role="galabau")
    d2 = docs.create(type="offer", title="Two", body="y\n", role="consultant")
    rows = docs.list_documents()
    assert {r["slug"] for r in rows} == {d1.slug, d2.slug}
    by_type = docs.list_documents(type="memo")
    assert [r["slug"] for r in by_type] == [d1.slug]
    by_role = docs.list_documents(role="consultant")
    assert [r["slug"] for r in by_role] == [d2.slug]


def test_list_documents_empty_when_root_missing(docs, tmp_path):
    docs.WORKSPACE_HOME = tmp_path / "absent"
    assert docs.list_documents() == []


def test_export_markdown_identity_copy(docs, tmp_path):
    doc = docs.create(type="memo", title="Export", body="body\n")
    out = docs.export("memo", doc.slug, tmp_path / "out", format="md")
    assert out.exists()
    assert out.read_text(encoding="utf-8") == doc.path.read_text(encoding="utf-8")


def test_export_pdf_without_pandoc_errors(docs, tmp_path, monkeypatch):
    doc = docs.create(type="memo", title="Export", body="body\n")
    monkeypatch.setattr(docs.shutil, "which", lambda _name: None)
    with pytest.raises(RuntimeError, match="pandoc"):
        docs.export("memo", doc.slug, tmp_path / "out", format="pdf")


def test_export_unknown_format_errors(docs, tmp_path):
    doc = docs.create(type="memo", title="Export", body="body\n")
    with pytest.raises(ValueError, match="unsupported format"):
        docs.export("memo", doc.slug, tmp_path / "out", format="xls")


# --- pandoc invocation-contract matrix (3 types × {pdf, docx}) -----------
#
# Council (claude-sonnet-4-5 + gpt-4o, 2026-06-08, design mode) converged on
# option (b): do NOT add pandoc (+ TeX) to CI for a gracefully-degrading
# pre-v1.0 feature. Byte-level golden tests on pandoc output verify pandoc's
# determinism (a supply-chain concern), not OUR code. What this repo owns is
# the *invocation contract* — the argv we hand pandoc, the output path, the
# format routing. These tests stub pandoc and assert exactly that, with no
# system dependency. The real-render path is covered opt-in below when a
# pandoc binary happens to be present locally.

@pytest.mark.parametrize("doc_type", ["offer", "memo", "brief"])
@pytest.mark.parametrize("fmt", ["pdf", "docx"])
def test_export_pandoc_invocation_contract(docs, tmp_path, monkeypatch, doc_type, fmt):
    doc = docs.create(type=doc_type, title="Export Matrix", body="# H\n\nbody\n")
    fake_pandoc = "/usr/bin/pandoc-stub"
    monkeypatch.setattr(docs.shutil, "which",
                        lambda name: fake_pandoc if name == "pandoc" else None)

    calls: list[list[str]] = []
    input_seen: list[str] = []

    def _record(argv, *args, **kwargs):
        calls.append(list(argv))
        # Capture the cleartext input pandoc is handed AT CALL TIME — under
        # encryption the export materialises a temp cleartext .md and never
        # hands pandoc the .enc blob. The temp file is deleted after run().
        src = argv[1]
        input_seen.append(Path(src).read_text(encoding="utf-8"))
        Path(argv[argv.index("-o") + 1]).write_bytes(b"")
        return None

    monkeypatch.setattr(docs.subprocess, "run", _record)

    out = docs.export(doc_type, doc.slug, tmp_path / "out", format=fmt)

    expected_target = tmp_path / "out" / f"{doc.slug}.{fmt}"
    assert out == expected_target
    assert len(calls) == 1
    argv = calls[0]
    assert argv[0] == fake_pandoc
    # pandoc receives a real readable cleartext .md (never the source path
    # directly, never ciphertext) and the caller-chosen output target.
    assert argv[1].endswith(".md")
    assert "body" in input_seen[0]
    assert "-o" in argv
    assert argv[argv.index("-o") + 1] == str(expected_target)


# --- encryption-at-rest (ADR-062 Part B, documents-only) -----------------

@pytest.mark.skipif(not HAS_CRYPTO, reason="cryptography not installed")
def test_encrypted_create_writes_enc_not_plaintext(enc_docs):
    doc = enc_docs.create(type="offer", title="Kunde X Angebot", body="secret body\n")
    assert doc.path.name.endswith(".md.enc")
    assert not (doc.path.with_name(doc.path.name[:-4])).exists()  # no plaintext .md
    raw = doc.path.read_bytes()
    assert raw[:4] == b"AC1\x00"          # AES-256-GCM envelope
    assert b"secret body" not in raw       # body not in cleartext on disk


@pytest.mark.skipif(not HAS_CRYPTO, reason="cryptography not installed")
def test_encrypted_round_trip_read_and_list(enc_docs):
    doc = enc_docs.create(type="memo", title="Quarterly", body="# H\n\nthe body\n")
    got = enc_docs.read("memo", doc.slug)
    assert got is not None and "the body" in got.body
    rows = enc_docs.list_documents()
    assert any(r["slug"] == doc.slug and r["title"] == "Quarterly" for r in rows)


@pytest.mark.skipif(not HAS_CRYPTO, reason="cryptography not installed")
def test_encrypted_save_round_trip(enc_docs):
    doc = enc_docs.create(type="brief", title="Brief", body="v1\n")
    enc_docs.save("brief", doc.slug, "v2 updated\n")
    got = enc_docs.read("brief", doc.slug)
    assert "v2 updated" in got.body


@pytest.mark.skipif(not HAS_CRYPTO, reason="cryptography not installed")
def test_migrate_then_decrypt_all_round_trip(enc_docs, tmp_path, monkeypatch):
    # Write a plaintext doc with the flag OFF, then migrate it.
    monkeypatch.setattr(enc_docs.workspace_crypto, "is_enabled", lambda *a, **k: False)
    doc = enc_docs.create(type="offer", title="Legacy", body="plaintext body\n")
    plain = doc.path
    assert plain.name.endswith(".md") and not plain.name.endswith(".enc")

    # Flip ON and migrate: plaintext → .enc, plaintext removed, content intact.
    # migrated counts the .md body (1) + the .history.jsonl that had plaintext
    # lines (1) = 2, since the history log is per-record encrypted too (ADR-064).
    monkeypatch.setattr(enc_docs.workspace_crypto, "is_enabled", lambda *a, **k: True)
    result = enc_docs.migrate(root=enc_docs.WORKSPACE_HOME)
    assert result["migrated"] == 2
    assert not plain.exists()
    assert enc_docs._enc_path(plain).exists()
    assert "plaintext body" in enc_docs.read("offer", doc.slug).body
    # The history log is now per-record encrypted on disk.
    hp = enc_docs.WORKSPACE_HOME / "offer" / f"{doc.slug}.history.jsonl"
    assert all(not ln.startswith("{") for ln in hp.read_text().splitlines() if ln.strip())

    # migrate is idempotent for the .md body (no plaintext .md remains → 0).
    assert enc_docs.migrate(root=enc_docs.WORKSPACE_HOME)["migrated"] == 0

    # Kill-switch: decrypt-all returns body + history to plaintext (2).
    dres = enc_docs.decrypt_all(root=enc_docs.WORKSPACE_HOME)
    assert dres["decrypted"] == 2
    assert plain.exists() and not enc_docs._enc_path(plain).exists()
    assert "plaintext body" in plain.read_text(encoding="utf-8")
    assert all(ln.startswith("{") for ln in hp.read_text().splitlines() if ln.strip())


@pytest.mark.skipif(not HAS_CRYPTO, reason="cryptography not installed")
def test_history_line_encrypted_on_write(enc_docs):
    doc = enc_docs.create(type="memo", title="Audited", body="v1\n")
    enc_docs.save("memo", doc.slug, "v2\n")
    hp = enc_docs.WORKSPACE_HOME / "memo" / f"{doc.slug}.history.jsonl"
    lines = [ln for ln in hp.read_text(encoding="utf-8").splitlines() if ln.strip()]
    assert len(lines) == 2                          # create + save revisions
    assert all(not ln.startswith("{") for ln in lines)   # per-record encrypted
    import base64
    assert base64.b64decode(lines[0], validate=True)[:4] == b"AC1\x00"
    # decrypt_line recovers the cleartext revision record.
    rec = json.loads(enc_docs.workspace_crypto.decrypt_line(lines[1]))
    assert rec["kind"] == "save"


@pytest.mark.skipif(not HAS_CRYPTO, reason="cryptography not installed")
def test_rekey_covers_history_log(enc_docs, monkeypatch):
    import os as _os
    wc = enc_docs.workspace_crypto
    monkeypatch.delenv("AGENT_CONFIG_WORKSPACE_KEY", raising=False)
    state = {"key": _os.urandom(32)}
    monkeypatch.setattr(wc, "_get_or_create_master_key", lambda **k: state["key"])
    monkeypatch.setattr(wc, "rotate_key",
                        lambda: state.__setitem__("key", _os.urandom(32)) or state["key"])
    doc = enc_docs.create(type="memo", title="Rot", body="b\n")
    hp = enc_docs.WORKSPACE_HOME / "memo" / f"{doc.slug}.history.jsonl"
    before = hp.read_text(encoding="utf-8")
    res = enc_docs.rekey(root=enc_docs.WORKSPACE_HOME)
    assert res["rekeyed"] == 1 and res["rekeyed_history"] == 1
    assert hp.read_text(encoding="utf-8") != before          # re-encrypted
    rec = json.loads(wc.decrypt_line(hp.read_text().splitlines()[0]))
    assert rec["kind"] == "save"                              # still decryptable


@pytest.mark.skipif(not HAS_CRYPTO, reason="cryptography not installed")
def test_rekey_reencrypts_and_still_reads(enc_docs, monkeypatch):
    # rekey is only coherent when the key resolver tracks the rotated key
    # (NOT when AGENT_CONFIG_WORKSPACE_KEY pins it externally). Drive the
    # resolver + rotate_key off a hermetic in-test key holder.
    import os as _os
    wc = enc_docs.workspace_crypto
    monkeypatch.delenv("AGENT_CONFIG_WORKSPACE_KEY", raising=False)
    state = {"key": _os.urandom(32)}
    monkeypatch.setattr(wc, "_get_or_create_master_key", lambda **k: state["key"])

    def _fake_rotate():
        state["key"] = _os.urandom(32)
        return state["key"]

    monkeypatch.setattr(wc, "rotate_key", _fake_rotate)

    doc = enc_docs.create(type="memo", title="Rotate", body="rotate me\n")
    enc_file = enc_docs.WORKSPACE_HOME / "memo" / f"{doc.slug}.md.enc"
    before = enc_file.read_bytes()
    res = enc_docs.rekey(root=enc_docs.WORKSPACE_HOME)
    assert res["rekeyed"] == 1
    assert enc_file.read_bytes() != before        # re-encrypted under the new key
    assert "rotate me" in enc_docs.read("memo", doc.slug).body


@pytest.mark.skipif(not HAS_CRYPTO, reason="cryptography not installed")
def test_list_json_cli_returns_decrypted_rows(enc_docs, tmp_path, capsys):
    """The `list --json --root` CLI is the Python-authoritative read path the
    Node GUI server consumes. With encryption on, it must return CLEARTEXT
    titles (decrypted from the .md.enc), plus the updated_at/path shape Node
    maps. This is the cross-runtime contract (Python encrypts → Node reads
    back via this CLI)."""
    import json as _json
    enc_docs.create(type="offer", title="Decrypted Title", body="confidential\n")
    rc = enc_docs.main(["list", "--json", "--root", str(enc_docs.WORKSPACE_HOME)])
    assert rc == 0
    rows = _json.loads(capsys.readouterr().out)
    assert len(rows) == 1
    row = rows[0]
    assert row["title"] == "Decrypted Title"      # decrypted, not ciphertext
    assert row["type"] == "offer"
    assert row["updated_at"].endswith("Z")        # Node-compatible mtime ISO
    assert row["path"].endswith(".md.enc")         # backing file is encrypted


@pytest.mark.skipif(not HAS_CRYPTO, reason="cryptography not installed")
def test_read_survives_flag_flip_off(enc_docs, monkeypatch):
    # Written encrypted; reading after the flag flips OFF still decrypts the
    # on-disk .enc (decryption only needs the key, not the flag).
    doc = enc_docs.create(type="memo", title="Flip", body="still readable\n")
    monkeypatch.setattr(enc_docs.workspace_crypto, "is_enabled", lambda *a, **k: False)
    got = enc_docs.read("memo", doc.slug)
    assert got is not None and "still readable" in got.body


def test_export_pandoc_failure_propagates(docs, tmp_path, monkeypatch):
    import subprocess as _sp
    doc = docs.create(type="memo", title="Export", body="body\n")
    monkeypatch.setattr(docs.shutil, "which", lambda _n: "/usr/bin/pandoc-stub")

    def _boom(argv, *a, **k):
        raise _sp.CalledProcessError(1, argv)

    monkeypatch.setattr(docs.subprocess, "run", _boom)
    with pytest.raises(_sp.CalledProcessError):
        docs.export("memo", doc.slug, tmp_path / "out", format="docx")


# Opt-in real-render: runs ONLY when a pandoc binary is on PATH (local dev,
# or a CI image that already ships pandoc). docx is chosen over pdf because
# it needs only pandoc — pdf additionally needs a TeX engine that a bare
# pandoc install lacks. Asserts the docx zip magic bytes (PK\x03\x04), i.e.
# pandoc actually produced a structurally-valid container. Never gates CI.
import shutil as _shutil  # noqa: E402

@pytest.mark.skipif(_shutil.which("pandoc") is None,
                    reason="pandoc not on PATH — opt-in real-render check")
def test_export_docx_real_render_when_pandoc_present(docs, tmp_path):
    doc = docs.create(type="memo", title="Real Render", body="# Title\n\nbody\n")
    out = docs.export("memo", doc.slug, tmp_path / "out", format="docx")
    assert out.exists()
    data = out.read_bytes()
    assert data[:4] == b"PK\x03\x04", "docx export is not a valid zip container"


def test_slugify_normalises_input(docs):
    assert docs.slugify("Spring  Cleanup!! 2025") == "spring-cleanup-2025"
    assert docs.slugify("") == "document"
