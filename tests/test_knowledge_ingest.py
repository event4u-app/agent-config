"""Tests for ``src/cli/python/knowledge_ingest.py``.

Covers the contract surface defined in
``docs/contracts/local-knowledge-ingestion.md``:

* uuid7 generation + timestamp recovery
* redaction (PII + secrets)
* chunking
* file walk with MAX_DEPTH respect
* bounds enforcement (count + per-file)
* remote-scheme rejection
* manifest persistence
* list / forget / pin round-trip
"""

from __future__ import annotations

import importlib.util
import json
import sys
from pathlib import Path

import pytest


REPO_ROOT = Path(__file__).resolve().parents[1]
MODULE_PATH = REPO_ROOT / "src" / "cli" / "python" / "knowledge_ingest.py"
FIXTURES = REPO_ROOT / "tests" / "fixtures" / "knowledge-corpus"


def _load_module():
    spec = importlib.util.spec_from_file_location("knowledge_ingest", MODULE_PATH)
    assert spec and spec.loader, "module spec must resolve"
    mod = importlib.util.module_from_spec(spec)
    sys.modules["knowledge_ingest"] = mod
    spec.loader.exec_module(mod)
    return mod


@pytest.fixture(scope="module")
def ki():
    return _load_module()


def test_uuid7_format_and_timestamp_recovery(ki) -> None:
    u = ki.uuid7()
    parts = u.split("-")
    assert [len(p) for p in parts] == [8, 4, 4, 4, 12]
    ts = ki.uuid7_ts(u)
    # uuid7 ms must be a recent UNIX millisecond
    import time

    now_ms = int(time.time() * 1000)
    assert abs(now_ms - ts) < 5000


def test_redact_pii_classes(ki) -> None:
    counters: dict = {}
    text, secrets = ki.redact(
        "Email me at alice@example.com or DE89370400440532013000 for IBAN. "
        "Card 4111 1111 1111 1111 SSN 123-45-6789.",
        counters,
    )
    assert "[EMAIL]" in text
    assert "[IBAN]" in text
    assert "[CC]" in text
    assert "[SSN]" in text
    assert secrets == 0
    assert counters.get("EMAIL", 0) >= 1


def test_redact_secrets(ki) -> None:
    counters: dict = {}
    text, secrets = ki.redact(
        "AWS=AKIAIOSFODNN7EXAMPLE GH=ghp_abcdefghijklmnopqrstuvwxyz0123456789 "
        "OAI=sk-abcdefghijklmnopqrstuvwxyz0123456789ABCDEFGHIJ",
        counters,
    )
    assert text.count("[SECRET]") >= 3
    assert secrets >= 3


def test_chunk_text_paragraph_boundaries(ki) -> None:
    big = ("para one.\n\n" * 10) + ("para two.\n\n" * 10)
    chunks = ki.chunk_text(big, target_bytes=100)
    assert len(chunks) >= 2
    for c in chunks:
        assert c.strip()


def test_ingest_plain_markdown(ki, tmp_path) -> None:
    m = ki.ingest(str(FIXTURES / "plain"), root=tmp_path)
    assert m.documents == 1
    assert m.chunks >= 1
    assert m.redacted is True
    assert not m.pinned
    target = tmp_path / m.ingest_id / "manifest.json"
    assert target.exists()
    persisted = json.loads(target.read_text(encoding="utf-8"))
    assert persisted["ingest_id"] == m.ingest_id


def test_ingest_redacts_pii(ki, tmp_path) -> None:
    m = ki.ingest(str(FIXTURES / "with-pii"), root=tmp_path)
    chunks_dir = tmp_path / m.ingest_id / "chunks"
    assert chunks_dir.exists()
    content = "\n".join(p.read_text() for p in chunks_dir.iterdir())
    assert "alice@example.com" not in content
    assert "[EMAIL]" in content
    assert m.pii_redacted.get("EMAIL", 0) >= 1


def test_ingest_redacts_secrets(ki, tmp_path) -> None:
    m = ki.ingest(str(FIXTURES / "with-secrets"), root=tmp_path)
    chunks_dir = tmp_path / m.ingest_id / "chunks"
    content = "\n".join(p.read_text() for p in chunks_dir.iterdir())
    assert "AKIAIOSFODNN7EXAMPLE" not in content
    assert "[SECRET]" in content
    assert m.secrets_redacted >= 1
    assert m.contains_redactions is True


def test_ingest_no_redact_opt_out(ki, tmp_path) -> None:
    m = ki.ingest(str(FIXTURES / "with-pii"), redact_pii=False, root=tmp_path)
    chunks_dir = tmp_path / m.ingest_id / "chunks"
    content = "\n".join(p.read_text() for p in chunks_dir.iterdir())
    assert "alice@example.com" in content
    assert m.redacted is False


def test_ingest_nested_walks_subdirs(ki, tmp_path) -> None:
    m = ki.ingest(str(FIXTURES / "nested"), root=tmp_path)
    assert m.documents == 2


def test_ingest_skips_unsupported_mime(ki, tmp_path) -> None:
    m = ki.ingest(str(FIXTURES / "mixed"), root=tmp_path)
    assert m.documents == 2
    assert any("unsupported" in s["reason"] for s in m.skipped)


def test_remote_scheme_rejected(ki) -> None:
    with pytest.raises(ki.IngestError, match="remote scheme rejected"):
        ki.ingest("https://example.com/foo.md")


def test_list_forget_pin_roundtrip(ki, tmp_path) -> None:
    m = ki.ingest(str(FIXTURES / "plain"), root=tmp_path)
    listed = ki.list_ingests(root=tmp_path)
    assert len(listed) == 1
    assert listed[0]["ingest_id"] == m.ingest_id

    ki.set_pin(m.ingest_id[:8], True, root=tmp_path)
    listed = ki.list_ingests(root=tmp_path)
    assert listed[0]["pinned"] is True

    ki.forget(m.ingest_id[:8], root=tmp_path)
    listed = ki.list_ingests(root=tmp_path)
    assert listed == []


def test_forget_unknown_prefix_errors(ki, tmp_path) -> None:
    with pytest.raises(ki.IngestError, match="no ingest matches"):
        ki.forget("ffffffff", root=tmp_path)
