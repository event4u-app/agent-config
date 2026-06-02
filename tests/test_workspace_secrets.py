"""Tests for the shared secret-scan module + per-store pre-write guard.

Covers Phase 8 Step 5 (secret-hygiene sweep) of
``road-to-employee-product-and-external-proof``:

* the five secret patterns scrub to ``[SECRET]`` after the DRY extraction
* confidence tiers (high vs fuzzy) are reported correctly by ``scan``
* ``scrub_obj`` recurses dict/list, leaves non-strings untouched, and is
  bounded against cyclic / over-deep payloads (the never-raises contract)
* each store wires the guard: analytics + sessions scrub silently, documents
  refuse high-confidence and warn on fuzzy
* analytics ``emit`` drops (never persists) an event whose scrub errors
* ``knowledge_ingest`` still redacts after importing the shared patterns
"""

from __future__ import annotations

import importlib.util
import json
import sys
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parents[1]
PY_DIR = REPO_ROOT / "packages" / "core" / "installer" / "python"


def _load(name: str):
    spec = importlib.util.spec_from_file_location(name, PY_DIR / f"{name}.py")
    assert spec and spec.loader
    mod = importlib.util.module_from_spec(spec)
    sys.modules[name] = mod
    spec.loader.exec_module(mod)
    return mod


@pytest.fixture(scope="module")
def ws():
    return _load("workspace_secrets")


# --- secret samples (synthetic — never real credentials) --------------------

AWS = "AKIAIOSFODNN7EXAMPLE"
GH = "ghp_" + "a" * 36
OPENAI = "sk-" + "b" * 24
PEM = "-----BEGIN RSA PRIVATE KEY-----\nMIIabc\n-----END RSA PRIVATE KEY-----"
KV = 'api_key="abcdef0123456789"'


# --- scrub: each pattern collapses to the placeholder -----------------------


@pytest.mark.parametrize(
    "sample,expect_count",
    [(AWS, 1), (GH, 1), (OPENAI, 1), (PEM, 1), (KV, 1)],
)
def test_scrub_each_pattern(ws, sample, expect_count):
    clean, count = ws.scrub(f"prefix {sample} suffix")
    assert count == expect_count
    assert ws.PLACEHOLDER in clean
    assert sample not in clean


def test_scrub_counts_multiple(ws):
    clean, count = ws.scrub(f"{AWS} and {GH} and {OPENAI}")
    assert count == 3
    assert clean.count(ws.PLACEHOLDER) == 3


# --- scan: non-destructive, correct tier, no value echoed -------------------


def test_scan_reports_high_tier(ws):
    findings = ws.scan(f"key {AWS}")
    assert len(findings) == 1
    assert findings[0].confidence == "high"
    assert findings[0].pattern == "aws_access_key"


def test_scan_reports_fuzzy_tier(ws):
    findings = ws.scan(KV)
    assert [f.confidence for f in findings] == ["fuzzy"]


def test_scan_include_fuzzy_false_skips_kv(ws):
    assert ws.scan(KV, include_fuzzy=False) == []
    clean, count = ws.scrub(KV, include_fuzzy=False)
    assert count == 0 and clean == KV


def test_scan_clean_text_is_noop(ws):
    assert ws.scan("a perfectly ordinary memo about hedges") == []
    clean, count = ws.scrub("a perfectly ordinary memo about hedges")
    assert count == 0 and clean == "a perfectly ordinary memo about hedges"


# --- scrub_obj: recursion, leaf typing, bounded against abuse ---------------


def test_scrub_obj_recurses_and_preserves_non_strings(ws):
    payload = {"prompt": f"use {AWS}", "n": 7, "ok": True, "none": None,
               "nested": ["clean", f"tok {GH}"]}
    clean, count = ws.scrub_obj(payload)
    assert count == 2
    assert clean["n"] == 7 and clean["ok"] is True and clean["none"] is None
    assert ws.PLACEHOLDER in clean["prompt"]
    assert ws.PLACEHOLDER in clean["nested"][1]
    assert clean["nested"][0] == "clean"


