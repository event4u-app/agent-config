"""Tests for scripts/check_reply_consistency.py."""
from __future__ import annotations

import importlib.util
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent
SPEC = importlib.util.spec_from_file_location(
    "check_reply_consistency",
    ROOT / "scripts" / "check_reply_consistency.py",
)
assert SPEC and SPEC.loader
crc = importlib.util.module_from_spec(SPEC)
sys.modules["check_reply_consistency"] = crc
SPEC.loader.exec_module(crc)


# --- validate() — happy paths ----------------------------------------------

def test_clean_options_with_recommendation():
    text = (
        "> 1. Foo — bar\n"
        "> 2. Baz — qux\n"
        "\n"
        "**Recommendation: 1 — Foo** — reason. Caveat: flip to 2 if X.\n"
    )
    assert crc.validate(text) == (0, "ok (recommendation 1 matches option block)")


def test_clean_german():
    text = (
        "> 1. Eins\n> 2. Zwei\n\n**Empfehlung: 2 — Zwei** — weil.\n"
    )
    code, _ = crc.validate(text)
    assert code == 0


def test_no_options_block():
    assert crc.validate("Plain reply, no options.")[0] == 0


def test_options_without_rec_non_strict():
    text = "> 1. Foo\n> 2. Bar\n"
    code, msg = crc.validate(text, strict=False)
    assert code == 0
    assert "non-strict" in msg


def test_codespan_tag_does_not_trigger():
    text = (
        "> 1. Foo — describes `(recommended)` legacy pattern\n"
        "> 2. Baz\n"
        "\n**Recommendation: 1 — Foo** — reason.\n"
    )
    assert crc.validate(text)[0] == 0


# --- validate() — failure modes --------------------------------------------

def test_inline_tag_recommended():
    text = "> 1. Foo (recommended)\n> 2. Bar\n\n**Recommendation: 1 — Foo** — r.\n"
    code, msg = crc.validate(text)
    assert code == 2
    assert "inline tag" in msg


def test_inline_tag_rec_short():
    text = "> 1. Foo (rec)\n> 2. Bar\n\n**Recommendation: 1 — Foo** — r.\n"
    assert crc.validate(text)[0] == 2


def test_inline_tag_empfohlen():
    text = "> 1. Foo (empfohlen)\n> 2. Bar\n\n**Empfehlung: 1 — Foo** — r.\n"
    assert crc.validate(text)[0] == 2


def test_multi_distinct_recommendations():
    text = (
        "> 1. Foo\n> 2. Bar\n\n"
        "**Recommendation: 1 — Foo** — r.\n"
        "Empfehlung: 2 weil.\n"
    )
    code, msg = crc.validate(text)
    assert code == 3
    assert "[1, 2]" in msg


def test_repeated_same_number_is_not_multi():
    text = (
        "> 1. Foo\n> 2. Bar\n\n"
        "**Recommendation: 1 — Foo** — r.\n"
        "(Earlier I also said Recommendation: 1 — same.)\n"
    )
    assert crc.validate(text)[0] == 0


def test_recommended_number_not_in_options():
    text = "> 1. Foo\n> 2. Bar\n\n**Recommendation: 5 — Phantom** — r.\n"
    code, msg = crc.validate(text)
    assert code == 4
    assert "5" in msg


def test_strict_options_without_rec():
    text = "> 1. Foo\n> 2. Bar\n"
    code, msg = crc.validate(text, strict=True)
    assert code == 5


# --- scan-dir mode ---------------------------------------------------------

def test_scan_dir_finds_legacy(tmp_path: Path):
    bad = tmp_path / "bad.md"
    bad.write_text("> 1. Foo (recommended)\n> 2. Bar\n")
    assert crc.cmd_scan_dir(tmp_path) == 6


def test_scan_dir_clean(tmp_path: Path):
    good = tmp_path / "good.md"
    good.write_text("> 1. Foo\n> 2. Bar\n\n**Recommendation: 1 — Foo** — r.\n")
    assert crc.cmd_scan_dir(tmp_path) == 0


def test_scan_dir_ignores_codespan_tag(tmp_path: Path):
    """Backticked `(recommended)` in option lines is documentation, not legacy."""
    p = tmp_path / "doc.md"
    p.write_text("> 1. Foo — describe `(recommended)` legacy\n> 2. Bar\n")
    assert crc.cmd_scan_dir(tmp_path) == 0


def test_scan_dir_missing_path(tmp_path: Path):
    missing = tmp_path / "does-not-exist"
    assert crc.cmd_scan_dir(missing) == 9


# --- repo invariant: shipped sources stay clean ----------------------------

@pytest.mark.parametrize("subdir", ["rules", "commands", "skills"])
def test_agent_src_uncompressed_clean(subdir: str):
    """The shipped uncompressed sources must never reintroduce the legacy tag."""
    target = ROOT / ".agent-src.uncompressed" / subdir
    if not target.exists():
        pytest.skip(f"{target} not present")
    assert crc.cmd_scan_dir(target) == 0
