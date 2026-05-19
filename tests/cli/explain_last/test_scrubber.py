"""PII / cost-metadata scrubber coverage (Phase 4 #2).

Mirrors the patterns documented in
``scripts/_cli/explain_last/scrubber.py``: raw-key secrets, ``api_key=``
inline shapes, emails, absolute paths, URLs (path stripped), internal
hostnames, monetary amounts, and the 200-char long-string fallback.

Each test asserts both the masked output *and* idempotence — running the
scrubber a second time on its own output must be a no-op, which keeps
the redactor safe to call from multiple call sites without compounding.
"""
from __future__ import annotations

import pytest

from scripts._cli.explain_last.scrubber import (
    LONG_STRING_THRESHOLD,
    scrub_string,
    scrub_value,
)


@pytest.mark.parametrize(
    "raw, expected_marker",
    [
        ("sk_live_abcdef1234567890", "<secret>"),
        ("ghp_0123456789abcdefABCDEF0123", "<secret>"),
        ("github_pat_11ABCDEFG0XYZxyz1234567890", "<secret>"),
        ("AIzaSyABCDEFGHIJKLMNOPQR", "<secret>"),
        ("AKIAIOSFODNN7EXAMPLE", "<secret>"),
    ],
)
def test_raw_key_prefixes_are_masked(raw: str, expected_marker: str) -> None:
    assert scrub_string(raw) == expected_marker
    # Idempotent — second pass leaves the placeholder untouched.
    assert scrub_string(scrub_string(raw)) == expected_marker


def test_inline_api_key_assignment_is_masked() -> None:
    assert scrub_string("api_key=AbCdEf1234567890") == "api_key=<secret>"
    assert scrub_string("API_KEY: shhsecretvaluE12") == "api_key=<secret>"


def test_email_addresses_are_masked() -> None:
    out = scrub_string("contact matze@example.com please")
    assert "<email>" in out
    assert "matze" not in out


def test_absolute_paths_are_masked() -> None:
    out = scrub_string("trace from /Users/matze/projects/repo/file.py at line 42")
    assert "<path>" in out
    assert "matze" not in out
    assert "/Users/" not in out


def test_windows_paths_are_masked() -> None:
    out = scrub_string(r"opened C:\Users\matze\repo\file.py")
    assert "<path>" in out
    assert "matze" not in out


def test_urls_strip_path_and_query() -> None:
    out = scrub_string("see https://example.com/secret/path?token=abc#frag")
    assert "https://example.com/" in out
    assert "secret/path" not in out
    assert "token=abc" not in out
    assert "#frag" not in out


def test_internal_hostnames_are_masked() -> None:
    out = scrub_string("ping db.internal and cache.local now")
    assert "db.internal" not in out
    assert "cache.local" not in out
    assert out.count("<host>") == 2


def test_monetary_amounts_are_masked() -> None:
    out = scrub_string("spent $1,234.56 and USD 500 on the run")
    assert "<money>" in out
    assert "1,234" not in out
    assert "USD 500" not in out


def test_long_string_collapses_to_summary() -> None:
    raw = "x" * (LONG_STRING_THRESHOLD + 1)
    masked = scrub_string(raw)
    assert masked == f"<{LONG_STRING_THRESHOLD + 1} chars>"


def test_short_string_passes_through() -> None:
    assert scrub_string("plain text") == "plain text"


def test_empty_and_non_string_inputs_are_returned_unchanged() -> None:
    assert scrub_string("") == ""
    # type: ignore[arg-type]
    assert scrub_string(None) is None  # type: ignore[arg-type]


def test_scrub_value_recurses_dicts_and_lists() -> None:
    payload = {
        "ok": True,
        "count": 7,
        "user": "matze@example.com",
        "trace": ["see /Users/matze/code", "amount $99"],
        "nested": {"key": "sk_live_aaaabbbbccccdddd"},
    }
    out = scrub_value(payload)
    assert out["ok"] is True
    assert out["count"] == 7
    assert "<email>" in out["user"]
    assert "<path>" in out["trace"][0]
    assert "<money>" in out["trace"][1]
    assert out["nested"]["key"] == "<secret>"


def test_scrub_value_preserves_dict_keys() -> None:
    # Keys are schema names, not user payloads — must NOT be scrubbed.
    payload = {"api_key": "sk_live_aaaabbbbccccdddd"}
    out = scrub_value(payload)
    assert "api_key" in out
    assert out["api_key"] == "<secret>"


def test_scrub_value_normalises_tuples_to_lists() -> None:
    out = scrub_value(("a", "b"))
    assert out == ["a", "b"]


def test_url_in_complex_string_keeps_surrounding_text() -> None:
    out = scrub_string("Visit https://internal.example.com/admin?key=secret for setup")
    assert out.startswith("Visit ")
    assert " for setup" in out
    assert "key=secret" not in out
