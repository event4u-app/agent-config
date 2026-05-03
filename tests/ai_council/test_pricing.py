"""Parser, heuristic, last-Monday detection, bootstrap behaviour."""

from __future__ import annotations

import datetime as _dt
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from scripts.ai_council._default_prices import DEFAULT_PRICES  # noqa: E402
from scripts.ai_council.pricing import (  # noqa: E402
    bootstrap_from_defaults,
    estimate_cost,
    estimate_input_tokens,
    is_stale,
    last_monday_utc,
    load_prices,
)


# ── chars/4 heuristic ────────────────────────────────────────────────────────


def test_estimate_input_tokens_empty_returns_zero() -> None:
    assert estimate_input_tokens("") == 0


def test_estimate_input_tokens_short_string_returns_at_least_one() -> None:
    assert estimate_input_tokens("ab") == 1
    assert estimate_input_tokens("a") == 1


def test_estimate_input_tokens_uses_chars_div_four() -> None:
    assert estimate_input_tokens("x" * 100) == 25
    assert estimate_input_tokens("x" * 4001) == 1000


# ── bootstrap + parser round-trip ────────────────────────────────────────────


def test_bootstrap_creates_file_with_frontmatter_and_table(tmp_path) -> None:  # type: ignore[no-untyped-def]
    p = tmp_path / "prices.md"
    bootstrap_from_defaults(p)
    text = p.read_text()
    assert text.startswith("---\n")
    assert "currency: USD" in text
    assert "unit: per_1M_tokens" in text
    assert "source: shipped-default" in text
    assert "| provider" in text


def test_load_prices_bootstraps_when_missing(tmp_path) -> None:  # type: ignore[no-untyped-def]
    p = tmp_path / "prices.md"
    table = load_prices(p)
    assert p.exists()
    assert table.source == "shipped-default"
    assert ("anthropic", "claude-sonnet-4-5") in table.prices


def test_load_prices_round_trips_all_default_entries(tmp_path) -> None:  # type: ignore[no-untyped-def]
    p = tmp_path / "prices.md"
    bootstrap_from_defaults(p)
    table = load_prices(p)
    for key in DEFAULT_PRICES:
        assert key in table.prices, f"missing {key}"
    for (provider, model), (inp, outp) in DEFAULT_PRICES.items():
        price = table.lookup(provider, model)
        assert price is not None
        assert price.input_per_1m_usd == inp
        assert price.output_per_1m_usd == outp


def test_load_prices_user_edit_wins_over_defaults(tmp_path) -> None:  # type: ignore[no-untyped-def]
    p = tmp_path / "prices.md"
    p.write_text(
        "---\nlast_updated: 2026-04-29\ncurrency: USD\nunit: per_1M_tokens\nsource: user-curated\n---\n\n"
        "| provider | model | input | output |\n"
        "|---|---|---|---|\n"
        "| anthropic | claude-sonnet-4-5 | 99.99 | 100.00 |\n"
    )
    table = load_prices(p)
    price = table.lookup("anthropic", "claude-sonnet-4-5")
    assert price is not None
    assert price.input_per_1m_usd == 99.99
    assert price.output_per_1m_usd == 100.00
    assert table.source == "user-curated"


# ── cost estimation ──────────────────────────────────────────────────────────


def test_estimate_cost_known_model(tmp_path) -> None:  # type: ignore[no-untyped-def]
    p = tmp_path / "prices.md"
    bootstrap_from_defaults(p)
    table = load_prices(p)
    e = estimate_cost("anthropic", "claude-sonnet-4-5", 1_000_000, 1_000_000, table)
    assert e.input_usd == 3.00
    assert e.output_usd == 15.00
    assert e.total_usd == 18.00


def test_estimate_cost_unknown_model_returns_zero(tmp_path) -> None:  # type: ignore[no-untyped-def]
    p = tmp_path / "prices.md"
    bootstrap_from_defaults(p)
    table = load_prices(p)
    e = estimate_cost("anthropic", "no-such-model", 100, 100, table)
    assert e.input_usd == 0.0
    assert e.output_usd == 0.0


# ── staleness (UTC Monday boundary) ──────────────────────────────────────────


def test_last_monday_utc_on_a_wednesday() -> None:
    # 2026-04-29 is a Wednesday
    wed = _dt.datetime(2026, 4, 29, 12, 0, tzinfo=_dt.timezone.utc)
    assert last_monday_utc(wed) == _dt.date(2026, 4, 27)


def test_last_monday_utc_on_a_monday_returns_same_date() -> None:
    mon = _dt.datetime(2026, 4, 27, 0, 1, tzinfo=_dt.timezone.utc)
    assert last_monday_utc(mon) == _dt.date(2026, 4, 27)


def test_last_monday_utc_on_a_sunday_returns_previous_monday() -> None:
    sun = _dt.datetime(2026, 5, 3, 23, 0, tzinfo=_dt.timezone.utc)
    assert last_monday_utc(sun) == _dt.date(2026, 4, 27)


def test_is_stale_when_last_updated_before_last_monday(tmp_path) -> None:  # type: ignore[no-untyped-def]
    p = tmp_path / "prices.md"
    p.write_text(
        "---\nlast_updated: 2026-04-26\ncurrency: USD\nunit: per_1M_tokens\nsource: shipped-default\n---\n\n"
        "| provider | model | input | output |\n|---|---|---|---|\n"
    )
    table = load_prices(p)
    now = _dt.datetime(2026, 4, 29, 12, 0, tzinfo=_dt.timezone.utc)
    assert is_stale(table, now) is True


def test_is_stale_when_last_updated_on_or_after_last_monday(tmp_path) -> None:  # type: ignore[no-untyped-def]
    p = tmp_path / "prices.md"
    p.write_text(
        "---\nlast_updated: 2026-04-27\ncurrency: USD\nunit: per_1M_tokens\nsource: shipped-default\n---\n\n"
        "| provider | model | input | output |\n|---|---|---|---|\n"
    )
    table = load_prices(p)
    now = _dt.datetime(2026, 4, 29, 12, 0, tzinfo=_dt.timezone.utc)
    assert is_stale(table, now) is False


def test_is_stale_with_invalid_date_returns_true(tmp_path) -> None:  # type: ignore[no-untyped-def]
    p = tmp_path / "prices.md"
    p.write_text(
        "---\nlast_updated: not-a-date\ncurrency: USD\nunit: per_1M_tokens\nsource: shipped-default\n---\n\n"
    )
    table = load_prices(p)
    assert is_stale(table) is True
