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

    def _record(argv, *args, **kwargs):
        calls.append(list(argv))
        # pandoc would write the target; the contract test owns only the argv,
        # so materialise an empty target to mirror a successful run.
        Path(argv[argv.index("-o") + 1]).write_bytes(b"")
        return None

    monkeypatch.setattr(docs.subprocess, "run", _record)

    out = docs.export(doc_type, doc.slug, tmp_path / "out", format=fmt)

    expected_target = tmp_path / "out" / f"{doc.slug}.{fmt}"
    assert out == expected_target
    assert len(calls) == 1
    argv = calls[0]
    assert argv[0] == fake_pandoc
    assert str(doc.path) in argv
    assert "-o" in argv
    assert argv[argv.index("-o") + 1] == str(expected_target)


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
