"""Privacy regression test for ``docs/contracts/memory-visibility-v1.md``.

Enforces the privacy-floor clause: the visibility line and its
underlying summary must never carry entry **bodies**, summaries,
quoted snippets, secrets, tokens, env values, or paths outside the
``agents/state/`` and ``tests/`` allowlist.

Three layers:

1. **Allowlisted summary keys.** ``summarise_visibility`` returns
   exactly ``{"asks", "hits", "ids"}`` — no body, source, or path
   leaks through that surface.
2. **Rendered line whitelist.** The line embeds the icon, fixed
   labels, two integers, and entry ids. Anything outside
   ``[icon, " Memory: ", "<int>", "/", "<int>", " · ids=[",
   "<id-list>", "]"]`` fails the test.
3. **Synthetic-secret fixtures.** Memory entries seeded with secrets,
   bearer tokens, prod-paths, and entry bodies must not appear in the
   summary or the rendered line.
"""
from __future__ import annotations

import re
from pathlib import Path

import pytest

from work_engine.scoring.memory_visibility import (
    format_line,
    summarise_visibility,
)

ROOT = Path(__file__).resolve().parent.parent.parent
CONTRACT_PATH = ROOT / "docs" / "contracts" / "memory-visibility-v1.md"

ALLOWED_SUMMARY_KEYS = {"asks", "hits", "ids"}

SYNTHETIC_SECRETS = (
    "AKIAFAKEFAKEFAKEFAKE",
    "ghp_FAKE_PERSONAL_ACCESS_TOKEN_1234567890",
    "Bearer eyJhbGciFAKEHEADER.FAKEPAYLOAD.FAKESIGNATURE",
    "/etc/passwd",
    "/var/log/prod.log",
    "/Users/operator/.ssh/id_rsa",
    "DROP TABLE customers",
    "user@example.com password=hunter2",
)


def _payload(extras: dict) -> dict:
    """Build a memory hit dict that crams every dangerous field in."""
    base = {
        "id": "mem_safe_42",
        "type": "domain-invariants",
        "score": 0.91,
    }
    base.update(extras)
    return base


def test_contract_pins_redaction_test_path() -> None:
    text = CONTRACT_PATH.read_text(encoding="utf-8")
    assert "tests/contracts/test_memory_visibility_redaction.py" in text


def test_summary_only_exposes_allowlisted_keys() -> None:
    summary = summarise_visibility(
        [
            _payload(
                {
                    "entry": {
                        "body": "secret onboarding text",
                        "summary": "do not leak",
                        "path": "/etc/secrets/credentials",
                    },
                    "source": "operational",
                    "path": "agents/memory/intake/2026-05-04.jsonl",
                    "snippet": "do not leak",
                    "raw": SYNTHETIC_SECRETS[0],
                }
            )
        ]
    )
    assert set(summary.keys()) == ALLOWED_SUMMARY_KEYS
    assert summary["ids"] == ["mem_safe_42"]


@pytest.mark.parametrize("secret", SYNTHETIC_SECRETS)
def test_secret_value_never_appears_in_line(secret: str) -> None:
    memory = [
        _payload(
            {
                "id": f"mem_safe_{abs(hash(secret)) % 9999}",
                "entry": {"body": secret, "summary": secret},
                "raw_text": secret,
                "path": secret,
                "source": secret,
            }
        )
    ]
    summary = summarise_visibility(memory)
    line = format_line(summary)
    assert line is not None
    assert secret not in line
    for value in summary.values():
        assert secret not in repr(value)


def test_line_matches_contract_grammar() -> None:
    memory = [
        {"id": "mem_a", "type": "domain-invariants"},
        {"id": "mem_b", "type": "architecture-decisions"},
        {"id": "mem_c", "type": "incident-learnings"},
    ]
    line = format_line(summarise_visibility(memory))
    assert line is not None
    pattern = re.compile(
        r"^\U0001F9E0 Memory: \d+/\d+ \u00b7 ids=\[[a-zA-Z0-9_,\s\u2026+]*\]$"
    )
    assert pattern.match(line), f"line does not match grammar: {line!r}"


def test_line_never_contains_path_separator_outside_allowlist() -> None:
    memory = [
        _payload(
            {
                "id": "mem_safe_path_1",
                "path": "/var/log/billing/prod.log",
                "entry": {"file": "/etc/passwd"},
            }
        )
    ]
    line = format_line(summarise_visibility(memory))
    assert line is not None
    assert "/var/" not in line
    assert "/etc/" not in line
    assert "log" not in line.lower()


def test_summary_drops_unknown_id_typed_payload() -> None:
    summary = summarise_visibility(
        [
            {"type": "domain-invariants", "body": "no id here"},
            {"id": ["not", "a", "string"], "type": "x"},
            {"id": 42, "type": "x"},
        ]
    )
    assert summary["ids"] == ["42"]
