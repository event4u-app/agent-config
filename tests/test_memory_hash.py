"""Tests for scripts/memory_hash.py — content-addressed entry hash."""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scripts"))
import memory_hash as mh  # noqa: E402


def test_hash_length_is_12_hex():
    h = mh.hash_entry({"id": "x", "body": "b"})
    assert len(h) == 12
    assert all(c in "0123456789abcdef" for c in h)


def test_same_entry_same_hash():
    a = {"id": "x", "body": "b", "tags": ["z", "a"]}
    b = {"tags": ["z", "a"], "body": "b", "id": "x"}  # key order differs
    assert mh.hash_entry(a) == mh.hash_entry(b)


def test_different_entry_different_hash():
    assert mh.hash_entry({"id": "x"}) != mh.hash_entry({"id": "y"})


def test_whitespace_does_not_matter():
    # canonical-JSON ignores whitespace because it serialises freshly
    a = {"body": "hello  world"}
    b = {"body": "hello  world"}
    assert mh.hash_entry(a) == mh.hash_entry(b)


def test_list_order_matters():
    # Lists in YAML represent ordered sequences (e.g. paths globs) —
    # reordering MUST produce a different hash, or two different
    # policies could collapse to the same file.
    a = {"paths": ["a", "b"]}
    b = {"paths": ["b", "a"]}
    assert mh.hash_entry(a) != mh.hash_entry(b)


def test_nested_dict_keys_sorted():
    a = {"meta": {"x": 1, "y": 2}}
    b = {"meta": {"y": 2, "x": 1}}
    assert mh.hash_entry(a) == mh.hash_entry(b)
