"""Tests for ``src/cli/python/workspace_inbox.py`` (ADR-065 Tier-3 inbox).

v0 is plaintext + ephemeral + content-minimal (no encryption — the inbox
holds a prompt the user reads to copy-paste, already encrypted in sessions).
"""
from __future__ import annotations

import importlib.util
import json
import os
import sys
import time
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parents[1]
MODULE_PATH = REPO_ROOT / "src" / "cli" / "python" / "workspace_inbox.py"


def _load():
    spec = importlib.util.spec_from_file_location("workspace_inbox", MODULE_PATH)
    assert spec and spec.loader
    mod = importlib.util.module_from_spec(spec)
    sys.modules["workspace_inbox"] = mod
    spec.loader.exec_module(mod)
    return mod


@pytest.fixture
def wi(tmp_path, monkeypatch):
    mod = _load()
    monkeypatch.setattr(mod, "WORKSPACE_HOME", tmp_path / "inbox")
    return mod


def test_write_returns_id_path_banner(wi):
    r = wi.write("galabau", "offer", "RENDERED PROMPT\n", session="s1")
    assert r["id"] and r["path"].endswith(".md")
    assert "copy" in r["banner"].lower()


def test_write_is_plaintext_on_disk(wi):
    r = wi.write("galabau", "offer", "the rendered prompt body\n")
    raw = Path(r["path"]).read_text(encoding="utf-8")
    assert raw.startswith("---\n")                      # plaintext frontmatter
    assert "role: galabau" in raw
    assert "the rendered prompt body" in raw            # NOT encrypted


def test_read_round_trip(wi):
    r = wi.write("consultant", "memo", "BODY\n", session="s2")
    text = wi.read(r["id"])
    assert text is not None and "BODY" in text and "session: s2" in text


def test_read_missing_returns_none(wi):
    assert wi.read("nope") is None


def test_list_orders_recent_first(wi):
    a = wi.write("galabau", "t1", "a\n")
    time.sleep(0.01)
    b = wi.write("consultant", "t2", "b\n")
    rows = wi.list_inbox()
    assert [r["id"] for r in rows] == [b["id"], a["id"]]
    assert rows[0]["role"] == "consultant" and rows[0]["task"] == "t2"


def test_forget_deletes(wi):
    r = wi.write("galabau", "t", "x\n")
    assert wi.forget(r["id"]) is True
    assert wi.read(r["id"]) is None
    assert wi.forget(r["id"]) is False                  # idempotent


def test_prune_drops_old(wi):
    r = wi.write("galabau", "t", "x\n")
    p = Path(r["path"])
    old = time.time() - 48 * 3600
    os.utime(p, (old, old))
    assert wi.prune(max_age_hours=24) == 1
    assert not p.exists()


def test_prune_keeps_fresh(wi):
    wi.write("galabau", "t", "x\n")
    assert wi.prune(max_age_hours=24) == 0


def test_secret_scrubbed_from_body(wi):
    # A pasted high-confidence secret is scrubbed (disposable hand-off posture).
    r = wi.write("galabau", "t", "key=AKIAIOSFODNN7EXAMPLE in the prompt\n")
    raw = Path(r["path"]).read_text(encoding="utf-8")
    assert "AKIAIOSFODNN7EXAMPLE" not in raw


def test_write_with_skill_hint_prerenders_skill(wi):
    # A real shipped skill is pre-rendered into the hand-off (ADR-066).
    r = wi.write("galabau", "offer", "Draft an offer.\n", skill_hint="doc-coauthoring")
    raw = Path(r["path"]).read_text(encoding="utf-8")
    assert "Draft an offer." in raw
    assert "## Skill context: doc-coauthoring" in raw          # skill body appended


def test_write_with_missing_skill_hint_is_graceful(wi):
    r = wi.write("galabau", "offer", "Draft.\n", skill_hint="no-such-skill-xyz")
    raw = Path(r["path"]).read_text(encoding="utf-8")
    assert "Draft." in raw
    assert "not found" in raw                                  # inline note, no crash


def test_write_without_skill_hint_unchanged(wi):
    r = wi.write("galabau", "offer", "Just the prompt.\n")
    raw = Path(r["path"]).read_text(encoding="utf-8")
    assert "## Skill context" not in raw                       # no section when absent


def test_cli_root_validation_rejects_bad_path(wi, tmp_path):
    bad = tmp_path / "not-inbox"
    bad.mkdir()
    with pytest.raises(SystemExit, match="workspace/inbox"):
        wi.main(["list", "--root", str(bad)])


def test_cli_write_read_with_valid_root(wi, tmp_path, capsys):
    root = tmp_path / "workspace" / "inbox"
    root.mkdir(parents=True)
    body = tmp_path / "body.md"
    body.write_text("CLI BODY\n", encoding="utf-8")
    rc = wi.main(["write", "--role", "galabau", "--task", "offer",
                  "--body-file", str(body), "--root", str(root)])
    assert rc == 0
    res = json.loads(capsys.readouterr().out)
    rc = wi.main(["read", res["id"], "--root", str(root)])
    assert rc == 0
    assert "CLI BODY" in capsys.readouterr().out
