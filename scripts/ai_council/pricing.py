"""Runtime pricing layer for the AI Council.

Reads `agents/.agent-prices.md` from the repo root, parses YAML
frontmatter and the Markdown table, and exposes:

- `load_prices()`           — parse `agents/.agent-prices.md` (bootstraps if missing)
- `estimate_input_tokens()` — chars / 4 heuristic
- `estimate_cost()`         — input + output USD for a single member
- `is_stale()`              — True if `last_updated` is older than the
                              most recent UTC Monday 00:00
- `bootstrap_from_defaults()` — write a fresh `agents/.agent-prices.md`
                              from `_default_prices.DEFAULT_PRICES`

The orchestrator never reads `_default_prices` directly. It always
goes through `load_prices()` so user edits to
`agents/.agent-prices.md` win.
"""

from __future__ import annotations

import datetime as _dt
from dataclasses import dataclass
from pathlib import Path

from scripts.ai_council._default_prices import DEFAULT_PRICES, LAST_UPDATED, as_rows

REPO_ROOT = Path(__file__).resolve().parents[2]
PRICES_FILE = REPO_ROOT / "agents" / ".agent-prices.md"

# Heuristic: 1 token ≈ 4 characters of English text. OpenAI's tiktoken
# is more accurate but pulls in a heavy dep we explicitly avoid.
_CHARS_PER_TOKEN = 4


@dataclass
class Price:
    provider: str
    model: str
    input_per_1m_usd: float
    output_per_1m_usd: float


@dataclass
class PriceTable:
    last_updated: str  # YYYY-MM-DD
    currency: str
    unit: str  # "per_1M_tokens"
    source: str
    prices: dict[tuple[str, str], Price]

    def lookup(self, provider: str, model: str) -> Price | None:
        return self.prices.get((provider, model))


@dataclass
class CostEstimate:
    provider: str
    model: str
    input_tokens: int
    output_tokens: int  # max_tokens budget — worst-case ceiling
    input_usd: float
    output_usd: float

    @property
    def total_usd(self) -> float:
        return self.input_usd + self.output_usd


# ── token + cost arithmetic ────────────────────────────────────────


def estimate_input_tokens(text: str) -> int:
    """chars / 4 heuristic. Always returns ≥ 1 for non-empty strings."""
    if not text:
        return 0
    return max(1, len(text) // _CHARS_PER_TOKEN)


def estimate_cost(
    provider: str,
    model: str,
    input_tokens: int,
    max_output_tokens: int,
    table: PriceTable,
) -> CostEstimate:
    price = table.lookup(provider, model)
    if price is None:
        # Unknown model — return zero-cost estimate; caller decides what
        # to do (warn user, skip, ...). Never silently invent a price.
        return CostEstimate(provider, model, input_tokens, max_output_tokens, 0.0, 0.0)
    input_usd = (input_tokens / 1_000_000) * price.input_per_1m_usd
    output_usd = (max_output_tokens / 1_000_000) * price.output_per_1m_usd
    return CostEstimate(provider, model, input_tokens, max_output_tokens, input_usd, output_usd)


# ── staleness ──────────────────────────────────────────────────────


def last_monday_utc(now: _dt.datetime | None = None) -> _dt.date:
    """Return the most recent Monday 00:00 UTC as a date."""
    now = now or _dt.datetime.now(_dt.timezone.utc)
    weekday = now.weekday()  # Mon=0 ... Sun=6
    return (now - _dt.timedelta(days=weekday)).date()


def is_stale(table: PriceTable, now: _dt.datetime | None = None) -> bool:
    """True if `last_updated` is older than the most recent UTC Monday."""
    try:
        last = _dt.date.fromisoformat(table.last_updated)
    except ValueError:
        return True
    return last < last_monday_utc(now)


# ── parser + bootstrap ─────────────────────────────────────────────


def load_prices(path: Path = PRICES_FILE) -> PriceTable:
    """Parse `agents/.agent-prices.md`; bootstrap from defaults if missing."""
    if not path.exists():
        bootstrap_from_defaults(path)
    return _parse(path.read_text(encoding="utf-8"))


def bootstrap_from_defaults(path: Path = PRICES_FILE) -> None:
    """Write a fresh `agents/.agent-prices.md` from `_default_prices.py`."""
    rows = as_rows()
    body = _render_markdown(LAST_UPDATED, "shipped-default", rows)
    path.write_text(body, encoding="utf-8")


def _render_markdown(
    last_updated: str,
    source: str,
    rows: list[tuple[str, str, float, float]],
) -> str:
    lines = [
        "---",
        f"last_updated: {last_updated}",
        "currency: USD",
        "unit: per_1M_tokens",
        f"source: {source}",
        "---",
        "",
        "# Agent prices",
        "",
        "| provider  | model               | input  | output |",
        "|-----------|---------------------|--------|--------|",
    ]
    for provider, model, inp, outp in rows:
        lines.append(f"| {provider:<9} | {model:<19} | {inp:>6.2f} | {outp:>6.2f} |")
    lines.append("")
    return "\n".join(lines)


def _parse(text: str) -> PriceTable:
    front, body = _split_frontmatter(text)
    meta = _parse_frontmatter(front)
    prices = _parse_table(body)
    return PriceTable(
        last_updated=meta.get("last_updated", "1970-01-01"),
        currency=meta.get("currency", "USD"),
        unit=meta.get("unit", "per_1M_tokens"),
        source=meta.get("source", "unknown"),
        prices=prices,
    )


def _split_frontmatter(text: str) -> tuple[str, str]:
    if not text.startswith("---"):
        return "", text
    parts = text.split("---", 2)
    if len(parts) < 3:
        return "", text
    return parts[1], parts[2]


def _parse_frontmatter(front: str) -> dict[str, str]:
    out: dict[str, str] = {}
    for line in front.splitlines():
        line = line.strip()
        if not line or ":" not in line:
            continue
        k, _, v = line.partition(":")
        out[k.strip()] = v.strip()
    return out


def _parse_table(body: str) -> dict[tuple[str, str], Price]:
    out: dict[tuple[str, str], Price] = {}
    for line in body.splitlines():
        line = line.strip()
        if not line.startswith("|") or line.startswith("|--") or line.startswith("|-"):
            continue
        cells = [c.strip() for c in line.strip("|").split("|")]
        if len(cells) != 4:
            continue
        provider, model, inp, outp = cells
        if provider == "provider":  # header row
            continue
        try:
            out[(provider, model)] = Price(provider, model, float(inp), float(outp))
        except ValueError:
            continue
    return out


__all__ = [
    "Price", "PriceTable", "CostEstimate",
    "PRICES_FILE", "DEFAULT_PRICES",
    "load_prices", "bootstrap_from_defaults",
    "estimate_input_tokens", "estimate_cost",
    "last_monday_utc", "is_stale",
]
