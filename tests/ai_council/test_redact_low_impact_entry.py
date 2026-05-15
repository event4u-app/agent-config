"""Privacy-floor redactor contract (Phase 12, Step 4)."""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from scripts.ai_council.redact_low_impact_entry import (  # noqa: E402
    redact_low_impact_entry,
)


def test_clean_question_passes() -> None:
    res = redact_low_impact_entry(
        "Service vs repository for this read path?"
    )
    assert res.ok is True
    assert res.violations == ()


def test_secret_raw_key_prefix_refused() -> None:
    res = redact_low_impact_entry(
        "I leaked sk-ant-abcdef12345 in my config",
    )
    assert res.ok is False
    assert any(v.category == "secret" for v in res.violations)


def test_inline_api_key_refused() -> None:
    res = redact_low_impact_entry(
        "Should api_key: AbCdEf1234567890XYZ go in env?",
    )
    assert res.ok is False
    assert any(v.category == "secret" for v in res.violations)


def test_email_refused() -> None:
    res = redact_low_impact_entry(
        "Should I send to admin@example.com here?",
    )
    assert res.ok is False
    assert any(v.category == "email" for v in res.violations)


def test_project_path_refused_for_each_root() -> None:
    for path in ("/Users/foo/code", "/home/bar/proj", "/opt/app/x",
                 "/private/tmp/data", "C:\\Users\\baz\\project"):
        res = redact_low_impact_entry(f"is {path} ok to log?")
        assert res.ok is False, path
        assert any(v.category == "project_path" for v in res.violations)


def test_configured_repo_root_refused() -> None:
    res = redact_low_impact_entry(
        "is the repo at /workspace/myproject ok?",
        repo_root="/workspace/myproject",
    )
    assert res.ok is False
    assert any(v.category == "project_path" for v in res.violations)


def test_internal_hostname_refused() -> None:
    res = redact_low_impact_entry(
        "Can we point at api.staging.internal here?",
    )
    assert res.ok is False
    assert any(v.category == "internal_hostname" for v in res.violations)


def test_configured_private_domain_refused() -> None:
    res = redact_low_impact_entry(
        "Should we route through gateway.privco.example?",
        private_domains=("gateway.privco.example",),
    )
    assert res.ok is False
    assert any(v.category == "internal_hostname" for v in res.violations)


def test_monetary_amount_refused() -> None:
    for txt in ("Should we charge $1,234 per seat?",
                "Move it to €500 tier?",
                "Switch to USD 1000 plan?"):
        res = redact_low_impact_entry(txt)
        assert res.ok is False, txt
        assert any(v.category == "monetary_amount" for v in res.violations)


def test_customer_name_refused() -> None:
    res = redact_low_impact_entry(
        "Is this safe for AcmeCorp tenants?",
        customer_names=("AcmeCorp",),
    )
    assert res.ok is False
    assert any(v.category == "customer_name" for v in res.violations)


def test_generic_placeholder_survives() -> None:
    res = redact_low_impact_entry(
        "Is <customer>/<tenant>/<account> the right placeholder set?",
    )
    assert res.ok is True


def test_sql_identifier_refused() -> None:
    res = redact_low_impact_entry(
        "Should we index tenants_billing_secret here?",
        sql_identifiers=("tenants_billing_secret",),
    )
    assert res.ok is False
    assert any(v.category == "sql_identifier" for v in res.violations)


def test_long_inline_code_refused() -> None:
    long_code = "x" * 41
    res = redact_low_impact_entry(f"Is `{long_code}` fine?")
    assert res.ok is False
    assert any(v.category == "long_code_excerpt" for v in res.violations)


def test_short_inline_code_survives() -> None:
    res = redact_low_impact_entry("Is `Service` a good name?")
    assert res.ok is True


def test_summary_message_format() -> None:
    res = redact_low_impact_entry("Leak: sk-abcdef1234 here")
    assert res.ok is False
    assert "REFUSED" in res.summary()
    assert "secret" in res.summary()


def test_multiple_violations_collected() -> None:
    res = redact_low_impact_entry(
        "Both sk-abcdef1234 and admin@example.com leak here.",
    )
    assert res.ok is False
    cats = {v.category for v in res.violations}
    assert "secret" in cats and "email" in cats
