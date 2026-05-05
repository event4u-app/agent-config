"""Shipped baseline prices for the AI Council.

This file is the bootstrap source for `agents/.agent-prices.md` when
the runtime file is missing. It is also the network-fallback source for
`scripts/update_prices.py` when the upstream feed (LiteLLM) is
unreachable.

Prices are USD per **1 000 000** tokens. Models are identified by the
exact `model:` string the user puts into `.agent-settings.yml`.

Numbers below are a hand-curated snapshot — they will drift. The
runtime never reads them directly once `agents/.agent-prices.md`
exists; the weekly refresh and user edits are the live source of truth.
"""

from __future__ import annotations

# YYYY-MM-DD of when this table was last hand-edited. Keep in sync with
# the test_default_prices freshness assertion if you bump this.
LAST_UPDATED = "2026-04-29"

# (provider, model)  ->  (input_per_1m_usd, output_per_1m_usd)
DEFAULT_PRICES: dict[tuple[str, str], tuple[float, float]] = {
    # ── Anthropic ────────────────────────────────────────────────────
    ("anthropic", "claude-sonnet-4-5"): (3.00, 15.00),
    ("anthropic", "claude-opus-4-1"): (15.00, 75.00),
    ("anthropic", "claude-haiku-4-5"): (1.00, 5.00),
    # ── OpenAI ───────────────────────────────────────────────────────
    ("openai", "gpt-4o"): (2.50, 10.00),
    ("openai", "gpt-4o-mini"): (0.15, 0.60),
    ("openai", "o1"): (15.00, 60.00),
    ("openai", "o3-mini"): (1.10, 4.40),
}


def as_rows() -> list[tuple[str, str, float, float]]:
    """Return the table sorted (provider, model) for stable Markdown output."""
    return [
        (provider, model, prices[0], prices[1])
        for (provider, model), prices in sorted(DEFAULT_PRICES.items())
    ]