def test_scrub_obj_cycle_guard_does_not_raise(ws):
    d: dict = {"k": f"x {AWS}"}
    d["self"] = d  # self-reference
    clean, count = ws.scrub_obj(d)  # must not RecursionError
    assert count >= 1


def test_scrub_obj_deep_nesting_is_bounded(ws):
    obj: dict = {}
    cur = obj
    for _ in range(200):  # well past _MAX_DEPTH
        cur["child"] = {}
        cur = cur["child"]
    cur["secret"] = AWS
    # The leaf is below the depth cap, so it is NOT scrubbed — but crucially
    # the call returns instead of overflowing the stack.
    clean, count = ws.scrub_obj(obj)
    assert isinstance(clean, dict)


# --- knowledge_ingest still redacts after the DRY extraction ----------------


def test_knowledge_ingest_redacts_via_shared_patterns():
    ki = _load("knowledge_ingest")
    counters: dict = {}
    text, secrets = ki.redact(f"{AWS} mail a@b.com {GH} {OPENAI}", counters)
    assert secrets >= 3
    assert "[SECRET]" in text
    assert "[EMAIL]" in text


# --- store integration: analytics scrubs + fail-safe drop -------------------


def test_analytics_emit_scrubs_payload(tmp_path, monkeypatch):
    wa = _load("workspace_analytics")
    events = tmp_path / "events.jsonl"
    monkeypatch.setattr(wa, "EVENTS_PATH", events)
    monkeypatch.setattr(wa, "WORKSPACE_HOME", tmp_path)
    monkeypatch.delenv(wa.ENV_OPT_OUT, raising=False)
    assert wa.emit("launcher.opened", {"prompt": f"deploy with {AWS}"}) is True
    written = events.read_text(encoding="utf-8")
    assert AWS not in written
    assert "[SECRET]" in written


def test_analytics_emit_drops_event_when_scrub_errors(tmp_path, monkeypatch):
    wa = _load("workspace_analytics")
    events = tmp_path / "events.jsonl"
    monkeypatch.setattr(wa, "EVENTS_PATH", events)
    monkeypatch.setattr(wa, "WORKSPACE_HOME", tmp_path)
    monkeypatch.delenv(wa.ENV_OPT_OUT, raising=False)

    def _boom(*_a, **_k):
        raise RuntimeError("scrub blew up")

    monkeypatch.setattr(wa.workspace_secrets, "scrub_obj", _boom)
    assert wa.emit("launcher.opened", {"prompt": f"x {AWS}"}) is False
    assert not events.exists()  # nothing persisted, secret never reached disk


# --- store integration: sessions scrub silently -----------------------------


def test_sessions_append_scrubs_payload(tmp_path, monkeypatch):
    ws_sess = _load("workspace_sessions")
    root = tmp_path / "sessions"
    sid = ws_sess.start("galabau", f"set up {GH} please", root=root)
    assert ws_sess.append(sid, "host.tool", {"args": {"token": OPENAI}}, root=root)
    records = ws_sess.read(sid, root=root)
    blob = json.dumps(records)
    assert GH not in blob and OPENAI not in blob
    assert "[SECRET]" in blob


# --- store integration: documents refuse high, warn on fuzzy ----------------


def test_documents_create_refuses_high_confidence(tmp_path, monkeypatch):
    wd = _load("workspace_documents")
    monkeypatch.setattr(wd, "WORKSPACE_HOME", tmp_path / "documents")
    with pytest.raises(wd.SecretLeakError):
        wd.create(type="memo", title="leak", body=f"here is {AWS}")
    # Nothing written.
    assert not (tmp_path / "documents" / "memo").exists()


def test_documents_create_allows_fuzzy_with_warning(tmp_path, monkeypatch, capsys):
    wd = _load("workspace_documents")
    monkeypatch.setattr(wd, "WORKSPACE_HOME", tmp_path / "documents")
    doc = wd.create(type="memo", title="reset note", body=KV)
    assert doc.path.exists()
    assert KV in doc.path.read_text(encoding="utf-8")  # body preserved verbatim
    assert "possible secret" in capsys.readouterr().err
