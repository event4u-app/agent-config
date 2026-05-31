#!/usr/bin/env python3
"""Real-tokenizer counting for the budget tooling (roadmap 0B.1).

`char != token`. Every budget in this suite is historically in characters;
the lean-initial-context goal is tokens. This helper adds a token count
*alongside* chars so chars stay the cheap, stdlib-only proxy and tokens
become the truth where a real tokenizer is available.

Design — no silent installs, no mandatory network (per `missing-tool-handling`):

- **GPT** — exact via `tiktoken` (`o200k_base`, the GPT-4o/4.1 encoding) when
  the optional dependency is installed; otherwise a documented `chars / 4`
  proxy flagged `exact=False`. Install `tiktoken` to activate exact counts.
- **Claude** — no offline tokenizer ships in `anthropic` 0.98 (the SDK exposes
  only the live `messages.count_tokens` endpoint, which needs an API call).
  Offline we use a documented `chars / 3.6` proxy flagged `exact=False`; the
  exact API count is reserved for the live-bench boundaries to avoid spend on
  the cheap path.

Both proxies are intentionally conservative ratios drawn from English-prose +
markdown samples; they are estimates, never gates. The char budgets remain the
enforced floor (`measure_rule_budget --kernel-budget-check`).
"""

from __future__ import annotations

from dataclasses import dataclass

# Proxy ratios (chars per token) for the no-tokenizer fallback. Tuned for
# English markdown rule/skill prose; deliberately conservative.
_GPT_CHARS_PER_TOKEN = 4.0
_CLAUDE_CHARS_PER_TOKEN = 3.6

_TIKTOKEN_ENCODING = "o200k_base"  # GPT-4o / GPT-4.1 family.

# Resolve the optional tiktoken encoder once at import.
try:  # pragma: no cover - exercised by env presence, not unit tests
    import tiktoken  # type: ignore

    _ENC = tiktoken.get_encoding(_TIKTOKEN_ENCODING)
except Exception:  # ImportError, or model-data fetch failure offline
    _ENC = None

TIKTOKEN_AVAILABLE = _ENC is not None


@dataclass(frozen=True)
class TokenCount:
    """A single token measurement and whether it is exact or a proxy."""

    tokens: int
    exact: bool


def gpt_tokens(text: str) -> TokenCount:
    """GPT token count — exact via tiktoken when present, else a char proxy."""
    if _ENC is not None:
        return TokenCount(len(_ENC.encode(text)), True)
    return TokenCount(round(len(text) / _GPT_CHARS_PER_TOKEN), False)


def claude_tokens(text: str) -> TokenCount:
    """Claude token count — documented offline proxy (no local tokenizer)."""
    return TokenCount(round(len(text) / _CLAUDE_CHARS_PER_TOKEN), False)


def measure(text: str) -> dict[str, object]:
    """Return chars + per-model token counts for one text blob.

    Keys: chars, tokens_gpt, tokens_gpt_exact, tokens_claude,
    tokens_claude_exact. The `*_exact` booleans tell a report consumer
    whether the number is a real tokenizer count or a proxy estimate.
    """
    g = gpt_tokens(text)
    c = claude_tokens(text)
    return {
        "chars": len(text),
        "tokens_gpt": g.tokens,
        "tokens_gpt_exact": g.exact,
        "tokens_claude": c.tokens,
        "tokens_claude_exact": c.exact,
    }


def method_note() -> str:
    """One-line provenance of how token counts were produced (for reports)."""
    if TIKTOKEN_AVAILABLE:
        return (
            f"tokens_gpt: exact (tiktoken {_TIKTOKEN_ENCODING}); "
            f"tokens_claude: proxy (chars/{_CLAUDE_CHARS_PER_TOKEN})"
        )
    return (
        f"tokens_gpt: proxy (chars/{_GPT_CHARS_PER_TOKEN}, tiktoken not installed); "
        f"tokens_claude: proxy (chars/{_CLAUDE_CHARS_PER_TOKEN})"
    )
