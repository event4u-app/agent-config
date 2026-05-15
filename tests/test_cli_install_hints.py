"""Step-9 Phase 2 — ``cli_hints`` install-hint banner tests.

Covers:

- ``hint_for`` returns the table entry for known providers and
  ``None`` for unknown ones.
- ``format_install_hints`` produces one line per skipped entry, in
  input order.
- Known ``binary_missing`` entries include the install one-liner and
  the docs URL.
- Unknown providers (not yet in ``INSTALL_HINTS``) fall back to the
  raw ``detail`` without crashing.
- Non-``binary_missing`` reasons (e.g. future ``auth_expired``) reuse
  the raw ``detail`` without an install suffix.
- Empty input yields an empty string so callers can append it
  unconditionally.

The helper is exercised directly — no subprocess, no PATH lookups.
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from scripts.ai_council.cli_hints import (  # noqa: E402
    INSTALL_HINTS, format_install_hints, hint_for,
)


def test_hint_for_known_providers_returns_table_row():
    for provider in ("anthropic", "openai", "gemini", "xai", "perplexity"):
        row = hint_for(provider)
        assert row is not None, f"{provider} should be in INSTALL_HINTS"
        binary, url, one_liner = row
        assert binary, f"{provider}: binary must be non-empty"
        assert url.startswith("https://"), f"{provider}: docs URL must be https"
        assert one_liner, f"{provider}: install one-liner must be non-empty"


def test_hint_for_unknown_provider_is_none():
    assert hint_for("nonesuch") is None
    assert hint_for("") is None


def test_format_install_hints_empty_input_returns_empty_string():
    assert format_install_hints([]) == ""


def test_format_install_hints_known_provider_includes_install_and_docs():
    skipped = [{
        "member": "anthropic",
        "reason": "binary_missing",
        "detail": "AnthropicCliClient: binary 'claude' not found on PATH.",
    }]
    out = format_install_hints(skipped)
    assert "council:cli-skip" in out
    assert "anthropic" in out
    assert "binary not found" in out
    _, url, one_liner = INSTALL_HINTS["anthropic"]
    assert one_liner in out
    assert url in out


def test_format_install_hints_unknown_provider_falls_back_to_detail():
    skipped = [{
        "member": "futureai",
        "reason": "binary_missing",
        "detail": "FutureCliClient: binary 'futureai' not found on PATH.",
    }]
    out = format_install_hints(skipped)
    assert "council:cli-skip" in out
    assert "futureai" in out
    assert "binary not found" in out
    # Falls back to detail — no install one-liner since provider is unknown.
    assert "FutureCliClient: binary 'futureai' not found on PATH." in out


def test_format_install_hints_non_binary_missing_reason_keeps_detail():
    skipped = [{
        "member": "anthropic",
        "reason": "auth_expired",
        "detail": "session expired — run `claude /login`",
    }]
    out = format_install_hints(skipped)
    assert "council:cli-skip" in out
    assert "auth_expired" in out
    assert "run `claude /login`" in out
    # Should NOT advertise install hint for a non-missing-binary reason.
    _, _, one_liner = INSTALL_HINTS["anthropic"]
    assert one_liner not in out


def test_format_install_hints_multiple_entries_one_line_each_in_order():
    skipped = [
        {"member": "openai", "reason": "binary_missing", "detail": "x"},
        {"member": "gemini", "reason": "binary_missing", "detail": "y"},
    ]
    out = format_install_hints(skipped)
    lines = out.splitlines()
    assert len(lines) == 2
    assert "openai" in lines[0]
    assert "gemini" in lines[1]


def test_format_install_hints_missing_keys_do_not_crash():
    # Defensive: build_members always sets all three keys, but a
    # caller passing a partial dict should degrade gracefully rather
    # than raise KeyError.
    out = format_install_hints([{"member": "anthropic"}])
    assert "anthropic" in out
    assert "council:cli-skip" in out
